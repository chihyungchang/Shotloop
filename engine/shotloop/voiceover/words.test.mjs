// The subtitles' words: split as the language breaks them, timed off the
// voice, and shown as the look brings them
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { newProject } from '../project/create.mjs'
import { subtitleStyle } from './cues.mjs'
import { loadProject } from '../project/project.mjs'
import { applyStoryboard } from '../project/storyboard.mjs'
import { subtitleCues, subtitleWindows } from './subtitles.mjs'
import { setVoice } from './voice.mjs'
import { FRAME, splitWords, timeWords, wordsHtml } from './words.mjs'

const made = []
after(() => made.forEach(d => fs.rmSync(d, { recursive: true, force: true })))
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-words-'))
  made.push(dir)
  return path.join(dir, 'p')
}

const texts = ws => ws.map(w => w.text)

test('words keep their punctuation and give the text back', () => {
  const text = 'Sunlight isn\'t 8.5 minutes — it\'s “U.S.” data, 2.6%.'
  const ws = splitWords(text, 'en')
  assert.deepEqual(texts(ws), ['Sunlight', 'isn\'t', '8.5', 'minutes —', 'it\'s', '“U.S.”', 'data,', '2.6%.'])
  assert.equal(ws.map(w => w.text + w.space).join(''), text)
  assert.deepEqual(texts(splitWords('阳光需要八分钟，才能到达地球。', 'zh-CN')), ['阳光', '需要', '八', '分钟，', '才能', '到达', '地球。'])
})

test('a boundary moves into the pause the voice leaves between words', () => {
  // "one two": sound 0–0.4 s, a pause 0.4–0.6 s, sound 0.6–1 s
  const env = Array.from({ length: 100 }, (_, f) => (f * FRAME >= 0.4 && f * FRAME < 0.6 ? 0.001 : 0.3))
  const [a, b] = timeWords(splitWords('a twoooooo', 'en'), 0, 1, env)
  // By length alone "two…" would start near 0.2 s; the voice says 0.6 s
  assert.equal(a.at, 0)
  assert.ok(Math.abs(b.at - 0.6) < 0.02, String(b.at))
  assert.equal(b.end, 1)
})

test('words too many for their time keep their shares, never NaN', () => {
  const env = Array.from({ length: 40 }, () => 0.3)
  const ws = timeWords(splitWords('one two three four five six seven eight nine ten eleven twelve', 'en'), 0, 0.4, env)
  assert.ok(ws.every(w => Number.isFinite(w.at) && Number.isFinite(w.end)))
})

test('figures count as the words they are said as', () => {
  const [, n] = timeWords(splitWords('day 2.6%', 'en'), 0, 1)
  // "two point six percent" is far longer than "day"
  assert.ok(n.end - n.at > 0.7, String(n.at))
})

test('a following look lights each word of its chunk in turn; one at a time joins a quick word', () => {
  const cues = subtitleCues([{ shot: 'a', text: 'The spring stores a lot of energy.', at: 0, end: 3 }], { chunk: [22, 9] })
  const shot = { id: 'a', start: 0, duration: 3 }
  const follow = subtitleWindows(shot, cues, 'follow')
  assert.equal(follow.length, cues.reduce((n, c) => n + c.words.length, 0))
  assert.ok(follow.every((w, i) => w.on === cues.flatMap(c => c.words.map((_, k) => k))[i]))
  assert.match(follow[1].html, /class="w past">The<.*class="w on">spring</)
  const one = subtitleWindows(shot, cues, 'one')
  assert.ok(one.every(w => w.words.length === 1))
  assert.ok(one.some(w => w.words[0].text.includes(' ')), texts(one.map(w => w.words[0])).join('|'))
  assert.equal(wordsHtml([{ text: 'a<b', space: '' }]), '<span class="w">a&lt;b</span>')
})

test('the plan picks the subtitles unless the person chose them', () => {
  const plan = (dir, subtitles) => {
    const project = loadProject(dir)
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ subtitles, shots: [{ title: 'One', duration: 4, say: 'Hello there.' }] }))
    applyStoryboard(project)
    return loadProject(dir).config.voice
  }
  const free = tmp()
  newProject(free, { idea: 'A door shuts', duration: 6, voice: true })
  assert.deepEqual(plan(free, 'pop'), { on: true, subtitles: 'pop' })
  assert.equal(plan(free, 'no-such-look').subtitles, 'pop')
  const chosen = tmp()
  newProject(chosen, { idea: 'A door shuts', duration: 6, voice: true, subtitles: 'reveal' })
  assert.equal(plan(chosen, 'pop').subtitles, 'reveal')
  // A pick in the studio is the person's too
  setVoice(loadProject(free), { subtitles: 'clean' })
  assert.equal(plan(free, 'pop').subtitles, 'clean')
})

test('strictly one word at a time joins nothing, and only where words are spaced', () => {
  const cues = subtitleCues([{ shot: 'a', text: 'The spring stores a lot of energy.', at: 0, end: 3 }], { chunk: [22, 9] })
  const single = subtitleWindows({ id: 'a', start: 0, duration: 3 }, cues, 'single')
  assert.deepEqual(texts(single.map(w => w.words[0])), ['The', 'spring', 'stores', 'a', 'lot', 'of', 'energy.'])
  const look = (lang, subtitles) => subtitleStyle({ config: { lang, voice: { on: true, subtitles } }, shots: [] })
  assert.equal(look('en', 'word'), 'word')
  assert.equal(look('ko', 'word'), 'word')
  assert.equal(look('zh-CN', 'word'), 'highlight')
  assert.equal(look('ja', 'word'), 'highlight')
  assert.equal(look('zh-CN', 'pop'), 'pop')
})
