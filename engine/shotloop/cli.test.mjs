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

test('a 3D film is drawn in WebGL or Blender; one from before the choice is Blender\'s', () => {
  const webgl = path.join(tmp(), 'webgl')
  newProject(webgl, { idea: 'How gears mesh', track: '3d', duration: 12 })
  const w = run('status', webgl).result
  assert.equal(w.renderer, 'webgl')
  assert.ok(fs.existsSync(path.join(webgl, 'world', 'page.html')))
  assert.ok(fs.existsSync(path.join(webgl, 'shots', '01-hook', 'shot.js')))
  assert.equal(fs.existsSync(path.join(webgl, 'captions.html')), false)

  const blender = path.join(tmp(), 'blender')
  newProject(blender, { idea: 'How gears mesh', track: '3d', renderer: 'blender', duration: 12 })
  assert.ok(fs.existsSync(path.join(blender, 'world', 'world.py')))
  assert.ok(fs.existsSync(path.join(blender, 'shots', '01-hook', 'shot.py')))
  // Saved before the choice: no renderer field, a world.py
  const cfg = JSON.parse(fs.readFileSync(path.join(blender, 'shotloop.json'), 'utf8'))
  delete cfg.renderer
  fs.writeFileSync(path.join(blender, 'shotloop.json'), JSON.stringify(cfg))
  assert.equal(run('status', blender).result.renderer, 'blender')

  assert.throws(() => newProject(path.join(tmp(), 'bad'), { idea: 'x', track: '3d', renderer: 'unity', duration: 12 }), /renderer/)
})
