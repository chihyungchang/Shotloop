// Applying a plan: shots keep their ids while they are still starter cards
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { newProject } from './create.mjs'
import { loadProject } from './project.mjs'
import { applyStoryboard } from './storyboard.mjs'

const made = []
after(() => made.forEach(d => fs.rmSync(d, { recursive: true, force: true })))

test('a plan applied again keeps the starter shots\' ids; a title in another script gets its place', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-sb-')), 'p')
  made.push(path.dirname(dir))
  newProject(dir, { idea: '飞行汽车', duration: 12 })
  const plan = titles => {
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ shots: titles.map(title => ({ title, duration: 4 })) }))
    applyStoryboard(loadProject(dir))
    return loadProject(dir).shots.map(s => s.id)
  }
  const first = plan(['会飞的跑车？', 'Ten thrusters', '后座的气罐'])
  const again = plan(['会飞的跑车？', 'Ten thrusters', '后座的气罐'])
  assert.deepEqual(again, first)
  // A drawn shot stays itself when the same plan is applied again (the
  // plan keeps the ids it was given)
  fs.writeFileSync(path.join(dir, 'shots', first[0], 'shot.js'), 'export default function render() {}\n')
  applyStoryboard(loadProject(dir))
  assert.deepEqual(loadProject(dir).shots.map(s => s.id), first)
  // A shot the AI has drawn keeps its code: a new plan never takes its id
  fs.writeFileSync(path.join(dir, 'shots', first[0], 'shot.js'), 'export default function render() {}\n')
  const third = plan(['开场', 'Ten thrusters', '后座的气罐'])
  assert.notEqual(third[0], first[0])
  assert.deepEqual(third.slice(1), first.slice(1))
  assert.ok(third.every(id => !/shot/.test(id)), third.join(' '))
  // A title that leads with its chapter number doesn't number the id twice
  fs.writeFileSync(path.join(dir, 'shots', third[0], 'shot.js'), 'export default function render() {}\n')
  assert.equal(plan(['01 — The problem', 'Ten thrusters', '后座的气罐'])[0], '01-the-problem')
})
