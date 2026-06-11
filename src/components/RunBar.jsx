import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, loadApiKey } from '../db'
import { engine } from '../lib/engine'
import { providerForModel } from '../lib/defaults'

export default function RunBar({ project, selectedIds, onError }) {
  const templates = useLiveQuery(() => db.templates.toArray(), []) || []
  const [activeTplId, setActiveTplId] = useState(null)
  const [eng, setEng] = useState({ state: engine.state, progress: engine.progress })

  useEffect(() => {
    getSetting('activeTemplateId').then(setActiveTplId)
    return engine.subscribe(setEng)
  }, [])

  const tpl = templates.find((t) => t.id === activeTplId)
  const running = eng.state === 'running' || eng.state === 'paused' || eng.state === 'aborting'
  const tplReady = tpl && tpl.sourceCols?.length > 0 && tpl.targetCol

  async function start(rowIds) {
    if (!tplReady) {
      onError('Vorlage unvollständig: Quellspalten und Zielspalte in "Vorlagen" konfigurieren.')
      return
    }
    const model = await getSetting('model', 'gpt-4.1-mini')
    const apiKey = await loadApiKey(providerForModel(model))
    if (!apiKey) {
      onError(`Kein API-Key für ${providerForModel(model)} hinterlegt → Einstellungen.`)
      return
    }
    const [textRules, processingRules, starters, delayMs] = await Promise.all([
      getSetting('textRules', []),
      getSetting('processingRules', []),
      getSetting('starters', {}),
      getSetting('apiDelayMs', 1000),
    ])
    onError('')
    try {
      await engine.run({
        projectId: project.id,
        template: tpl,
        textRules, processingRules, starters,
        model, apiKey, delayMs,
        rowIds,
      })
      await db.projects.update(project.id, { updatedAt: Date.now() })
    } catch (e) {
      onError(String(e.message || e))
    }
  }

  const p = eng.progress
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0

  return (
    <div className="card mx-4 mt-4 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="lbl !mb-0">Vorlage</span>
          <select
            className="inp !w-52"
            value={activeTplId || ''}
            disabled={running}
            onChange={(e) => { setActiveTplId(e.target.value); setSetting('activeTemplateId', e.target.value) }}
          >
            <option value="">— wählen —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {tpl && (
          <span className="text-[10px] mono" style={{ color: tplReady ? 'var(--fg3)' : 'var(--warn)' }}>
            {tpl.sourceCols?.length ? tpl.sourceCols.join(', ') : '⚠ keine Quellspalten'} → {tpl.targetCol || '⚠ keine Zielspalte'}
          </span>
        )}
        <div className="flex-1" />

        {!running && (
          <>
            <button className="btn" disabled={!selectedIds.size} onClick={() => start([...selectedIds])}>
              ⚡ Auswahl ({selectedIds.size})
            </button>
            <button className="btn btn-a" onClick={() => start(null)}>▶ Batch starten</button>
          </>
        )}
        {running && (
          <>
            {eng.state === 'running' && <button className="btn" onClick={() => engine.pause()}>⏸ Pause</button>}
            {eng.state === 'paused' && <button className="btn btn-a" onClick={() => engine.resume()}>▶ Fortsetzen</button>}
            <button className="btn btn-d" onClick={() => engine.abort()}>⏹ Abbrechen</button>
          </>
        )}
      </div>

      {(running || p.done > 0) && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-[11px] mono" style={{ color: 'var(--fg2)' }}>
            <span className={running ? 'running font-bold' : 'font-bold'} style={{ color: 'var(--accent)' }}>
              {eng.state === 'paused' ? '⏸ Pausiert' : eng.state === 'aborting' ? 'Breche ab…' : running ? `${p.status}` : p.status}
            </span>
            <span>{p.done}/{p.total}</span>
            <span style={{ color: 'var(--ok)' }}>OK {p.ok}</span>
            <span style={{ color: 'var(--warn)' }}>Skip {p.skip}</span>
            {p.fixed > 0 && <span>Fix {p.fixed}</span>}
            {p.dupe > 0 && <span>Dup {p.dupe}</span>}
            <span style={{ color: 'var(--err)' }}>Err {p.err}</span>
            <span className="ml-auto">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: pct + '%', background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
