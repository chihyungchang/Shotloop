// The files a project starts with, and that its plan rewrites while they
// are still starters: each shot's placeholder code and notes, the world,
// the starter caption layer and cover, and the readable plan (copy.md,
// script.md, storyboard.md). newProject (create.mjs) and applyStoryboard
// (storyboard.mjs) both write them through these functions.
//
// A plan shot: { id, title, duration, show?, text?, motion?, say?, source? }

import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_LOOK, HUES, lookById, round } from './data.mjs'
import { lookPage, pageLayout, styleFiles } from './looks.mjs'
import { codeFile, cssSize } from './project.mjs'
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

const MOVES_3D = [
  "move='dolly', frm=(0, -7, 2.2), to=(0, -5.5, 1.9)",
  "move='orbit', frm=(-110,), to=(-70,), radius=5, height=1.8",
  "move='truck', frm=(-1.5, -5, 1.6), to=(1.5, -5, 1.6)",
  "move='pedestal', frm=(0, -5, 3), to=(0, -5, 1.4)",
  "move='crane', frm=(-2, -6, 3.5), to=(-1, -5, 1.6)"
]

// A Blender starter: one camera move on the starter world's subject
function shotBlender(shot, i) {
  return `# ${shot.id}: ${shot.title}. Starter shot: one camera move on the subject.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
kit.Shot(${JSON.stringify(shot.id).replace(/"/g, "'")}, at(0), at(DUR), lens=35, target=subject,
         ${MOVES_3D[i % MOVES_3D.length]}, clip=(0.1, 80))
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
${shot.source?.trim() ? `\n## Source line\n\n${shot.source.trim()}\n` : ''}`
}

// Each plan shot's folder: starter code where the shot has none or only a
// starter, and notes from the plan with the review history carried over
// and `event` added to it. Returns the film's length
export function writeShots(root, renderer, shots, event) {
  const film = round(shots.reduce((t, s) => t + s.duration, 0), 1)
  const today = new Date().toISOString().slice(0, 10)
  shots.forEach((s, i) => {
    const dir = path.join(root, 'shots', s.id)
    fs.mkdirSync(dir, { recursive: true })
    const code = path.join(dir, codeFile(renderer))
    const starter = renderer === 'blender' ? shotBlender(s, i) : renderer === 'webgl' ? shotWebgl(s, i, shots.length) : shot2d(s, i, shots.length, film)
    if (!fs.existsSync(code) || isStarter(code)) fs.writeFileSync(code, starter)
    const file = path.join(dir, 'notes.md')
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const history = old.match(/## Review history\n[\s\S]*$/)?.[0]?.trim() ?? '## Review history'
    fs.writeFileSync(file, `${notes(s)}\n${history}\n- ${today}: ${event}.\n`)
  })
  return film
}

const WORLD_3D = `"""World of a 3D Shotloop project: what every shot shares. Starter
stage: a floor, a plinth and an amber subject that turns over the film.
Blender: metres, +Z up. Film time in seconds; see shotloop.json."""

import math

import kit

DURATION = {{DURATION}}
AMBER = (1.0, 0.62, 0.18)

s = kit.reset(DURATION, size=({{W}}, {{H}}), samples=24)
kit.world_color((0.08, 0.1, 0.16), strength=0.6)
kit.sun(direction=(0.4, -0.5, -0.75), energy=2.5)

kit.box('floor', (30, 30, 0.1), (0, 0, -0.05), kit.mat('floor', (0.12, 0.14, 0.2), roughness=0.9), bevel=0)
kit.box('plinth', (1.4, 1.4, 0.6), (0, 0, 0.3), kit.mat('plinth', (0.8, 0.8, 0.82)), bevel=0.01)
# Built at the origin and placed by its location: kit.box bakes the
# location into the mesh in recent Blender versions
subject = kit.box('subject', (0.5, 0.5, 0.5), (0, 0, 0), kit.mat('subject', AMBER, emission=AMBER, strength=2))
subject.location = (0, 0, 0.85)
subject.rotation_euler = (0, 0, 0)
subject.keyframe_insert('rotation_euler', frame=1)
subject.rotation_euler = (0, 0, math.radians(360))
subject.keyframe_insert('rotation_euler', frame=round(DURATION * kit.FPS))
for fc in kit.fcurves(subject.animation_data.action):
    for k in fc.keyframe_points:
        k.interpolation = 'LINEAR'
`

// The 3D starter world for a film of this length and size: a WebGL page
// (world/page.html), its type in the default look, or a Blender scene
// (world/world.py)
export function writeWorld3d(root, renderer, duration, size) {
  fs.mkdirSync(path.join(root, 'world'), { recursive: true })
  if (renderer === 'webgl') {
    fs.writeFileSync(path.join(root, 'world', 'page.html'), webglPage(lookById(DEFAULT_LOOK), { ...pageLayout(size), hue: HUES.dark }))
    return
  }
  fs.writeFileSync(path.join(root, 'world', 'world.py'),
    WORLD_3D.replace('{{DURATION}}', String(duration)).replace('{{W}}', size.width).replace('{{H}}', size.height))
}

// The 2D world: a look's page in a style (looks.mjs), and the files the
// style's page loads beside it
export function writeWorld2d(root, look, size, style, tune = null) {
  const dir = path.join(root, 'world')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'page.html'), lookPage(look ?? DEFAULT_LOOK, size, style, tune))
  for (const [name, text] of Object.entries(styleFiles(style))) fs.writeFileSync(path.join(dir, name), text)
}

// The starter caption layer (3D in Blender): each shot's text, or its title, over its time
const CAPTIONS_MARK = "film's timeline. (starter)"
export const isStarterCaptions = file => fs.readFileSync(file, 'utf8').includes(CAPTIONS_MARK)

export function captions(size, shots) {
  const { width: w, height: h } = cssSize(size)
  let t = 0
  const lines = shots.map(s => {
    const at = round(t, 1)
    t += s.duration
    return [at, s.text || s.title]
  })
  return `<!doctype html>
<!-- Caption layer: transparent, drawn over every frame on the ${CAPTIONS_MARK} -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
      #cap { position: absolute; left: 40px; right: 40px; top: 140px; padding: 18px 22px; border-radius: 14px;
        background: rgba(11, 15, 25, 0.85); color: #fff; font: 700 ${Math.round(w * 0.055)}px/1.15 system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <div id="cap"></div>
    <script>
      const LINES = ${JSON.stringify(lines)}
      window.render = t => {
        document.getElementById('cap').textContent = LINES.filter(([at]) => t >= at).at(-1)[1]
      }
      window.ready = document.fonts.ready
      render(0)
    </script>
  </body>
</html>
`
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
