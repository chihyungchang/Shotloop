// A Shotloop project: one video as a folder on disk (docs/PRD.md §8).
//
//   my-video/
//     shotloop.json        title, track, renderer (3D), size, fps, shot order
//     world/               page.html (+ shared files); 3D in Blender: world.py
//     shots/<id>/          shot.js, notes.md; 3D in Blender: shot.py
//     captions.html  music.json  thumb.html  publish.md  copy.md …
//     .shotloop/           cache, takes, logs (never edited by hand)
//     out/                 exported films and publish kits
//
// Shot time starts at 0; a shot's place on the film timeline is the sum
// of the durations before it, so reordering shots never edits their code.

import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_SAMPLES, round } from './data.mjs'
import { readJson, writeJson } from './files.mjs'

const FILE = 'shotloop.json'

export const SIZES = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 }
}

// A shot id, which is also its folder's name
export const SHOT_ID = /^[a-z0-9][a-z0-9-]*$/

// How a project's frames are drawn. A 2D film is a page in Chrome; a 3D
// film is one too, its world in WebGL (three.js, fast), or a scene in
// Blender (slower, higher quality). A 3D project from before the choice
// is Blender's: it has a world.py
export const RENDERERS = ['webgl', 'blender']
export function rendererOf(root, cfg) {
  if (cfg.track !== '3d') return 'page'
  return cfg.renderer ?? (fs.existsSync(path.join(root, 'world', 'world.py')) ? 'blender' : 'webgl')
}

// Drawn by a page (2D, or 3D in WebGL): render2d.mjs, the subtitle check
// and the element picker work on it
export const paged = project => project.renderer !== 'blender'

// A shot's code file for each renderer
export const codeFile = renderer => (renderer === 'blender' ? 'shot.py' : 'shot.js')

// Pages (world, captions, subtitles) are laid out in CSS px at 2/3 of the
// film's pixel size (720×1280 for 1080×1920) and captured at 1.5x
export const cssSize = size => ({ width: Math.round(size.width / 1.5), height: Math.round(size.height / 1.5) })

export function isProject(dir) {
  return fs.existsSync(path.join(dir, FILE))
}

export function loadProject(dir) {
  const root = path.resolve(dir)
  const cfg = readJson(path.join(root, FILE), null)
  if (!cfg) throw new Error(`not a Shotloop project (no ${FILE}): ${root}`)
  validate(cfg)

  const renderer = rendererOf(root, cfg)
  let t = 0
  const shots = cfg.shots.map((s, index) => {
    const shot = {
      ...s,
      index,
      start: round(t),
      end: round(t + s.duration),
      dir: path.join(root, 'shots', s.id),
      code: path.join(root, 'shots', s.id, codeFile(renderer)),
      notes: path.join(root, 'shots', s.id, 'notes.md')
    }
    t += s.duration
    return shot
  })

  const opt = name => (cfg[name] && fs.existsSync(path.join(root, cfg[name])) ? path.join(root, cfg[name]) : null)
  return {
    root,
    config: cfg,
    title: cfg.title,
    slug: cfg.slug ?? path.basename(root),
    track: cfg.track,
    renderer,
    fps: cfg.fps ?? 30,
    size: cfg.size ?? SIZES.portrait,
    duration: round(t),
    shots,
    world: path.join(root, 'world'),
    captions: opt('captions'),
    music: opt('music'),
    cover: opt('cover'),
    publish: opt('publish'),
    state: path.join(root, '.shotloop'),
    out: path.join(root, 'out')
  }
}

export function saveConfig(root, cfg) {
  validate(cfg)
  writeJson(path.join(root, FILE), cfg)
}

// shotloop.json changed by fn, read afresh: a writer that ran for a while
// (fitting the voice-over) changes only the fields it owns and keeps what
// the app or another command wrote meanwhile. Returns what was written
export function updateConfig(root, fn) {
  const cfg = fn(readJson(path.join(root, FILE)))
  saveConfig(root, cfg)
  return cfg
}

// The engine's records name the project's files by their place in it
// (projectPath) and read them back as paths in it (localPath), so a moved
// or copied project finds its files. Absolute paths written before (or by
// the agent) into a .shotloop folder are read in this project's
export const projectPath = (project, file) => path.relative(project.root, file)
export function localPath(project, file) {
  if (!path.isAbsolute(file)) return path.join(project.root, file)
  const at = file.lastIndexOf(`${path.sep}.shotloop${path.sep}`)
  return at >= 0 ? path.join(project.root, file.slice(at + 1)) : file
}

export function findShot(project, id) {
  const shot = project.shots.find(s => s.id === id)
  if (!shot) throw new Error(`no shot "${id}" (shots: ${project.shots.map(s => s.id).join(', ')})`)
  return shot
}

// 3D final quality: EEVEE render samples per frame
export const finalSamples = project => project.config.samples ?? DEFAULT_SAMPLES

// Frames are counted per shot: frame 1 is the shot's first frame
export function frameCount(project, shot) {
  return Math.round(shot.duration * project.fps)
}

function validate(cfg) {
  const fail = msg => {
    throw new Error(`${FILE}: ${msg}`)
  }
  if (cfg.version !== 1) fail('version must be 1')
  if (!['2d', '3d'].includes(cfg.track)) fail('track must be "2d" or "3d"')
  if (cfg.renderer != null && (cfg.track !== '3d' || !RENDERERS.includes(cfg.renderer))) fail(`renderer is for 3D: ${RENDERERS.join(' or ')}`)
  if (!Array.isArray(cfg.shots) || !cfg.shots.length) fail('shots must be a non-empty array')
  const ids = new Set()
  for (const s of cfg.shots) {
    if (!SHOT_ID.test(s.id ?? '')) fail(`bad shot id "${s.id}" (use a-z, 0-9, -)`)
    if (ids.has(s.id)) fail(`duplicate shot id "${s.id}"`)
    ids.add(s.id)
    if (!(s.duration > 0)) fail(`shot "${s.id}" needs a positive duration`)
  }
}
