// Shared steps of every shot render: the caption layer, ffmpeg encodes
// and progress events. Both tracks render a shot to a
// folder of PNG frames; this module turns them into clips.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { openPage } from '../../lib/chrome.mjs'
import * as jsonl from '../../lib/jsonl.mjs'
import { cssSize } from '../project/project.mjs'

// ---------------------------------------------------------------- events

// With --json every event is one JSON line on stdout, for the app;
// otherwise a short human-readable line
let jsonMode = false
export const setJson = on => (jsonMode = on)

export function emit(event) {
  if (jsonMode) jsonl.emit(event)
  else if (event.type === 'progress') {
    const eta = event.eta != null ? ` · ${Math.ceil(event.eta)} s left` : ''
    process.stdout.write(`\r${event.shot ?? ''} ${event.stage} ${event.done}/${event.total}${eta}      `)
    if (event.done === event.total) process.stdout.write('\n')
  } else if (event.type === 'log') console.log(event.message)
  else if (event.type === 'error') console.error(`error: ${event.message}`)
}

// Progress with a time estimate from the average time per item so far
export function progress(fields, total) {
  const t0 = Date.now()
  let last = 0
  return done => {
    const now = Date.now()
    if (done < total && now - last < 250) return
    last = now
    const per = done ? (now - t0) / 1000 / done : null
    emit({ type: 'progress', ...fields, done, total, eta: per != null ? per * (total - done) : null })
  }
}

// ---------------------------------------------------------------- processes

export const run = (cmd, args, { input, onStdout, env } = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env
    })
    // Keep the tail of both streams: a tool may report its error on either
    let err = ''
    p.stdout.on('data', d => {
      onStdout?.(String(d))
      err = (err + d).slice(-4000)
    })
    p.stderr.on('data', d => {
      err = (err + d).slice(-4000)
    })
    p.on('error', reject)
    p.on('close', code => (code ? reject(new Error(`${path.basename(cmd)} exited ${code}\n${err.trim()}`)) : resolve()))
    if (input) input(p.stdin)
  })

export const ffmpeg = (args, opts) => run('ffmpeg', ['-loglevel', 'error', '-y', ...args], opts)

export const QUALITY = {
  draft: ['-crf', '23', '-preset', 'veryfast'],
  final: ['-crf', '18', '-preset', 'slow']
}

// The pixel size of a mode: drafts are half size
export function pixelSize(project, mode) {
  const k = mode === 'draft' ? 0.5 : 1
  const even = x => Math.round((x * k) / 2) * 2
  return { width: even(project.size.width), height: even(project.size.height) }
}

// A page at its CSS size (project.mjs cssSize), captured at the device
// scale that gives the mode's pixel size
export function pageGeometry(project, mode) {
  const css = cssSize(project.size)
  return { ...css, scale: pixelSize(project, mode).width / css.width }
}

// ---------------------------------------------------------------- pages

// Module scripts define render() after load; give up after 20 s rather
// than hang on a page that never defines it
const waitForRender = `new Promise((r, j) => { const t0 = Date.now(); const c = () => typeof window.render === 'function' ? r()
  : Date.now() - t0 > 20000 ? j(new Error('the page did not define window.render(t)')) : setTimeout(c, 50); c() })`

// Opens a page that follows the contract (window.render(t), optional
// window.ready) and returns it ready to draw. A 2D world page need not
// define render(t): its shots draw it (render: false)
export async function openRenderPage(file, geometry, { transparent = false, query = {}, render = true } = {}) {
  const page = await openPage(geometry)
  if (transparent) {
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  }
  const url = pathToFileURL(file)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  try {
    await page.goto(url.href)
    if (render) await page.evaluate(waitForRender)
    await page.evaluate('window.ready')
  } catch (err) {
    await page.close()
    throw err
  }
  return page
}

// The page as PNG. fast: lighter compression, a third quicker, for frames
// that are encoded and thrown away (the pixels are the same)
export async function capture(page, { fast = false } = {}) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', ...(fast ? { optimizeForSpeed: true } : {}) })
  return Buffer.from(data, 'base64')
}

// A page drawn once per item into PNG files: window.render(item), then a
// capture to fileOf(item, i); tick(n) after each when given. The page is
// closed after, drawn through or not
export async function renderPageFrames(page, items, fileOf, tick) {
  try {
    for (const [i, item] of items.entries()) {
      await page.evaluate(`render(${JSON.stringify(item)})`)
      fs.writeFileSync(fileOf(item, i), await capture(page))
      tick?.(i + 1)
    }
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------- clips

export const frameName = i => `${String(i).padStart(5, '0')}.png`

// Frames → silent H.264 clip
export async function encodeClip(project, mode, framesDir, out) {
  const fps = String(project.fps)
  await ffmpeg([
    '-framerate', fps, '-i', path.join(framesDir, '%05d.png'),
    '-filter_complex', '[0]format=yuv420p[v]',
    '-map', '[v]', '-c:v', 'libx264', ...QUALITY[mode], '-r', fps,
    '-movflags', '+faststart', out
  ])
}

// A still in out's format: a JPEG at high quality (a fifth of the PNG's
// size, the text as crisp to read)
export async function composeStill(frame, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await ffmpeg(['-i', frame, ...(/\.jpe?g$/i.test(out) ? ['-q:v', '2'] : []), out])
}
