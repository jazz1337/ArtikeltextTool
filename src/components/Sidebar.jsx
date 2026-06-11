import { useRef, useState } from 'react'
import { deleteProject } from '../db'
import { importFile } from '../lib/io'

const THEMES = [
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'solarized', label: 'Solarized' },
  { id: 'contrast', label: 'Kontrast' },
]

export default function Sidebar({ projects, view, setView, theme, setTheme }) {
  const fileRef = useRef()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setErr('')
    try {
      const id = await importFile(file)
      setView({ panel: 'project', projectId: id })
    } catch (ex) {
      setErr(String(ex.message || ex))
    } finally {
      setBusy(false)
    }
  }

  const navItem = (panel, icon, label) => (
    <button
      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
      style={{
        background: view.panel === panel ? 'var(--accent-bg)' : 'transparent',
        color: view.panel === panel ? 'var(--accent)' : 'var(--fg2)',
      }}
      onClick={() => setView((v) => ({ ...v, panel }))}
    >
      {icon} {label}
    </button>
  )

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col border-r overflow-hidden"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <span className="text-lg">🧠</span>
        <div>
          <div className="text-sm font-bold leading-tight">Produkttexte KI</div>
          <div className="text-[10px]" style={{ color: 'var(--fg3)' }}>v3.0 · Webapp</div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
        <button className="btn btn-a w-full" disabled={busy} onClick={() => fileRef.current.click()}>
          {busy ? 'Importiere…' : '+ Datei importieren'}
        </button>
        {err && <div className="text-[10px] mt-1" style={{ color: 'var(--err)' }}>{err}</div>}
      </div>

      <div className="px-3 pb-1">
        <div className="lbl px-1">Projekte</div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {projects.length === 0 && (
          <div className="text-[11px] px-1 py-2" style={{ color: 'var(--fg3)' }}>
            Noch keine Projekte.
          </div>
        )}
        {projects.map((p) => {
          const active = view.panel === 'project' && view.projectId === p.id
          return (
            <div
              key={p.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors"
              style={{
                background: active ? 'var(--accent-bg)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
              }}
              onClick={() => setView({ panel: 'project', projectId: p.id })}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: active ? 'var(--accent)' : 'var(--fg)' }}>
                  {p.name}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--fg3)' }}>
                  {p.rowCount} Zeilen · {p.headers.length} Spalten
                </div>
              </div>
              <button
                className="btn btn-sm btn-d opacity-0 group-hover:opacity-100"
                title="Projekt löschen"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Projekt "${p.name}" inkl. aller Daten löschen?`)) deleteProject(p.id)
                }}
              >✕</button>
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2 space-y-0.5 border-t" style={{ borderColor: 'var(--border)' }}>
        {navItem('templates', '📋', 'Vorlagen')}
        {navItem('rules', '⚖️', 'Regeln')}
        {navItem('settings', '⚙️', 'Einstellungen')}
      </div>

      <div className="px-3 pb-3">
        <div className="flex gap-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className="flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors"
              style={{
                background: theme === t.id ? 'var(--accent-bg)' : 'var(--bg3)',
                color: theme === t.id ? 'var(--accent)' : 'var(--fg3)',
                border: `1px solid ${theme === t.id ? 'var(--accent)' : 'var(--border)'}`,
              }}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
