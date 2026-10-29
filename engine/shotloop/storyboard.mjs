// The plan of a project, as the app's planning page edits it:
// storyboard.json holds the copy (hook, body, facts with sources) and the
// shots (title, duration, what the frame shows, the text on screen, the
// motion). applyStoryboard turns it into the project: the shot list in
// shotloop.json, each shot's notes.md, copy.md, and starter code for new
// shots, so the agent can build every shot from its notes.

import fs from 'node:fs'
import path from 'node:path'
import { captions, shot3d } from './create.mjs'
import { saveConfig } from './project.mjs'

export const FILE = 'storyboard.json'

const round1 = x => Math.round(x * 10) / 10
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

// A 2D starter that already says the shot's text, on the starter page's card
function starter2d(shot, i, n, film) {
  return `// ${shot.id}: ${shot.title}. Starter shot from the storyboard: a title card to replace.
// Shot-local time: t = 0 is this shot's first frame.

export default function render(t, { window, start }) {
  window.kit?.card?.(t, {
    kicker: ${JSON.stringify(`${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`)},
    title: ${JSON.stringify(shot.text || shot.title)},
    body: ${JSON.stringify(shot.show ?? '')},
    progress: (start + t) / ${film}
  })
}
`
}

function notes(shot) {
  return `# ${shot.id} · ${shot.title}

## Must show

${shot.show?.trim() || '(what this shot must show)'}

## On screen

${shot.text?.trim() || '(no text)'}

## Motion

${shot.motion?.trim() || '(the move)'}
`
}

// Code nobody has touched yet: the starter the engine wrote
const isStarter = file => fs.readFileSync(file, 'utf8').split('\n', 1)[0].includes('Starter shot')

export function applyStoryboard(project) {
  const sb = readStoryboard(project)
  if (!sb) throw new Error(`no ${FILE} yet: plan the video first`)
  const used = new Set()
  const shots = sb.shots.map((s, i) => {
    // A shot read back from the project keeps its folder; a new one gets
    // its own from its place and title
    const keep = typeof s.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s.id) && !used.has(s.id)
    let id = keep ? s.id : `${String(i + 1).padStart(2, '0')}-${slug(s.title) || 'shot'}`
    while (used.has(id)) id += '-b'
    used.add(id)
    return { id, title: String(s.title).trim().slice(0, 80), duration: round1(s.duration), show: s.show, text: s.text, motion: s.motion }
  })
  const film = round1(shots.reduce((t, s) => t + s.duration, 0))
  const today = new Date().toISOString().slice(0, 10)

  shots.forEach((s, i) => {
    const dir = path.join(project.root, 'shots', s.id)
    fs.mkdirSync(dir, { recursive: true })
    const code = path.join(dir, project.track === '3d' ? 'shot.py' : 'shot.js')
    if (!fs.existsSync(code) || isStarter(code)) fs.writeFileSync(code, project.track === '3d' ? shot3d(s, i) : starter2d(s, i, shots.length, film))
    // New notes from the plan; the review history carries over
    const file = path.join(dir, 'notes.md')
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const history = old.match(/## Review history\n[\s\S]*$/)?.[0]?.trim() ?? '## Review history'
    fs.writeFileSync(file, `${notes(s)}\n${history}\n- ${today}: planned in the storyboard.\n`)
  })

  // Shots the plan dropped go if they are still starters; edited ones stay
  // on disk, out of the shot list
  for (const old of project.shots) {
    if (used.has(old.id) || !fs.existsSync(old.code) || !isStarter(old.code)) continue
    fs.rmSync(path.dirname(old.code), { recursive: true, force: true })
  }

  const c = sb.copy ?? {}
  const facts = (c.facts ?? []).filter(f => f?.text)
  fs.writeFileSync(path.join(project.root, 'copy.md'), `# ${project.title}

## Idea

${c.idea ?? project.config.idea ?? ''}

## Hook

${c.hook ?? ''}

## Copy

${c.body ?? ''}

## Facts

${facts.map(f => `- ${f.text}${f.source ? ` (source: ${f.source})` : ''}`).join('\n') || '(none)'}
`)

  // The starter caption layer follows the plan: 3D shows each shot's
  // text; 2D draws its text in the frame, so the layer goes
  const cfg = { ...project.config, shots: shots.map(({ id, title, duration }) => ({ id, title, duration })) }
  if (project.captions && fs.readFileSync(project.captions, 'utf8').includes("film's timeline. (starter)")) {
    if (project.track === '3d') fs.writeFileSync(project.captions, captions(project.size, shots))
    else cfg.captions = null
  }
  saveConfig(project.root, cfg)
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
      show: section(notes, 'Must show'), text: section(notes, 'On screen'), motion: section(notes, 'Motion')
    }
  })
  const starter = project.shots.every(s => !fs.existsSync(s.code) || isStarter(s.code)) && shots.every(s => placeholder(s.show))
  if (starter) return null
  const copy = read(path.join(project.root, 'copy.md'))
  // One fact per bullet, its wrapped lines joined
  const bullets = section(copy, 'Facts').split(/\n(?=[-*]\s)/).map(b => b.replace(/^[-*]\s*/, '').replace(/\s*\n\s*/g, ' ').trim())
  const facts = bullets.filter(l => l && !placeholder(l)).map(l => {
    const m = l.match(/^(.*?)\s*\((?:source:\s*)?([^()]*)\)\s*$/)
    return m ? { text: m[1].trim(), source: m[2].trim() } : { text: l, source: '' }
  })
  const sb = {
    target: project.duration,
    copy: {
      idea: section(copy, 'Idea'), hook: section(copy, 'Hook'),
      body: section(copy, 'Copy') || section(copy, 'Script'), facts
    },
    shots: shots.map(s => ({ ...s, show: placeholder(s.show) ? '' : s.show, text: placeholder(s.text) ? '' : s.text, motion: placeholder(s.motion) ? '' : s.motion }))
  }
  fs.writeFileSync(path.join(project.root, FILE), JSON.stringify(sb, null, 2) + '\n')
  return sb
}
