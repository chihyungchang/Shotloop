// Project settings the app changes: the title, and the music bed (a
// synthesized preset, the person's own audio file, or none) with its
// volume. Writes shotloop.json and music.json through saveConfig, so the
// file keeps its shape.

import fs from 'node:fs'
import path from 'node:path'
import { saveConfig } from './project.mjs'

// Synthesized beds (engine/video/music.mjs): chords one per bar, layers
const PRESETS = {
  calm: { bpm: 72, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], layers: ['pad', 'bass'] },
  bright: { bpm: 108, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], layers: ['pad', 'bass', 'arp', 'hat'] },
  groove: { bpm: 118, chords: [[62, 65, 69], [58, 62, 65], [53, 57, 60], [60, 64, 67]], layers: ['pad', 'bass', 'arp', 'kick', 'hat'] },
  tech: { bpm: 96, chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]], layers: ['pad', 'arp', 'hat'] }
}
export const MUSIC_PRESETS = Object.keys(PRESETS)

// 3D final quality: EEVEE render samples per frame. 24 looks the same as
// 64 on these scenes (SSIM 0.9999) at well under half the time; more
// helps fine glossy detail and fast motion blur
export const DEFAULT_SAMPLES = 24
export const finalSamples = project => project.config.samples ?? DEFAULT_SAMPLES

// samples: 4–512, or null for the default
export function setSamples(project, samples) {
  const cfg = { ...project.config }
  if (samples == null) delete cfg.samples
  else {
    const n = Math.round(Number(samples))
    if (!(n >= 4 && n <= 512)) throw new Error('samples must be 4–512')
    cfg.samples = n
  }
  saveConfig(project.root, cfg)
  return { samples: cfg.samples ?? DEFAULT_SAMPLES, custom: cfg.samples != null, default: DEFAULT_SAMPLES }
}

export function setTitle(project, title) {
  title = String(title ?? '').trim()
  if (!title) throw new Error('the title is empty')
  saveConfig(project.root, { ...project.config, title: title.slice(0, 120) })
  return { title }
}

// preset: one of MUSIC_PRESETS; file: an audio file, copied into the
// project; none: no music. gain: the bed's volume, 0–2
export function setMusic(project, { preset, file, none, gain }) {
  const cfg = { ...project.config }
  if (gain != null) cfg.musicGain = Math.min(2, Math.max(0, Number(gain)))
  if (none) {
    cfg.music = null
  } else if (file) {
    if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`)
    const dir = path.join(project.root, 'music')
    fs.mkdirSync(dir, { recursive: true })
    const name = path.basename(file).replace(/[^\w.-]+/g, '-')
    fs.copyFileSync(file, path.join(dir, name))
    cfg.music = `music/${name}`
  } else if (preset) {
    const p = PRESETS[preset]
    if (!p) throw new Error(`unknown music preset ${preset} (${MUSIC_PRESETS.join(', ')})`)
    const bed = { preset, bpm: p.bpm, duration: project.duration, chords: p.chords,
      sections: [{ from: 0, to: project.duration, layers: p.layers }], hits: [], risers: [], fadeIn: 0.2, fadeOut: 1.5 }
    fs.writeFileSync(path.join(project.root, 'music.json'), JSON.stringify(bed, null, 2) + '\n')
    cfg.music = 'music.json'
  }
  saveConfig(project.root, cfg)
  return musicInfo({ ...project, config: cfg, music: cfg.music && path.join(project.root, cfg.music) })
}

// What the app shows: the kind, the preset or the file name, the volume
export function musicInfo(project) {
  const gain = project.config.musicGain ?? 1
  if (!project.music || !fs.existsSync(project.music)) return { kind: 'none', gain }
  if (!project.music.endsWith('.json')) return { kind: 'file', name: path.basename(project.music), gain }
  const preset = JSON.parse(fs.readFileSync(project.music, 'utf8')).preset ?? 'custom'
  return { kind: 'preset', preset, gain }
}
