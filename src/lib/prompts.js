// Portierte Geschäftslogik aus Code.gs — Zellen werden über Header-Namen referenziert.
// rowCells = { headerName: wert }

// ── Rule-Overrides der Vorlage auf globale Textregeln anwenden ──
export function applyRuleOverrides(rules, ov) {
  if (!ov || typeof ov !== 'object') return rules
  return rules.map((r) => {
    const o = ov[r.id]
    if (!o) return r
    const c = { ...r }
    if (o.enabled !== undefined) c.enabled = !!o.enabled
    if (o.value !== undefined) c.value = o.value
    return c
  })
}

// ── System-Prompt ──
export function buildSystemPrompt(textRules, starters, tpl) {
  const parts = ['Du bist ein erfahrener E-Commerce-Texter.']
  const rules = applyRuleOverrides(textRules || [], tpl?.ruleOverrides || {})

  for (const r of rules) {
    if (!r.enabled || r.kind === 'starters') continue
    if (r.value && r.value.trim()) parts.push(r.value.trim())
  }

  const sr = rules.find((r) => r.kind === 'starters' && r.enabled)
  if (sr && starters?.enabled) {
    const sl = String(starters.text || '').split('\n').map((x) => x.trim()).filter(Boolean)
    if (sl.length) {
      const cnt = Math.min(starters.count || 3, sl.length)
      const cp = [...sl]
      for (let i = cp.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[cp[i], cp[j]] = [cp[j], cp[i]]
      }
      parts.push('\nSATZANFÄNGE:\nBeginne den ersten Satz mit GENAU EINEM:\n- ' + cp.slice(0, cnt).join('\n- '))
    }
  }

  parts.push('\nGib ausschließlich den fertigen Zieltext aus. Keine Kommentare oder Einleitungen.')
  return parts.join('\n')
}

// ── User-Prompt ──
export function buildUserPrompt(tpl, rowCells) {
  const parts = []
  if (tpl.prompt?.trim()) parts.push('AUFGABE:\n' + tpl.prompt.trim())
  const dp = []
  for (const col of tpl.sourceCols || []) {
    const v = rowCells[col]
    if (v !== '' && v != null) dp.push(`SPALTE (${col}):\n${v}`)
  }
  if (dp.length) parts.push('DATEN:\n' + dp.join('\n\n'))
  return parts.join('\n\n')
}

// ── [Variablen] in Texten auflösen: [Artikelname] → Zellwert ──
export function resolveVars(text, rowCells) {
  if (!text || text.indexOf('[') === -1) return text
  return text.replace(/\[([^\]]+)\]/g, (match, varName) => {
    const name = varName.trim().toLowerCase()
    for (const [h, v] of Object.entries(rowCells)) {
      if (String(h).trim().toLowerCase() === name) return String(v ?? '')
    }
    return match
  })
}

function cellByName(rowCells, ref) {
  if (!ref) return undefined
  const l = String(ref).trim().toLowerCase()
  for (const [h, v] of Object.entries(rowCells)) {
    if (String(h).trim().toLowerCase() === l) return v
  }
  return undefined
}

// ── Bearbeitungsregeln evaluieren (nur Batch-Modus) ──
// Rückgabe: { action: 'process' } | { action: 'skip', reason } | { action: 'fixed', output, reason }
export function evalProcRules(processingRules, rowCells, targetCol, currentOutput) {
  const tv = String(currentOutput ?? '').trim()

  for (const r of processingRules || []) {
    if (!r.enabled) continue
    switch (r.kind) {
      case 'skip_if_filled': {
        if (tv) {
          const an = String(cellByName(rowCells, 'artikelname') ?? '').trim()
          if (tv !== an) return { action: 'skip', reason: 'target_filled' }
        }
        break
      }
      case 'skip_if_short': {
        const mc = r.config?.minChars || 10
        let tl = 0
        for (const v of Object.values(rowCells)) tl += String(v ?? '').length
        if (tl < mc) return { action: 'skip', reason: 'source_short' }
        break
      }
      case 'skip_if_value':
      case 'fixed_output':
      case 'only_if_value': {
        if (!r.config) break
        const ref = r.config.checkCol
        const cv = ref === '_target_' || !ref
          ? tv
          : String(cellByName(rowCells, ref) ?? '').trim()
        const ex = resolveVars(String(r.config.value || '').trim(), rowCells)
        const co = r.config.condition || 'equals'
        let match = false
        if (!ex) match = cv === ''
        else {
          if (co === 'equals') match = cv === ex
          if (co === 'contains') match = cv.indexOf(ex) > -1
          if (co === 'starts_with') match = cv.indexOf(ex) === 0
        }
        if (r.kind === 'only_if_value') {
          if (!match) return { action: 'skip', reason: `only_if: ${r.name} (no match)` }
        } else if (match) {
          if (r.kind === 'fixed_output' && r.config.output) {
            return { action: 'fixed', output: resolveVars(r.config.output, rowCells), reason: `fixed: ${r.name}` }
          }
          if (r.kind === 'skip_if_value') return { action: 'skip', reason: `skip: ${r.name}` }
        }
        break
      }
      case 'only_if_empty': {
        if (!r.config) break
        const ref2 = r.config.checkCol
        const cv2 = ref2 === '_target_' || !ref2
          ? tv
          : String(cellByName(rowCells, ref2) ?? '').trim()
        if (cv2) return { action: 'skip', reason: `only_if_empty: ${r.name} (not empty)` }
        break
      }
      default:
        break
    }
  }
  return { action: 'process' }
}

// ── Bad-Response-Erkennung ──
export function isBadResponse(t) {
  const l = String(t || '').toLowerCase().replace(/<[^>]*>/g, '').trim()
  const bad = [
    'kein artikel gefunden', 'kein produkt gefunden', 'keine daten gefunden',
    'keine informationen gefunden', 'artikel nicht gefunden', 'produkt nicht gefunden',
    'no article found', 'no product found',
  ]
  for (const b of bad) if (l.indexOf(b) > -1) return true
  return l.length < 20
}

export function ruleSummary(textRules, tpl) {
  return applyRuleOverrides(textRules || [], tpl?.ruleOverrides || {})
    .filter((r) => r.enabled)
    .map((r) => r.name)
    .join(' | ')
}
