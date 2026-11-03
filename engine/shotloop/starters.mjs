// The files a project starts with, and that its plan rewrites while they
// are still starters: each shot's placeholder code and notes, the world,
// the starter cover, and the readable plan (copy.md,
// script.md, storyboard.md). newProject (create.mjs) and applyStoryboard
// (storyboard.mjs) both write them through these functions.
//
// A plan shot: { id, title, duration, show?, text?, motion?, say?, sound?, source? }

import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_LOOK, HUES, lookById, round } from './data.mjs'
import { lookPage, pageLayout, styleFiles } from './looks.mjs'
import { CODE_FILE } from './project.mjs'
import { readJson, writeAtomic } from './files.mjs'
import { emit } from './compose.mjs'
import { webglPage } from './webgl.mjs'

// Code nobody has touched yet: the starter the engine wrote
export const isStarter = file => fs.readFileSync(file, 'utf8').split('\n', 1)[0].includes('Starter shot')

// Nothing built yet: every shot is still its starter
export const unbuilt = project => project.shots.every(s => !fs.existsSync(s.code) || isStarter(s.code))

// A 2D starter: the kit's title card with the shot's text
function shot2d(shot, i, n, film) {
  return `// ${shot.id}: ${shot.title}. Starter shot: a title card to replace.
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

// A WebGL starter: the kit's title card in its studio
function shotWebgl(shot, i, n) {
  return `// ${shot.id}: ${shot.title}. Starter shot: a title card to replace.
// Shot-local time: t = 0 is this shot's first frame.

export async function setup(ctx) {
  await ctx.window.kit.init(ctx)
}

export default function render(t, { window }) {
  window.kit.card(t, {
    kicker: ${JSON.stringify(`${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`)},
    title: ${JSON.stringify(shot.text || shot.title)},
    body: ${JSON.stringify(shot.show ?? '')}
  })
}
`
}

function notes(shot) {
  return `# ${shot.id} · ${shot.title}

## Must show

${shot.show?.trim() || '(what this shot must show)'}
${shot.say?.trim() ? `\n## Voice-over\n\n${shot.say.trim()}\n` : ''}
## On screen

${shot.text?.trim() || '(no text)'}

## Motion

${shot.motion?.trim() || '(the move)'}
${shot.sound?.trim() ? `\n## Sound\n\n${shot.sound.trim()}\n` : ''}${shot.source?.trim() ? `\n## Source line\n\n${shot.source.trim()}\n` : ''}`
}

// Each plan shot's folder: starter code where the shot has none or only a
// starter, and notes from the plan with the review history carried over
// and `event` added to it. Returns the film's length
export function writeShots(root, track, shots, event) {
  const film = round(shots.reduce((t, s) => t + s.duration, 0), 1)
  const today = new Date().toISOString().slice(0, 10)
  shots.forEach((s, i) => {
    const dir = path.join(root, 'shots', s.id)
    fs.mkdirSync(dir, { recursive: true })
    const code = path.join(dir, CODE_FILE)
    const starter = track === '3d' ? shotWebgl(s, i, shots.length) : shot2d(s, i, shots.length, film)
    if (!fs.existsSync(code) || isStarter(code)) fs.writeFileSync(code, starter)
    const file = path.join(dir, 'notes.md')
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const history = old.match(/## Review history\n[\s\S]*$/)?.[0]?.trim() ?? '## Review history'
    fs.writeFileSync(file, `${notes(s)}\n${history}\n- ${today}: ${event}.\n`)
  })
  return film
}

const webglWorld = size => webglPage(lookById(DEFAULT_LOOK), { ...pageLayout(size), hue: HUES.dark })

// A 3D film's world page is the engine's (its WebGL kit; the film's own
// world is in world/*.js): brought up to this engine's kit before a
// command reads the project, so an improved kit reaches every film (its
// shots render again, as for any world change). A film Blender drew
// (before Shotloop drew 3D in WebGL) gets the page and is built again
export function freshWebglPage(root) {
  const cfg = readJson(path.join(root, 'shotloop.json'), null)
  if (cfg?.track !== '3d') return
  const file = path.join(root, 'world', 'page.html')
  if (!fs.existsSync(file)) {
    if (!fs.existsSync(path.join(root, 'world', 'world.py'))) return
    emit({ type: 'log', message: 'this 3D film was drawn in Blender, which Shotloop no longer uses: its world is now the WebGL kit; build it again from its plan (its copy, storyboard, voice and sound are kept)' })
  } else if (!fs.readFileSync(file, 'utf8').includes('shotloop-renderer: webgl')) return
  const page = webglWorld(cfg.size)
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== page) writeAtomic(file, page)
}

// A product promo's screenshot kit (screens.js) is the engine's too: put in
// its world, and brought up to this engine's before a command reads the
// project, so an improved kit (a camera that moves in on the whole window)
// reaches every promo; its shots render again, as for any world change
const SCREENS = new URL('screens.js', import.meta.url)
export function freshScreens(root) {
  const cfg = readJson(path.join(root, 'shotloop.json'), null)
  if (!cfg?.promo) return
  const file = path.join(root, 'world', 'screens.js')
  const kit = fs.readFileSync(SCREENS, 'utf8')
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== kit) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    writeAtomic(file, kit)
  }
}

// The 3D starter world: the WebGL kit's page, its type in the default look
export function writeWorld3d(root, size) {
  fs.mkdirSync(path.join(root, 'world'), { recursive: true })
  fs.writeFileSync(path.join(root, 'world', 'page.html'), webglWorld(size))
}

// The 2D world: a look's page in a style (looks.mjs), and the files the
// style's page loads beside it
export function writeWorld2d(root, look, size, style, tune = null) {
  const dir = path.join(root, 'world')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'page.html'), lookPage(look ?? DEFAULT_LOOK, size, style, tune))
  for (const [name, text] of Object.entries(styleFiles(style))) fs.writeFileSync(path.join(dir, name), text)
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function starterCover(title) {
  return `<!doctype html>
<!-- Cover, 1080×1920; the text stays inside the centred 3:4 crop (y 240–1680). -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 1080px; height: 1920px; background: #0b0f19; color: #fff; }
      h1 { position: absolute; left: 90px; right: 90px; top: 640px; font: 900 110px/1.05 system-ui, sans-serif; margin: 0; }
      i { position: absolute; left: 90px; top: 600px; width: 120px; height: 12px; background: #ffb340; }
    </style>
  </head>
  <body>
    <i></i>
    <h1>${esc(title)}</h1>
    <script>window.ready = document.fonts.ready</script>
  </body>
</html>
`
}

// Still the cover page a new project starts with (whatever its title)?
export const isStarterCover = html => html.replace(/<h1>[\s\S]*?<\/h1>/, '<h1></h1>') === starterCover('')

// copy.md, script.md and storyboard.md, the readable plan, in the
// examples' form: the copy with its facts, one numbered line per shot,
// and a table of what each shot shows
export function writePlan(root, title, shots, copy = {}) {
  const line = s => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim()
  const cell = s => line(s).replace(/\|/g, '\\|')
  const facts = (copy.facts ?? []).filter(f => f?.text)
  fs.writeFileSync(path.join(root, 'copy.md'), `# ${title}

## Idea

${copy.idea ?? ''}

## Hook

${copy.hook ?? ''}

## Copy

${copy.body ?? ''}

## Facts

${facts.map(f => `- ${f.text}${f.source ? ` (source: ${f.source})` : ''}`).join('\n') || '(none)'}
`)
  fs.writeFileSync(path.join(root, 'script.md'), `# ${title} · Script

${shots.map((s, i) => `${i + 1}. ${line(s.say) || line(s.text) || line(s.title)}`).join('\n')}
`)
  fs.writeFileSync(path.join(root, 'storyboard.md'), `# ${title} · Storyboard

| # | Time | Shot | Motion |
| --- | --- | --- | --- |
${shots.map((s, i) => `| ${i + 1} | ${s.duration} s | ${cell(s.title)}${s.show ? `: ${cell(s.show)}` : ''} | ${cell(s.motion)} |`).join('\n')}
`)
}
