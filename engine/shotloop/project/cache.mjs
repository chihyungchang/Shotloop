// Per-shot cache (docs/PRD.md §7.2, §8). A shot's frames are keyed by a
// hash of every input that changes a pixel: the world, the shot's code,
// the models it loads, the renderer and the render settings.
// An unchanged shot reuses its frames; the film is assembled from them.
// Keys hash files by their place in the project, never by absolute path,
// so a copied project (an example opened as a draft) finds its cache.
//
//   .shotloop/shots/<id>/<mode>-<hash>/   frames/, clip.mp4, preview-*.mp4,
//                                         stills/, meta.json
//   .shotloop/shots/<id>/takes.json       every render of the shot
//   .shotloop/shots/<id>/error.json       the last failed render
//   .shotloop/music/<key>.wav             the music bed (bed.mjs)

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { subtitleStyle, timedLines, voiceCues, voiceLang } from '../voiceover/cues.mjs'
import { pageLayout, subtitleLookKey } from '../data.mjs'
import { readJson, writeJson } from './files.mjs'
import { IMAGES_DIR, SITE_DIR } from '../promo/images.mjs'
import { REPO_DIR } from '../promo/repo.mjs'
import { localPath, projectPath } from './project.mjs'
import { cutTimes } from '../sound/score.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// engine/shotloop, whose files engineCode() names, and engine/
const SHOTLOOP = path.resolve(HERE, '..')
export const ENGINE = path.resolve(SHOTLOOP, '..')

// Bump when a renderer change should invalidate every cached frame
const RENDERER_VERSION = 2

export const MODES = ['draft', 'final']

// The three review stills of every render, in order
export const STILLS = ['start', 'middle', 'end']

// The quality the editor works in: a page's frames are cheap, so the
// editor works in final quality and an export just joins them
export const editMode = () => 'final'

// Files of the engine that draw pixels
const RENDERER_FILES = ['shotloop/render/render2d.mjs', 'shotloop/render/compose.mjs']

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

const digest = fill => {
  const h = crypto.createHash('sha256')
  fill(h)
  return h.digest('hex').slice(0, 16)
}

// Engine files that shape an output beside the renderers (the music bed,
// the subtitle layer), hashed once per process
const codeKeys = new Map()
export function engineCode(...files) {
  const id = files.join('\0')
  if (!codeKeys.has(id)) codeKeys.set(id, digest(h => hashFiles(h, SHOTLOOP, files.map(f => path.join(SHOTLOOP, f)))))
  return codeKeys.get(id)
}

// The world's key on its own, so a world change can be reported as
// touching every shot
export function worldKey(project) {
  const h = crypto.createHash('sha256')
  hashFiles(h, project.root, listFiles(project.world))
  return h.digest('hex').slice(0, 12)
}

// What goes into a shot's frames, part by part: its code, the shared
// scene (the world, for 3D the models copied into the project, for a
// product promo its material: the person's pictures, the repository's
// and the page's), its
// timing (with the voice-over's sentences and times, which its code may
// follow: ctx.voice), and the engine (renderer, mode). A stale shot says
// which parts changed since its last render
export function keyParts(project, shot, mode) {
  const own = path.join(project.root, 'assets')
  return {
    code: digest(h => fs.existsSync(shot.code) && hashFiles(h, project.root, [shot.code])),
    scene: digest(h => {
      hashFiles(h, project.root, listFiles(project.world))
      if (project.track === '3d' && fs.existsSync(own)) hashFiles(h, project.root, listFiles(own))
      if (project.config.promo) for (const dir of [IMAGES_DIR, REPO_DIR, SITE_DIR]) hashFiles(h, project.root, listFiles(path.join(project.root, dir)))
    }),
    // Empty since the caption layer went with Blender, kept so films keep their keys
    captions: digest(() => {}),
    timing: digest(h => h.update(JSON.stringify([project.fps, project.size, shot.start, shot.duration, voiceCues(project, shot)]))),
    engine: digest(h => {
      // A 3D film says so (null: where Blender's samples were), so keys made before stay valid
      h.update(JSON.stringify([RENDERER_VERSION, project.track, mode, null, ...(project.track === '3d' ? ['webgl'] : [])]))
      hashFiles(h, ENGINE, RENDERER_FILES.map(f => path.join(ENGINE, f)))
    })
  }
}

// A shot's frames' key: every part of it
export const shotKey = (project, shot, mode) => digest(h => h.update(JSON.stringify(keyParts(project, shot, mode))))

// The music bed's identity: its file (a music.json or an audio file), the
// project's music volume, the film's length (the bed is cut to it), its
// cuts (a synthesized bed is tuned to them) and the code that makes it
export function musicKey(project) {
  if (!project.music) return null
  return digest(h => h.update(engineCode('sound/bed.mjs', 'sound/score.mjs', 'sound/synth.mjs')).update(fs.readFileSync(project.music))
    .update(JSON.stringify([project.config.musicGain ?? 1, project.duration, cutTimes(project)])))
}

const shotState = (project, shot) => path.join(project.state, 'shots', shot.id)
const entryDir = (project, shot, mode, key) => path.join(shotState(project, shot), `${mode}-${key}`)

// A shot's last subtitle check (check.mjs), kept with the shot and valid
// while its frames, the subtitle layer, its look and the language are
// unchanged: the app marks the shot until its code (or the voice)
// changes. Null when not checked since
const subtitleFile = (project, shot) => path.join(shotState(project, shot), 'subtitles.json')
// The lines spoken during the shot count too: another shot's line may run
// over the cut into it
const subtitleKey = (project, shot, finalKey) =>
  digest(h => h.update(JSON.stringify([finalKey, engineCode('voiceover/subtitles.mjs', 'voiceover/cues.mjs', 'voiceover/check.mjs', 'voiceover/words.mjs'), voiceLang(project), subtitleLookKey(subtitleStyle(project)), pageLayout(project.size).safeRight,
    // The voice and its speed time the words (each line's speech)
    project.config.voice?.voice ?? null, project.config.voice?.speed ?? 1,
    timedLines(project).filter(l => l.shot !== shot.id && l.at < shot.start + shot.duration && l.end > shot.start).map(l => [l.text, l.at - shot.start, l.end - shot.start])])))

export function subtitleResult(project, shot, finalKey = shotKey(project, shot, 'final')) {
  const r = readJson(subtitleFile(project, shot), null)
  return r && r.key === subtitleKey(project, shot, finalKey) ? { at: r.at, issues: r.issues } : null
}

export function saveSubtitleResult(project, shot, issues) {
  writeJson(subtitleFile(project, shot), { key: subtitleKey(project, shot, shotKey(project, shot, 'final')), at: new Date().toISOString(), issues })
}

// A take's files are kept by their place in the project and read back
// as paths in it, so a moved or copied project still finds them
const TAKE_FILES = ['clip', 'preview', 'stills']
const mapFiles = (take, f) => ({ ...take, ...Object.fromEntries(TAKE_FILES.filter(k => take[k]).map(k => [k, Array.isArray(take[k]) ? take[k].map(f) : f(take[k])])) })

export const takes = (project, shot) =>
  readJson(path.join(shotState(project, shot), 'takes.json'), []).map(t => mapFiles(t, p => localPath(project, p)))

// A take is one render of a shot. Takes are numbered and timestamped so
// the app always shows the latest one and never a stale file
export function addTake(project, shot, take) {
  const file = path.join(shotState(project, shot), 'takes.json')
  const list = readJson(file, [])
  const entry = { take: (list.at(-1)?.take ?? 0) + 1, at: new Date().toISOString(), ...take }
  writeJson(file, [...list, mapFiles(entry, p => projectPath(project, p))])
  fs.rmSync(path.join(shotState(project, shot), 'error.json'), { force: true })
  return entry
}

// A file made once and kept: returned when it is there, else made by
// make(part) under a temporary name and renamed into place, so a file cut
// short (a crash, two processes at once) is never taken for a finished one
export async function cachedFile(file, make) {
  if (fs.existsSync(file)) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const ext = path.extname(file)
  const part = `${file.slice(0, file.length - ext.length)}.${process.pid}.part${ext}`
  try {
    await make(part)
    fs.renameSync(part, file)
  } finally {
    fs.rmSync(part, { recursive: true, force: true })
  }
  return file
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
  // JPEG since 0.7; renders from before keep their PNGs
  const stills = STILLS.map(n => ['jpg', 'png'].map(x => path.join(dir, 'stills', `${n}.${x}`)).find(f => fs.existsSync(f)))
  return {
    key,
    dir,
    clip: meta?.clip ? path.join(dir, 'clip.mp4') : null,
    stills: stills.every(Boolean) ? stills : null,
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
    // recorded its parts (older renders didn't: 'unknown'). Takes before
    // 0.10 kept the first 10 digits of each part
    let changed = null
    if (state === 'stale') {
      const last = takes(project, shot).findLast(t => t.mode === mode)
      const now = keyParts(project, shot, mode)
      changed = last?.parts ? Object.keys(now).filter(k => !last.parts[k] || !now[k].startsWith(last.parts[k])) : ['unknown']
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
  out.subtitles = subtitleResult(project, shot, out.final.key)
  // The agent's fixes and checks of this shot, oldest first, with
  // before/after stills: the shot's conversation in the app
  const fixes = path.join(base, 'fixes')
  // (the agent records its stills by absolute path: read in this project)
  const here = p => localPath(project, p)
  out.fixes = (fs.existsSync(fixes) ? fs.readdirSync(fixes).sort() : [])
    .map(d => readJson(path.join(fixes, d, 'fix.json'), null))
    .filter(Boolean)
    .slice(-20)
    .map(f => ({ ...f, before: f.before?.map(here) ?? null, after: f.after?.map(here) ?? null, record: f.record && here(f.record) }))
  out.fix = out.fixes.at(-1) ?? null
  return out
}

// Removes cache entries no take refers to and that are not current, and
// music beds and screen renders the film no longer uses. Files younger
// than ten minutes stay: a render may be writing them
export function prune(project) {
  const recent = Date.now() - 10 * 60 * 1000
  const sweep = (dir, keep) => {
    if (!fs.existsSync(dir)) return 0
    const old = fs.readdirSync(dir).filter(f => f !== keep && fs.statSync(path.join(dir, f)).mtimeMs < recent)
    for (const f of old) fs.rmSync(path.join(dir, f), { recursive: true, force: true })
    return old.length
  }
  let removed = sweep(path.join(project.state, 'music'), `${musicKey(project)}.wav`)
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
