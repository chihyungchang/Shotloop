// The plan of a project, as the app's planning page edits it:
// storyboard.json holds the copy (hook, body, facts with sources) and the
// shots (title, duration, what the frame shows, the text on screen, the
// motion, and with the voice-over the line it says). applyStoryboard
// turns it into the project: the shot list in shotloop.json, each shot's
// notes.md, copy.md, and starter code for new shots, so the agent can
// build every shot from its notes.

import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_LOOK, DEFAULT_STYLE, lookById, round, styleById } from './data.mjs'
import { writeJson } from './files.mjs'
import { untouchedLook } from './looks.mjs'
import { loadProject, SHOT_ID, updateConfig } from './project.mjs'
import { captions, isStarter, isStarterCaptions, unbuilt, writePlan, writeShots, writeWorld2d, writeWorld3d } from './starters.mjs'

export const FILE = 'storyboard.json'
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 4).join('-')

export function readStoryboard(project) {
  const file = path.join(project.root, FILE)
  if (!fs.existsSync(file)) return null
  const sb = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(sb.shots) || !sb.shots.length) throw new Error(`${FILE} has no shots`)
  for (const [i, s] of sb.shots.entries()) {
    if (!String(s.title ?? '').trim()) throw new Error(`${FILE}: shot ${i + 1} has no title`)
    if (!(s.duration >= 1 && s.duration <= 30)) throw new Error(`${FILE}: shot ${i + 1} must last 1–30 s`)
  }
  return sb
}

// The 2D starter page of projects made before looks
const isStarterPage = file => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('Shots draw it from shots/*/shot.js')

// A project made with track "auto" becomes 3D when the plan picks the 3D
// style, while nothing is built yet: the world and the starters change
function toThreeD(project) {
  writeWorld3d(project.root, project.duration, project.size)
  fs.rmSync(path.join(project.root, 'world', 'page.html'), { force: true })
  // Nothing is built yet: the 2D starter shots go, the plan's shots come as 3D
  for (const s of project.shots) fs.rmSync(path.dirname(s.code), { recursive: true, force: true })
  fs.writeFileSync(path.join(project.root, 'captions.html'), captions(project.size, project.shots))
  updateConfig(project.root, ({ look, trackAuto, ...cfg }) => ({ ...cfg, track: '3d', captions: 'captions.html' }))
  return loadProject(project.root)
}

export function applyStoryboard(project) {
  const sb = readStoryboard(project)
  if (!sb) throw new Error(`no ${FILE} yet: plan the video first`)
  // The visual style the plan picked (styles.mjs); 3D only while the
  // project may still change track
  let style = styleById(sb.style)
  if (style?.track === '3d' && project.track === '2d') {
    if (project.config.trackAuto && unbuilt(project)) project = toThreeD(project)
    else style = null
  }
  if (style && style.track !== project.track) style = null
  // Shots read back from the project keep their folders: their ids are
  // reserved first. A new shot gets an id from its place and title that
  // no kept shot and no folder on disk has, so it never inherits code
  const valid = id => typeof id === 'string' && SHOT_ID.test(id)
  const kept = new Set()
  for (const s of sb.shots) if (valid(s.id) && !kept.has(s.id)) kept.add(s.id)
  const used = new Set()
  const taken = id => used.has(id) || kept.has(id) || fs.existsSync(path.join(project.root, 'shots', id))
  const shots = sb.shots.map((s, i) => {
    let id
    if (valid(s.id) && !used.has(s.id)) id = s.id
    else {
      id = `${String(i + 1).padStart(2, '0')}-${slug(s.title) || 'shot'}`
      while (taken(id)) id += '-b'
    }
    used.add(id)
    const say = String(s.say ?? '').trim()
    return { id, title: String(s.title).trim().slice(0, 80), duration: round(s.duration, 1), show: s.show, text: s.text, motion: s.motion, source: s.source, ...(say ? { say } : {}) }
  })
  const film = writeShots(project.root, project.track, shots, 'planned in the storyboard')

  // Shots the plan dropped go if they are still starters; edited ones stay
  // on disk, out of the shot list
  for (const old of project.shots) {
    if (used.has(old.id) || !fs.existsSync(old.code) || !isStarter(old.code)) continue
    fs.rmSync(path.dirname(old.code), { recursive: true, force: true })
  }

  const copy = sb.copy ?? {}
  writePlan(project.root, project.title, shots, { ...copy, idea: copy.idea ?? project.config.idea ?? '' })

  // 2D: the plan's look in its style becomes the world, while the AI
  // hasn't changed it. The scene style needs a look with scene colors
  const twoD = project.track === '2d'
  // The plan's style, else the project's own when it fits the track
  const own = styleById(project.config.style)?.track === project.track ? project.config.style : null
  const styleId = twoD ? (style?.id ?? own ?? DEFAULT_STYLE) : null
  let look = twoD ? (lookById(sb.look) ? sb.look : project.config.look ?? null) : null
  if (styleId === 'scene' && !lookById(look ?? DEFAULT_LOOK)?.scene) look = DEFAULT_LOOK
  const page = path.join(project.root, 'world', 'page.html')
  if (twoD && (look || style) && (!fs.existsSync(page) || untouchedLook(fs.readFileSync(page, 'utf8')) || isStarterPage(page))) {
    writeWorld2d(project.root, look, project.size, styleId)
  }

  // A shot whose line and length are unchanged keeps its voice timing
  // (voice.mjs fitVoice), so its frames stay valid; others are timed again
  const before = new Map(project.shots.map(s => [s.id, s]))
  const timing = s => {
    const old = before.get(s.id)
    return old?.cues && old.say === s.say && old.duration === s.duration ? { cues: old.cues, ...(old.sayFast ? { sayFast: old.sayFast } : {}) } : {}
  }
  const fields = {
    shots: shots.map(s => ({ id: s.id, title: s.title, duration: s.duration, ...(s.say ? { say: s.say, ...timing(s) } : {}) })),
    ...(typeof sb.lang === 'string' && sb.lang.trim() ? { lang: sb.lang.trim() } : {}),
    ...(look ? { look } : {}), ...(styleId ? { style: styleId } : {}), ...(project.track === '3d' ? { style: '3d' } : {})
  }
  // The starter caption layer follows the plan: 3D shows each shot's
  // text; 2D draws its text in the frame, so the layer goes
  if (project.captions && isStarterCaptions(project.captions)) {
    if (project.track === '3d') fs.writeFileSync(project.captions, captions(project.size, shots))
    else fields.captions = null
  }
  updateConfig(project.root, cfg => ({ ...cfg, ...fields }))
  return { shots: shots.map(s => s.id), duration: film }
}

// A "## Heading" section of a markdown file, trimmed
function section(text, heading) {
  const m = text.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))
  return m ? m[1].trim() : ''
}
const placeholder = s => !s || /^\(.*\)$/.test(s.trim())

// The plan of a project that already has shots, read back from them (the
// shot list, each shot's notes, copy.md) without asking the AI, so the
// planning page shows what the project is. Null when the shots are still
// the starters: then there is nothing to read and the AI plans.
export function deriveStoryboard(project) {
  const read = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')
  const shots = project.shots.map(s => {
    const notes = read(s.notes)
    return {
      id: s.id, title: s.title ?? s.id, duration: s.duration,
      show: section(notes, 'Must show'), text: section(notes, 'On screen'), motion: section(notes, 'Motion'),
      ...((s.say ?? section(notes, 'Voice-over')) ? { say: s.say ?? section(notes, 'Voice-over') } : {}),
      ...(section(notes, 'Source line') ? { source: section(notes, 'Source line') } : {})
    }
  })
  const starter = unbuilt(project) && shots.every(s => placeholder(s.show))
  if (starter) return null
  const copy = read(path.join(project.root, 'copy.md'))
  // One fact per bullet, its wrapped lines joined
  const bullets = section(copy, 'Facts').split(/\n(?=[-*]\s)/).map(b => b.replace(/^[-*]\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
  const facts = bullets.filter(l => l && !placeholder(l)).map(l => {
    const m = l.match(/^(.*?)\s*\((?:source:\s*)?([^()]*)\)\s*$/)
    return m ? { text: m[1].trim(), source: m[2].trim() } : { text: l, source: '' }
  })
  // The script: copy.md's own section, or script.md (one numbered line
  // per beat), whose first line is the hook when copy.md has none
  const script = read(path.join(project.root, 'script.md')).replace(/^#.*\n+/, '').trim()
  const body = section(copy, 'Copy') || section(copy, 'Script') || script
  const hook = section(copy, 'Hook') || (script.split('\n')[0] ?? '').replace(/^\d+[.)]\s*/, '').trim()
  const sb = {
    target: project.duration,
    look: project.config.look ?? null,
    ...(project.config.lang ? { lang: project.config.lang } : {}),
    copy: { idea: section(copy, 'Idea'), hook, body, facts },
    shots: shots.map(s => ({ ...s, show: placeholder(s.show) ? '' : s.show, text: placeholder(s.text) ? '' : s.text, motion: placeholder(s.motion) ? '' : s.motion }))
  }
  writeJson(path.join(project.root, FILE), sb)
  return sb
}
