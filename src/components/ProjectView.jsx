import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, clearDupeCache } from '../db'
import { exportProject } from '../lib/io'
import RunBar from './RunBar'
import RowDetail from './RowDetail'

const PAGE_SIZE = 100

function StatusBadge({ meta, targetCol }) {
  const m = meta?.[targetCol]
  if (!m) return <span className="badge badge-pending">Ausstehend</span>
  if (m.status === 'OK') return <span className="badge badge-ok" title={m.message}>Verarbeitet</span>
  if (m.status === 'SKIPPED') return <span className="badge badge-skip" title={m.message}>Übersprungen</span>
  if (m.status === 'ERROR') return <span className="badge badge-err" title={m.message}>Fehler</span>
  return <span className="badge badge-pending">Ausstehend</span>
}

export default function ProjectView({ project }) {
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [detailRowId, setDetailRowId] = useState(null)
  const [editCell, setEditCell] = useState(null) // {rowId, col}
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all | pending | OK | SKIPPED | ERROR

  const activeTplId = useLiveQuery(() => getSetting('activeTemplateId'), [])
  const activeTpl = useLiveQuery(
    () => (activeTplId ? db.templates.get(activeTplId) : null),
    [activeTplId]
  )
  const targetCol = activeTpl?.targetCol || ''

  const allRows = useLiveQuery(
    () => db.rows.where('projectId').equals(project.id).sortBy('idx'),
    [project.id]
  )

  const filtered = useMemo(() => {
    if (!allRows) return []
    if (filter === 'all' || !targetCol) return allRows
    return allRows.filter((r) => {
      const st = r.meta?.[targetCol]?.status
      if (filter === 'pending') return !st
      return st === filter
    })
  }, [allRows, filter, targetCol])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Spalten: Original + ggf. Zielspalte falls neu
  const headers = useMemo(() => {
    const h = [...project.headers]
    if (targetCol && !h.includes(targetCol)) h.push(targetCol)
    return h
  }, [project.headers, targetCol])

  const detailRow = allRows?.find((r) => r.id === detailRowId) || null

  function toggleSel(id) {
    setSelectedIds((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function togglePageSel() {
    const ids = pageRows.map((r) => r.id)
    const allSel = ids.every((id) => selectedIds.has(id))
    setSelectedIds((s) => {
      const n = new Set(s)
      ids.forEach((id) => (allSel ? n.delete(id) : n.add(id)))
      return n
    })
  }

  async function saveCell(row, col, value) {
    await db.rows.update(row.id, { cells: { ...row.cells, [col]: value } })
    setEditCell(null)
  }

  if (!allRows) return <div className="p-6 text-xs" style={{ color: 'var(--fg3)' }}>Lade Daten…</div>

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <RunBar project={project} selectedIds={selectedIds} onError={setError} />
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--err-bg)', color: 'var(--err)' }}>
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap">
        <h1 className="text-sm font-bold flex-1 truncate">{project.name}</h1>
        {targetCol && (
          <select className="inp !w-44" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}>
            <option value="all">Alle Zeilen</option>
            <option value="pending">Ausstehend</option>
            <option value="OK">Verarbeitet</option>
            <option value="SKIPPED">Übersprungen</option>
            <option value="ERROR">Fehler</option>
          </select>
        )}
        <button className="btn btn-sm" title="Duplikat-Cache dieses Projekts leeren"
          onClick={async () => { await clearDupeCache(project.id); setError('') }}>
          🧹 Cache
        </button>
        <button className="btn btn-a btn-sm" onClick={() => exportProject(project)}>⬇ Export .xlsx</button>
      </div>

      <div className="flex-1 overflow-auto mx-4 mb-2 card">
        <table className="dtable w-full">
          <thead>
            <tr>
              <th className="!min-w-0 w-8">
                <input type="checkbox"
                  checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id))}
                  onChange={togglePageSel} />
              </th>
              <th className="!min-w-0 w-10">#</th>
              {targetCol && <th>Status</th>}
              {headers.map((h) => (
                <th key={h} style={h === targetCol ? { color: 'var(--accent)' } : {}}>
                  {h}{h === targetCol ? ' ◀ Ziel' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="mono">
            {pageRows.map((r) => (
              <tr key={r.id} className={selectedIds.has(r.id) ? 'sel' : ''}>
                <td className="!min-w-0" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSel(r.id)} />
                </td>
                <td className="!min-w-0 cursor-pointer" style={{ color: 'var(--fg3)' }}
                  onClick={() => setDetailRowId(r.id)} title="Vorher/Nachher öffnen">
                  {r.idx + 1}
                </td>
                {targetCol && (
                  <td className="!min-w-0 cursor-pointer" onClick={() => setDetailRowId(r.id)}>
                    <StatusBadge meta={r.meta} targetCol={targetCol} />
                  </td>
                )}
                {headers.map((h) => {
                  const editing = editCell?.rowId === r.id && editCell?.col === h
                  return (
                    <td key={h} className={editing ? 'editing' : ''}
                      onDoubleClick={() => setEditCell({ rowId: r.id, col: h })}
                      title={editing ? '' : String(r.cells[h] ?? '')}>
                      {editing ? (
                        <textarea
                          className="inp mono !text-[11px]"
                          autoFocus
                          rows={3}
                          defaultValue={r.cells[h] ?? ''}
                          onBlur={(e) => saveCell(r, h, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditCell(null)
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveCell(r, h, e.target.value)
                          }}
                        />
                      ) : (
                        r.cells[h] ?? ''
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs" style={{ color: 'var(--fg3)' }}>Keine Zeilen für diesen Filter.</div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 text-[11px]" style={{ color: 'var(--fg2)' }}>
        <span>{filtered.length} Zeilen · Doppelklick = Zelle bearbeiten · Klick auf # = Vorher/Nachher</span>
        <div className="flex-1" />
        <button className="btn btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>←</button>
        <span className="mono">Seite {safePage + 1}/{pageCount}</span>
        <button className="btn btn-sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>→</button>
      </div>

      {detailRow && activeTpl && (
        <RowDetail row={detailRow} template={activeTpl} onClose={() => setDetailRowId(null)} />
      )}
    </div>
  )
}
