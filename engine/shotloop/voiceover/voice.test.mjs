// Run with: node --test engine/shotloop/voiceover/voice.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sentences } from './cues.mjs'
import { chunk, subtitleCues, subtitleWindows } from './subtitles.mjs'

test('sentences split at stops, not inside numbers', () => {
  assert.deepEqual(sentences('Only 2.6% is left. Half is gone by day 69.'), ['Only 2.6% is left.', 'Half is gone by day 69.'])
  assert.deepEqual(sentences('每天进步。一年后是3.5倍！真的吗？'), ['每天进步。', '一年后是3.5倍！', '真的吗？'])
  assert.deepEqual(sentences('  '), [])
})

test('subtitle chunks stay short and break at punctuation first', () => {
  assert.deepEqual(chunk('The gap is made every day.'), ['The gap is made every day.'])
  const long = 'Real life is messier: progress speeds up, stalls, and starts again.'
  const parts = chunk(long)
  assert.ok(parts.every(p => p.length <= 42), parts.join(' | '))
  assert.equal(parts.join(' '), long)
  const zh = chunk('坚持三百六十五天，你会变成原来的大约三十八倍，第七十天就已经翻倍了。')
  assert.ok(zh.every(p => [...p].length <= 18), zh.join(' | '))
  assert.equal(zh.join(''), '坚持三百六十五天，你会变成原来的大约三十八倍，第七十天就已经翻倍了。')
})

test('subtitle cues share their sentence’s time in order', () => {
  const cues = subtitleCues([{ shot: 'a', text: 'Real life is messier: progress speeds up, stalls, and starts again.', at: 1, end: 5 }])
  assert.equal(cues[0].at, 1)
  assert.ok(Math.abs(cues.at(-1).end - 5) < 1e-9)
  for (let i = 1; i < cues.length; i++) assert.equal(cues[i].at, cues[i - 1].end)
})

test('a line over a cut is subtitled in both shots, each within its own time', () => {
  // Shot a: 0–3 s; its line runs on to 3.8 s, into shot b (3–6 s)
  const cues = subtitleCues([{ shot: 'a', text: 'The spring stores the energy.', at: 0.2, end: 3.8 }])
  const a = subtitleWindows({ id: 'a', start: 0, duration: 3 }, cues)
  const b = subtitleWindows({ id: 'b', start: 3, duration: 3 }, cues)
  assert.ok(a.length && b.length)
  assert.ok(Math.abs(a.at(-1).end - 3) < 1e-9)
  assert.equal(b[0].at, 0)
  assert.ok(Math.abs(b.at(-1).end - 0.8) < 1e-9)
})
