// New projects and project summaries for the app's Home and All projects.
//
// newProject writes a starter project that renders as it is: the idea
// goes into copy.md and every shot's notes, and each shot gets placeholder
// code (2D: a title card per shot; 3D: a small stage and one camera move
// per shot) for the agent and the person to replace step by step.

import fs from 'node:fs'
import path from 'node:path'
import { editMode, entry, takes } from './cache.mjs'
import { isProject, loadProject, saveConfig, SIZES } from './project.mjs'

const round1 = x => Math.round(x * 10) / 10

// Shots of about 5 s, a short hook first and an end card last
function planShots(duration) {
  const n = Math.max(3, Math.round(duration / 5))
  const hook = round1(Math.min(3, duration / n))
  const end = round1(Math.min(3, duration / n))
  const middle = n - 2
  const each = round1((duration - hook - end) / middle)
  const shots = [{ id: '01-hook', title: 'Hook', duration: hook }]
  for (let i = 0; i < middle; i++) {
    shots.push({ id: `${String(i + 2).padStart(2, '0')}-beat-${i + 1}`, title: `Beat ${i + 1}`, duration: each })
  }
  // The end card absorbs rounding so the film is exactly `duration`
  const used = shots.reduce((t, s) => t + s.duration, 0)
  shots.push({ id: `${String(n).padStart(2, '0')}-end`, title: 'End card', duration: round1(duration - used) })
  return shots
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function page2d({ width, height }) {
  const w = Math.round(width / 1.5)
  const h = Math.round(height / 1.5)
  return `<!doctype html>
<!--
  World of a 2D Shotloop project: the stage every shot draws on, at
  ${w}×${h} CSS px (rendered at 1.5x). Shots draw it from shots/*/shot.js
  through the helpers on window.kit; nothing animates on its own. The
  caption layer (captions.html) owns the top of the frame: content starts
  at 40% of the height.
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root { --ink: #0b0f19; --text: #f2f5fa; --muted: #93a0b8; --accent: #ffb340; }
      * { box-sizing: border-box; margin: 0; }
      html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: var(--ink); color: var(--text);
        font-family: system-ui, -apple-system, sans-serif; }
      #kicker { position: absolute; left: 40px; top: ${Math.round(h * 0.4) - 40}px; font: 600 18px ui-monospace, monospace; color: var(--muted);
        letter-spacing: 0.08em; text-transform: uppercase; }
      #title { position: absolute; left: 40px; right: 40px; top: ${Math.round(h * 0.4)}px; font-weight: 800;
        font-size: ${Math.round(w * 0.09)}px; line-height: 1.05; letter-spacing: -0.02em; }
      #title b { color: var(--accent); }
      #body { position: absolute; left: 40px; right: 40px; top: ${Math.round(h * 0.66)}px; font-size: ${Math.round(w * 0.04)}px;
        line-height: 1.35; color: var(--muted); }
      #progress { position: absolute; left: 0; top: 0; height: 6px; background: var(--accent); }
    </style>
  </head>
  <body>
    <div id="progress"></div>
    <div id="kicker"></div>
    <h1 id="title"></h1>
    <p id="body"></p>
    <script>
      const $ = id => document.getElementById(id)
      const clamp = x => Math.min(1, Math.max(0, x))
      // 0 → 1 over [a, a + d], eased out
      const rise = (t, a, d = 0.4) => 1 - Math.pow(1 - clamp((t - a) / d), 3)
      const lift = (el, p, dy = 40) => {
        el.style.opacity = p
        el.style.transform = \`translateY(\${(1 - p) * dy}px)\`
      }
      // A title card: what every starter shot draws until it gets its own design
      function card(t, { kicker, title, body, progress }) {
        $('kicker').textContent = kicker
        $('title').innerHTML = title
        $('body').textContent = body
        $('progress').style.width = \`\${progress * 100}%\`
        lift($('kicker'), rise(t, 0.05))
        lift($('title'), rise(t, 0.15))
        lift($('body'), rise(t, 0.45), 24)
      }
      window.kit = { $, clamp, rise, lift, card }
      window.ready = document.fonts.ready
    </script>
  </body>
</html>
`
}

function shot2d(shot, i, n, idea) {
  const title = i === 0 ? esc(idea.split(/[.?!]/)[0].slice(0, 60)) : i === n - 1 ? 'Follow for <b>more</b>' : esc(shot.title)
  return `// ${shot.id}: ${shot.title}. Starter shot: a title card to replace.
// Shot-local time: t = 0 is this shot's first frame.

export default function render(t, { window, start, duration }) {
  window.kit.card(t, {
    kicker: ${JSON.stringify(`${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`)},
    title: ${JSON.stringify(title)},
    body: ${JSON.stringify(i === 0 ? 'What this video answers, in one line.' : i === n - 1 ? 'Sources and credits go here.' : 'What this beat shows.')},
    progress: (start + t) / ${JSON.stringify('FILM')}
  })
}
`
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

const MOVES_3D = [
  "move='dolly', frm=(0, -7, 2.2), to=(0, -5.5, 1.9)",
  "move='orbit', frm=(-110,), to=(-70,), radius=5, height=1.8",
  "move='truck', frm=(-1.5, -5, 1.6), to=(1.5, -5, 1.6)",
  "move='pedestal', frm=(0, -5, 3), to=(0, -5, 1.4)",
  "move='crane', frm=(-2, -6, 3.5), to=(-1, -5, 1.6)"
]

export function shot3d(shot, i) {
  return `# ${shot.id}: ${shot.title}. Starter shot: one camera move on the subject.
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
kit.Shot(${JSON.stringify(shot.id).replace(/"/g, "'")}, at(0), at(DUR), lens=35, target=subject,
         ${MOVES_3D[i % MOVES_3D.length]}, clip=(0.1, 80))
`
}

export function captions({ width, height }, shots) {
  const w = Math.round(width / 1.5)
  const h = Math.round(height / 1.5)
  let t = 0
  const lines = shots.map((s, i) => {
    const at = round1(t)
    t += s.duration
    return [at, s.text ?? s.title]
  })
  return `<!doctype html>
<!-- Caption layer: transparent, drawn over every frame on the film's timeline. (starter) -->
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

function thumb(title) {
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

export function newProject(dir, { title, idea = '', track = '2d', aspect = '9:16', duration = 30 }) {
  const root = path.resolve(dir)
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error(`${root} exists and is not empty`)
  if (!['2d', '3d'].includes(track)) throw new Error('track must be 2d or 3d')
  if (!(duration >= 6 && duration <= 180)) throw new Error('duration must be 6–180 s')
  const size = aspect === '16:9' ? SIZES.landscape : SIZES.portrait
  title = title?.trim() || idea.split(/[.?!\n]/)[0].trim().slice(0, 60) || path.basename(root)
  idea = idea.trim()
  const shots = planShots(duration)

  fs.mkdirSync(path.join(root, 'world'), { recursive: true })
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text)
  }
  if (track === '2d') write('world/page.html', page2d(size))
  else write('world/world.py', WORLD_3D.replace('{{DURATION}}', String(duration)).replace('{{W}}', size.width).replace('{{H}}', size.height))
  shots.forEach((s, i) => {
    write(`shots/${s.id}/${track === '3d' ? 'shot.py' : 'shot.js'}`,
      track === '3d' ? shot3d(s, i) : shot2d(s, i, shots.length, idea || title).replace('"FILM"', String(duration)))
    write(`shots/${s.id}/notes.md`, `# ${s.id} · ${s.title}\n\n## Must show\n\n(what this shot must show)\n\n## Motion\n\n(the move)\n\n## Review history\n\n- ${new Date().toISOString().slice(0, 10)}: created from the idea.\n`)
  })
  write('copy.md', `# ${title}\n\n## Idea\n\n${idea || '(the idea, in a few sentences)'}\n\n## Facts\n\n(each fact with its source)\n\n## Sources\n\n- \n`)
  write('script.md', `# ${title} · Script\n\n(one line per shot, what the viewer reads or hears)\n`)
  write('storyboard.md', `# ${title} · Storyboard\n\n| # | Time | Shot | Motion |\n| --- | --- | --- | --- |\n${shots.map((s, i) => `| ${i + 1} | ${s.duration} s | ${s.title} | |`).join('\n')}\n`)
  write('captions.html', captions(size, shots))
  write('music.json', JSON.stringify({
    bpm: 100, duration, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    sections: [{ from: 0, to: duration, layers: ['pad', 'bass', 'hat'] }],
    hits: [], risers: [], fadeIn: 0.2, fadeOut: 1.5
  }, null, 2) + '\n')
  write('thumb.html', thumb(title))
  write('publish.md', `# ${title} · Publish\n\n(written by the agent from copy.md: Export → Publish copy)\n`)
  write('.gitignore', '.shotloop/\nout/\n')
  saveConfig(root, {
    version: 1,
    title,
    slug: path.basename(root),
    track,
    fps: 30,
    size,
    shots,
    captions: 'captions.html',
    music: 'music.json',
    cover: 'thumb.html',
    publish: 'publish.md'
  })
  return { root, title, track, shots: shots.length }
}

// A summary card per project: title, a one-line description (optional
// "description" in shotloop.json), track, size, duration, a poster
// (a still of the first shot that has one), last change
export function summaries(dirs) {
  return dirs.flatMap(dir => {
    if (!isProject(dir)) return []
    try {
      const p = loadProject(dir)
      let poster = null
      for (const s of p.shots) {
        const e = entry(p, s, editMode(p))
        poster = e.stills?.[1] ?? takes(p, s).findLast(t => t.stills)?.stills?.[1] ?? null
        if (poster) break
      }
      const changed = fs.statSync(path.join(p.root, 'shotloop.json')).mtimeMs
      return [{
        root: p.root, title: p.title, description: p.config.description ?? '', lang: p.config.lang ?? null, slug: p.slug, track: p.track, size: p.size,
        duration: p.duration, shots: p.shots.length, poster, changed: new Date(changed).toISOString()
      }]
    } catch {
      return []
    }
  })
}

// Projects directly inside a folder (the repository's examples/)
export const projectsIn = dir =>
  fs.existsSync(dir) ? fs.readdirSync(dir).map(d => path.join(dir, d)).filter(isProject).sort() : []
