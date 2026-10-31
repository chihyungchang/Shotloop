// Project settings the app changes: the title, and the music bed (a
// synthesized preset, the person's own audio file, or none) with its
// volume. Writes shotloop.json and music.json through saveConfig, so the
// file keeps its shape.

import fs from 'node:fs'
import path from 'node:path'
import { saveConfig } from './project.mjs'
import { unbuilt } from './storyboard.mjs'
import { composeBed, cutTimes, MOODS, newSeed } from './score.mjs'
import { styleById } from './styles.mjs'

// Synthesized beds: a mood, composed anew for each film (score.mjs)
export const MUSIC_PRESETS = Object.keys(MOODS)

// A new bed in a mood, written as the project's music.json
export function writeBed(root, mood, project) {
  const bed = composeBed(mood, { seed: newSeed(), duration: project.duration, cuts: cutTimes(project) })
  fs.writeFileSync(path.join(root, 'music.json'), JSON.stringify(bed, null, 2) + '\n')
}

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

// The visual style the person picked (styles.mjs): the planner keeps it
export function setStyle(project, id) {
  const style = styleById(id)
  if (!style) throw new Error(`no style "${id}"`)
  // 3D only for a 2D project made with Auto that has nothing built yet;
  // a 2D style never for a 3D project
  if (style.track === '3d' && project.track === '2d' && !(project.config.trackAuto && unbuilt(project))) {
    throw new Error('3D is only possible for a project made with Auto, before its shots are built')
  }
  if (style.track === '2d' && project.track === '3d') throw new Error('a 3D project has no 2D style')
  saveConfig(project.root, { ...project.config, style: id, styleChosen: true })
  return { style: id }
}

export function setTitle(project, title) {
  title = String(title ?? '').trim().slice(0, 120)
  if (!title) throw new Error('the title is empty')
  saveConfig(project.root, { ...project.config, title })
  return { title }
}

// preset: one of MUSIC_PRESETS, a new bed in that mood; shuffle: another
// bed in the current mood; file: an audio file, copied into the project;
// none: no music. gain: the bed's volume, 0–2
export function setMusic(project, { preset, shuffle, file, none, gain }) {
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
  } else if (preset || shuffle) {
    const mood = preset ?? musicInfo(project).preset
    if (!MOODS[mood]) throw new Error(`unknown music preset ${mood} (${MUSIC_PRESETS.join(', ')})`)
    writeBed(project.root, mood, project)
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
  const bed = JSON.parse(fs.readFileSync(project.music, 'utf8'))
  const preset = bed.mood ?? bed.preset ?? 'custom'
  return { kind: 'preset', preset, gain }
}
