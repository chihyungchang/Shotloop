// Anonymous usage counts: the app asks the shell (src-tauri/src/telemetry.rs)
// whether a report is due, at launch and every hour, and sends it to the
// product site, which keeps one row per install and day. A report holds a
// random install id, the version, the chip, the UI language and how many
// films were planned, built, fixed and exported (exports by style); never
// a project's content, names, paths or keys. Settings → General turns it
// off; a development build never reports.

import { api } from './api'
import { lang } from './i18n'

const ENDPOINT = 'https://oliverz.dev/api/shotloop/ping'
const EVERY = 3600 * 1000

async function report() {
  const due = await api.telemetryDue()
  if (!due) return
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...due, lang: lang() })
  })
  // Taken off once it landed, or once the site refused it for good (400
  // malformed, 413 too large): resending the same counts every hour
  // would never get through, and the next ones would pile up behind them.
  // Anything else (offline, 5xx, 404 while the endpoint isn't there) waits.
  if (res.ok || res.status === 400 || res.status === 413) await api.telemetrySent(due.counts)
}

let started = false
export function startTelemetry() {
  if (started) return
  started = true
  // Offline or the site down: the counts wait for the next hour, on purpose
  // without a word, as nothing the person does depends on them
  const run = () => report().catch(() => {})
  run()
  setInterval(run, EVERY)
}
