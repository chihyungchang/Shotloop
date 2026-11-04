// The film from its shots: concatenates the cached clip of every shot
// (with the voice-over's subtitles), lays the sound under it (the music
// bed, ducked under the voice-over) and exports MP4 (H.264 + AAC) at 9:16 and
// 16:9, plus the publish kit (cover PNG and per-platform post).
//
// Every output carries its mode and a timestamp in its name, and
// out/latest.json points at the newest export, so an older file can't
// be mistaken for a new one.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cachedFile, entry, takes } from '../project/cache.mjs'
import { writeJson } from '../project/files.mjs'
import { musicBed } from '../sound/bed.mjs'
import { emit, ffmpeg, openRenderPage, pixelSize, QUALITY } from './compose.mjs'
import { findShot, loadProject, projectPath, updateConfig } from '../project/project.mjs'
import { renderShot, stillFrames } from './render.mjs'
import { dressFilm } from '../voiceover/voice.mjs'
import { assertSubtitlesClear } from '../voiceover/check.mjs'
import { deliver } from '../project/deliver.mjs'

const ASPECTS = { '9:16': [9, 16], '16:9': [16, 9] }

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

// Shots whose clip for this mode is missing or stale
const pendingShots = (project, mode) => project.shots.filter(s => !entry(project, s, mode).clip)

// Stops a film with shots that have no clip in this mode (shots: those)
function assertRendered(shots, mode) {
  if (shots.length) throw new Error(`not rendered (${mode}): ${shots.map(s => s.id).join(', ')}; render them first`)
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

// The shots' clips joined into out as they are: they share codec and
// settings (dressed with subtitles or not), so nothing is encoded again
async function joinClips(clips, out) {
  const list = `${out}.txt`
  fs.writeFileSync(list, clips.map(c => `file '${c.replaceAll("'", "'\\''")}'`).join('\n') + '\n')
  try {
    emit({ type: 'log', message: `joining ${clips.length} shots` })
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out])
  } finally {
    fs.rmSync(list, { force: true })
  }
}

export async function assemble(project, { mode = 'draft', aspects = ['9:16', '16:9'] } = {}) {
  assertRendered(pendingShots(project, mode), mode)
  for (const a of aspects) if (!ASPECTS[a]) throw new Error(`unknown aspect ${a} (9:16 or 16:9)`)
  const work = path.join(project.state, `film-${process.pid}`)
  fs.mkdirSync(work, { recursive: true })
  const at = stamp()

  try {
    // An export never leaves the voice-over out silently (strict)
    const { clips, audio: music } = await dressFilm(project, mode, project.shots.map(s => entry(project, s, mode).clip), await musicBed(project), { strict: true })
    const film = path.join(work, 'film.mp4')
    await joinClips(clips, film)

    const src = pixelSize(project, mode)
    const files = []
    for (const [i, aspect] of aspects.entries()) {
      const dst = aspectSize(project, mode, aspect)
      emit({ type: 'progress', stage: 'export', done: i, total: aspects.length, eta: null })
      const out = await cachedFile(path.join(project.out, `${project.slug}.${mode}.${aspect.replace(':', 'x')}.${at}.mp4`), part => ffmpeg([
        '-i', film, ...(music ? ['-i', music] : []),
        '-filter_complex', fitFilter(src, dst), '-map', '[v]',
        ...(music ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '160k'] : []),
        '-t', String(project.duration),
        '-c:v', 'libx264', ...QUALITY[mode],
        '-movflags', '+faststart', part
      ]))
      files.push({ aspect, file: out })
    }
    emit({ type: 'progress', stage: 'export', done: aspects.length, total: aspects.length, eta: null })
    return { mode, at, films: files }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

// The whole film to watch in the app: the shots' clips joined as they
// are, with the music under them, at the project's own aspect. Cached by
// what went in, so watching it again costs nothing.
// A shot whose frames are out of date plays its latest clip in this mode
// (listed in `stale`), so watching never waits for renders; only a shot
// with no clip at all stops it.
export async function filmPreview(project, { mode = 'draft' } = {}) {
  const stale = []
  const clips = project.shots.map(s => {
    const current = entry(project, s, mode).clip
    if (current) return current
    const last = takes(project, s).findLast(t => t.mode === mode && t.clip && fs.existsSync(t.clip))?.clip
    if (last) stale.push(s.id)
    return last ?? null
  })
  assertRendered(project.shots.filter((s, i) => !clips[i]), mode)
  const { clips: dressed, audio: music } = await dressFilm(project, mode, clips, await musicBed(project))
  // By the files' places in the project, so a copy of it finds the film
  const key = createHash('sha256').update(JSON.stringify([...dressed, music].map(f => f && projectPath(project, f)).concat(project.duration))).digest('hex').slice(0, 16)
  const dir = path.join(project.state, 'film')
  const file = path.join(dir, `${mode}-${key}.mp4`)
  if (fs.existsSync(file)) return { mode, file, cached: true, stale }

  await cachedFile(file, async part => {
    if (!music) return joinClips(dressed, part)
    const joined = part.replace(/\.mp4$/, '.joined.mp4')
    try {
      await joinClips(dressed, joined)
      await ffmpeg(['-i', joined, '-i', music, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
        '-t', String(project.duration), '-movflags', '+faststart', part])
    } finally {
      fs.rmSync(joined, { force: true })
    }
  })
  // One preview per mode: older ones go
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${mode}-`) && f !== path.basename(file)) fs.rmSync(path.join(dir, f), { force: true })
  return { mode, file, cached: false, stale }
}

// The cover: thumb.html at 1080×1920, text kept inside the 3:4 crop by
// the page itself. A cover may use a frame of the film as its background
// (shotloop.json coverFrame: { shot, time }, time within the shot), read
// by the page from out/cover-frame.png. Without a clip of the shot yet,
// the nearest of its stills stands in.
// preview: rendered to .shotloop/cover.png (the AI's drafts and the
// export panel's preview) instead of a new file in out/
export async function renderCover(project, { at = stamp(), mode = 'final', preview = false } = {}) {
  if (!project.cover) return null
  fs.mkdirSync(project.out, { recursive: true })
  const frame = path.join(project.out, 'cover-frame.png')
  const cf = project.config.coverFrame
  const shot = cf && project.shots.find(s => s.id === cf.shot)
  const src = shot && coverSource(project, shot, Number(cf.time) || 0, mode)
  if (src) {
    await ffmpeg([...(src.clip ? ['-ss', String(src.time), '-i', src.clip] : ['-i', src.still]), '-frames:v', '1',
      '-vf', `scale=${project.size.width}:${project.size.height}`, frame])
  } else {
    fs.rmSync(frame, { force: true })
  }
  const out = preview ? path.join(project.state, 'cover.png') : path.join(project.out, `${project.slug}.cover.${at}.png`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  // A fresh load (t): the page may have been rewritten since the last one
  const page = await openRenderPage(project.cover, { width: 1080, height: 1920 }, { render: false, query: { t: Date.now() } })
  try {
    await page.screenshot(out)
  } finally {
    await page.close()
  }
  return out
}

// Where the cover's frame comes from: the shot's clip (this mode, else
// the other), else its nearest still
function coverSource(project, shot, time, mode) {
  time = Math.min(Math.max(0, time), Math.max(0, shot.duration - 1 / project.fps))
  for (const m of [mode, mode === 'final' ? 'draft' : 'final']) {
    const clip = entry(project, shot, m).clip
    if (clip) return { clip, time }
  }
  const stills = entry(project, shot, 'final').stills ?? entry(project, shot, 'draft').stills
    ?? takes(project, shot).findLast(t => t.stills?.every(f => fs.existsSync(f)))?.stills
  if (!stills) return null
  const at = stillFrames(project, shot).map(f => (f - 1) / project.fps)
  const i = at.reduce((best, t, k) => (Math.abs(t - time) < Math.abs(at[best] - time) ? k : best), 0)
  return { still: stills[i] }
}

// The cover's background frame: { shot, time } or null for none
export function setCoverFrame(project, frame) {
  if (frame) {
    findShot(project, frame.shot)
    if (!(Number(frame.time) >= 0)) throw new Error('the cover frame needs a time ≥ 0 within the shot')
  }
  updateConfig(project.root, ({ coverFrame: _, ...cfg }) => (frame ? { ...cfg, coverFrame: { shot: frame.shot, time: Number(frame.time) } } : cfg))
  return loadProject(project.root)
}

function copyPublish(project, at) {
  if (!project.publish) return null
  const out = path.join(project.out, `${project.slug}.publish.${at}.md`)
  fs.copyFileSync(project.publish, out)
  return out
}

// Renders whatever is missing (one shot at a time, cached shots are
// reused), then assembles and writes the publish kit. Each part can be
// left out (video, cover, publish: false); the copy comes only once the
// AI has written it (publish.json). to: also deliver the files into a
// new folder there, named after the work (deliver.mjs)
export async function exportFilm(project, { mode = 'final', aspects, video = true, cover: withCover = true, publish: withPublish = true, to, name, lang } = {}) {
  // A film whose subtitles cover what the viewer must see is not exported
  if (video) await assertSubtitlesClear(project)
  const missing = video ? pendingShots(project, mode) : []
  for (const [i, shot] of missing.entries()) {
    emit({ type: 'log', message: `rendering ${shot.id} (${i + 1}/${missing.length}, ${mode})` })
    await renderShot(project, shot, { mode })
  }
  const film = video ? await assemble(project, { mode, aspects }) : { mode, at: stamp(), films: [] }
  const cover = withCover ? await renderCover(project, { at: film.at, mode }) : null
  const written = fs.existsSync(path.join(project.root, 'publish.json'))
  const publish = withPublish && written ? copyPublish(project, film.at) : null
  // The film's visual style (or 3d), for the app's usage counts
  const style = project.track === '3d' ? '3d' : project.config.style ?? null
  let result = { ...film, cover, publish, folder: null, rendered: missing.map(s => s.id), style }
  if (to) result = deliver(project, result, { to, name, lang })
  writeJson(path.join(project.out, 'latest.json'), result)
  emit({ type: 'done', what: 'export', ...result })
  return result
}
