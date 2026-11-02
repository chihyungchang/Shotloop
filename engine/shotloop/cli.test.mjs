// The CLI's JSON output against protocol.d.ts: the fields `status` sends
// are the ones the protocol types, so neither drifts from the other
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { newProject } from './create.mjs'

const CLI = path.join(import.meta.dirname, 'cli.mjs')
const made = []
// Temporary folders, removed when the tests end
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-cli-'))
  made.push(dir)
  return dir
}
after(() => made.forEach(d => fs.rmSync(d, { recursive: true, force: true })))
const PROTOCOL = fs.readFileSync(path.join(import.meta.dirname, 'protocol.d.ts'), 'utf8')

// The fields of an interface in protocol.d.ts, by name
function fields(name) {
  const body = PROTOCOL.match(new RegExp(`export interface ${name} \\{\\n([\\s\\S]*?)\\n\\}`))?.[1]
  assert.ok(body, `protocol.d.ts has no interface ${name}`)
  return body.split('\n').map(l => l.match(/^ {2}(\w+)\??:/)?.[1]).filter(Boolean).sort()
}

// The command's events, and its result
function run(...args) {
  const events = execFileSync(process.execPath, [CLI, '--json', ...args], { encoding: 'utf8' }).trim().split('\n').map(l => JSON.parse(l))
  return { events, result: events.find(e => e.type === 'result')?.value }
}

test('status sends what the protocol types', () => {
  for (const track of ['2d', '3d']) {
    const dir = path.join(tmp(), `film-${track}`)
    newProject(dir, { idea: 'How a zipper works', track, duration: 12 })
    const { result } = run('status', dir)
    assert.deepEqual(Object.keys(result).sort(), fields('StatusResult'))
    for (const shot of result.shots) assert.deepEqual(Object.keys(shot).sort(), fields('ShotStatus'))
    assert.deepEqual(Object.keys(result.shots[0].final).sort(), fields('CacheEntry'))
    assert.equal(result.voiced, false)
    assert.equal(result.styleChosen, false)
  }
})

test('list reports a project that can\'t be read instead of hiding it', () => {
  const parent = tmp()
  const good = path.join(parent, 'good')
  newProject(good, { idea: 'Coffee by country', duration: 12 })
  const broken = path.join(parent, 'broken')
  fs.mkdirSync(broken)
  fs.writeFileSync(path.join(broken, 'shotloop.json'), '{ "version": 1, ')
  const { result } = run('list', good, broken)
  assert.deepEqual(Object.keys(result[0]).sort(), fields('ProjectSummary'))
  assert.deepEqual(Object.keys(result[1]).sort(), fields('BrokenProject'))
  assert.match(result[1].error, /shotloop\.json/)
})

test('a 3D film is drawn in WebGL; one Blender drew gets the kit and is built again', () => {
  const dir = path.join(tmp(), 'webgl')
  newProject(dir, { idea: 'How gears mesh', track: '3d', duration: 12 })
  assert.ok(fs.existsSync(path.join(dir, 'world', 'page.html')))
  assert.ok(fs.existsSync(path.join(dir, 'shots', '01-hook', 'shot.js')))
  // A film from before: a Blender world, no page
  fs.rmSync(path.join(dir, 'world', 'page.html'))
  fs.writeFileSync(path.join(dir, 'world', 'world.py'), 'import kit\n')
  const { events } = run('status', dir)
  assert.ok(fs.existsSync(path.join(dir, 'world', 'page.html')))
  assert.ok(events.some(e => /drawn in Blender/.test(e.message ?? '')))
})

test('a WebGL film\'s kit page is brought up to the engine\'s before a command reads it', () => {
  const dir = path.join(tmp(), 'kit')
  newProject(dir, { idea: 'How gears mesh', track: '3d', duration: 12 })
  const page = path.join(dir, 'world', 'page.html')
  const current = fs.readFileSync(page, 'utf8')
  fs.writeFileSync(page, current.replace('function frame()', 'function frameOld()'))
  run('status', dir)
  assert.equal(fs.readFileSync(page, 'utf8'), current)
})
