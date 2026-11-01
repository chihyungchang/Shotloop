// The project, described for the agent's prompts: its shots with their
// notes, code and voice-over, its style, recurring pictures and models,
// and what the plan picks from. The system prompts (prompts.ts) stay
// fixed; these change with the project.

import fs from 'node:fs'
import path from 'node:path'
import type { PickedElement } from '../../engine/shotloop/protocol.d.ts'
import type { ProjectStatus, ShotStatus } from './engine.ts'
import { reason, warn } from './events.ts'
import { creditsPrompt } from './prompts.ts'
import { LOOKS, STYLES } from './enginelib.ts'

export const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '(missing)')

// The models in the project's assets/ (from the asset library)
function assetList(project: ProjectStatus) {
  const dir = path.join(project.root, 'assets')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap(id => {
    const meta = path.join(dir, id, 'asset.json')
    if (!fs.existsSync(meta)) return []
    const a = JSON.parse(fs.readFileSync(meta, 'utf8'))
    return [{ id, name: String(a.name ?? id), license: String(a.license ?? ''), author: String(a.author ?? ''), page: a.page ? String(a.page) : '', attribution: a.attribution ? String(a.attribution) : '' }]
  })
}

// CC-BY models need their authors credited in every post
export const credits = (project: ProjectStatus) => creditsPrompt(assetList(project).filter(a => /cc-by/i.test(a.license)))

function assetsBrief(project: ProjectStatus) {
  const assets = assetList(project)
  if (!assets.length) return ''
  return `\n\nModels in assets/ (import them as the format describes):\n${assets.map(a => `- assets/${a.id}/model.glb: ${a.name} (${a.license}${a.author ? `, ${a.author}` : ''})`).join('\n')}`
}

// A project in one line, for prompts
export const head = (p: ProjectStatus) => `"${p.title}" (${p.track.toUpperCase()}, ${p.size.width}×${p.size.height}, ${p.duration} s, ${p.shots.length} shots)`

// The plan's pictures that appear in more than one shot (storyboard.json
// "recurring"), each with its fixed design and the 1-based shots it is in
interface Recurring { name: string; design: string; shots: number[] }
const recurringOf = new Map<string, Recurring[]>()
export function recurring(project: ProjectStatus): Recurring[] {
  const known = recurringOf.get(project.root)
  if (known) return known
  const file = path.join(project.root, 'storyboard.json')
  let list: Recurring[] = []
  if (fs.existsSync(file)) {
    try {
      const sb = JSON.parse(fs.readFileSync(file, 'utf8'))
      list = (Array.isArray(sb.recurring) ? sb.recurring : [])
        .filter((r: Recurring) => r && String(r.name ?? '').trim() && Array.isArray(r.shots) && r.shots.length)
        .map((r: Recurring) => ({ name: String(r.name), design: String(r.design ?? ''), shots: r.shots.map(Number) }))
    } catch (err) {
      warn(`storyboard.json is unreadable (${reason(err)}); shots are built without its recurring pictures`)
    }
  }
  recurringOf.set(project.root, list)
  return list
}

// 2D: the recurring pictures a shot shows, to draw from world/parts.js
function recurringBrief(project: ProjectStatus, shot: ShotStatus) {
  if (project.track !== '2d') return ''
  const n = project.shots.findIndex(s => s.id === shot.id) + 1
  const mine = recurring(project).filter(r => r.shots.includes(n))
  if (!mine.length) return ''
  return `\n\nRecurring pictures in this shot (draw them with their functions in world/parts.js when it has them; keep their design exactly):\n${mine.map(r => `- ${r.name}: ${r.design}`).join('\n')}`
}

// 2D: the project's visual style, what its frames are made of and the
// reference that sets the bar
function styleBrief(project: ProjectStatus) {
  const s = project.track === '2d' && project.style ? STYLES.find(x => x.id === project.style) : null
  if (!s) return ''
  return `\n\nVisual style: ${s.id} (${s.name.en}). ${s.frames} Reference: ${s.why} Look at its reference stills (view_style "${s.id}") before you build, and reach that quality.`
}

// The element the person picked in the frame (engine/shotloop/pick.mjs),
// said so the agent can find it in the shot's code
export function elementBrief(el: PickedElement) {
  const at = `at ${el.t} s, at page point (${el.point.x}, ${el.point.y}) CSS px`
  if (el.kind === 'three') return `They pointed at the shot's three.js scene (its WebGL canvas) as a whole, ${at}.`
  if (el.kind === 'canvas') {
    return el.name
      ? `They pointed at "${el.name}", a part the shot names on its canvas (window.picker?.part or subtitles.keep) (${el.path}), ${at}.`
      : `They pointed at what is drawn on the canvas (${el.path}) ${at}, the coordinates its drawing code uses.`
  }
  const name = el.name ? ` named "${el.name}"` : ''
  const text = el.text ? `, showing "${el.text}"` : ''
  return `They pointed at this element${name}: <${el.tag}> (${el.path} in the page)${text}, ${at}.`
}

export function shotBrief(project: ProjectStatus, shot: ShotStatus) {
  const rel = (f: string) => path.relative(project.root, f)
  const others = project.shots.map(s => `${s.id} (${s.start}–${s.start + s.duration} s)${s.id === shot.id ? ' ← this shot' : ''}`)
  return `Project: "${project.title}", ${project.track.toUpperCase()} track, ${project.duration} s.
Shots: ${others.join(', ')}.

Shot ${shot.id}: film time ${shot.start}–${shot.start + shot.duration} s, ${shot.duration} s long.${voiceBrief(shot)}

${rel(shot.notes)}:
${read(shot.notes)}

${rel(shot.code)}:
${read(shot.code)}${styleBrief(project)}${recurringBrief(project, shot)}${assetsBrief(project)}`
}

// What the voice says over the shot, sentence by sentence with its times
// (ctx.voice in the shot's code); subtitles are added by the engine
function voiceBrief(shot: ShotStatus) {
  if (!shot.cues?.length) return shot.say?.trim() ? `\nVoice-over (not timed yet): "${shot.say.trim()}"` : ''
  return `\nVoice-over (ctx.voice; subtitled by the engine, keep the subtitle band clear):\n${shot.cues.map(c => `- ${c.at.toFixed(2)}–${c.end.toFixed(2)} s: "${c.text}"`).join('\n')}`
}

// The idea, from copy.md's Idea section
export function ideaOf(project: ProjectStatus) {
  const copy = read(path.join(project.root, 'copy.md'))
  return copy.match(/## Idea\n+([\s\S]*?)(\n## |$)/)?.[1]?.trim() || project.title
}

export function trackBrief(project: ProjectStatus, threeD: boolean) {
  if (project.trackAuto) return `Track: chosen by you through the style (${threeD ? '2D or 3D' : '2D; Blender is not installed, so no 3D'})`
  return `Track: ${project.track.toUpperCase()} (chosen by the person)`
}

// The visual styles the plan picks from (engine/shotloop/styles.mjs)
export function stylesBrief(project: ProjectStatus, threeD: boolean) {
  const chosen = project.styleChosen ? STYLES.find(s => s.id === project.style) : null
  if (chosen) return `\n\nVisual style: "${chosen.id}" (${chosen.name.en}), chosen by the person: keep it as "style" and plan every shot in it. ${chosen.frames} Reference: ${chosen.why} Look at its reference stills (view_style) first.`
  const open = STYLES.filter(s => (s.track === project.track && project.track === '2d') || (s.track === '3d' && threeD))
  if (project.track === '3d' || !open.length) return ''
  return `\n\nVisual styles (pick one for "style"; look at each candidate's reference stills with view_style before you decide):\n${open.map(s =>
    `- ${s.id} (${s.name.en}): use when ${s.when} Avoid when: ${s.avoid} Frames: ${s.frames} Reference: ${s.why}${s.looks.length ? ` Looks: ${s.looks.join(', ')}.` : ''}`).join('\n')}`
}

// The looks a 2D plan picks from, or the one the person chose
// The looks to pick from: the planner always picks its own, the AI's
// choice the plan page offers; a look the person chose is laid over it
// afterwards (main.ts planTask)
export async function looksBrief(project: ProjectStatus) {
  if (project.track !== '2d') return ''
  return `\nLooks: pick one for "look", one the style can use. Pick by mood: name the mood the subject carries (awe, tension, warmth, calm, urgency, trust…), then take the look whose mood matches it; "lookWhy" says that mood. One look for the whole video: every shot is drawn in it, no shot switches palette. A look changes only the ground and the type (background, text, accent); the structure stays the same whatever the look: layout, headline place, safe area, and the content colors pictures and data take. On that base you are free: shade the look for this subject with "lookTune" (its accents, its background), as long as the mood holds, the text stays easy to read on the ground, and the video keeps that one palette.
${LOOKS.map(l => `- ${l.id}: ${l.about}; mood: ${l.mood}${l.scene ? '' : ' (not for the cinematic scene)'}`).join('\n')}`
}

// The world's text files (not folders such as __pycache__, not media, not
// data such as the map's countries: too long to read, never edited)
export function worldFiles(project: ProjectStatus) {
  const worldDir = path.join(project.root, 'world')
  if (!fs.existsSync(worldDir)) return ''
  return fs.readdirSync(worldDir, { withFileTypes: true })
    .filter(e => e.isFile() && /\.(py|js|mjs|html|css|json|md|txt|svg)$/i.test(e.name) && !/\.data\./.test(e.name))
    .map(e => `world/${e.name}:\n${read(path.join(worldDir, e.name))}`).join('\n\n')
}
