// Portiert aus Code.gs v2.0 — Spalten-Referenzen sind jetzt Header-Namen (dynamisches Schema)

export const DEFAULT_DESC_STARTERS = [
  'Entdecken Sie', 'Erleben Sie', 'Ideal für', 'Perfekt geeignet für',
  'Diese hochwertige', 'Dieses Produkt', 'Mit dieser', 'Dank der',
  'Hochwertige Verarbeitung für', 'Entwickelt für', 'Die durchdachte', 'Für alle, die',
]

export const MODELS = [
  { id: 'gpt-4.1-mini', provider: 'openai' },
  { id: 'gpt-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', provider: 'openai' },
  { id: 'claude-3-5-haiku-latest', provider: 'anthropic' },
  { id: 'claude-3-7-sonnet-latest', provider: 'anthropic' },
  { id: 'claude-opus-4-0', provider: 'anthropic' },
]

export function providerForModel(model) {
  const known = MODELS.find((m) => m.id === model)
  if (known) return known.provider
  return model.toLowerCase().startsWith('claude') ? 'anthropic' : 'openai'
}

export function defaultTextRules() {
  return [
    { id: 'lang', kind: 'text', name: 'Sprache', enabled: true, value: 'Schreibe auf Deutsch.', custom: false, options: [
      { name: 'Deutsch', value: 'Schreibe auf Deutsch.' }, { name: 'Englisch', value: 'Schreibe auf Englisch.' },
      { name: 'Französisch', value: 'Schreibe auf Französisch.' }, { name: 'Spanisch', value: 'Schreibe auf Spanisch.' }] },
    { id: 'tone', kind: 'text', name: 'Tonalität', enabled: false, value: 'Tonalität: Professionell – sachlich, kompetent, vertrauenerweckend.', custom: false, options: [
      { name: 'Professionell', value: 'Tonalität: Professionell – sachlich, kompetent, vertrauenerweckend.' },
      { name: 'Locker & modern', value: 'Tonalität: Locker & modern – nahbar, frisch, direkt.' },
      { name: 'Luxuriös', value: 'Tonalität: Luxuriös – elegant, exklusiv, hochwertig.' },
      { name: 'Sachlich-technisch', value: 'Tonalität: Sachlich-technisch – präzise, faktenbasiert, nüchtern.' }] },
    { id: 'address', kind: 'text', name: 'Anrede', enabled: false, value: 'Verwende die Du-Anrede.', custom: false, options: [
      { name: 'Du', value: 'Verwende die Du-Anrede.' }, { name: 'Sie', value: 'Verwende die Sie-Anrede.' }] },
    { id: 'html', kind: 'text', name: 'HTML-Formatierung', enabled: false, value: 'Formatiere den Output als HTML. Erlaubte Tags: <p>, <strong>, <ul>, <li>.', custom: false, options: [
      { name: 'Standard (p, strong)', value: 'Formatiere den Output als HTML. Erlaubte Tags: <p>, <strong>.' },
      { name: 'Mit Listen', value: 'Formatiere den Output als HTML. Erlaubte Tags: <p>, <strong>, <ul>, <li>.' },
      { name: 'Voll (h2,h3,ul)', value: 'Formatiere den Output als HTML. Erlaubte Tags: <p>, <strong>, <h2>, <h3>, <ul>, <li>.' },
      { name: 'Nur p', value: 'Formatiere den Output als HTML. Nur <p>-Tags erlaubt.' }] },
    { id: 'charlimit', kind: 'text', name: 'Zeichenlimit', enabled: false, value: 'Output zwischen 300 und 600 Zeichen.', custom: false, options: [] },
    { id: 'no_invent', kind: 'text', name: 'Keine Erfindungen', enabled: true, value: 'Verwende ausschließlich Informationen aus den Quelldaten. Erfinde keine Fakten, Maße, Materialien oder Eigenschaften.', custom: false, options: [] },
    { id: 'no_prices', kind: 'text', name: 'Keine Preise', enabled: true, value: 'Keine Preise, Rabatte, Verfügbarkeiten oder Lieferzeiten nennen.', custom: false, options: [] },
    { id: 'no_superl', kind: 'text', name: 'Keine Übertreibungen', enabled: false, value: 'Keine Superlative oder Übertreibungen wie "bester", "einzigartiger" – nur wenn belegbar.', custom: false, options: [] },
    { id: 'no_artnum', kind: 'text', name: 'Keine Artikelnummern', enabled: false, value: 'Keine Artikelnummern, GTINs, EANs oder HANs im Output erwähnen.', custom: false, options: [] },
    { id: 'exact_vals', kind: 'text', name: 'Exakte Übernahme', enabled: false, value: 'Werte exakt übernehmen inkl. Einheiten (z.B. "30 cm", "1,2 kg"). Keine Umrechnungen.', custom: false, options: [] },
    { id: 'seo', kind: 'text', name: 'SEO-Optimierung', enabled: false, value: 'SEO-optimiert: Keywords natürlich einbauen (1-2x). Kein Keyword-Stuffing.', custom: false, options: [] },
    { id: 'starters', kind: 'starters', name: 'Satzanfänge', enabled: false, value: '', custom: false, options: [] },
  ]
}

export function defaultProcessingRules() {
  return [
    { id: 'skip_filled', kind: 'skip_if_filled', name: 'Überspringe gefüllte Zellen', enabled: true, config: {} },
    { id: 'skip_short', kind: 'skip_if_short', name: 'Überspringe kurze Quelldaten', enabled: false, config: { minChars: 10 } },
    { id: 'reuse_dupes', kind: 'reuse_duplicates', name: 'Duplikate wiederverwenden', enabled: false, config: { keyCol: 'artikelname' } },
  ]
}

export function defaultStarters() {
  return { enabled: false, count: 3, text: DEFAULT_DESC_STARTERS.join('\n') }
}

export function defaultTemplates() {
  return [
    {
      id: 'tpl_produktdetails', name: 'Produktdetails', sourceCols: [], targetCol: '',
      prompt: 'Du bist ein Produktdaten-Extraktions-Assistent.\nGib verifizierte Produktdaten im folgenden HTML-Format aus:\n\n<p><strong>Material:</strong> ...</p>\n<p><strong>Farbe:</strong> ...</p>\n<p><strong>Alter:</strong> ...</p>\n<p><strong>Hergestellt in:</strong> ...</p>\n<p><strong>Masse:</strong> ...</p>\n<p><strong>Gewicht:</strong> ...</p>\n<p><strong>Lieferumfang:</strong> ...</p>\n<p><strong>Pflegehinweise:</strong> ...</p>\n<p><strong>Kompatibilitaet:</strong> ...</p>\n<p><strong>Besonderheiten:</strong> ...</p>\n\nFelder ohne Wert weglassen. Kein Fliesstext.',
      ruleOverrides: {
        lang: { enabled: true, value: 'Schreibe auf Deutsch.' },
        html: { enabled: true, value: 'Formatiere den Output als HTML. Erlaubte Tags: <p>, <strong>.' },
        no_invent: { enabled: true }, exact_vals: { enabled: true }, no_artnum: { enabled: true },
        tone: { enabled: false }, address: { enabled: false }, seo: { enabled: false }, starters: { enabled: false },
      },
    },
    {
      id: 'tpl_beschreibung', name: 'Beschreibungen', sourceCols: [], targetCol: '',
      prompt: 'Erstelle eine gut lesbare Produktbeschreibung als Fliesstext.\nNur Fliesstext in <p>-Tags (keine Listen).\nSatzstruktur variieren.',
      ruleOverrides: {
        lang: { enabled: true, value: 'Schreibe auf Deutsch.' },
        address: { enabled: true, value: 'Verwende die Du-Anrede.' },
        html: { enabled: true, value: 'Formatiere den Output als HTML. Erlaubte Tags: <p>, <strong>.' },
        no_invent: { enabled: true }, no_prices: { enabled: true }, no_superl: { enabled: true },
        no_artnum: { enabled: true }, seo: { enabled: true }, starters: { enabled: true },
      },
    },
    {
      id: 'tpl_kurzbeschreibung', name: 'Kurzbeschreibungen', sourceCols: [], targetCol: '',
      prompt: 'Erzeuge genau 3 Bulletpoints als Nominalphrasen.\n\nAusgabe exakt so:\n<p>Bulletpoint 1</p>\n<p>Bulletpoint 2</p>\n<p>Bulletpoint 3</p>\n\nNur <p>-Tags. Max 8 Woerter pro Zeile.',
      ruleOverrides: {
        lang: { enabled: true, value: 'Schreibe auf Deutsch.' },
        html: { enabled: true, value: 'Formatiere den Output als HTML. Nur <p>-Tags erlaubt.' },
        no_invent: { enabled: true }, no_artnum: { enabled: true },
        charlimit: { enabled: true, value: 'Output maximal 80 Zeichen.' },
        address: { enabled: false }, seo: { enabled: false }, starters: { enabled: false },
      },
    },
  ]
}

export const PROC_RULE_KINDS = [
  { kind: 'skip_if_filled', label: 'Überspringe gefüllte Zellen' },
  { kind: 'skip_if_short', label: 'Überspringe kurze Quelldaten' },
  { kind: 'skip_if_value', label: 'Überspringe wenn Spalte = Wert' },
  { kind: 'only_if_value', label: 'Bearbeite NUR wenn Spalte = Wert' },
  { kind: 'only_if_empty', label: 'Bearbeite NUR wenn Spalte leer' },
  { kind: 'fixed_output', label: 'Fester Output wenn Bedingung' },
  { kind: 'reuse_duplicates', label: 'Duplikate wiederverwenden' },
]
