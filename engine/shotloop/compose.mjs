// Shared steps of every shot render: the caption layer, ffmpeg encodes,
// the music bed and progress events. Both tracks render a shot to a
// folder of PNG frames; this module turns them into clips.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { openPage } from '../lib/chrome.mjs'
import { render as renderMusic, wav } from '../video/music.mjs'
import { musicKey } from './cache.mjs'

// ---------------------------------------------------------------- events

// With --json every event is one JSON line on stdout, for the app;
// otherwise a short human-readable line
let jsonMode = false
export const setJson = on => (jsonMode = on)

export function emit(event) {
  if (jsonMode) {
    process.stdout.write(JSON.stringify(event) + '\n')
    return
  }
  if (event.type === 'progress') {
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
    // Keep the tail of both streams: Blender reports Python errors on either
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

const QUALITY = {
  draft: ['-crf', '23', '-preset', 'veryfast'],
  final: ['-crf', '18', '-preset', 'slow']
}

// The pixel size of a mode: drafts are half size
export function pixelSize(project, mode) {
  const k = mode === 'draft' ? 0.5 : 1
  const even = x => Math.round((x * k) / 2) * 2
  return { width: even(project.size.width), height: even(project.size.height) }
}

// Pages are laid out in CSS px at 2/3 of the final size (720×1280 for
// 1080×1920) and captured at a device scale that gives the mode's size
export function pageGeometry(project, mode) {
  const css = { width: Math.round(project.size.width / 1.5), height: Math.round(project.size.height / 1.5) }
  return { ...css, scale: pixelSize(project, mode).width / css.width }
}

// ---------------------------------------------------------------- pages

const waitForRender = `new Promise(r => { const c = () => typeof window.render === 'function' ? r() : setTimeout(c, 50); c() })`

// Opens a page that follows the contract (window.render(t), optional
// window.ready) and returns it ready to draw
export async function openRenderPage(file, geometry, { transparent = false, query = {} } = {}) {
  const page = await openPage(geometry)
  if (transparent) {
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  }
  const url = pathToFileURL(file)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  await page.goto(url.href)
  await page.evaluate(waitForRender)
  await page.evaluate('window.ready')
  return page
}

export async function capture(page) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
  return Buffer.from(data, 'base64')
}

// ---------------------------------------------------------------- clips

const frameName = i => `${String(i).padStart(5, '0')}.png`
export { frameName }

// Caption layer for a shot: one transparent PNG per frame, drawn at film
// time (the caption page is written against the film's timeline)
export async function renderCaptions(project, shot, mode, dir, frames) {
  fs.mkdirSync(dir, { recursive: true })
  const page = await openRenderPage(project.captions, pageGeometry(project, mode), { transparent: true })
  const tick = progress({ shot: shot.id, stage: 'captions' }, frames.length)
  try {
    for (const [n, f] of frames.entries()) {
      await page.evaluate(`render(${shot.start + (f - 1) / project.fps})`)
      fs.writeFileSync(path.join(dir, frameName(f)), await capture(page))
      tick(n + 1)
    }
  } finally {
    await page.close()
  }
}

// Frames (+ caption layer) → silent H.264 clip
export async function encodeClip(project, mode, framesDir, captionsDir, out) {
  const fps = String(project.fps)
  const overlay = captionsDir && fs.existsSync(captionsDir)
  await ffmpeg([
    '-framerate', fps, '-i', path.join(framesDir, '%05d.png'),
    ...(overlay ? ['-framerate', fps, '-i', path.join(captionsDir, '%05d.png')] : []),
    '-filter_complex', overlay ? '[0][1]overlay=0:0,format=yuv420p[v]' : '[0]format=yuv420p[v]',
    '-map', '[v]', '-c:v', 'libx264', ...QUALITY[mode], '-r', fps,
    '-movflags', '+faststart', out
  ])
}

// One composited still (frame + caption) as PNG
export async function composeStill(frame, caption, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  if (!caption) {
    fs.copyFileSync(frame, out)
    return
  }
  await ffmpeg(['-i', frame, '-i', caption, '-filter_complex', '[0][1]overlay=0:0', out])
}

// ---------------------------------------------------------------- music

// The music bed for the whole film, rendered once per music.json
export function musicWav(project) {
  const key = musicKey(project)
  if (!key) return null
  const file = path.join(project.state, 'music', `${key}.wav`)
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const cfg = JSON.parse(fs.readFileSync(project.music, 'utf8'))
    fs.writeFileSync(file, wav(renderMusic(cfg)))
  }
  return file
}

// The shot's clip with the music for its range of the film, for review
export async function previewClip(project, shot, clip) {
  const music = musicWav(project)
  if (!music) return clip
  const out = path.join(path.dirname(clip), `preview-${musicKey(project)}.mp4`)
  if (fs.existsSync(out)) return out
  await ffmpeg([
    '-i', clip, '-ss', String(shot.start), '-t', String(shot.duration), '-i', music,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart', out
  ])
  return out
}
