import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../db'
import { PROC_RULE_KINDS } from '../lib/defaults'

export default function RulesPanel() {
  const [textRules, setTextRules] = useState(null)
  const [procRules, setProcRules] = useState(null)
  const [starters, setStarters] = useState(null)
  const [editProc, setEditProc] = useState(null) // Regel-Draft fürs Modal
  const [msg, setMsg] = useState('')

  useEffect(() => {
    Promise.all([
      getSetting('textRules', []),
      getSetting('processingRules', []),
      getSetting('starters', { enabled: false, count: 3, text: '' }),
    ]).then(([t, p, s]) => { setTextRules(t); setProcRules(p); setStarters(s) })
  }, [])

  async function saveAll(t = textRules, p = procRules, s = starters) {
    await Promise.all([
      setSetting('textRules', t),
      setSetting('processingRules', p),
      setSetting('starters', s),
    ])
    setMsg('Gespeichert.')
    setTimeout(() => setMsg(''), 2000)
  }

  if (!textRules || !procRules || !starters) return null

  const updTR = (id, patch) => {
    const next = textRules.map((r) => (r.id === id ? { ...r, ...patch } : r))
    setTextRules(next)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold flex-1">Regeln</h1>
        {msg && <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>{msg}</span>}
        <button className="btn btn-a btn-sm" onClick={() => saveAll()}>💾 Speichern</button>
      </div>

      {/* ── Bearbeitungsregeln ── */}
      <section className="card p-4">
        <div className="flex items-center mb-1">
          <h2 className="text-xs font-bold flex-1">Bearbeitungsregeln (global, nur Batch)</h2>
          <button className="btn btn-sm"
            onClick={() => setEditProc({ id: 'pr_' + Date.now(), kind: 'fixed_output', name: 'Neue Regel', enabled: true, config: {}, _new: true })}>
            + Neu
          </button>
        </div>
        <p className="text-[10px] mb-2" style={{ color: 'var(--fg3)' }}>
          Laufen vor jedem API-Call. Einzelzeilen-Verarbeitung ignoriert diese Regeln.
          Spalten-Referenz: Header-Name oder <span className="mono">_target_</span> für die Zielspalte.
          Variablen in Wert/Output: <span className="mono">[Artikelname]</span> etc.
        </p>
        <div className="space-y-1">
          {procRules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold flex-1 truncate">
                {r.name}
                <span className="text-[10px] font-normal ml-2" style={{ color: 'var(--fg3)' }}>
                  {PROC_RULE_KINDS.find((k) => k.kind === r.kind)?.label}
                </span>
              </span>
              {r.config?.value && <span className="badge badge-run mono">{String(r.config.value).substring(0, 24)}</span>}
              <button className="btn btn-sm" onClick={() => setEditProc(JSON.parse(JSON.stringify(r)))}>✎</button>
              <button className="btn btn-d btn-sm" onClick={() => setProcRules(procRules.filter((x) => x.id !== r.id))}>✕</button>
              <label className="tg">
                <input type="checkbox" checked={r.enabled}
                  onChange={(e) => setProcRules(procRules.map((x) => x.id === r.id ? { ...x, enabled: e.target.checked } : x))} />
                <span className="s" />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* ── Textregeln (globale Defaults) ── */}
      <section className="card p-4">
        <div className="flex items-center mb-1">
          <h2 className="text-xs font-bold flex-1">Textregeln (globale Standardwerte)</h2>
          <button className="btn btn-sm"
            onClick={() => setTextRules([...textRules, { id: 'c_' + Date.now(), kind: 'custom', name: 'Neue Regel', enabled: false, value: '', custom: true, options: [] }])}>
            + Eigene Regel
          </button>
        </div>
        <p className="text-[10px] mb-2" style={{ color: 'var(--fg3)' }}>
          Standardwerte für alle Vorlagen. Pro Vorlage überschreibbar (Tab „Vorlagen").
        </p>
        <div className="space-y-1">
          {textRules.filter((r) => r.kind !== 'starters').map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              {r.custom ? (
                <input className="inp !w-36 !py-1 font-semibold !text-xs flex-shrink-0" value={r.name}
                  onChange={(e) => updTR(r.id, { name: e.target.value })} />
              ) : (
                <span className="text-xs font-semibold w-36 flex-shrink-0">{r.name}</span>
              )}
              <input className="inp flex-1 !py-1 mono !text-[11px]" value={r.value}
                onChange={(e) => updTR(r.id, { value: e.target.value })} />
              {r.custom && <button className="btn btn-d btn-sm" onClick={() => setTextRules(textRules.filter((x) => x.id !== r.id))}>✕</button>}
              <label className="tg">
                <input type="checkbox" checked={r.enabled} onChange={(e) => updTR(r.id, { enabled: e.target.checked })} />
                <span className="s" />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* ── Satzanfänge ── */}
      <section className="card p-4">
        <div className="flex items-center mb-2">
          <h2 className="text-xs font-bold flex-1">Satzanfänge</h2>
          <label className="tg">
            <input type="checkbox" checked={starters.enabled}
              onChange={(e) => setStarters({ ...starters, enabled: e.target.checked })} />
            <span className="s" />
          </label>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <span className="lbl">Ein Satzanfang pro Zeile</span>
            <textarea className="inp mono" rows={6} value={starters.text}
              onChange={(e) => setStarters({ ...starters, text: e.target.value })} />
          </div>
          <div className="w-32">
            <span className="lbl">Anzahl im Prompt</span>
            <input className="inp" type="number" min={1} max={20} value={starters.count}
              onChange={(e) => setStarters({ ...starters, count: Number(e.target.value) || 3 })} />
          </div>
        </div>
      </section>

      {/* ── Modal: Bearbeitungsregel ── */}
      {editProc && (
        <ProcRuleModal
          rule={editProc}
          onClose={() => setEditProc(null)}
          onSave={(r) => {
            const exists = procRules.find((x) => x.id === r.id)
            delete r._new
            setProcRules(exists ? procRules.map((x) => (x.id === r.id ? r : x)) : [...procRules, r])
            setEditProc(null)
          }}
        />
      )}
    </div>
  )
}

function ProcRuleModal({ rule, onClose, onSave }) {
  const [d, setD] = useState(rule)
  const cfg = (k, v) => setD({ ...d, config: { ...d.config, [k]: v } })
  const needsCond = ['fixed_output', 'skip_if_value', 'only_if_value'].includes(d.kind)

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-3">{d._new ? 'Neue Bearbeitungsregel' : 'Regel bearbeiten'}</h3>
        <span className="lbl">Name</span>
        <input className="inp mb-2" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <span className="lbl">Typ</span>
        <select className="inp mb-2" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value, config: {} })}>
          {PROC_RULE_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>

        {needsCond && (
          <>
            <span className="lbl">Prüf-Spalte (Header-Name oder _target_)</span>
            <input className="inp mono mb-2" value={d.config.checkCol ?? '_target_'} onChange={(e) => cfg('checkCol', e.target.value)} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <span className="lbl">Bedingung</span>
                <select className="inp" value={d.config.condition || 'equals'} onChange={(e) => cfg('condition', e.target.value)}>
                  <option value="equals">ist gleich</option>
                  <option value="contains">enthält</option>
                  <option value="starts_with">beginnt mit</option>
                </select>
              </div>
              <div>
                <span className="lbl">Wert (leer = prüft ob leer)</span>
                <input className="inp mono" value={d.config.value || ''} onChange={(e) => cfg('value', e.target.value)} />
              </div>
            </div>
            {d.kind === 'fixed_output' && (
              <>
                <span className="lbl">Fester Output — Variablen: [Spaltenname]</span>
                <textarea className="inp mono mb-2" rows={4} value={d.config.output || ''} onChange={(e) => cfg('output', e.target.value)} />
              </>
            )}
          </>
        )}
        {d.kind === 'only_if_empty' && (
          <>
            <span className="lbl">Prüf-Spalte (Header-Name oder _target_)</span>
            <input className="inp mono mb-2" value={d.config.checkCol ?? '_target_'} onChange={(e) => cfg('checkCol', e.target.value)} />
          </>
        )}
        {d.kind === 'skip_if_short' && (
          <>
            <span className="lbl">Mindestzeichen (Summe aller Quellzellen)</span>
            <input className="inp !w-28 mb-2" type="number" value={d.config.minChars ?? 10} onChange={(e) => cfg('minChars', Number(e.target.value) || 10)} />
          </>
        )}
        {d.kind === 'reuse_duplicates' && (
          <>
            <span className="lbl">Schlüssel-Spalte (Header-Name)</span>
            <input className="inp mono mb-2" value={d.config.keyCol ?? 'artikelname'} onChange={(e) => cfg('keyCol', e.target.value)} />
          </>
        )}
        {d.kind === 'skip_if_filled' && (
          <p className="text-[11px] mb-2" style={{ color: 'var(--fg3)' }}>
            Überspringt Zeilen, deren Zielspalte bereits einen Wert hat (≠ Artikelname).
          </p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-a" onClick={() => onSave(d)}>Übernehmen</button>
        </div>
      </div>
    </div>
  )
}
