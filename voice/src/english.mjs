// English text made speakable for Kokoro's lexicon. sherpa-onnx (2.x)
// has no letter-to-sound fallback (its espeak-ng was GPL), so a word the
// lexicon lacks is silently dropped. Before synthesis: numbers become
// words, acronyms are spelled, camelCase and compounds split into words
// the lexicon has. What still has no reading is reported (unknown), so
// the plan can respell it.

import fs from 'node:fs'

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]
const ORDINAL = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' }

function under1000(n) {
  const out = []
  if (n >= 100) {
    out.push(ONES[Math.floor(n / 100)], 'hundred')
    n %= 100
  }
  if (n >= 20) out.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  else if (n || !out.length) out.push(ONES[n])
  return out.join(' ')
}

export function integer(n) {
  if (n === 0) return 'zero'
  const out = []
  for (const [size, name] of SCALES) {
    if (n >= size) {
      out.push(under1000(Math.floor(n / size)), name)
      n %= size
    }
  }
  if (n) out.push(under1000(n))
  return out.join(' ')
}

// 1984 → nineteen eighty-four, 2005 → two thousand five, 2024 → twenty twenty-four
function year(n) {
  if (n % 1000 < 10 && n < 2010) return integer(n)
  const hi = Math.floor(n / 100), lo = n % 100
  return `${under1000(hi)} ${lo === 0 ? 'hundred' : lo < 10 ? `oh ${ONES[lo]}` : under1000(lo)}`
}

function ordinal(n) {
  const words = integer(n).split(' ')
  const last = words.pop()
  const parts = last.split('-')
  const end = parts.pop()
  const ord = ORDINAL[end] ?? (end.endsWith('y') ? `${end.slice(0, -1)}ieth` : `${end}th`)
  return [...words, [...parts, ord].join('-')].join(' ')
}

// A number as written (1,234 · 3.5 · 0.026) → words
function number(raw) {
  const [int, frac] = raw.replace(/,/g, '').split('.')
  const whole = integer(Number(int || 0))
  return frac ? `${whole} point ${[...frac].map(d => ONES[Number(d)]).join(' ')}` : whole
}

const UNITS = { '%': 'percent', '$': 'dollars', '€': 'euros', '£': 'pounds', '¥': 'yen' }

// Numbers, currency and symbols as words
export function spellNumbers(text) {
  return text
    .replace(/([$€£¥])\s?(\d[\d,]*(?:\.\d+)?)(\s?(?:million|billion|trillion|thousand))?/g, (_, c, n, scale = '') => `${number(n)}${scale} ${UNITS[c]}`)
    .replace(/(\d+)(st|nd|rd|th)\b/g, (_, n) => ordinal(Number(n)))
    .replace(/\b(1[1-9]\d\d|20\d\d)\b(?![.,]\d)/g, (_, n) => year(Number(n)))
    .replace(/\d[\d,]*(?:\.\d+)?/g, n => number(n))
    .replace(/\s?%/g, ' percent')
    .replace(/\s?×/g, ' times').replace(/≈\s?/g, 'about ').replace(/\s?&\s?/g, ' and ').replace(/\s?\+\s?/g, ' plus ')
}

let lexicon = null
export function loadLexicon(...files) {
  if (lexicon) return lexicon
  lexicon = new Set()
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const w = line.slice(0, line.indexOf(' '))
      if (w) lexicon.add(w.toLowerCase())
    }
  }
  return lexicon
}

// Kokoro's lexicon (misaki's) holds base words and only some of their
// forms: misaki derives the rest at run time, sherpa-onnx doesn't, and a
// missing form (countries, wanted, world's) is dropped whole. So every
// word's -s, -ed, -ing and 's forms are written out, read the English way
// (cat's -s, dog's -z, bus's -ɪz; walked -t, played -d, wanted -ᵻd), as
// an extra lexicon for Kokoro. Forms the lexicon has keep its reading
const SIBILANT = new Set(['s', 'z', 'ʃ', 'ʒ', 'ʧ', 'ʤ'])
const VOICELESS = new Set(['p', 't', 'k', 'f', 'θ'])
const VOWEL = /[aeiou]/
export function inflections(...files) {
  const have = new Set()
  const entries = []
  for (const file of files) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const at = line.indexOf(' ')
      if (at < 1) continue
      const w = line.slice(0, at)
      if (have.has(w)) continue
      have.add(w)
      if (/^[a-z]{2,}$/.test(w)) entries.push([w, line.slice(at + 1).trim()])
    }
  }
  const out = []
  const add = (w, ph) => {
    if (have.has(w)) return
    have.add(w)
    out.push(`${w} ${ph}`)
  }
  for (const [w, ph] of entries) {
    const last = ph.split(/\s+/).at(-1)
    const s = SIBILANT.has(last) ? 'ɪ z' : VOICELESS.has(last) ? 's' : 'z'
    add(`${w}'s`, `${ph} ${s}`)
    // Plurals and he/she forms
    if (/(s|x|z|ch|sh)$/.test(w)) add(`${w}es`, `${ph} ɪ z`)
    else if (/[^aeiou]y$/.test(w)) add(`${w.slice(0, -1)}ies`, `${ph} z`)
    else add(`${w}s`, `${ph} ${s}`)
    // Past forms
    const ed = last === 't' || last === 'd' ? 'ᵻ d' : VOICELESS.has(last) || SIBILANT.has(last) && last !== 'z' && last !== 'ʒ' && last !== 'ʤ' ? 't' : 'd'
    if (w.endsWith('e')) add(`${w}d`, `${ph} ${ed}`)
    else if (/[^aeiou]y$/.test(w)) add(`${w.slice(0, -1)}ied`, `${ph} d`)
    else add(`${w}ed`, `${ph} ${ed}`)
    // -ing (a silent final e goes)
    if (/[^e]e$/.test(w) && VOWEL.test(w.slice(0, -1))) add(`${w.slice(0, -1)}ing`, `${ph} ɪ ŋ`)
    else add(`${w}ing`, `${ph} ɪ ŋ`)
  }
  return out.join('\n') + '\n'
}

const has = w => lexicon.has(w.toLowerCase())

// A word the lexicon lacks, as words it has (or null): pieces of at
// least two letters, the fewest pieces winning
function segment(word) {
  const w = word.toLowerCase()
  const best = Array(w.length + 1).fill(null)
  best[0] = []
  for (let i = 1; i <= w.length; i++) {
    for (let j = Math.max(0, i - 20); j <= i - 2; j++) {
      if (best[j] && has(w.slice(j, i)) && (!best[i] || best[j].length + 1 < best[i].length)) best[i] = [...best[j], w.slice(j, i)]
    }
  }
  const pieces = best[w.length]
  return pieces && pieces.length <= 3 ? pieces : null
}

const spell = w => [...w.toUpperCase()].join(' ')

// One word → words the lexicon reads, or null
function speakable(word) {
  if (has(word)) return word
  // A 's form the lexicons lack would be dropped: read it as the word
  // and its s (inflections() covers every lexicon word)
  const bare = word.replace(/'s$/i, '')
  if (bare !== word) {
    const b = speakable(bare)
    return b && `${b}s`.split(' ').every(has) ? `${b}s` : b && has(`${bare}s`) ? `${bare}s` : null
  }
  // ACRONYM, or one with a plural: GPUs
  if (/^[A-Z]{2,5}s?$/.test(word)) return word.endsWith('s') && word.length > 2 ? `${spell(word.slice(0, -1))}'s` : spell(word)
  // camelCase and digits inside: ChatGPT → Chat GPT
  const parts = word.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)
  if (parts.length > 1) {
    const each = parts.map(speakable)
    if (each.every(Boolean)) return each.join(' ')
  }
  const pieces = segment(word)
  if (pieces) return pieces.join(' ')
  // A single letter or two: spelled
  if (word.length <= 2) return spell(word)
  return null
}

// The text Kokoro reads, and the words it would still drop
export function prepare(text) {
  const unknown = []
  const out = spellNumbers(text.replace(/[’‘]/g, "'")).replace(/[\p{L}][\p{L}'’]*(?:-[\p{L}][\p{L}'’]*)*/gu, word => {
    if (has(word)) return word
    const parts = word.split('-').map(p => {
      const s = speakable(p)
      if (!s) unknown.push(p)
      return s ?? p
    })
    return parts.join(' ')
  })
  return { text: out, unknown: [...new Set(unknown)] }
}
