import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

// A memory of its own, set before the module reads where it lives
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-memory-'))
process.env.SHOTLOOP_MEMORY = dir
after(() => fs.rmSync(dir, { recursive: true, force: true }))
const memory = await import('./memory.mjs')

test('memory: notes and lessons, a merge replaces the old lesson, the AI cannot replace a note', () => {
  const note = memory.add({ text: '  Keep captions\n in sentence case ' })
  assert.deepEqual([note.by, note.track, note.text], ['user', 'all', 'Keep captions in sentence case'])
  const lesson = memory.add({ text: 'Compute the physics', by: 'ai', track: '2d', from: 'Lift' })
  const merged = memory.add({ text: 'Compute physics from a model', by: 'ai', track: '2d', replaces: lesson.id })
  assert.deepEqual(memory.list().map(m => m.text), ['Keep captions in sentence case', 'Compute physics from a model'])
  assert.equal(merged.by, 'ai')
  assert.throws(() => memory.add({ text: 'x', by: 'ai', replaces: note.id }), /only the AI's own/)
  assert.throws(() => memory.add({ text: 'x'.repeat(memory.MAX_CHARS + 1) }), /at most/)
  assert.throws(() => memory.add({ text: 'x', by: 'ai', track: '4d' }), /track/)
  memory.remove(note.id)
  memory.remove(merged.id)
  assert.deepEqual(memory.list(), [])
})

test('memory: when the AI holds its share, a new lesson must be merged', () => {
  const kept = Array.from({ length: memory.MAX_LEARNED }, (_, i) => memory.add({ text: `lesson ${i}`, by: 'ai' }))
  assert.throws(() => memory.add({ text: 'one more', by: 'ai' }), /merge this one/)
  // The person's notes don't count against it
  memory.add({ text: 'a note' })
  assert.ok(memory.add({ text: 'merged', by: 'ai', replaces: kept[0].id }))
  assert.equal(memory.list().filter(m => m.by === 'ai').length, memory.MAX_LEARNED)
})
