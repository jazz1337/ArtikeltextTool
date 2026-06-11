import Dexie from 'dexie'

export const db = new Dexie('produkttexte-ki')

db.version(1).stores({
  // Projekte: eine importierte Datei = ein Projekt
  projects: '++id, name, updatedAt',
  // Zeilen: cells = { spaltenName: wert }, meta = { [targetCol]: {status, message, ts, model} }
  rows: '++id, projectId, [projectId+idx], idx',
  // Vorlagen (global, projektübergreifend)
  templates: 'id, name',
  // Key-Value: textRules, processingRules, starters, theme, model, apiDelayMs, activeTemplateId, apiKeyEnc, cryptoKey, firstRunDone
  settings: 'key',
  // Duplikat-Cache pro Projekt+Template
  dupeCache: '++id, [projectId+templateId+key]',
})

// ── Settings-Helper ──────────────────────────────────────────
export async function getSetting(key, fallback = null) {
  const r = await db.settings.get(key)
  return r ? r.value : fallback
}
export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}

// ── API-Key: AES-GCM-verschlüsselt, CryptoKey non-extractable in IDB ──
async function getCryptoKey() {
  let rec = await db.settings.get('cryptoKey')
  if (rec?.value) return rec.value
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable → kann nicht als Klartext ausgelesen werden
    ['encrypt', 'decrypt']
  )
  await db.settings.put({ key: 'cryptoKey', value: key })
  return key
}

export async function saveApiKey(provider, plaintext) {
  if (!plaintext) {
    const enc = await getSetting('apiKeyEnc', {})
    delete enc[provider]
    await setSetting('apiKeyEnc', enc)
    return
  }
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  const enc = await getSetting('apiKeyEnc', {})
  enc[provider] = { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) }
  await setSetting('apiKeyEnc', enc)
}

export async function loadApiKey(provider) {
  const enc = await getSetting('apiKeyEnc', {})
  const rec = enc[provider]
  if (!rec) return ''
  try {
    const key = await getCryptoKey()
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(rec.iv) },
      key,
      new Uint8Array(rec.ct)
    )
    return new TextDecoder().decode(pt)
  } catch {
    return ''
  }
}

// ── Projekt löschen inkl. abhängiger Daten ──
export async function deleteProject(projectId) {
  await db.transaction('rw', db.projects, db.rows, db.dupeCache, async () => {
    await db.rows.where('projectId').equals(projectId).delete()
    await db.dupeCache.where('[projectId+templateId+key]').between(
      [projectId, Dexie.minKey, Dexie.minKey],
      [projectId, Dexie.maxKey, Dexie.maxKey]
    ).delete()
    await db.projects.delete(projectId)
  })
}

export async function clearDupeCache(projectId) {
  await db.dupeCache.where('[projectId+templateId+key]').between(
    [projectId, Dexie.minKey, Dexie.minKey],
    [projectId, Dexie.maxKey, Dexie.maxKey]
  ).delete()
}
