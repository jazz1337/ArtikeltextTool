import { providerForModel } from './defaults'

export const MAX_RETRIES = 4
export const RETRY_BASE_MS = 3000

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })

async function callOpenAI({ model, system, user, apiKey, signal }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${txt.substring(0, 200)}`)
    err.status = res.status
    throw err
  }
  const j = await res.json()
  return (j.choices?.[0]?.message?.content || '').trim()
}

async function callAnthropic({ model, system, user, apiKey, signal }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.6,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${txt.substring(0, 200)}`)
    err.status = res.status
    throw err
  }
  const j = await res.json()
  return (j.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

/**
 * Ein API-Call mit 429-Retry (exponentielles Backoff) und Abort-Support.
 * onStatus(msg) → für Live-Statusanzeige.
 */
export async function callAI({ model, system, user, apiKey, signal, onStatus, delayMs = 0 }) {
  const provider = providerForModel(model)
  const fn = provider === 'anthropic' ? callAnthropic : callOpenAI

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (delayMs > 0) await sleep(delayMs, signal)
    try {
      return await fn({ model, system, user, apiKey, signal })
    } catch (e) {
      if (e.name === 'AbortError') throw e
      const retryable = e.status === 429 || e.status === 529 || e.status >= 500 || !e.status
      if (retryable && attempt < MAX_RETRIES) {
        const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1)
        onStatus?.(`Rate-Limit/Fehler – warte ${Math.round(wait / 1000)}s (${attempt}/${MAX_RETRIES})`)
        await sleep(wait, signal)
        continue
      }
      throw e
    }
  }
  throw new Error(`Rate limit: ${MAX_RETRIES}x fehlgeschlagen`)
}
