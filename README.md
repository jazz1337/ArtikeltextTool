# Produkttexte KI — Webapp (v3.0)

Vollständige Browser-Webapp als Nachfolger des Google Apps Script Tools "Produkttexte KI v2.0".
Kein Backend, kein Auth — alle Daten in IndexedDB.

## Lokal starten

```bash
npm install
npm run dev        # http://localhost:5173
```

## Deploy auf Cloudflare Pages

```bash
npm run build      # erzeugt dist/
npx wrangler pages deploy dist --project-name produkttexte-ki
```

Oder über das Dashboard: Repo verbinden → Build command `npm run build`, Output directory `dist`. Keine Env-Variablen nötig.

## Architektur

| Datei | Inhalt |
|---|---|
| `src/db.js` | Dexie-Schema (projects, rows, templates, settings, dupeCache) + AES-GCM-Key-Verschlüsselung |
| `src/lib/defaults.js` | Default-Textregeln, Bearbeitungsregeln, Vorlagen, Satzanfänge (1:1 aus Code.gs) |
| `src/lib/prompts.js` | System-/User-Prompt-Builder, Rule-Overrides, `resolveVars`, `evalProcRules`, Bad-Response-Erkennung |
| `src/lib/ai.js` | OpenAI + Anthropic Client, 429-Retry mit exponentiellem Backoff, AbortController |
| `src/lib/engine.js` | Batch-Engine: State-Machine (running/paused/aborting), Live-Writes in IndexedDB, Row-Retries, Duplikat-Cache |
| `src/lib/io.js` | xlsx/csv-Import (dynamische Spalten), xlsx-Export (alle Spalten erhalten), Vorlagen-JSON-Sharing |

## Wichtige Unterschiede zum GAS-Original

- **Spalten-Referenzen sind Header-Namen statt Buchstaben** (A, B, C → "Artikelname"). Das Schema ist dynamisch; Buchstaben wären nach Spalten-Umsortierung kaputt. In `fixed_output`/Bedingungen funktionieren `[Spaltenname]`-Variablen und `_target_` weiterhin.
- **Einzelzeilen-Modus ignoriert Bearbeitungsregeln** — wie im Original.
- **Kein 5-Minuten-Limit** mehr (das war eine GAS-Beschränkung). Stattdessen Pause/Abbruch-Buttons.
- **Duplikat-Cache** persistiert pro Projekt+Vorlage in IndexedDB, "🧹 Cache" leert ihn.
- **API-Delay** ist konfigurierbar (Default 1000 ms statt 6000 ms — Browser braucht das GAS-Bandbreiten-Polster nicht).

## API-Hinweise

- OpenAI: direkte Browser-Calls funktionieren (CORS offen).
- Anthropic: nutzt den Header `anthropic-dangerous-direct-browser-access: true`. Der Key ist damit im Browser des Nutzers — für ein internes Tool okay, für öffentliche Deployments einen Proxy-Worker vorschalten.
- API-Keys werden AES-GCM-verschlüsselt gespeichert; der CryptoKey ist non-extractable in IndexedDB. Das schützt vor versehentlichem Klartext-Leak (Export, Sync), nicht vor einem Angreifer mit vollem Gerätezugriff.

## Bekannte Limits (MVP)

- Bundle ~780 kB (SheetJS ist groß). Bei Bedarf: `import('xlsx')` lazy laden.
- Tabelle paginiert mit 100 Zeilen/Seite statt Virtual Scrolling — bei 5k Zeilen völlig ausreichend.
- Nur das erste Tabellenblatt einer xlsx wird importiert.
