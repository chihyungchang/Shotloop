// The layout check measures a promo shot in its page: what it finds is
// what the reviewer would have had to see in the stills
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { newProject } from '../project/create.mjs'
import { loadProject } from '../project/project.mjs'
import { measureLayout } from './measure.mjs'

const made = []
after(() => made.forEach(d => fs.rmSync(d, { recursive: true, force: true })))

function promoShot(code) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-measure-')), 'p')
  made.push(path.dirname(dir))
  newProject(dir, { idea: 'x', promo: true, duration: 6 })
  const project = loadProject(dir)
  const shot = project.shots[0]
  fs.writeFileSync(shot.code, code)
  return { project: loadProject(dir), shot }
}

test('measure: lines set over each other, a box laid on the desktop from outside, a small desktop and an empty half', async () => {
  const { project, shot } = promoShot(`import { depth, layout, headline, desktop } from '../../world/screens.js'
export default function render(t, { window }) {
  const L = layout('below', { lines: 2 })
  const box = { x: L.picture.x, y: L.picture.y, w: L.picture.w, h: L.picture.h * 0.7 }
  const d = desktop({ box, windows: [] })
  // Two lines set 10 px apart at 50 px: they collide
  depth(d.html,
    headline(t, { lines: ['One line'], x: 60, y: 120, size: 50 }),
    headline(t, { lines: ['Another'], x: 60, y: 130, size: 50 }),
    '<div data-name="mark" style="position:absolute;left:' + (d.box.x + 40) + 'px;top:' + (d.box.y + 40) + 'px;width:120px;height:40px;border:3px solid #111"></div>')
  window.kit.stage('')
}
`)
  const issues = await measureLayout(project, shot)
  const said = rule => issues.filter(i => i.rule === rule).map(i => i.what).join('\n')
  assert.match(said('caption-zone'), /"One line" overlaps text "Another"/)
  assert.match(said('promo-on-screen'), /mark is drawn over the desktop from outside its picture/)
  assert.match(said('promo-fill'), /the desktop is \d+% of the frame's height, under half/)
  assert.match(said('promo-fill'), /an empty band/)
  // Kept with the shot for the film's other beats to be held to
  assert.ok(fs.existsSync(path.join(project.root, '.shotloop', 'shots', shot.id, 'layout.json')))
})

test('measure: a mark drawn on the window\'s picture is part of the screen, and an explainer is not measured', async () => {
  const { project, shot } = promoShot(`import { depth, layout, headline, desktop, mark } from '../../world/screens.js'
export default function render(t, { window }) {
  const L = layout('auto', { lines: 1 })
  const d = desktop({ box: L.picture, windows: [{ file: 'images/screen.jpg', width: 640, height: 360, x: 20, y: 20, w: 600, draw: mark({ region: { x: 100, y: 100, w: 300, h: 60 } }) }] })
  depth(d.html, headline(t, { lines: ['Just one line'], x: L.words.x, y: L.words.y, width: L.words.width, size: L.words.size }))
  window.kit.stage('')
}
`)
  fs.mkdirSync(path.join(project.root, 'images'), { recursive: true })
  fs.copyFileSync(new URL('../tools/highlight.jpg', import.meta.url), path.join(project.root, 'images', 'screen.jpg'))
  const issues = await measureLayout(project, shot)
  assert.deepEqual(issues.filter(i => i.rule === 'promo-on-screen' || i.rule === 'caption-zone'), [])
  const explainer = loadProject(project.root)
  explainer.config = { ...explainer.config, promo: null }
  assert.equal(await measureLayout(explainer, shot), null)
})
