// The film from its shots: concatenates the cached clip of every shot,
// lays the music bed under it and exports MP4 (H.264 + AAC) at 9:16 and
// 16:9, plus the publish kit (cover PNG and per-platform post).
//
// Every output carries its mode and a timestamp in its name, and
// out/latest.json points at the newest export, so an older file can't
// be mistaken for a new one.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { openPage } from '../lib/chrome.mjs'
import { entry, writeJson } from './cache.mjs'
import { emit, ffmpeg, musicWav, pixelSize } from './compose.mjs'
import { renderShot } from './render.mjs'

export const ASPECTS = { '9:16': [9, 16], '16:9': [16, 9] }

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

// Shots whose clip for this mode is missing or stale
export function pendingShots(project, mode) {
  return project.shots.filter(s => !entry(project, s, mode).clip)
}

// Output size for an aspect: the long side matches the project's
function aspectSize(project, mode, aspect) {
  const { width, height } = pixelSize(project, mode)
  const long = Math.max(width, height)
  const short = Math.min(width, height)
  const [w, h] = ASPECTS[aspect]
  return w > h ? { width: long, height: short } : { width: short, height: long }
}

// Fit the film into another aspect over a blurred, zoomed copy of itself
function fitFilter(src, dst) {
  if (src.width === dst.width && src.height === dst.height) return '[0:v]format=yuv420p[v]'
  const { width: W, height: H } = dst
  return [
    '[0:v]split[a][b]',
    `[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,eq=brightness=-0.12[bg]`,
    `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg]`,
    '[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]'
  ].join(';')
}

export async function assemble(project, { mode = 'draft', aspects = ['9:16', '16:9'] } = {}) {
  const missing = pendingShots(project, mode)
  if (missing.length) {
    throw new Error(`not rendered (${mode}): ${missing.map(s => s.id).join(', ')}; render them first`)
  }
  for (const a of aspects) if (!ASPECTS[a]) throw new Error(`unknown aspect ${a} (9:16 or 16:9)`)
  fs.mkdirSync(project.out, { recursive: true })
  const work = path.join(project.state, `film-${process.pid}`)
  fs.mkdirSync(work, { recursive: true })
  const at = stamp()

  try {
    // All shot clips share codec and settings, so they join without
    // re-encoding
    const list = path.join(work, 'list.txt')
    fs.writeFileSync(list, project.shots
      .map(s => `file '${entry(project, s, mode).clip.replaceAll("'", "'\\''")}'`)
      .join('\n') + '\n')
    const film = path.join(work, 'film.mp4')
    emit({ type: 'log', message: `joining ${project.shots.length} shots` })
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', film])

    const music = musicWav(project)
    const src = pixelSize(project, mode)
    const files = []
    for (const [i, aspect] of aspects.entries()) {
      const dst = aspectSize(project, mode, aspect)
      const out = path.join(project.out, `${project.slug}.${mode}.${aspect.replace(':', 'x')}.${at}.mp4`)
      emit({ type: 'progress', stage: 'export', done: i, total: aspects.length, eta: null })
      await ffmpeg([
        '-i', film, ...(music ? ['-i', music] : []),
        '-filter_complex', fitFilter(src, dst), '-map', '[v]',
        ...(music ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '160k'] : []),
        '-t', String(project.duration),
        '-c:v', 'libx264', '-crf', mode === 'draft' ? '23' : '18', '-preset', mode === 'draft' ? 'veryfast' : 'slow',
        '-movflags', '+faststart', out
      ])
      files.push({ aspect, file: out })
    }
    emit({ type: 'progress', stage: 'export', done: aspects.length, total: aspects.length, eta: null })
    return { mode, at, films: files }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

// The cover: thumb.html at 1080×1920, text kept inside the 3:4 crop by
// the page itself. A cover may use a frame of the film as its background
// (shotloop.json coverFrame: { shot, time }), read by the page from
// out/cover-frame.png
export async function renderCover(project, { at = stamp(), mode = 'final' } = {}) {
  if (!project.cover) return null
  const cf = project.config.coverFrame
  if (cf) {
    const shot = project.shots.find(s => s.id === cf.shot)
    const clip = shot && (entry(project, shot, mode).clip ?? entry(project, shot, 'draft').clip)
    if (clip) {
      fs.mkdirSync(project.out, { recursive: true })
      await ffmpeg(['-ss', String(cf.time), '-i', clip, '-frames:v', '1',
        '-vf', `scale=${project.size.width}:${project.size.height}`, path.join(project.out, 'cover-frame.png')])
    }
  }
  const out = path.join(project.out, `${project.slug}.cover.${at}.png`)
  const page = await openPage({ width: 1080, height: 1920 })
  try {
    await page.goto(pathToFileURL(project.cover).href)
    await page.evaluate('window.ready')
    await page.screenshot(out)
  } finally {
    await page.close()
  }
  return out
}

export function copyPublish(project, at = stamp()) {
  if (!project.publish) return null
  const out = path.join(project.out, `${project.slug}.publish.${at}.md`)
  fs.copyFileSync(project.publish, out)
  return out
}

// Renders whatever is missing (one shot at a time, cached shots are
// reused), then assembles and writes the publish kit
export async function exportFilm(project, { mode = 'final', aspects } = {}) {
  const missing = pendingShots(project, mode)
  for (const [i, shot] of missing.entries()) {
    emit({ type: 'log', message: `rendering ${shot.id} (${i + 1}/${missing.length}, ${mode})` })
    await renderShot(project, shot, { mode })
  }
  const film = await assemble(project, { mode, aspects })
  const cover = await renderCover(project, { at: film.at, mode })
  const publish = copyPublish(project, film.at)
  const result = { ...film, cover, publish, rendered: missing.map(s => s.id) }
  writeJson(path.join(project.out, 'latest.json'), result)
  emit({ type: 'done', what: 'export', ...result })
  return result
}
