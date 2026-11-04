#!/usr/bin/env node
// The looks' preview frames (looks/<id>-infographic.jpg, and
// <id>-scene.jpg for a look with scene colors): the same demo shot drawn
// in every look, so the pickers compare like with like. Run it after
// adding or changing a look:
//
//   node engine/shotloop/kits/looks/previews.mjs [look id …]   (none: every look)

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ffmpeg } from '../../render/compose.mjs'
import { newProject } from '../../project/create.mjs'
import { LOOKS, lookById } from '../../data.mjs'
import { loadProject } from '../../project/project.mjs'
import { renderShot } from '../../render/render.mjs'

// The previews' width in px (the pickers show them at most this big)
const WIDTH = 300

// One demo per style a preview shows, drawn at its end still
const DEMOS = {
  infographic: `export default function render(t, { window }) {
  const { W, H, PAD, SAFE_BOTTOM, C, FONT, frame, stage, bars, waffle, rise } = window.kit
  frame({ kicker: 'WORLD POWER · 2024', head: ['Solar made', '*6.9%* of it'], typed: rise(t, 0, 0.6), progress: 0.45 })
  stage(
    bars({ y: H * 0.6, h: H * 0.2, values: [2.1, 3.2, 4.4, 6.9], labels: ['2021', '2022', '2023', '2024'],
      colors: [C.hue.gray, C.hue.gray, C.hue.gray, C.hue.yellow], p: rise(t, 0.3, 1) }) +
    waffle({ y: H * 0.655, n: 60, cols: 20, lit: 4, color: C.hue.yellow, p: rise(t, 0.6, 1), litP: rise(t, 1, 0.6) }) +
    '<text x="' + PAD + '" y="' + (SAFE_BOTTOM - 8) + '" font-size="14" fill="' + C.muted + '" font-family="' + FONT.replace(/"/g, "'") + '">Source: Ember, 2025</text>'
  )
}
`,
  scene: `export default function render(t, { window }) {
  const { W, H, stage, light, sphere, beam, trail, particles, caption, source, rise } = window.kit
  stage(t)
  particles(t, { n: 40, y: H * 0.55, h: H * 0.3, size: 1.4, vx: 20 })
  light(t, W * 0.06, H * 0.5, W * 0.12)
  sphere(t, W * 0.77, H * 0.5, W * 0.075, { light: Math.PI })
  beam(W * 0.06, H * 0.5, W * 0.77, H * 0.5, 0.55, { head: 1 })
  // A curve rising to the right, its head still glowing
  const arc = Array.from({ length: 16 }, (_, i) => { const k = i / 15; return [k * W * 0.68, H * (0.75 - 0.1 * k * k)] })
  trail(arc, 0.995)
  caption({ kicker: 'A JOURNEY OF LIGHT', head: ['Light reaches us', 'in *8 min 19 s*'], p: rise(t, 0, 0.6) })
  source('Source: NASA')
}
`
}

async function preview(look, style, tmp) {
  const dir = path.join(tmp, `${look}-${style}`)
  newProject(dir, { idea: 'Look preview', track: '2d', duration: 6, look, style, voice: false })
  const project = loadProject(dir)
  const shot = project.shots[0]
  fs.writeFileSync(shot.code, DEMOS[style])
  const { stills } = await renderShot(project, shot, { mode: 'final', stills: true, force: true })
  const out = path.join(import.meta.dirname, `${look}-${style}.jpg`)
  await ffmpeg(['-i', stills.at(-1), '-vf', `scale=${WIDTH}:-2`, '-q:v', '4', out])
  console.log(path.relative(process.cwd(), out))
}

const ids = process.argv.slice(2)
for (const id of ids) if (!lookById(id)) throw new Error(`no look "${id}"`)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-previews-'))
try {
  for (const look of LOOKS.filter(l => !ids.length || ids.includes(l.id))) {
    await preview(look.id, 'infographic', tmp)
    if (look.scene) await preview(look.id, 'scene', tmp)
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
