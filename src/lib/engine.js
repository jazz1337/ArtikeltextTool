import { db } from '../db'
import { callAI } from './ai'
import { buildSystemPrompt, buildUserPrompt, evalProcRules, isBadResponse } from './prompts'

const ROW_RETRIES = 2
const RETRY_BASE_MS = 3000

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')) }, { once: true })
  })

/**
 * Engine als State-Machine: idle → running ⇄ paused → done/aborted
 * Ergebnisse werden pro Zeile sofort in IndexedDB geschrieben (Live-Ansicht via useLiveQuery).
 */
export class ProcessingEngine {
  constructor() {
    this.state = 'idle'
    this.abortController = null
    this._pauseGate = null
    this._listeners = new Set()
    this.progress = { total: 0, done: 0, ok: 0, skip: 0, err: 0, fixed: 0, dupe: 0, currentRow: null, status: '' }
  }

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn) }
  _emit() { for (const fn of this._listeners) fn({ state: this.state, progress: { ...this.progress } }) }
  _setStatus(s) { this.progress.status = s; this._emit() }

  pause() {
    if (this.state !== 'running') return
    this.state = 'paused'
    this._emit()
  }

  resume() {
    if (this.state !== 'paused') return
    this.state = 'running'
    const gate = this._pauseGate
    this._pauseGate = null
    gate?.()
    this._emit()
  }

  abort() {
    if (this.state !== 'running' && this.state !== 'paused') return
    this.state = 'aborting'
    const gate = this._pauseGate
    this._pauseGate = null
    gate?.()
    this.abortController?.abort()
    this._emit()
  }

  async _waitIfPaused() {
    while (this.state === 'paused') {
      await new Promise((resolve) => { this._pauseGate = resolve })
    }
    if (this.state === 'aborting') throw new DOMException('aborted', 'AbortError')
  }

  /**
   * @param {object} opts
   *  projectId, template, textRules, processingRules, starters,
   *  model, apiKey, delayMs,
   *  rowIds (optional → Einzelzeilen-Modus, ignoriert Bearbeitungsregeln),
   */
  async run(opts) {
    if (this.state === 'running' || this.state === 'paused') throw new Error('Engine läuft bereits')
    const { projectId, template, textRules, processingRules, starters, model, apiKey, delayMs, rowIds } = opts
    const manual = Array.isArray(rowIds) && rowIds.length > 0

    this.state = 'running'
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    const system = buildSystemPrompt(textRules, starters, template)
    const targetCol = template.targetCol

    // Zeilen laden
    let rows
    if (manual) {
      rows = (await db.rows.bulkGet(rowIds)).filter(Boolean)
    } else {
      rows = await db.rows.where('projectId').equals(projectId).sortBy('idx')
    }

    // Duplikat-Regel
    const dupeRule = manual ? null : (processingRules || []).find((r) => r.kind === 'reuse_duplicates' && r.enabled)
    const dupeKeyCol = dupeRule?.config?.keyCol || 'artikelname'

    // Persistenter Dupe-Cache laden
    const dupeMem = new Map()
    if (dupeRule) {
      const cached = await db.dupeCache
        .where('[projectId+templateId+key]')
        .between([projectId, template.id, ''], [projectId, template.id, '\uffff'])
        .toArray()
      for (const c of cached) dupeMem.set(c.key, c.value)
    }

    this.progress = { total: rows.length, done: 0, ok: 0, skip: 0, err: 0, fixed: 0, dupe: 0, currentRow: null, status: 'Start...' }
    this._emit()

    const writeMeta = async (row, patch) => {
      const meta = { ...(row.meta || {}) }
      meta[targetCol] = { ...(meta[targetCol] || {}), ...patch, ts: Date.now(), model }
      const update = { meta }
      if (patch.value !== undefined) {
        update.cells = { ...row.cells, [targetCol]: patch.value }
        row.cells = update.cells
      }
      row.meta = meta
      await db.rows.update(row.id, update)
    }

    const dupeKeyOf = (row) => {
      const entry = Object.entries(row.cells).find(([h]) => h.trim().toLowerCase() === dupeKeyCol.trim().toLowerCase())
      return entry ? String(entry[1] || '').trim() : ''
    }

    try {
      for (const row of rows) {
        await this._waitIfPaused()
        this.progress.currentRow = row.idx + 1
        this._setStatus(`Zeile ${row.idx + 1}`)

        const currentOutput = row.cells[targetCol]

        // Bearbeitungsregeln nur im Batch-Modus (wie im Original)
        if (!manual) {
          const ev = evalProcRules(processingRules, row.cells, targetCol, currentOutput)
          if (ev.action === 'skip') {
            await writeMeta(row, { status: 'SKIPPED', message: ev.reason })
            this.progress.skip++; this.progress.done++; this._emit(); continue
          }
          if (ev.action === 'fixed') {
            await writeMeta(row, { status: 'OK', message: ev.reason, value: ev.output })
            this.progress.fixed++; this.progress.done++; this._emit(); continue
          }
          // Duplikat-Cache
          if (dupeRule) {
            const dk = dupeKeyOf(row)
            if (dk && dupeMem.has(dk)) {
              await writeMeta(row, { status: 'OK', message: 'duplicate', value: dupeMem.get(dk) })
              this.progress.dupe++; this.progress.done++; this._emit(); continue
            }
          }
        }

        const user = buildUserPrompt(template, row.cells)
        if (!user || user.trim().length < 10) {
          await writeMeta(row, { status: 'SKIPPED', message: 'no_data' })
          this.progress.skip++; this.progress.done++; this._emit(); continue
        }

        // Zeile verarbeiten mit Row-Retries (Bad-Response-Erkennung)
        let lastErr = ''
        let success = false
        for (let attempt = 1; attempt <= ROW_RETRIES + 1; attempt++) {
          await this._waitIfPaused()
          try {
            const raw = await callAI({
              model, system, user, apiKey, signal, delayMs,
              onStatus: (s) => this._setStatus(`Zeile ${row.idx + 1}: ${s}`),
            })
            const res = String(raw || '').trim()
            if (!res) throw new Error('empty_output')
            if (isBadResponse(res)) throw new Error('bad_output: ' + res.substring(0, 60))
            await writeMeta(row, { status: 'OK', message: attempt > 1 ? `retry_${attempt}` : '', value: res })
            if (dupeRule) {
              const dk = dupeKeyOf(row)
              if (dk && !dupeMem.has(dk)) {
                dupeMem.set(dk, res)
                await db.dupeCache.put({ projectId, templateId: template.id, key: dk, value: res })
              }
            }
            success = true
            break
          } catch (e) {
            if (e.name === 'AbortError') throw e
            lastErr = String(e.message || e)
            if (attempt <= ROW_RETRIES) {
              this._setStatus(`Zeile ${row.idx + 1}: Retry ${attempt + 1} in ${(RETRY_BASE_MS * attempt) / 1000}s`)
              await sleep(RETRY_BASE_MS * attempt, signal)
            }
          }
        }

        if (success) this.progress.ok++
        else {
          await writeMeta(row, { status: 'ERROR', message: lastErr.substring(0, 300) })
          this.progress.err++
        }
        this.progress.done++
        this._emit()
      }
      this.state = 'idle'
      this._setStatus('Fertig')
    } catch (e) {
      this.state = 'idle'
      if (e.name === 'AbortError') this._setStatus('Abgebrochen')
      else { this._setStatus('Fehler: ' + (e.message || e)); throw e }
    } finally {
      this.abortController = null
      this._emit()
    }
    return { ...this.progress }
  }
}

export const engine = new ProcessingEngine()
