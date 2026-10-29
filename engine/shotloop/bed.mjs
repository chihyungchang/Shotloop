// The music bed for the whole film, made once per music and volume: a
// music.json synthesized (engine/video/music.mjs), or the person's own
// audio file cut to the film with short fades. Written where
// compose.mjs's musicWav looks, so shot previews pick it up as it is.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { render as renderMusic, wav } from '../video/music.mjs'
import { musicKey } from './cache.mjs'

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
    const cfg = JSON.parse(fs.readFileSync(project.music, 'utf8'))
    fs.writeFileSync(part, wav(renderMusic({ ...cfg, duration: project.duration, gain: (cfg.gain ?? 1) * gain })))
  } else {
    const d = project.duration
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', project.music, '-t', String(d),
      '-af', `volume=${gain},afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, d - 1.5)}:d=1.5`, '-ar', '44100', '-ac', '2', part])
  }
  fs.renameSync(part, file)
  return file
}
