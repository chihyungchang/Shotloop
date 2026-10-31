// The music bed for the whole film, made once per music and volume: a
// music.json synthesized (engine/video/music.mjs), or the person's own
// audio file cut to the film with short fades. Written where
// compose.mjs's musicWav looks, so shot previews pick it up as it is.
// A synthesized bed is tuned so the cuts land on its beats, and on its
// bar lines where they can (the 2D principles' rhythm).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { render as renderMusic, wav } from '../video/music.mjs'
import { musicKey } from './cache.mjs'
import { composeBed, cutTimes } from './score.mjs'

// The tempo near `bpm` (±12%) whose beats, and better its bar lines, sit
// closest to the cuts; `bpm` itself when there are no cuts
export function fitBpm(bpm, cuts) {
  if (!cuts.length) return bpm
  const cost = b => cuts.reduce((sum, c) => {
    const beat = 60 / b, bar = beat * 4
    const off = (x, step) => Math.abs(x - Math.round(x / step) * step)
    return sum + off(c, beat) + 0.3 * off(c, bar)
  }, 0)
  let best = bpm
  for (let b = bpm * 0.88; b <= bpm * 1.12; b += 0.25) {
    // Ties keep the tempo closest to the preset's
    if (cost(b) < cost(best) - 1e-6 || (Math.abs(cost(b) - cost(best)) < 1e-6 && Math.abs(b - bpm) < Math.abs(best - bpm))) best = b
  }
  return Math.round(best * 100) / 100
}

// Seconds the bed fades out over at the film's end, at least
export const FADE_OUT = 3

// A bed's sections fitted to the film: music.json is written for the
// length a project had when it was made, and the plan may make the film
// longer or shorter. The last section plays on to the end, so the music
// never stops before the picture; sections past the end go
export function fitSections(sections, duration) {
  const list = (sections ?? []).filter(s => s.from < duration).map(s => ({ ...s, to: Math.min(s.to, duration) }))
  if (!list.length) return [{ from: 0, to: duration, layers: ['pad', 'bass', 'hat'] }]
  const last = list.reduce((a, b) => (b.to > a.to ? b : a))
  last.to = duration
  return list
}

export function musicBed(project) {
  const key = musicKey(project)
  if (!key) return null
  const file = path.join(project.state, 'music', `${key}.wav`)
  if (fs.existsSync(file)) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const gain = project.config.musicGain ?? 1
  // Written under a temporary name, so a cut-short bed is never reused
  const part = `${file}.${process.pid}.wav`
  if (project.music.endsWith('.json')) {
    let cfg = JSON.parse(fs.readFileSync(project.music, 'utf8'))
    // A composed bed (score.mjs) is arranged again to the film as it is
    // now: the same seed keeps its key, tempo and patterns
    if (cfg.mood && cfg.seed != null) cfg = { ...cfg, ...composeBed(cfg.mood, { seed: cfg.seed, duration: project.duration, cuts: cutTimes(project) }) }
    const bpm = cfg.syncCuts === false ? cfg.bpm : fitBpm(cfg.bpm, cutTimes(project))
    fs.writeFileSync(part, wav(renderMusic({
      ...cfg, bpm, duration: project.duration, sections: fitSections(cfg.sections, project.duration),
      fadeOut: Math.max(cfg.fadeOut ?? 0, FADE_OUT), gain: (cfg.gain ?? 1) * gain
    })))
  } else {
    const d = project.duration
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', project.music, '-t', String(d),
      '-af', `volume=${gain},afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, d - FADE_OUT)}:d=${FADE_OUT}:curve=qsin`, '-ar', '44100', '-ac', '2', part])
  }
  fs.renameSync(part, file)
  return file
}
