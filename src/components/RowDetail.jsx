import { useEffect, useState } from 'react'
import { db } from '../db'

export default function RowDetail({ row, template, onClose }) {
  const targetCol = template.targetCol
  const meta = row.meta?.[targetCol]
  const [output, setOutput] = useState(row.cells[targetCol] ?? '')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setOutput(row.cells[targetCol] ?? '')
    setDirty(false)
  }, [row.id, row.cells, targetCol])

  async function save() {
    await db.rows.update(row.id, {
      cells: { ...row.cells, [targetCol]: output },
      meta: { ...row.meta, [targetCol]: { ...(meta || {}), status: meta?.status || 'OK', message: 'manuell bearbeitet', ts: Date.now() } },
    })
    setDirty(false)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal !w-[min(900px,95vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold flex-1">Zeile {row.idx + 1} — Vorher / Nachher</h2>
          {meta?.status && (
            <span className={`badge ${meta.status === 'OK' ? 'badge-ok' : meta.status === 'ERROR' ? 'badge-err' : 'badge-skip'}`}>
              {meta.status}{meta.message ? ` · ${meta.message.substring(0, 60)}` : ''}
            </span>
          )}
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="lbl">Quelldaten ({template.sourceCols?.join(', ') || '—'})</div>
            <div className="card p-3 space-y-2 max-h-[55vh] overflow-y-auto mono text-[11px]">
              {(template.sourceCols || []).map((c) => (
                <div key={c}>
                  <div className="font-bold text-[10px] uppercase mb-0.5" style={{ color: 'var(--accent)' }}>{c}</div>
                  <div className="whitespace-pre-wrap break-words">{String(row.cells[c] ?? '') || <span style={{ color: 'var(--fg3)' }}>leer</span>}</div>
                </div>
              ))}
              {!template.sourceCols?.length && (
                <div style={{ color: 'var(--fg3)' }}>Keine Quellspalten in der Vorlage konfiguriert.</div>
              )}
            </div>
          </div>

          <div>
            <div className="lbl">Generierter Text → {targetCol || '—'}</div>
            <textarea
              className="inp mono !text-[11px] w-full"
              style={{ height: '55vh', resize: 'none' }}
              value={output}
              onChange={(e) => { setOutput(e.target.value); setDirty(true) }}
              placeholder="Noch kein Output generiert."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <button className="btn" onClick={onClose}>Schließen</button>
          <button className="btn btn-a" disabled={!dirty} onClick={save}>Änderung speichern</button>
        </div>
      </div>
    </div>
  )
}
