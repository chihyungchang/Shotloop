import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { cachedFile, keyParts, shotKey } from './cache.mjs'
import { newProject } from './create.mjs'
import { loadProject, updateConfig } from './project.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-test-'))

function starter() {
  const dir = path.join(tmp(), 'film')
  newProject(dir, { idea: 'Why the sky is blue', duration: 12, voice: false })
  return loadProject(dir)
}

test('a shot keeps its key while its inputs stay, and a copied project finds it', () => {
  const p = starter()
  const shot = p.shots[0]
  const again = loadProject(p.root)
  assert.equal(shotKey(again, again.shots[0], 'final'), shotKey(p, shot, 'final'))
  assert.notEqual(shotKey(p, shot, 'final'), shotKey(p, shot, 'draft'))

  const copy = path.join(tmp(), 'copy')
  fs.cpSync(p.root, copy, { recursive: true })
  const copied = loadProject(copy)
  assert.equal(shotKey(copied, copied.shots[0], 'final'), shotKey(p, shot, 'final'))
})

test('a change to a shot\'s code changes its key and names the part', () => {
  const p = starter()
  const shot = p.shots[1]
  const before = keyParts(p, shot, 'final')
  const key = shotKey(p, shot, 'final')
  const other = shotKey(p, p.shots[0], 'final')
  fs.appendFileSync(shot.code, '\n// edited\n')
  const after = keyParts(p, shot, 'final')
  assert.notEqual(shotKey(p, shot, 'final'), key)
  assert.deepEqual(Object.keys(after).filter(k => after[k] !== before[k]), ['code'])
  // The other shots keep theirs
  assert.equal(shotKey(p, p.shots[0], 'final'), other)
})

test('cachedFile makes a file once and leaves nothing behind when making fails', async () => {
  const dir = tmp()
  const file = path.join(dir, 'out', 'bed.wav')
  await assert.rejects(cachedFile(file, async part => {
    fs.writeFileSync(part, 'half')
    throw new Error('cut short')
  }), /cut short/)
  assert.deepEqual(fs.readdirSync(path.dirname(file)), [])

  let made = 0
  const make = async part => {
    made++
    fs.writeFileSync(part, 'whole')
  }
  assert.equal(await cachedFile(file, make), file)
  assert.equal(await cachedFile(file, make), file)
  assert.equal(made, 1)
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['bed.wav'])
})

test('updateConfig changes only what the writer owns, over what others wrote meanwhile', () => {
  const p = starter()
  // A long writer read the project before another command renamed it
  const stale = loadProject(p.root)
  updateConfig(p.root, cfg => ({ ...cfg, title: 'Renamed meanwhile' }))
  updateConfig(stale.root, cfg => ({ ...cfg, shots: cfg.shots.map(s => ({ ...s, duration: s.duration + 1 })) }))
  const now = loadProject(p.root)
  assert.equal(now.title, 'Renamed meanwhile')
  assert.deepEqual(now.shots.map(s => s.duration), p.shots.map(s => s.duration + 1))
  // Written whole: no temporary file is left next to it
  assert.deepEqual(fs.readdirSync(p.root).filter(f => f.includes('.tmp')), [])
})
