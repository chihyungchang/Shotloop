// The words of the voice-over's subtitles and when each is said. No
// speech engine here reports word times, so they are read off the spoken
// sentence: each word gets a share of the time the voice sounds by its
// length, and the boundaries settle together where the voice dips
// between words, near those shares. It imports nothing, so the app draws
// the subtitle looks' swatches with the same words and markup.

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
export const isCjk = s => CJK.test(s)

// A text's length as speech takes it: a CJK character about two Latin
// letters, a space a short breath
const units = s => [...s].reduce((n, c) => n + (CJK.test(c) ? 2.3 : /\s/.test(c) ? 0.6 : 1), 0)

// The pause a word's punctuation asks for after it, in units
const pauseAfter = w => (/[.!?…。！？]$/u.test(w) ? 3 : /[,;:—–，、；：]$/u.test(w) ? 1.5 : 0)

// A word's length as it is said: figures as their words ("69" is "sixty
// nine", "2.6%" "two point six percent"; in CJK a character a digit)
function spokenUnits(w, cjk) {
  const said = w.replace(/(\d),(?=\d{3})/g, '$1').replace(/(\d)\.(?=\d)/g, '$1·').replace(/\d/g, cjk ? '一' : 'xxx').replace(/·/g, cjk ? '点' : 'xxxxx')
    .replace(/%/g, cjk ? '百分之' : 'xxxxxxx')
  return units(said)
}

// A text's words in the language's own breaks (Chinese and Japanese by
// dictionary): { text, space }, the punctuation kept with its word and
// the white space after it apart, so joined they give the text back
export function splitWords(text, lang) {
  const out = []
  let lead = ''
  for (const { segment, isWordLike } of new Intl.Segmenter(lang, { granularity: 'word' }).segment(text)) {
    const last = out.at(-1)
    if (/^\s+$/u.test(segment)) {
      if (last) last.space += segment
    } else if (isWordLike) {
      out.push({ text: lead + segment, space: '' })
      lead = ''
    } else if (!last || /^[\p{Ps}\p{Pi}]/u.test(segment) || (last.space && /^["']/.test(segment))) {
      // An opening mark ("“", "(") joins the word after it
      lead += segment
    } else {
      // Any other mark stays with the word before (a dash after a space too)
      last.text += last.space + segment
      last.space = ''
    }
  }
  if (lead) out.push({ text: lead, space: '' })
  return out
}

// Loudness frames of a sentence's speech, FRAME s apart
export const FRAME = 0.01

// The words timed across [at, end] (seconds): { text, space, at, end }.
// env: the sentence's loudness from `at` on, one value per FRAME (none:
// shares of the length alone). With it, the shares are of the time the
// voice sounds (its pauses fall between words, not inside them), and the
// boundaries are placed together (place) where the voice dips, near
// where the shares put them
export function timeWords(words, at, end, env) {
  const cjk = words.some(w => isCjk(w.text))
  const weight = words.map(w => spokenUnits(w.text, cjk) + units(w.space) + (env?.length ? 0 : pauseAfter(w.text)))
  const total = weight.reduce((a, b) => a + b, 0) || 1
  const span = end - at
  let sum = 0
  const shares = weight.slice(0, -1).map(w => (sum += w) / total)
  const starts = env?.length > 1 && words.length > 1 ? place(env, shares, weight.map(w => w / total), span) : shares.map(x => x * span)
  const bounds = [0, ...starts, span]
  return words.map((w, i) => ({ ...w, at: at + bounds[i], end: at + bounds[i + 1] }))
}

// The voice is sounding above this share of its loudest
const VOICED = 0.06

// Where each word after the first starts (seconds), given each one's
// share of the voiced time: the frames that best balance being near the
// share's place against being quiet (a dip between words), each word
// keeping at least part of its share, found together (dynamic
// programming), then moved on to the next word's first sound
function place(env, shares, parts, span) {
  const top = Math.max(...env) || 1
  const e = env.map(x => x / top)
  const F = Math.min(e.length, Math.round(span / FRAME))
  // Voiced frames so far, to put a share of the voiced time on a frame
  const voiced = [0]
  for (let f = 0; f < F; f++) voiced.push(voiced[f] + (e[f] > VOICED ? 1 : 0))
  const frameOf = share => {
    const want = share * voiced[F]
    let f = 0
    while (f < F && voiced[f + 1] < want) f++
    return f
  }
  const voicedLen = p => p * voiced[F]
  const expect = shares.map(frameOf)
  const n = expect.length
  // Shortest a word may be: 40% of its voiced share, 4 frames at least
  const least = parts.map(p => Math.max(4, Math.round(0.4 * voicedLen(p))))
  const cost = (i, f) => {
    const spread = Math.max(8, 0.35 * voicedLen(parts[i]) + 0.35 * voicedLen(parts[i + 1]))
    return ((f - expect[i]) / spread) ** 2 + 6 * e[f]
  }
  // best[i][f]: the cheapest boundaries 0..i with boundary i at frame f
  const best = [], from = []
  for (let i = 0; i < n; i++) {
    const row = new Float64Array(F).fill(Infinity), back = new Int32Array(F).fill(-1)
    let low = Infinity, lowAt = -1
    for (let f = 0; f < F - least[i + 1]; f++) {
      if (i === 0) {
        if (f >= least[0]) row[f] = cost(0, f)
        continue
      }
      // The best place for the previous boundary, at least a word before
      const g = f - least[i]
      if (g >= 0 && best[i - 1][g] < low) {
        low = best[i - 1][g]
        lowAt = g
      }
      if (lowAt >= 0) {
        row[f] = low + cost(i, f)
        back[f] = lowAt
      }
    }
    best.push(row)
    from.push(back)
  }
  // No placing fits (more words than frames allow): the shares as they are
  const low = Math.min(...best[n - 1])
  if (!Number.isFinite(low)) return shares.map(x => x * span)
  let f = best[n - 1].indexOf(low)
  const frames = []
  for (let i = n - 1; i >= 0; i--) {
    frames[i] = f
    f = from[i][f]
  }
  // On to the end of the dip, where the next word starts sounding
  return frames.map((f, i) => {
    const stop = (frames[i + 1] ?? F) - least[i + 1]
    const calm = Math.max(e[f] * 1.6, VOICED / 2)
    while (f < stop && e[f + 1] <= calm) f++
    return f * FRAME
  })
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// The words as the subtitle draws them: a span each, classed past, on or
// next around the word being said (on: -1 for none), the white space
// between them left free to wrap. pop: the scale the word being said is
// drawn at (its entrance, a frame or two)
export function wordsHtml(words, on = -1, pop = 1) {
  return words.map((w, i) => {
    const state = on < 0 ? '' : i < on ? ' past' : i === on ? ' on' : ' next'
    const style = i === on && pop !== 1 ? ` style="--pop: ${pop}"` : ''
    return `<span class="w${state}"${style}>${esc(w.text)}</span>${w.space ? ' ' : ''}`
  }).join('')
}
