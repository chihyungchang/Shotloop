// 2D track: the world is an HTML page (world/page.html: styles, layout,
// helpers) and each shot is an ES module (shots/<id>/shot.js) that draws
// the page at shot-local time:
//
//   export function setup(ctx) {}           optional, once per render
//   export default function render(t, ctx)  t = 0 at the shot's first frame
//
// ctx = { window, document, world, start, duration, fps, id, voice }, where
// `world` is the page's own window.render (film time) if it defines one,
// so a shot can delegate to it: world(ctx.start + t), and `voice` is the
// shot's voice-over, one { text, at, end } per sentence in shot time (an
// empty list without one), so the picture can land on the words.
//
// The page also has window.subtitles.keep(x, y, w, h, name): canvas
// drawing reports, each frame, a region the viewer must see (page CSS
// px), which the subtitle check (check.mjs) keeps the subtitles off.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { capture, frameName, openRenderPage, pageGeometry, progress } from './compose.mjs'
import { voiceCues } from './cues.mjs'

// The shot's page, ready to draw: openShot(...).draw(t) renders shot time t
export async function openShot(project, shot, mode) {
  const page = path.join(project.world, 'page.html')
  if (!fs.existsSync(page)) throw new Error('2D project needs world/page.html')
  if (!fs.existsSync(shot.code)) throw new Error(`missing ${path.relative(project.root, shot.code)}`)
  const p = await openRenderPage(page, pageGeometry(project, mode), { query: { shotloop: shot.id }, render: false })
  try {
    const ctx = JSON.stringify({ start: shot.start, duration: shot.duration, fps: project.fps, id: shot.id, voice: voiceCues(project, shot) })
    // Cache-bust the module URL so an edited shot.js is always re-read
    const url = `${pathToFileURL(shot.code).href}?v=${Date.now()}`
    await p.evaluate(`(async () => {
      window.subtitles = { kept: [], keep(x, y, w, h, name = '') { this.kept.push({ x, y, w, h, name: String(name) }) } }
      const m = await import(${JSON.stringify(url)})
      if (typeof m.default !== 'function') throw new Error('shot.js must export default render(t, ctx)')
      const worldRender = typeof window.render === 'function' ? window.render : null
      window.__shotloop = { render: m.default, ctx: { ...${ctx}, window, document, world: worldRender } }
      await m.setup?.(window.__shotloop.ctx)
    })()`)
  } catch (err) {
    await p.close()
    throw err
  }
  // The regions a frame keeps are its own: emptied before each draw
  const draw = t => p.evaluate(`(async () => { window.subtitles.kept = []; await window.__shotloop.render(${t}, window.__shotloop.ctx) })()`)
  return { page: p, draw, close: () => p.close() }
}

export async function renderFrames2d(project, shot, mode, framesDir, frames) {
  fs.mkdirSync(framesDir, { recursive: true })
  const s = await openShot(project, shot, mode)
  try {
    const tick = progress({ shot: shot.id, stage: 'frames' }, frames.length)
    for (const [n, f] of frames.entries()) {
      await s.draw((f - 1) / project.fps)
      fs.writeFileSync(path.join(framesDir, frameName(f)), await capture(s.page))
      tick(n + 1)
    }
  } finally {
    await s.close()
  }
}
