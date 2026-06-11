import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { db, getSetting, setSetting } from './db'
import { defaultTextRules, defaultProcessingRules, defaultStarters, defaultTemplates } from './lib/defaults'

async function seed() {
  const seeded = await getSetting('seeded')
  if (seeded) return
  await db.templates.bulkPut(defaultTemplates())
  await setSetting('textRules', defaultTextRules())
  await setSetting('processingRules', defaultProcessingRules())
  await setSetting('starters', defaultStarters())
  await setSetting('model', 'gpt-4.1-mini')
  await setSetting('apiDelayMs', 1000)
  await setSetting('theme', 'light')
  await setSetting('seeded', true)
}

seed().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
