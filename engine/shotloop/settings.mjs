// Project settings the app changes: the title, and the music bed (a
// synthesized preset, the person's own audio file, or none) with its
// volume. Each writes only its own fields of shotloop.json (updateConfig),
// so the file keeps its shape and what another command wrote meanwhile.

import fs from 'node:fs'
import path from 'node:path'
import { writeJson } from './files.mjs'
import { updateConfig } from './project.mjs'
import { unbuilt } from './starters.mjs'
import { MUSIC_MOODS, styleById } from './data.mjs'
import { composeBed, cutTimes, newSeed } from './score.mjs'

// A new bed in a mood, written as the project's music.json
export function writeBed(root, mood, project) {
  writeJson(path.join(root, 'music.json'), composeBed(mood, { seed: newSeed(), duration: project.duration, cuts: cutTimes(project) }))
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
  updateConfig(project.root, cfg => ({ ...cfg, style: id, styleChosen: true }))
  return { style: id }
}

export function setTitle(project, title) {
  title = String(title ?? '').trim().slice(0, 120)
  if (!title) throw new Error('the title is empty')
  updateConfig(project.root, cfg => ({ ...cfg, title }))
  return { title }
}

// preset: one of MUSIC_MOODS, a new bed in that mood; shuffle: another
// bed in the current mood; file: an audio file, copied into the project;
// none: no music. gain: the bed's volume, 0–2
export function setMusic(project, { preset, shuffle, file, none, gain }) {
  const own = {}
  if (gain != null) own.musicGain = Math.min(2, Math.max(0, Number(gain)))
  if (none) {
    own.music = null
  } else if (file) {
    if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`)
    const dir = path.join(project.root, 'music')
    fs.mkdirSync(dir, { recursive: true })
    const name = path.basename(file).replace(/[^\w.-]+/g, '-')
    fs.copyFileSync(file, path.join(dir, name))
    own.music = `music/${name}`
  } else if (preset || shuffle) {
    const mood = preset ?? musicInfo(project).preset
    if (!MUSIC_MOODS.includes(mood)) throw new Error(`unknown music preset ${mood} (${MUSIC_MOODS.join(', ')})`)
    writeBed(project.root, mood, project)
    own.music = 'music.json'
  }
  const cfg = updateConfig(project.root, cfg => ({ ...cfg, ...own }))
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
