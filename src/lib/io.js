import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { db } from '../db'

function dedupeHeaders(headers) {
  const seen = {}
  return headers.map((h, i) => {
    let name = String(h ?? '').trim() || `Spalte ${i + 1}`
    if (seen[name]) name = `${name} (${++seen[name]})`
    else seen[name] = 1
    return name
  })
}

async function parseFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        skipEmptyLines: 'greedy',
        complete: (res) => {
          const [head, ...body] = res.data
          if (!head?.length) return reject(new Error('Keine Daten in der CSV gefunden.'))
          resolve({ headers: dedupeHeaders(head), rows: body })
        },
        error: reject,
      })
    })
  }
  // xlsx / xls
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  const [head, ...body] = aoa
  if (!head?.length) throw new Error('Keine Daten im ersten Tabellenblatt gefunden.')
  return { headers: dedupeHeaders(head), rows: body.filter((r) => r.some((c) => String(c ?? '').trim() !== '')) }
}

/** Datei importieren → neues Projekt mit Zeilen anlegen. Gibt projectId zurück. */
export async function importFile(file) {
  const { headers, rows } = await parseFile(file)
  const now = Date.now()
  const projectId = await db.projects.add({
    name: file.name.replace(/\.(xlsx|xls|csv)$/i, ''),
    headers,
    createdAt: now,
    updatedAt: now,
    rowCount: rows.length,
  })
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r, j) => {
      const cells = {}
      headers.forEach((h, ci) => { cells[h] = String(r[ci] ?? '') })
      return { projectId, idx: i + j, cells, meta: {} }
    })
    await db.rows.bulkAdd(chunk)
  }
  return projectId
}

/** Projekt als .xlsx exportieren — alle Spalten bleiben erhalten, neue Zielspalten werden angehängt. */
export async function exportProject(project) {
  const rows = await db.rows.where('projectId').equals(project.id).sortBy('idx')
  // Header: Original-Reihenfolge + neue Spalten die durch Verarbeitung dazukamen
  const headerSet = new Set(project.headers)
  const extra = []
  for (const r of rows) {
    for (const k of Object.keys(r.cells)) {
      if (!headerSet.has(k) && !extra.includes(k)) extra.push(k)
    }
  }
  const headers = [...project.headers, ...extra]
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r.cells[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Daten')
  XLSX.writeFile(wb, `${project.name}_bearbeitet.xlsx`)
}

/** Vorlagen als JSON exportieren/importieren (Sharing zwischen Kollegen). */
export function exportTemplatesJson(templates) {
  const blob = new Blob([JSON.stringify({ version: 1, templates }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'produkttexte-vorlagen.json'
  a.click()
  URL.revokeObjectURL(url)
}

export async function importTemplatesJson(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : data.templates
  if (!Array.isArray(list)) throw new Error('Ungültiges Vorlagen-Format.')
  let count = 0
  for (const t of list) {
    if (!t?.name) continue
    await db.templates.put({
      id: t.id && !(await db.templates.get(t.id)) ? t.id : 'tpl_' + Date.now() + '_' + count,
      name: String(t.name).slice(0, 80),
      sourceCols: Array.isArray(t.sourceCols) ? t.sourceCols : [],
      targetCol: String(t.targetCol || ''),
      prompt: String(t.prompt || '').slice(0, 8000),
      ruleOverrides: t.ruleOverrides || {},
    })
    count++
  }
  return count
}
