// Renders one shot, draft or final, as stills (start, middle, end) or
// as a clip, through the cache: unchanged inputs reuse the last render.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { addTake, entry, keyParts, recordError, subtitleResult } from './cache.mjs'
import { readJson, writeJson } from './files.mjs'
import { musicBed } from './bed.mjs'
import { composeStill, emit, encodeClip, ffmpeg, frameName, renderCaptions } from './compose.mjs'
import { frameCount } from './project.mjs'
import { renderFrames2d } from './render2d.mjs'
import { renderFrames3d } from './render3d.mjs'
import { withVoice } from './voice.mjs'
import { checkSubtitles, describeIssues } from './check.mjs'

export const STILLS = ['start', 'middle', 'end']

// Local frame numbers of the three review stills
export function stillFrames(project, shot) {
  const n = frameCount(project, shot)
  return [1, Math.max(1, Math.ceil(n / 2)), n]
}

export async function renderShot(project, shot, { mode = 'draft', stills = false, force = false } = {}) {
  const e = entry(project, shot, mode)
  const what = stills ? 'stills' : 'clip'
  if (!force && (stills ? e.stills : e.clip)) {
    emit({ type: 'log', message: `${shot.id}: ${mode} ${what} cached (${e.key})` })
    return { shot: shot.id, mode, key: e.key, cached: true, ...(await outputs(project, shot, e, mode)) }
  }

  // A voiced 2D shot is checked for what its subtitles would cover first
  // (seconds, no frames): the result is kept with the shot for the app to
  // mark; fixing it is the person's call, so the render goes on
  const subtitles = await subtitleCheck(project, shot)

  const t0 = Date.now()
  const work = path.join(e.dir, `work-${process.pid}`)
  const framesDir = path.join(work, 'frames')
  const capsDir = project.captions ? path.join(work, 'captions') : null
  const n = frameCount(project, shot)
  const frames = stills ? [...new Set(stillFrames(project, shot))] : Array.from({ length: n }, (_, i) => i + 1)
  emit({ type: 'start', shot: shot.id, mode, what, key: e.key, frames: frames.length })

  try {
    fs.mkdirSync(work, { recursive: true })
    const draw = project.track === '3d' ? renderFrames3d : renderFrames2d
    await draw(project, shot, mode, framesDir, frames)
    if (capsDir) await renderCaptions(project, shot, mode, capsDir, frames)

    // Stills come with every render: they are what the checks look at
    const [a, b, c] = stillFrames(project, shot)
    for (const [name, f] of [[STILLS[0], a], [STILLS[1], b], [STILLS[2], c]]) {
      await composeStill(
        path.join(framesDir, frameName(f)),
        capsDir ? path.join(capsDir, frameName(f)) : null,
        path.join(e.dir, 'stills', `${name}.jpg`)
      )
    }
    if (!stills) {
      emit({ type: 'log', message: `${shot.id}: encoding` })
      await encodeClip(project, mode, framesDir, capsDir, path.join(e.dir, 'clip.mp4'))
    }

    const seconds = Math.round((Date.now() - t0) / 100) / 10
    const prev = readJson(path.join(e.dir, 'meta.json'), {})
    // meta.json is written last: its presence marks the entry complete
    writeJson(path.join(e.dir, 'meta.json'), {
      ...prev,
      key: e.key,
      mode,
      shot: shot.id,
      start: shot.start,
      duration: shot.duration,
      clip: prev.clip || !stills,
      seconds: stills ? prev.seconds ?? null : seconds,
      stillsSeconds: stills ? seconds : prev.stillsSeconds ?? null,
      renderedAt: new Date().toISOString()
    })
    const done = entry(project, shot, mode, e.key)
    const out = await outputs(project, shot, done, mode)
    const take = addTake(project, shot, { mode, kind: what, key: e.key, parts: keyParts(project, shot, mode), seconds, ...out })
    emit({ type: 'done', shot: shot.id, mode, what, key: e.key, seconds, take: take.take })
    return { shot: shot.id, mode, key: e.key, cached: false, take: take.take, seconds, ...out, ...(subtitles ? { subtitles } : {}) }
  } catch (err) {
    recordError(project, shot, mode, err)
    throw err
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

async function subtitleCheck(project, shot) {
  if (project.track !== '2d') return null
  // These frames were checked already
  const known = subtitleResult(project, shot)
  if (known) return known.issues
  try {
    const { checked, issues } = await checkSubtitles(project, { shot: shot.id })
    if (!checked) return null
    for (const l of describeIssues(issues)) emit({ type: 'log', message: l })
    return issues
  } catch (err) {
    // The check is advice before a render: the render goes on, and says why
    emit({ type: 'log', message: `subtitle check skipped: ${err.message}` })
    return null
  }
}

async function outputs(project, shot, e, mode) {
  return {
    stills: e.stills,
    clip: e.clip,
    preview: e.clip ? await preview(project, shot, e.clip, mode) : null
  }
}

// The shot as the film plays it: its subtitles, the music and the voice
async function preview(project, shot, clip, mode) {
  const clips = project.shots.map(s => (s.id === shot.id ? clip : null))
  const { clips: dressed, audio } = await withVoice(project, mode, clips, musicBed(project))
  if (!audio) return dressed[shot.index]
  // Next to the shot's own clip, named by what went in
  const out = path.join(path.dirname(clip), `preview-${createHash('sha256').update(`${dressed[shot.index]}:${path.basename(audio)}`).digest('hex').slice(0, 12)}.mp4`)
  if (fs.existsSync(out)) return out
  await ffmpeg([
    '-i', dressed[shot.index], '-ss', String(shot.start), '-t', String(shot.duration), '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart', out
  ])
  return out
}
