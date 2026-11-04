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
import { LOOKS, promoImages, STYLES, SUBTITLE_STYLES } from './enginelib.ts'
import { notesOf } from './notes.ts'
import { PROMO_RULES, PROMO_TOOLS } from './principles.ts'

export const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '(missing)')

// The models and sounds in the project's assets/ (from the asset library)
function assetList(project: ProjectStatus) {
  const dir = path.join(project.root, 'assets')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap(id => {
    const meta = path.join(dir, id, 'asset.json')
    if (!fs.existsSync(meta)) return []
    const a = JSON.parse(fs.readFileSync(meta, 'utf8'))
    return [{
      id, kind: a.kind === 'sound' ? 'sound' : 'model', file: String(a.file ?? 'model.glb'), duration: typeof a.duration === 'number' ? a.duration : null,
      name: String(a.name ?? id), license: String(a.license ?? ''), author: String(a.author ?? ''), page: a.page ? String(a.page) : '', attribution: a.attribution ? String(a.attribution) : ''
    }]
  })
}

// CC-BY models and sounds need their authors credited in every post
export const credits = (project: ProjectStatus) => creditsPrompt(assetList(project).filter(a => /cc-by/i.test(a.license)))

export function assetsBrief(project: ProjectStatus) {
  const assets = assetList(project)
  const by = (a: ReturnType<typeof assetList>[number]) => `${a.license}${a.author ? `, ${a.author}` : ''}`
  const models = assets.filter(a => a.kind === 'model')
  const sounds = assets.filter(a => a.kind === 'sound')
  return (models.length ? `\n\nModels in assets/ (import them as the format describes):\n${models.map(a => `- assets/${a.id}/${a.file}: ${a.name} (${by(a)})`).join('\n')}` : '')
    + (sounds.length ? `\n\nSounds in assets/ (use one by its id as "sound" in sounds.json):\n${sounds.map(a => `- ${a.id}: ${a.name}${a.duration ? `, ${a.duration.toFixed(1)} s` : ''} (${by(a)})`).join('\n')}` : '')
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

// The element the person picked in the frame (engine/shotloop/render/pick.mjs),
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
${read(shot.code)}${frameBrief(project, shot)}${styleBrief(project)}${recurringBrief(project, shot)}${assetsBrief(project)}`
}

// A promo shot's frame as the plan laid it out (world/frames.json, which
// screens.js frame() returns), in page px
function frameBrief(project: ProjectStatus, shot: ShotStatus) {
  const file = path.join(project.root, 'world', 'frames.json')
  if (!fs.existsSync(file)) return ''
  const frame = JSON.parse(read(file)).beats?.find((b: { id: string }) => b.id === shot.id)
  if (!frame) return ''
  const round = (k: string, v: unknown) => (typeof v === 'number' ? Math.round(v) : v)
  // What the plan says the beat does on the product, for act()
  const planned = JSON.parse(read(path.join(project.root, 'storyboard.json')) || '{}').shots?.[project.shots.indexOf(shot)]
  const acts = planned?.actions?.length ? `\nIt starts on ${planned.picture} and does, in order (act(); find_text gives each control's region): ${planned.actions.join('; ')}` : ''
  return `\n\nThis beat's frame (frame() in the shot gives it; page px): ${JSON.stringify(frame, round)}${acts}`
}

// What the voice says over the shot, sentence by sentence with its times
// (ctx.voice in the shot's code); subtitles are added by the engine
function voiceBrief(shot: ShotStatus) {
  if (!shot.cues?.length) return shot.say?.trim() ? `\nVoice-over (not timed yet): "${shot.say.trim()}"` : ''
  return `\nVoice-over (ctx.voice; subtitled by the engine, keep the subtitle band clear):\n${shot.cues.map(c => `- ${c.at.toFixed(2)}–${c.end.toFixed(2)} s: "${c.text}"`).join('\n')}`
}

// A product promo (software or a website): what it is made from. plan: the whole product brief
// (site/brief.md) and how a promo is told; a shot gets the pictures, the
// brand and the screenshot devices
export function promoBrief(project: ProjectStatus, { plan = false } = {}) {
  if (!project.promo) return ''
  const siteBrief = path.join(project.root, 'site', 'brief.md')
  const repoBrief = path.join(project.root, 'repo', 'brief.md')
  const pictures = promoImages(project.root)
  const mine = pictures.filter(p => p.from === 'person')
  // The plan reads all of both briefs; a shot gets the brand
  const repo = fs.existsSync(repoBrief)
    ? plan ? `\n\n${read(repoBrief)}` : ''
    : project.promo.repo ? `\n\nThe repository (${project.promo.repo}) could not be read.` : ''
  const site = fs.existsSync(siteBrief)
    ? plan ? `\n\n${read(siteBrief)}` : `\n\nThe product's brand (site/brief.md):\n${read(siteBrief).match(/## Brand\n+([\s\S]*?)(\n## |$)/)?.[1]?.trim() ?? 'not read'}`
    : project.promo.site ? `\n\nThe product page (${project.promo.site}) could not be read.` : ''
  const list = (plan ? mine : pictures).map(p => (p.live
    ? `- ${p.file} (live part, ${p.width}×${p.height} CSS px${p.fields?.length ? `; fields ${p.fields.join(', ')}` : ''})`
    : `- ${p.file} (${p.width}×${p.height} px)`))
  const taste = PROMO_RULES.length ? `\n\nThe rules of a product promo (it is wide, 16:9; follow each as it stands):\n${PROMO_RULES.join('\n')}` : ''
  return `\n\nThis is a product promo of software, a website or an app: the product is the hero, its story told from its makers' own words, shown through its own screens.${repo}${site}${list.length ? `\n\n${plan ? 'The person\'s own pictures' : 'Pictures to show (with world/screens.js, at these sizes)'}:\n${list.join('\n')}` : ''}${plan ? `

Working with the material:
- Write the product's story in copy.body first (the problem, who has it, what the product does about it, the one thing to remember), from the briefs above, then plan the shots that tell it. Every claim in copy.facts, its source the repository's file or the page's address.
- A shot that shows the product names its picture in "show" by its file (repo/pictures/…, site/framed/…, site/hero.png, site/parts/…, site/live/…, or the person's pictures). Look at the pictures (view_image) before you pick them.
- The brand's colors (in the page's brief) reach the film through the look: pick the look nearest them and shade it with "lookTune".
- Each shot in storyboard.json also says what beat it is, so the engine lays the film out (its frames, the same boxes the shots are built in and the person sees as wireframes): "beat": "title" (the first shot: the logo and name), "problem" (the problem or the old way, drawn), "screen" (the product on the desktop) or "end" (the last shot: the end card); and "steps": how many chips sit under its headline (0 for none). Its "text" is its headline, a line each (one or two). A "screen" shot also says "picture", the screenshot it starts on, and "actions", what is done on it in order, the way a person does it: "click <the words on the control, or what it is>", "type <the words>" (into the field just clicked), "show <the picture it brings>" (repo/pictures/…). A beat clicks at least once and shows what its click brought (words typed, or the next picture); together the screen beats walk the product's real flow.
- "recurring" lists only a drawing the film shows more than once that the screens kit has no piece for (a diagram of the problem); never the desktop, a window, the headline, steps, a counter or the cards, which the kit draws and the frames place.
- Devices (world/screens.js; name the device in "show"):
${PROMO_TOOLS.join('\n')}${taste}` : `

Devices (world/screens.js):
${PROMO_TOOLS.join('\n')}${taste}`}`
}

// The idea, from copy.md's Idea section
export function ideaOf(project: ProjectStatus) {
  const copy = read(path.join(project.root, 'copy.md'))
  return copy.match(/## Idea\n+([\s\S]*?)(\n## |$)/)?.[1]?.trim() || project.title
}

export function trackBrief(project: ProjectStatus) {
  if (project.trackAuto) return 'Track: chosen by you through the style (2D, or 3D drawn in WebGL)'
  return `Track: ${project.track.toUpperCase()} (chosen by the person)`
}

// The visual styles the plan picks from (engine/shotloop/kits/styles.mjs)
export function stylesBrief(project: ProjectStatus) {
  const chosen = project.styleChosen ? STYLES.find(s => s.id === project.style) : null
  if (chosen) return `\n\nVisual style: "${chosen.id}" (${chosen.name.en}), chosen by the person: keep it as "style" and plan every shot in it. ${chosen.frames} Reference: ${chosen.why} Look at its reference stills (view_style) first.`
  // A product promo has its own page: no style to pick
  if (project.promo) return ''
  const open = STYLES.filter(s => (s.track === project.track && project.track === '2d') || (s.track === '3d' && project.trackAuto))
  if (project.track === '3d' || !open.length) return ''
  return `\n\nVisual styles (pick one for "style"; look at each candidate's reference stills with view_style before you decide):\n${open.map(s =>
    `- ${s.id} (${s.name.en}): use when ${s.when} Avoid when: ${s.avoid} Frames: ${s.frames} Reference: ${s.why}${s.looks.length ? ` Looks: ${s.looks.join(', ')}.` : ''}`).join('\n')}`
}

// The subtitles' looks a voiced plan picks from (data.mjs
// SUBTITLE_STYLES); none when the person chose one, which the engine keeps
const WORDS = { line: 'a chunk at a time', follow: 'a chunk at a time, the word being said lit', one: 'one word at a time', single: 'strictly one word at a time' }
export function subtitlesBrief(project: ProjectStatus) {
  if (!project.voice?.on || project.voice.subtitlesChosen) return ''
  const looks = Object.entries(SUBTITLE_STYLES).flatMap(([id, l]) => (l ? [`- ${id} (${WORDS[l.words]}): ${l.use}`] : []))
  return `\n\nSubtitle looks (pick one for "subtitles" by the video's pace and tone):\n${looks.join('\n')}`
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
// The world's files for an agent's request. docs: only the notes at the
// top of each (what its helpers are and take: what a shot's author needs,
// as the world is asked to write them), the code left for read_file: the
// files are sent again on every turn, and a 3D world's run to tens of KB
export function worldFiles(project: ProjectStatus, { docs = false } = {}) {
  const worldDir = path.join(project.root, 'world')
  if (!fs.existsSync(worldDir)) return ''
  // A kit split into a folder (world/screens/) is listed file by file, so
  // a piece is read alone; the recurring pictures (world/parts/) have their
  // index, world/parts.js
  const files = fs.readdirSync(worldDir, { withFileTypes: true }).flatMap(e => (e.isDirectory() && e.name === 'screens'
    ? fs.readdirSync(path.join(worldDir, e.name)).sort().map(f => `${e.name}/${f}`)
    : e.isFile() ? [e.name] : []))
  return files
    // The frames are given to each shot as its own (shotBrief)
    .filter(f => /\.(py|js|mjs|html|css|json|md|txt|svg)$/i.test(f) && !/\.data\./.test(f) && f !== 'frames.json')
    .map(f => `world/${f}:\n${docs ? notesOf(f, read(path.join(worldDir, f))) : read(path.join(worldDir, f))}`).join('\n\n')
}

