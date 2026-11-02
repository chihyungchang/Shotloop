// New projects and project summaries for the app's Home and All projects.
//
// newProject writes a starter project that renders as it is: the idea
// goes into copy.md and every shot's notes, and each shot gets placeholder
// code (2D: a title card per shot; 3D: a small stage and one camera move
// per shot) for the agent and the person to replace step by step.

import fs from 'node:fs'
import path from 'node:path'
import { editMode, entry, takes } from './cache.mjs'
import { DEFAULT_STYLE, firstLine, lookById, LOOKS, round, STYLES, styleById } from './data.mjs'
import { isProject, loadProject, saveConfig, SIZES } from './project.mjs'
import { writeBed } from './settings.mjs'
import { starterCover, writePlan, writeShots, writeWorld2d, writeWorld3d } from './starters.mjs'
import { voiceOn } from './cues.mjs'

// Shots of about 5 s, a short hook first and an end card last
function planShots(duration) {
  const n = Math.max(3, Math.round(duration / 5))
  const hook = round(Math.min(3, duration / n), 1)
  const end = round(Math.min(3, duration / n), 1)
  const middle = n - 2
  const each = round((duration - hook - end) / middle, 1)
  const shots = [{ id: '01-hook', title: 'Hook', duration: hook }]
  for (let i = 0; i < middle; i++) {
    shots.push({ id: `${String(i + 2).padStart(2, '0')}-beat-${i + 1}`, title: `Beat ${i + 1}`, duration: each })
  }
  // The end card absorbs rounding so the film is exactly `duration`
  const used = shots.reduce((t, s) => t + s.duration, 0)
  shots.push({ id: `${String(n).padStart(2, '0')}-end`, title: 'End card', duration: round(duration - used, 1) })
  return shots
}

// The music a new film starts with: a mood that suits its style (the
// person changes it in Export), composed anew for this film
const STYLE_MOOD = { scene: 'calm', map: 'calm', '3d': 'calm', infographic: 'bright', kinetic: 'groove', ui: 'tech', blueprint: 'tech', news: 'tense' }
const startMood = style => STYLE_MOOD[style] ?? 'bright'

// track 'auto': made as 2D, and the planner may turn it into 3D
// (applyStoryboard); duration 'auto': the planner picks 15–60 s from the
// content, the starter shots fill 30 s until then. style: a 2D visual
// style the person chose (styles.mjs), kept by the planner; none: the
// planner picks. voice: the film has a voice-over (voice.mjs)
export function newProject(dir, { title, idea = '', track = '2d', aspect = '9:16', duration = 30, look = '', style = '', voice = true }) {
  const root = path.resolve(dir)
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error(`${root} exists and is not empty`)
  if (!['2d', '3d', 'auto'].includes(track)) throw new Error('track must be 2d, 3d or auto')
  if (style && styleById(style)?.track !== '2d') throw new Error(`style must be a 2D style (${STYLES.filter(s => s.track === '2d').map(s => s.id).join(', ')})`)
  if (style && track === '3d') throw new Error('a visual style is for 2D')
  if (style === 'scene' && look && !lookById(look)?.scene) throw new Error(`the look "${look}" has no cinematic scene colors`)
  // A 2D style chosen settles the track
  const trackAuto = track === 'auto' && !style
  if (track === 'auto') track = '2d'
  const lengthAuto = duration === 'auto'
  if (lengthAuto) duration = 30
  duration = Number(duration)
  if (!(duration >= 6 && duration <= 180)) throw new Error('duration must be 6–180 s or auto')
  // A look the person chose; none: the planner picks one
  if (look && !lookById(look)) throw new Error(`no look "${look}" (${LOOKS.map(l => l.id).join(', ')})`)
  const size = aspect === '16:9' ? SIZES.landscape : SIZES.portrait
  title = title?.trim() || firstLine(idea) || path.basename(root)
  idea = idea.trim()
  const shots = planShots(duration)
  // The starter cards say the idea first and end on a follow
  const plan = shots.map((s, i) => ({ ...s, text: i === 0 ? firstLine(idea || title) : i === shots.length - 1 ? 'Follow for *more*' : '' }))

  fs.mkdirSync(root, { recursive: true })
  if (track === '2d') writeWorld2d(root, look || null, size, style || DEFAULT_STYLE)
  else writeWorld3d(root, size)
  writeShots(root, track, plan, 'created from the idea')
  writePlan(root, title, plan, { idea })
  fs.writeFileSync(path.join(root, 'thumb.html'), starterCover(title))
  fs.writeFileSync(path.join(root, 'publish.md'), `# ${title} · Publish\n\n(written by the agent from copy.md: Export → Publish copy)\n`)
  fs.writeFileSync(path.join(root, '.gitignore'), '.shotloop/\nout/\n')
  saveConfig(root, {
    version: 1,
    title,
    slug: path.basename(root),
    track,
    fps: 30,
    size,
    shots,
    music: 'music.json',
    cover: 'thumb.html',
    publish: 'publish.md',
    ...(track === '2d' && look ? { look } : {}),
    ...(trackAuto ? { trackAuto: true } : {}),
    ...(style ? { style, styleChosen: true } : {}),
    ...(lengthAuto ? { lengthAuto: true } : {}),
    // The voice-over: on for a new film unless the person turned it off;
    // the plan writes each shot's line
    voice: { on: !!voice }
  })
  writeBed(root, startMood(track === '3d' ? '3d' : style), loadProject(root))
  return { root, title, track, shots: shots.length }
}

// A summary card per project: title, a one-line description (optional
// "description" in shotloop.json), track, size, duration, a poster
// (a still of the first shot that has one), last change. A project that
// can't be read comes back as { root, error }, for the app to show
export function summaries(dirs) {
  return dirs.flatMap(dir => {
    if (!isProject(dir)) return []
    try {
      const p = loadProject(dir)
      let poster = null
      // The poster's shot as it plays, for a preview on hover
      let clip = null
      for (const s of p.shots) {
        const e = entry(p, s, editMode(p))
        poster = e.stills?.[1] ?? takes(p, s).findLast(t => t.stills)?.stills?.[1] ?? null
        clip = (e.clip && fs.existsSync(e.clip) ? e.clip : null) ?? takes(p, s).findLast(t => t.clip && fs.existsSync(t.clip))?.clip ?? null
        if (poster) break
      }
      const changed = fs.statSync(path.join(p.root, 'shotloop.json')).mtimeMs
      return [{
        root: p.root, title: p.title, description: p.config.description ?? '', lang: p.config.lang ?? null, slug: p.slug, track: p.track, size: p.size,
        style: p.track === '3d' ? '3d' : p.config.style ?? null,
        // It has a voice-over that plays (on, and lines to say)
        voice: voiceOn(p),
        duration: p.duration, shots: p.shots.length, poster, clip, changed: new Date(changed).toISOString()
      }]
    } catch (err) {
      return [{ root: path.resolve(dir), error: err.message }]
    }
  })
}

// Projects directly inside a folder (the repository's examples/)
export const projectsIn = dir =>
  fs.existsSync(dir) ? fs.readdirSync(dir).map(d => path.join(dir, d)).filter(isProject).sort() : []
