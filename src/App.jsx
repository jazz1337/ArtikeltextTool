import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from './db'
import Sidebar from './components/Sidebar'
import ProjectView from './components/ProjectView'
import TemplatesPanel from './components/TemplatesPanel'
import RulesPanel from './components/RulesPanel'
import SettingsPanel from './components/SettingsPanel'

export default function App() {
  const [view, setView] = useState({ panel: 'project', projectId: null })
  const [theme, setThemeState] = useState('light')
  const [showFirstRun, setShowFirstRun] = useState(false)

  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []) || []

  useEffect(() => {
    getSetting('theme', 'light').then((t) => {
      setThemeState(t)
      document.documentElement.dataset.theme = t
    })
    getSetting('firstRunDone').then((d) => { if (!d) setShowFirstRun(true) })
  }, [])

  const setTheme = (t) => {
    setThemeState(t)
    document.documentElement.dataset.theme = t
    setSetting('theme', t)
  }

  // Wenn aktuelles Projekt gelöscht wurde → auf erstes verfügbares wechseln
  useEffect(() => {
    if (view.panel === 'project' && view.projectId && projects.length && !projects.find((p) => p.id === view.projectId)) {
      setView({ panel: 'project', projectId: projects[0]?.id ?? null })
    }
  }, [projects, view])

  const activeProject = projects.find((p) => p.id === view.projectId) || null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects}
        view={view}
        setView={setView}
        theme={theme}
        setTheme={setTheme}
      />
      <main className="flex-1 overflow-hidden flex flex-col">
        {view.panel === 'project' && (
          activeProject
            ? <ProjectView key={activeProject.id} project={activeProject} />
            : <EmptyState />
        )}
        {view.panel === 'templates' && <TemplatesPanel project={activeProject} />}
        {view.panel === 'rules' && <RulesPanel />}
        {view.panel === 'settings' && <SettingsPanel />}
      </main>

      {showFirstRun && (
        <div className="modal-bg">
          <div className="modal" style={{ width: 'min(480px,100%)' }}>
            <h2 className="text-base font-bold mb-2">🧠 Produkttexte KI</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--fg2)' }}>
              <b>Wichtig:</b> Alle Daten — Projekte, Vorlagen, API-Key — werden ausschließlich
              lokal in deinem Browser gespeichert (IndexedDB). Es gibt keinen Server und kein Backup.
            </p>
            <ul className="text-xs leading-relaxed mb-4 list-disc pl-4" style={{ color: 'var(--fg2)' }}>
              <li>Browserdaten löschen = alle Projekte weg. Exportiere fertige Tabellen als .xlsx.</li>
              <li>Anderer Browser / anderes Gerät = leere App.</li>
              <li>Dein API-Key wird verschlüsselt gespeichert und nur direkt an OpenAI/Anthropic gesendet.</li>
            </ul>
            <button
              className="btn btn-a w-full"
              onClick={() => { setSetting('firstRunDone', true); setShowFirstRun(false) }}
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center" style={{ color: 'var(--fg3)' }}>
        <div className="text-3xl mb-2">📄</div>
        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--fg2)' }}>Kein Projekt ausgewählt</div>
        <div className="text-xs">Lade links eine .xlsx- oder .csv-Datei hoch, um zu starten.</div>
      </div>
    </div>
  )
}
