// A promo laid out from its plan: one desktop for the film, the cards
// for its ends, the same frames for the engine, the kit and the app
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { pageLayout } from '../data.mjs'
import { filmFrames, pageOf, planBeats, planIssues, SCREEN, wireframe } from '../kits/promo-layout.js'
import { newProject } from '../project/create.mjs'
import { loadProject, SIZES } from '../project/project.mjs'
import { applyStoryboard } from '../project/storyboard.mjs'
import { measureLayout } from '../render/measure.mjs'
import { writeFrames } from './frames.mjs'

const made = []
after(() => made.forEach(d => fs.rmSync(d, { recursive: true, force: true })))

const PLAN = [
  { title: 'Title', beat: 'title', text: 'Shotloop', duration: 3 },
  { title: 'Problem', beat: 'problem', text: 'One shot off.\nAll renders.', duration: 5 },
  { title: 'Plan', beat: 'screen', text: 'One line in.', steps: 3, duration: 5 },
  { title: 'Fix', beat: 'screen', text: 'Say what.\nIt fixes it.', duration: 5 },
  { title: 'End', beat: 'end', text: 'Fix one shot.', duration: 4 }
]

test('frames: one desktop at a screen\'s 16:10 for the whole film, cards at its ends', () => {
  const page = pageOf(pageLayout(SIZES.landscape))
  const frames = filmFrames(page, planBeats(PLAN))
  assert.equal(frames.kind, 'side')
  const screens = frames.beats.filter(b => b.beat === 'screen')
  assert.equal(screens.length, 2)
  assert.deepEqual(screens[0].desktop, screens[1].desktop)
  const d = frames.desktop
  assert.ok(Math.abs(d.w / d.h - SCREEN) < 1e-9 && d.h > page.H * 0.5, JSON.stringify(d))
  // Steps under the headline, clear of its last line
  assert.equal(screens[0].steps.n, 3)
  assert.ok(screens[0].steps.y > screens[0].words.y + screens[0].words.size)
  assert.ok(frames.beats[0].card && frames.beats[4].card)
  assert.ok(frames.beats[1].picture && !frames.beats[1].desktop)
  assert.match(wireframe(frames, 2), /^<svg [^>]*viewBox="0 0 1280 720"/)
  // A plan from before beats gets none
  assert.equal(planBeats(PLAN.map(({ beat, ...s }) => s)), null)
})

test('frames: written when the plan is applied, and taken by a shot with frame() and the cards', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-frames-')), 'p')
  made.push(path.dirname(dir))
  newProject(dir, { idea: 'x', promo: true, duration: 22 })
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ shots: PLAN }))
  applyStoryboard(loadProject(dir))
  const project = loadProject(dir)
  const frames = writeFrames(project)
  assert.deepEqual(frames.beats.map(b => b.id), project.shots.map(s => s.id))
  assert.ok(fs.existsSync(path.join(dir, 'world', 'frames.json')))
  assert.ok(fs.existsSync(path.join(dir, 'world', 'promo-layout.js')))

  // The title, laid out by the kit from the frames, and a screen beat
  const [title, , screen] = project.shots
  fs.writeFileSync(title.code, `import { load, depth, frame, titleCard } from '../../world/screens.js'
export const setup = () => load()
export default function render(t, { window }) {
  if (!frame().card) throw new Error('the title has no card')
  depth(titleCard(t, { name: 'Shotloop', line: 'Fix one shot, not the whole film.', at: 0 }))
  window.kit.stage('')
}
`)
  fs.writeFileSync(screen.code, `import { load, depth, frame, headline, desktop, steps } from '../../world/screens.js'
export const setup = () => load()
export default function render(t, { window }) {
  const f = frame()
  depth(desktop({ box: f.desktop, windows: [] }).html,
    headline(t, { lines: ['One line in.'], x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size }),
    steps(t, { items: ['IDEA', 'PLAN', 'FILM'], x: f.steps.x, y: f.steps.y }))
  window.kit.stage('')
}
`)
  const faults = await measureLayout(project, screen)
  assert.deepEqual(faults.filter(f => f.rule !== 'promo-motion'), [])
  await measureLayout(project, title)
})

test('frames: a plan without beats leaves none behind', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-frames-')), 'p')
  made.push(path.dirname(dir))
  newProject(dir, { idea: 'x', promo: true, duration: 22 })
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'world', 'frames.json'), '{}')
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ shots: PLAN.map(({ beat, ...s }) => s) }))
  applyStoryboard(loadProject(dir))
  assert.equal(writeFrames(loadProject(dir)), null)
  assert.ok(!fs.existsSync(path.join(dir, 'world', 'frames.json')))
})

test('frames: what the plan must change for its frames, said for the planner', () => {
  const page = pageOf(pageLayout(SIZES.landscape))
  assert.deepEqual(planIssues(page, PLAN), [])
  assert.match(planIssues(page, PLAN.map(({ beat, ...s }) => s))[0], /needs its "beat"/)
  const turned = [PLAN[1], PLAN[0], ...PLAN.slice(2, 4)]
  assert.deepEqual(planIssues(page, turned).map(i => i.split(':')[0]), ['shot 1 (Problem)', 'shot 4 (Fix)'])
  // Headlines keep their size: a line too long for the column is the plan's to split
  const long = PLAN.map((s, i) => (i === 2 ? { ...s, text: 'One sentence becomes a whole storyboard here' } : s))
  assert.match(planIssues(page, long).join('\n'), /shot 3 \(Plan\): a headline line of 44 letters is longer than its column holds/)
  const frames = filmFrames(page, planBeats(long))
  assert.ok(frames.beats[2].words.size >= filmFrames(page, planBeats(PLAN)).beats[2].words.size * 0.8 - 1e-9)
})
