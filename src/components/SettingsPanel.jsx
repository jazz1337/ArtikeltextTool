import { useEffect, useState } from 'react'
import { getSetting, setSetting, saveApiKey, loadApiKey } from '../db'
import { MODELS } from '../lib/defaults'

export default function SettingsPanel() {
  const [model, setModel] = useState('gpt-4.1-mini')
  const [customModel, setCustomModel] = useState('')
  const [delay, setDelay] = useState(1000)
  const [oaKey, setOaKey] = useState('')
  const [anKey, setAnKey] = useState('')
  const [oaSet, setOaSet] = useState(false)
  const [anSet, setAnSet] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getSetting('model', 'gpt-4.1-mini').then((m) => {
      setModel(m)
      if (!MODELS.find((x) => x.id === m)) setCustomModel(m)
    })
    getSetting('apiDelayMs', 1000).then(setDelay)
    loadApiKey('openai').then((k) => setOaSet(!!k))
    loadApiKey('anthropic').then((k) => setAnSet(!!k))
  }, [])

  async function save() {
    const m = customModel.trim() || model
    await setSetting('model', m)
    await setSetting('apiDelayMs', Number(delay) || 0)
    if (oaKey.trim()) { await saveApiKey('openai', oaKey.trim()); setOaSet(true); setOaKey('') }
    if (anKey.trim()) { await saveApiKey('anthropic', anKey.trim()); setAnSet(true); setAnKey('') }
    setMsg('Gespeichert.')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold flex-1">Einstellungen</h1>
        {msg && <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>{msg}</span>}
        <button className="btn btn-a btn-sm" onClick={save}>💾 Speichern</button>
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="text-xs font-bold">API-Keys</h2>
        <div>
          <span className="lbl">OpenAI {oaSet && <span style={{ color: 'var(--ok)' }}>· hinterlegt ✓</span>}</span>
          <div className="flex gap-2">
            <input className="inp mono" type="password" placeholder={oaSet ? '••••••••  (neu eingeben zum Ersetzen)' : 'sk-…'}
              value={oaKey} onChange={(e) => setOaKey(e.target.value)} />
            {oaSet && <button className="btn btn-d btn-sm" onClick={async () => { await saveApiKey('openai', ''); setOaSet(false) }}>Löschen</button>}
          </div>
        </div>
        <div>
          <span className="lbl">Anthropic {anSet && <span style={{ color: 'var(--ok)' }}>· hinterlegt ✓</span>}</span>
          <div className="flex gap-2">
            <input className="inp mono" type="password" placeholder={anSet ? '••••••••  (neu eingeben zum Ersetzen)' : 'sk-ant-…'}
              value={anKey} onChange={(e) => setAnKey(e.target.value)} />
            {anSet && <button className="btn btn-d btn-sm" onClick={async () => { await saveApiKey('anthropic', ''); setAnSet(false) }}>Löschen</button>}
          </div>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--fg3)' }}>
          Keys werden AES-GCM-verschlüsselt in IndexedDB gespeichert (Schlüssel non-extractable) und ausschließlich
          direkt an api.openai.com bzw. api.anthropic.com gesendet.
        </p>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-xs font-bold">Modell & Rate-Limiting</h2>
        <div>
          <span className="lbl">Modell</span>
          <select className="inp" value={MODELS.find((m) => m.id === model) ? model : '_custom_'}
            onChange={(e) => { if (e.target.value !== '_custom_') { setModel(e.target.value); setCustomModel('') } }}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.id} ({m.provider})</option>)}
            <option value="_custom_">Eigenes Modell…</option>
          </select>
          <input className="inp mono mt-2" placeholder="Eigene Modell-ID, z.B. gpt-4.1 — überschreibt die Auswahl oben"
            value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
          <p className="text-[10px] mt-1" style={{ color: 'var(--fg3)' }}>
            Provider wird automatisch erkannt: IDs mit „claude" → Anthropic, sonst OpenAI.
          </p>
        </div>
        <div>
          <span className="lbl">Delay zwischen API-Calls (ms)</span>
          <input className="inp !w-32" type="number" min={0} step={100} value={delay}
            onChange={(e) => setDelay(e.target.value)} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-xs font-bold mb-1">Datenspeicherung</h2>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fg2)' }}>
          Alle Daten liegen ausschließlich in der IndexedDB dieses Browsers. Kein Server, kein Sync, kein Backup.
          Browserdaten löschen entfernt alle Projekte unwiderruflich — exportiere fertige Tabellen rechtzeitig als .xlsx.
        </p>
      </section>
    </div>
  )
}
