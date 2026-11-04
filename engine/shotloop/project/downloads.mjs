// What the engine downloads on first use (a speech model, the render
// browser), reported as the app's queue bar shows it: progress in MB

import { emit, progress } from '../render/compose.mjs'

// A download's progress, as MB a step (the last step once it is unpacked
// in place). what: the thing downloading, for the log
export function downloadTicker(stage, bytes, what) {
  const total = Math.round(bytes / 1e6)
  const tick = progress({ stage }, total)
  let last = -1
  let waiting = false
  // { waiting }: another process is fetching the same thing, and done is
  // how far it has got; said once, so the bar isn't taken for our own
  return (done, _total, info) => {
    if (info?.waiting && !waiting) emit({ type: 'log', message: `waiting for another download of the ${what}` })
    waiting = !!info?.waiting
    const mb = Math.min(Math.floor(done / 1e6), done >= bytes ? total : total - 1)
    if (mb !== last) tick((last = mb))
  }
}
