// A Shotloop project: one video as a folder on disk (docs/PRD.md §8).
//
//   my-video/
//     shotloop.json        title, track, size, fps, shot order
//     world/               3D: world.py; 2D: page.html (+ shared files)
//     shots/<id>/          shot.py | shot.js, notes.md
//     captions.html  music.json  thumb.html  publish.md  copy.md …
//     .shotloop/           cache, takes, logs (never edited by hand)
//     out/                 exported films and publish kits
//
// Shot time starts at 0; a shot's place on the film timeline is the sum
// of the durations before it, so reordering shots never edits their code.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FILE = 'shotloop.json'

export const SIZES = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 }
}

export function isProject(dir) {
  return fs.existsSync(path.join(dir, FILE))
}

export function loadProject(dir) {
  const root = path.resolve(dir)
  const file = path.join(root, FILE)
  if (!fs.existsSync(file)) throw new Error(`not a Shotloop project (no ${FILE}): ${root}`)
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'))
  validate(cfg)

  let t = 0
  const shots = cfg.shots.map((s, index) => {
    const shot = {
      ...s,
      index,
      start: round(t),
      end: round(t + s.duration),
      dir: path.join(root, 'shots', s.id),
      code: path.join(root, 'shots', s.id, cfg.track === '3d' ? 'shot.py' : 'shot.js'),
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
    fps: cfg.fps ?? 30,
    size: cfg.size ?? SIZES.portrait,
    duration: round(t),
    shots,
    world: path.join(root, 'world'),
    captions: opt('captions'),
    music: opt('music'),
    cover: opt('cover'),
    publish: opt('publish'),
    checklist: opt('checklist') ?? fileURLToPath(new URL('checklist.md', import.meta.url)),
    state: path.join(root, '.shotloop'),
    out: path.join(root, 'out')
  }
}

export function saveConfig(root, cfg) {
  validate(cfg)
  fs.writeFileSync(path.join(root, FILE), JSON.stringify(cfg, null, 2) + '\n')
}

export function findShot(project, id) {
  const shot = project.shots.find(s => s.id === id)
  if (!shot) throw new Error(`no shot "${id}" (shots: ${project.shots.map(s => s.id).join(', ')})`)
  return shot
}

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
  if (!Array.isArray(cfg.shots) || !cfg.shots.length) fail('shots must be a non-empty array')
  const ids = new Set()
  for (const s of cfg.shots) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id ?? '')) fail(`bad shot id "${s.id}" (use a-z, 0-9, -)`)
    if (ids.has(s.id)) fail(`duplicate shot id "${s.id}"`)
    ids.add(s.id)
    if (!(s.duration > 0)) fail(`shot "${s.id}" needs a positive duration`)
  }
}

const round = x => Math.round(x * 1000) / 1000
