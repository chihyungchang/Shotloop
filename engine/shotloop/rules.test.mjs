import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

// A rules folder of its own, set before the module reads where it lives
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-rules-'))
process.env.SHOTLOOP_RULES = dir
after(() => fs.rmSync(dir, { recursive: true, force: true }))
const rules = await import('./rules.mjs')

const taste = id => rules.list().taste.find(r => r.id === id)

test('rules: taste is reworded, switched off and restored; fixed rules stay', () => {
  assert.ok(rules.asBuilt('caption'))
  rules.edit('caption', '  Two lines are fine\n when the picture is busy ')
  assert.deepEqual([taste('caption').rule, taste('caption').edited], ['Two lines are fine when the picture is busy', true])
  assert.equal(rules.asBuilt('caption'), false)
  // The checklist judges an edited rule by its new words
  assert.match(rules.checklist('2d'), /\*\*caption\*\* \(2D\): Two lines are fine/)

  rules.remove('full')
  assert.equal(taste('full').off, true)
  assert.doesNotMatch(rules.checklist('2d'), /\*\*full\*\*/)
  rules.reset('full')
  rules.reset('caption')
  assert.equal(taste('full').off, false)
  assert.ok(rules.asBuilt('caption'))

  assert.throws(() => rules.remove('honest'), /fixed rule/)
  assert.throws(() => rules.reset('honest'), /no built-in rule/)
  assert.throws(() => rules.edit('visual', 'x'.repeat(rules.MAX_CHARS + 1)), /at most/)
})

test('rules: the person adds and deletes their own; the checklist keeps tracks apart', () => {
  const own = rules.add('Always end on a question').taste.at(-1)
  assert.deepEqual([own.builtIn, own.name, own.rule, own.track], [false, null, 'Always end on a question', 'all'])
  const flat = rules.add('Keep the camera low', '3d').taste.at(-1)
  assert.equal(flat.track, '3d')
  assert.doesNotMatch(rules.checklist('2d'), new RegExp(flat.id))
  rules.remove(flat.id)
  assert.throws(() => rules.add('x', '4d'), /track/)
  rules.edit(own.id, 'End on a question')
  const two = rules.checklist('2d')
  const three = rules.checklist('3d')
  assert.match(two, new RegExp(`\\*\\*${own.id}\\*\\*: End on a question`))
  assert.match(three, new RegExp(`\\*\\*${own.id}\\*\\*`))
  assert.match(three, /\*\*sightline\*\*/)
  assert.doesNotMatch(three, /\*\*honest\*\*/)
  assert.doesNotMatch(two, /\*\*sightline\*\*/)
  rules.remove(own.id)
  assert.equal(rules.list().taste.some(r => r.id === own.id), false)
})

test('rules: the person\'s tools carry a picture; built-in tools stay', () => {
  const png = path.join(dir, 'source.png')
  fs.writeFileSync(png, 'not really a png')
  const tool = rules.addTool({ name: 'Split screen', text: 'two sides at once', image: png }).tools.at(-1)
  assert.deepEqual([tool.group, tool.builtIn, tool.name, tool.tracks], ['mine', false, 'Split screen', ['2d', '3d']])
  assert.ok(fs.existsSync(tool.image))
  assert.throws(() => rules.addTool({ name: 'x', image: path.join(dir, 'clip.gif') }), /JPEG, PNG or WebP/)
  assert.throws(() => rules.removeTool('waffle'), /built-in tool/)
  rules.removeTool(tool.id)
  assert.equal(fs.existsSync(tool.image), false)
  assert.equal(rules.list().tools.length, rules.TOOLS.length)
})

test('rules: a project\'s own checklist takes the taste\'s place, never the fixed rules\'', () => {
  const list = rules.checklist('2d', '- **brand**: the logo shows in the end card\n')
  assert.match(list, /\*\*honest\*\*/)
  assert.match(list, /\*\*brand\*\*: the logo/)
  assert.doesNotMatch(list, /\*\*visual\*\*/)
})

test('rules: a damaged file is set aside, the defaults apply and it is reported until the next save', () => {
  fs.writeFileSync(path.join(dir, 'rules.json'), '{ not json')
  const now = rules.list()
  assert.equal(now.damaged, path.join(dir, 'rules.json.bad'))
  assert.ok(now.taste.every(r => !r.off && !r.edited))
  rules.remove('rhythm')
  assert.equal(rules.list().damaged, null)
  rules.reset('rhythm')
})

test('rules: every tool says the tracks it fits; a 2D tool staged in 3D says how', () => {
  for (const t of rules.TOOLS) {
    assert.ok(t.tracks.length && t.tracks.every(k => k === '2d' || k === '3d'), t.id)
    if (t.text3d) assert.ok(t.tracks.includes('3d'), t.id)
  }
  assert.ok(rules.TOOLS.some(t => t.group === 'camera'))
  const tool = rules.addTool({ name: 'Dolly zoom', track: '3d' }).tools.at(-1)
  assert.deepEqual(tool.tracks, ['3d'])
  rules.removeTool(tool.id)
})

test('rules: a fixed rule can be switched off and on, never removed', () => {
  assert.throws(() => rules.remove('honest'), /fixed rule/)
  rules.setOn('source', false)
  assert.equal(rules.list().fixed.find(r => r.id === 'source').off, true)
  assert.doesNotMatch(rules.checklist('2d'), /\*\*source\*\*/)
  rules.setOn('source', true)
  assert.match(rules.checklist('2d'), /\*\*source\*\*/)
  assert.throws(() => rules.setOn('visual', false), /no fixed rule or tool/)
})

test('rules: any tool can be switched off and on', () => {
  rules.setOn('waffle', false)
  assert.equal(rules.list().tools.find(t => t.id === 'waffle').off, true)
  rules.setOn('waffle', true)
  const own = rules.addTool({ name: 'Split screen' }).tools.at(-1)
  rules.setOn(own.id, false)
  assert.equal(rules.list().tools.find(t => t.id === own.id).off, true)
  rules.removeTool(own.id)
  assert.equal(rules.list().tools.some(t => t.off), false)
})

test('rules: a product promo\'s taste is checked for a demo only, and can be switched off', () => {
  assert.doesNotMatch(rules.checklist('2d'), /promo-one-part/)
  assert.match(rules.checklist('2d', null, { promo: true }), /\*\*promo-one-part\*\*: /)
  rules.remove('promo-motion')
  assert.doesNotMatch(rules.checklist('2d', null, { promo: true }), /promo-motion/)
  rules.reset('promo-motion')
  assert.match(rules.checklist('2d', null, { promo: true }), /promo-motion/)
})

test('rules: a locked rule stays on; a kind\'s rules stay with their part of the work', () => {
  assert.throws(() => rules.setOn('honest', false), /locked/)
  assert.throws(() => rules.setOn('real-people', false), /locked/)
  assert.throws(() => rules.setOn('sources-read', false), /locked/)
  assert.throws(() => rules.setOn('promo-desktop', false), /locked/)
  assert.throws(() => rules.setOn('clean', false), /locked/)
  assert.throws(() => rules.setOn('readable', false), /locked/)
  assert.throws(() => rules.setOn('promo-open-close', false), /locked/)
  assert.throws(() => rules.setOn('promo-aligned', false), /locked/)
  assert.equal(rules.list().fixed.find(r => r.id === 'original').off, false)
  // The cover's and the sound's taste never join a shot's checklist
  const shots = rules.checklist('2d')
  assert.match(shots, /\*\*real-people\*\*/)
  assert.doesNotMatch(shots, /cover-message|sound-sparse|promo-real/)
  assert.match(rules.checklist('2d', null, { promo: true }), /\*\*promo-real\*\*/)
})

test('rules: a voiced film\'s rules join its checklist only', () => {
  assert.doesNotMatch(rules.checklist('2d'), /voice-roles/)
  assert.match(rules.checklist('2d', null, { voice: true }), /\*\*voice-roles\*\*/)
})
