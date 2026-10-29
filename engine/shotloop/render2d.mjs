// 2D track: the world is an HTML page (world/page.html: styles, layout,
// helpers) and each shot is an ES module (shots/<id>/shot.js) that draws
// the page at shot-local time:
//
//   export function setup(ctx) {}           optional, once per render
//   export default function render(t, ctx)  t = 0 at the shot's first frame
//
// ctx = { window, document, world, start, duration, fps, id }, where
// `world` is the page's own window.render (film time) if it defines one,
// so a converted episode can delegate: world(ctx.start + t).

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { capture, frameName, openRenderPage, pageGeometry, progress } from './compose.mjs'

export async function renderFrames2d(project, shot, mode, framesDir, frames) {
  const page = path.join(project.world, 'page.html')
  if (!fs.existsSync(page)) throw new Error('2D project needs world/page.html')
  if (!fs.existsSync(shot.code)) throw new Error(`missing ${path.relative(project.root, shot.code)}`)
  fs.mkdirSync(framesDir, { recursive: true })

  const p = await openRenderPage(page, pageGeometry(project, mode), { query: { shotloop: shot.id } })
  try {
    const ctx = JSON.stringify({ start: shot.start, duration: shot.duration, fps: project.fps, id: shot.id })
    // Cache-bust the module URL so an edited shot.js is always re-read
    const url = `${pathToFileURL(shot.code).href}?v=${Date.now()}`
    await p.evaluate(`(async () => {
      const m = await import(${JSON.stringify(url)})
      if (typeof m.default !== 'function') throw new Error('shot.js must export default render(t, ctx)')
      const worldRender = typeof window.render === 'function' ? window.render : null
      window.__shotloop = { render: m.default, ctx: { ...${ctx}, window, document, world: worldRender } }
      await m.setup?.(window.__shotloop.ctx)
    })()`)
    const tick = progress({ shot: shot.id, stage: 'frames' }, frames.length)
    for (const [n, f] of frames.entries()) {
      const t = (f - 1) / project.fps
      await p.evaluate(`(async () => { await window.__shotloop.render(${t}, window.__shotloop.ctx) })()`)
      fs.writeFileSync(path.join(framesDir, frameName(f)), await capture(p))
      tick(n + 1)
    }
  } finally {
    await p.close()
  }
}
