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
  assert.deepEqual([own.builtIn, own.name, own.rule], [false, null, 'Always end on a question'])
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
  assert.deepEqual([tool.group, tool.builtIn, tool.name], ['mine', false, 'Split screen'])
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
