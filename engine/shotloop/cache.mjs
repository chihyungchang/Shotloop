// Per-shot cache (docs/PRD.md §7.2, §8). A shot's frames are keyed by a
// hash of every input that changes a pixel: the world, the shot's code,
// the caption layer, the assets, the renderer and the render settings.
// An unchanged shot reuses its frames; the film is assembled from them.
//
//   .shotloop/shots/<id>/<mode>-<hash>/   frames/, clip.mp4, preview-*.mp4,
//                                         stills/, meta.json
//   .shotloop/shots/<id>/takes.json       every render of the shot
//   .shotloop/shots/<id>/error.json       the last failed render

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { finalSamples } from './settings.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ENGINE = path.resolve(HERE, '..')
export const KIT_3D = path.join(ENGINE, 'video', 'explainers', '3d', 'lib')
export const ASSETS = process.env.SHOTLOOP_ASSETS ?? path.join(ENGINE, 'video', 'assets')

// Bump when a renderer change should invalidate every cached frame
const RENDERER_VERSION = 1

export const MODES = ['draft', 'final']

// The quality the editor works in: 3D renders fast previews (half size,
// few samples) and only an export renders final frames; 2D frames are
// cheap, so 2D works in final quality and its export just joins them
export const editMode = project => (project.track === '3d' ? 'draft' : 'final')

// Files of the engine that draw pixels, per track
const RENDERER_FILES = {
  '2d': ['shotloop/render2d.mjs', 'shotloop/compose.mjs'],
  '3d': ['shotloop/render3d.mjs', 'shotloop/compose.mjs', 'shotloop/blender/run_shot.py']
}

function listFiles(dir, { skip = () => false } = {}) {
  if (!fs.existsSync(dir)) return []
  const out = []
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.') || e.name === '__pycache__' || skip(e.name)) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else out.push(p)
    }
  }
  walk(dir)
  return out
}

function hashFiles(h, root, files) {
  for (const f of files) {
    h.update(path.relative(root, f) + '\0')
    h.update(fs.readFileSync(f))
    h.update('\0')
  }
}

// Assets are large (Blender kits, HDRIs): key them by path, size and
// modification time instead of content
let assetsKey = null
function hashAssets() {
  if (assetsKey) return assetsKey
  const h = crypto.createHash('sha256')
  for (const f of listFiles(ASSETS, { skip: n => n === 'README.md' })) {
    const st = fs.statSync(f)
    h.update(`${path.relative(ASSETS, f)}:${st.size}:${Math.floor(st.mtimeMs)}\n`)
  }
  return (assetsKey = h.digest('hex'))
}

// The world's key on its own, so a world change can be reported as
// touching every shot
export function worldKey(project) {
  const h = crypto.createHash('sha256')
  hashFiles(h, project.root, listFiles(project.world))
  return h.digest('hex').slice(0, 12)
}

export function shotKey(project, shot, mode) {
  const h = crypto.createHash('sha256')
  h.update(JSON.stringify({
    v: RENDERER_VERSION,
    track: project.track,
    mode,
    fps: project.fps,
    size: project.size,
    start: shot.start,
    duration: shot.duration,
    // 3D: the final render samples (2D keys stay as they were before it)
    ...(project.track === '3d' ? { samples: mode === 'final' ? finalSamples(project) : null } : {})
  }))
  hashFiles(h, ENGINE, RENDERER_FILES[project.track].map(f => path.join(ENGINE, f)))
  hashFiles(h, project.root, listFiles(project.world))
  if (fs.existsSync(shot.code)) hashFiles(h, project.root, [shot.code])
  if (project.captions) hashFiles(h, project.root, [project.captions])
  if (project.track === '3d') {
    hashFiles(h, ENGINE, listFiles(KIT_3D))
    h.update(hashAssets())
    // Models from the asset library, copied into the project
    const own = path.join(project.root, 'assets')
    if (fs.existsSync(own)) hashFiles(h, project.root, listFiles(own))
  }
  return h.digest('hex').slice(0, 16)
}

// What went into a shot's key, part by part, so a stale shot can say
// what changed since its last render: its code, the shared scene (world,
// and for 3D the project's models), the captions, its timing, or the
// engine itself
export function keyParts(project, shot, mode) {
  const part = fill => {
    const h = crypto.createHash('sha256')
    fill(h)
    return h.digest('hex').slice(0, 10)
  }
  return {
    code: part(h => fs.existsSync(shot.code) && hashFiles(h, project.root, [shot.code])),
    scene: part(h => {
      hashFiles(h, project.root, listFiles(project.world))
      const own = path.join(project.root, 'assets')
      if (project.track === '3d' && fs.existsSync(own)) hashFiles(h, project.root, listFiles(own))
    }),
    captions: part(h => project.captions && hashFiles(h, project.root, [project.captions])),
    timing: part(h => h.update(JSON.stringify([project.fps, project.size, shot.start, shot.duration]))),
    engine: part(h => {
      h.update(JSON.stringify([RENDERER_VERSION, mode, project.track === '3d' && mode === 'final' ? finalSamples(project) : null]))
      hashFiles(h, ENGINE, RENDERER_FILES[project.track].map(f => path.join(ENGINE, f)))
      if (project.track === '3d') {
        hashFiles(h, ENGINE, listFiles(KIT_3D))
        h.update(hashAssets())
      }
    })
  }
}

// The music bed's identity: its file (a music.json or an audio file), the
// project's music volume, and the film's length (the bed is cut to it)
export function musicKey(project) {
  if (!project.music) return null
  // The cuts too: a synthesized bed is tuned to them (bed.mjs); bed2: the
  // sections run to the end and the fade out eases
  return crypto.createHash('sha256').update('bed2:').update(fs.readFileSync(project.music))
    .update(String(project.config.musicGain ?? 1)).update(`:${project.duration}`)
    .update(`:${project.shots.slice(1).map(s => s.start).join(',')}`).digest('hex').slice(0, 12)
}

export const shotState = (project, shot) => path.join(project.state, 'shots', shot.id)
export const entryDir = (project, shot, mode, key) => path.join(shotState(project, shot), `${mode}-${key}`)

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // Write then rename, so a reader never sees half a file
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

export const takes = (project, shot) => readJson(path.join(shotState(project, shot), 'takes.json'), [])

// A take is one render of a shot. Takes are numbered and timestamped so
// the app always shows the latest one and never a stale file
export function addTake(project, shot, take) {
  const list = takes(project, shot)
  const entry = { take: (list.at(-1)?.take ?? 0) + 1, at: new Date().toISOString(), ...take }
  list.push(entry)
  writeJson(path.join(shotState(project, shot), 'takes.json'), list)
  fs.rmSync(path.join(shotState(project, shot), 'error.json'), { force: true })
  return entry
}

export function recordError(project, shot, mode, error) {
  writeJson(path.join(shotState(project, shot), 'error.json'), {
    at: new Date().toISOString(),
    mode,
    message: String(error?.message ?? error)
  })
}

// A cache entry is complete when its meta.json says so; the renderer
// writes it last
export function entry(project, shot, mode, key = shotKey(project, shot, mode)) {
  const dir = entryDir(project, shot, mode, key)
  const meta = readJson(path.join(dir, 'meta.json'), null)
  const stills = ['start', 'middle', 'end'].map(n => path.join(dir, 'stills', `${n}.png`))
  return {
    key,
    dir,
    clip: meta?.clip ? path.join(dir, 'clip.mp4') : null,
    stills: stills.every(f => fs.existsSync(f)) ? stills : null,
    meta
  }
}

// cached: frames for the current inputs exist; stale: an older render
// exists but the inputs changed since; missing: never rendered
export function status(project, shot) {
  const base = shotState(project, shot)
  const out = { id: shot.id }
  for (const mode of MODES) {
    const e = entry(project, shot, mode)
    // Only an older clip makes a shot stale: test stills alone (the AI's
    // checks during a build) are not a render of the shot to watch
    const older = fs.existsSync(base)
      && fs.readdirSync(base).some(d => d.startsWith(`${mode}-`) && d !== path.basename(e.dir)
        && readJson(path.join(base, d, 'meta.json'), null)?.clip)
    const state = e.clip ? 'cached' : older ? 'stale' : 'missing'
    // Stale: what changed since the last render in this mode that
    // recorded its parts (older renders didn't: 'unknown')
    let changed = null
    if (state === 'stale') {
      const last = takes(project, shot).findLast(t => t.mode === mode)
      const now = keyParts(project, shot, mode)
      changed = last?.parts ? Object.keys(now).filter(k => now[k] !== last.parts[k]) : ['unknown']
    }
    out[mode] = {
      key: e.key,
      state,
      changed,
      clip: e.clip,
      stills: e.stills,
      seconds: e.meta?.seconds ?? null
    }
  }
  out.takes = takes(project, shot)
  out.error = readJson(path.join(base, 'error.json'), null)
  out.checks = readJson(path.join(base, 'checks.json'), null)
  // The agent's fixes and checks of this shot, oldest first, with
  // before/after stills: the shot's conversation in the app
  const fixes = path.join(base, 'fixes')
  out.fixes = (fs.existsSync(fixes) ? fs.readdirSync(fixes).sort() : [])
    .map(d => readJson(path.join(fixes, d, 'fix.json'), null))
    .filter(Boolean)
    .slice(-20)
  out.fix = out.fixes.at(-1) ?? null
  return out
}

// Removes cache entries no take refers to and that are not current
export function prune(project) {
  let removed = 0
  for (const shot of project.shots) {
    const base = shotState(project, shot)
    if (!fs.existsSync(base)) continue
    const keep = new Set(MODES.map(m => path.basename(entryDir(project, shot, m, shotKey(project, shot, m)))))
    for (const t of takes(project, shot)) keep.add(`${t.mode}-${t.key}`)
    for (const d of fs.readdirSync(base)) {
      if (/^(draft|final)-/.test(d) && !keep.has(d)) {
        fs.rmSync(path.join(base, d), { recursive: true, force: true })
        removed++
      }
    }
  }
  return removed
}
