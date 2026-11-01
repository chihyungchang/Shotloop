import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { integer, loadLexicon, prepare, spellNumbers } from '../src/english.mjs'

test('integers in words', () => {
  assert.equal(integer(0), 'zero')
  assert.equal(integer(38), 'thirty-eight')
  assert.equal(integer(1481), 'one thousand four hundred eighty-one')
  assert.equal(integer(1_000_000_000), 'one billion')
})

test('numbers, years, money and symbols as spoken', () => {
  assert.equal(spellNumbers('2.6% is left'), 'two point six percent is left')
  assert.equal(spellNumbers('in 2024'), 'in twenty twenty-four')
  assert.equal(spellNumbers('in 2005'), 'in two thousand five')
  assert.equal(spellNumbers('in 1999'), 'in nineteen ninety-nine')
  assert.equal(spellNumbers('$3.5 million'), 'three point five million dollars')
  assert.equal(spellNumbers('the 21st day'), 'the twenty-first day')
  assert.equal(spellNumbers('1,481× apart'), 'one thousand four hundred eighty-one times apart')
  assert.equal(spellNumbers('≈ 38'), 'about thirty-eight')
})

test('words the lexicon lacks: spelled, split, or reported', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lex-')), 'lexicon.txt')
  fs.writeFileSync(file, ['shot', 'loop', 'chat', 'open', 'phone', 'the', 'on', 'renders', 'with', 'met', 'and', 'it']
    .map(w => `${w} x`).join('\n') + '\n')
  loadLexicon(file)
  const r = prepare('Shotloop renders it with ONNX on the iPhone and met Xiaomi')
  assert.equal(r.text, 'shot loop renders it with O N N X on the I Phone and met Xiaomi')
  assert.deepEqual(r.unknown, ['Xiaomi'])
  assert.equal(prepare('ChatGPT').text, 'Chat G P T')
})

test('word forms the lexicon lacks are written out, read the English way', async () => {
  const { inflections } = await import('../src/english.mjs')
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lex-')), 'lexicon.txt')
  fs.writeFileSync(file, ['cat k ˈ æ t', 'bus b ˈ ʌ s', 'country k ˈ ʌ n t ɹ i', 'want w ˈ ɑ n t', 'make m ˈ A k', 'makes m ˈ A k s'].join('\n') + '\n')
  const lex = new Map(inflections(file).trim().split('\n').map(l => [l.slice(0, l.indexOf(' ')), l.slice(l.indexOf(' ') + 1)]))
  assert.equal(lex.get("cat's"), 'k ˈ æ t s')
  assert.equal(lex.get('buses'), 'b ˈ ʌ s ɪ z')
  assert.equal(lex.get('countries'), 'k ˈ ʌ n t ɹ i z')
  assert.equal(lex.get('wanted'), 'w ˈ ɑ n t ᵻ d')
  assert.equal(lex.get('making'), 'm ˈ A k ɪ ŋ')
  // A form the lexicon has keeps its own reading
  assert.equal(lex.has('makes'), false)
})
