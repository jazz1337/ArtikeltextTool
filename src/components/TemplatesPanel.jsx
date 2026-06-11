import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db'
import { exportTemplatesJson, importTemplatesJson } from '../lib/io'

const DEFAULT_IDS = ['tpl_produktdetails', 'tpl_beschreibung', 'tpl_kurzbeschreibung']

export default function TemplatesPanel({ project }) {
  const templates = useLiveQuery(() => db.templates.toArray(), []) || []
  const textRules = useLiveQuery(() => getSetting('textRules', []), []) || []
  const starters = useLiveQuery(() => getSetting('starters', {}), []) || {}
  const activeTplId = useLiveQuery(() => getSetting('activeTemplateId'), [])
  const [selId, setSelId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const importRef = useRef()

  const sel = templates.find((t) => t.id === selId)
  useEffect(() => { if (sel) setDraft(JSON.parse(JSON.stringify(sel))) }, [selId, sel?.id]) // eslint-disable-line

  const headers = project?.headers || []

  async function save() {
    if (!draft) return
    await db.templates.put(draft)
    setMsg(`"${draft.name}" gespeichert.`)
    setTimeout(() => setMsg(''), 2500)
  }

  async function addTpl() {
    const t = { id: 'tpl_' + Date.now(), name: 'Neue Vorlage', sourceCols: [], targetCol: '', prompt: '', ruleOverrides: {} }
    await db.templates.put(t)
    setSelId(t.id)
  }

  async function delTpl() {
    if (!sel || DEFAULT_IDS.includes(sel.id)) return
    if (!confirm(`Vorlage "${sel.name}" löschen?`)) return
    await db.templates.delete(sel.id)
    setSelId(null); setDraft(null)
  }

  function effRule(r) {
    const o = draft?.ruleOverrides?.[r.id]
    return {
      enabled: o?.enabled !== undefined ? !!o.enabled : r.enabled,
      value: o?.value !== undefined ? o.value : (r.value || ''),
    }
  }

  function setOverride(ruleId, key, val) {
    setDraft((d) => ({
      ...d,
      ruleOverrides: { ...d.ruleOverrides, [ruleId]: { ...(d.ruleOverrides?.[ruleId] || {}), [key]: val } },
    }))
  }

  function toggleSourceCol(h) {
    setDraft((d) => {
      const cols = d.sourceCols.includes(h) ? d.sourceCols.filter((c) => c !== h) : [...d.sourceCols, h]
      return { ...d, sourceCols: cols }
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h1 className="text-sm font-bold flex-1">Vorlagen</h1>
        {msg && <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>{msg}</span>}
        <input ref={importRef} type="file" accept=".json" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            try { const n = await importTemplatesJson(f); setMsg(`${n} Vorlage(n) importiert.`) }
            catch (ex) { setMsg('Import fehlgeschlagen: ' + ex.message) }
          }} />
        <button className="btn btn-sm" onClick={() => importRef.current.click()}>⬆ JSON-Import</button>
        <button className="btn btn-sm" onClick={() => exportTemplatesJson(templates)}>⬇ JSON-Export</button>
        <button className="btn btn-a btn-sm" onClick={addTpl}>+ Neue Vorlage</button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-4 items-start">
        {/* Liste */}
        <div className="card p-2 space-y-1">
          {templates.map((t) => (
            <div key={t.id}
              className="px-2 py-2 rounded-lg cursor-pointer flex items-center gap-2"
              style={{
                background: t.id === selId ? 'var(--accent-bg)' : 'transparent',
                border: `1px solid ${t.id === selId ? 'var(--accent)' : 'transparent'}`,
              }}
              onClick={() => setSelId(t.id)}>
              {t.id === activeTplId && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--ok)' }} title="Aktive Vorlage" />}
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{t.name}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--fg3)' }}>
                  {(t.sourceCols?.length ? t.sourceCols.join(', ') : '—')} → {t.targetCol || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        {draft ? (
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input className="inp font-bold !text-sm" value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <button className="btn btn-sm" onClick={() => setSetting('activeTemplateId', draft.id)}>
                {draft.id === activeTplId ? '✓ Aktiv' : 'Aktivieren'}
              </button>
              {!DEFAULT_IDS.includes(draft.id) && <button className="btn btn-d btn-sm" onClick={delTpl}>✕</button>}
            </div>

            <div>
              <span className="lbl">Quellspalten {project ? `(aus "${project.name}")` : '(kein Projekt offen)'}</span>
              {headers.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {headers.map((h) => (
                    <button key={h}
                      className="px-2 py-1 rounded-full text-[11px] font-semibold transition-colors"
                      style={{
                        background: draft.sourceCols.includes(h) ? 'var(--accent-bg)' : 'var(--bg3)',
                        color: draft.sourceCols.includes(h) ? 'var(--accent)' : 'var(--fg2)',
                        border: `1px solid ${draft.sourceCols.includes(h) ? 'var(--accent)' : 'var(--border2)'}`,
                      }}
                      onClick={() => toggleSourceCol(h)}>
                      {h}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[11px]" style={{ color: 'var(--fg3)' }}>
                  Öffne zuerst ein Projekt, um Spalten auszuwählen — oder tippe sie unten manuell ein.
                </div>
              )}
              <input className="inp mono mt-2" placeholder="Manuell: Spalte1, Spalte2, …"
                value={draft.sourceCols.join(', ')}
                onChange={(e) => setDraft({ ...draft, sourceCols: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="lbl">Zielspalte (bestehend oder neu)</span>
                <input className="inp mono" list="target-cols" value={draft.targetCol}
                  onChange={(e) => setDraft({ ...draft, targetCol: e.target.value })}
                  placeholder="z.B. Beschreibung" />
                <datalist id="target-cols">
                  {headers.map((h) => <option key={h} value={h} />)}
                </datalist>
              </div>
            </div>

            <div>
              <span className="lbl">Prompt (Arbeitsauftrag)</span>
              <textarea className="inp mono" rows={8} value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                placeholder="Arbeitsauftrag an das Modell…" />
            </div>

            <div>
              <span className="lbl">Textregeln (Overrides für diese Vorlage)</span>
              <div className="space-y-1">
                {textRules.map((r) => {
                  const eff = effRule(r)
                  return (
                    <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <span className="text-xs font-semibold w-40 flex-shrink-0">
                        {r.name}{r.custom && <span className="badge badge-skip ml-1 !text-[8px]">EIGEN</span>}
                      </span>
                      {r.kind === 'starters' ? (
                        <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--fg3)' }}>
                          {starters.enabled ? `${starters.count} zufällige Satzanfänge (global, Tab "Regeln")` : 'global deaktiviert (Tab "Regeln")'}
                        </span>
                      ) : r.options?.length ? (
                        <select className="inp flex-1 !py-1" value={eff.value}
                          onChange={(e) => setOverride(r.id, 'value', e.target.value)}>
                          {!r.options.find((o) => o.value === eff.value) && <option value={eff.value}>{eff.value || '—'}</option>}
                          {r.options.map((o) => <option key={o.name} value={o.value}>{o.name}</option>)}
                        </select>
                      ) : (
                        <input className="inp flex-1 !py-1 mono !text-[11px]" value={eff.value}
                          onChange={(e) => setOverride(r.id, 'value', e.target.value)} />
                      )}
                      <label className="tg">
                        <input type="checkbox" checked={eff.enabled}
                          onChange={(e) => setOverride(r.id, 'enabled', e.target.checked)} />
                        <span className="s" />
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-a" onClick={save}>💾 Vorlage speichern</button>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-xs" style={{ color: 'var(--fg3)' }}>
            Vorlage links auswählen oder neue anlegen.
          </div>
        )}
      </div>
    </div>
  )
}
