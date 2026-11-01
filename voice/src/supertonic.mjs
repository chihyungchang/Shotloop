// Supertonic 3 (Supertone, MIT code, OpenRAIL-M weights) on ONNX Runtime:
// raw text in, no phonemizer, 31 languages. Ported from the reference
// Node example (github.com/supertone-inc/supertonic, nodejs/helper.js)
// with typed arrays, and with seeded noise so the same line always
// sounds the same (the voice-over is cached by its text).

import fs from 'node:fs'
import path from 'node:path'
import * as ort from 'onnxruntime-node'

export const LANGS = ['en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hi', 'hr', 'hu', 'id',
  'it', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi']

// Denoising steps: 8 is the reference default; fewer sound robotic
const STEPS = 8

const REPLACE = {
  '–': '-', '‑': '-', '—': '-', '_': ' ', '“': '"', '”': '"', '‘': "'", '’': "'", '´': "'", '`': "'",
  '[': ' ', ']': ' ', '|': ' ', '/': ' ', '#': ' ', '→': ' ', '←': ' ', '@': ' at '
}
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu

// The reference preprocessing: normalized, symbols spelled or dropped,
// a final stop added, wrapped in the language's tags
function prepare(text, lang) {
  let t = text.normalize('NFKD').replace(EMOJI, '')
  for (const [k, v] of Object.entries(REPLACE)) t = t.replaceAll(k, v)
  t = t.replace(/[♥☆♡©\\]/g, '').replace(/ ([,.!?;:'])/g, '$1').replace(/""+/g, '"').replace(/''+/g, "'")
  t = t.replace(/\s+/g, ' ').trim()
  if (!/[.!?;:,'")\]}…。」』】〉》›»]$/.test(t)) t += '.'
  return `<${lang}>${t}</${lang}>`
}

// A seeded normal random generator (mulberry32 + Box–Muller)
function gaussian(seed) {
  let a = seed >>> 0
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(Math.max(1e-10, uniform()))) * Math.cos(2 * Math.PI * uniform())
}

const seedOf = text => [...text].reduce((h, c) => Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0, 2166136261)

export async function load(dir) {
  const onnx = f => ort.InferenceSession.create(path.join(dir, 'onnx', f))
  const [dp, enc, est, voc] = await Promise.all(['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'].map(n => onnx(`${n}.onnx`)))
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'onnx', 'tts.json'), 'utf8'))
  const indexer = JSON.parse(fs.readFileSync(path.join(dir, 'onnx', 'unicode_indexer.json'), 'utf8'))
  const styles = new Map()
  const style = name => {
    if (!styles.has(name)) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, 'voice_styles', `${name}.json`), 'utf8'))
      const tensor = v => new ort.Tensor('float32', Float32Array.from(v.data.flat(Infinity)), v.dims)
      styles.set(name, { ttl: tensor(s.style_ttl), dp: tensor(s.style_dp) })
    }
    return styles.get(name)
  }
  return { dp, enc, est, voc, cfg, indexer, style, sampleRate: cfg.ae.sample_rate }
}

// One sentence (or a few) → mono samples at the model's rate
export async function speak(m, text, { lang, voice, speed = 1 }) {
  if (!LANGS.includes(lang)) throw new Error(`Supertonic has no "${lang}"`)
  const s = m.style(voice)
  const input = prepare(text, lang)
  const chars = Array.from(input)
  const ids = new ort.Tensor('int64', BigInt64Array.from(chars.map(c => BigInt(m.indexer[c.charCodeAt(0)] ?? 0))), [1, chars.length])
  const textMask = new ort.Tensor('float32', new Float32Array(chars.length).fill(1), [1, 1, chars.length])

  const { duration } = await m.dp.run({ text_ids: ids, style_dp: s.dp, text_mask: textMask })
  const seconds = duration.data[0] / speed
  const { text_emb: emb } = await m.enc.run({ text_ids: ids, style_ttl: s.ttl, text_mask: textMask })

  const chunk = m.cfg.ae.base_chunk_size * m.cfg.ttl.chunk_compress_factor
  const dim = m.cfg.ttl.latent_dim * m.cfg.ttl.chunk_compress_factor
  const wavLen = Math.floor(seconds * m.sampleRate)
  const len = Math.ceil(wavLen / chunk)
  const noise = gaussian(seedOf(input))
  let latent = Float32Array.from({ length: dim * len }, noise)
  const latentMask = new ort.Tensor('float32', new Float32Array(len).fill(1), [1, 1, len])
  const total = new ort.Tensor('float32', Float32Array.of(STEPS), [1])
  for (let step = 0; step < STEPS; step++) {
    const out = await m.est.run({
      noisy_latent: new ort.Tensor('float32', latent, [1, dim, len]), text_emb: emb, style_ttl: s.ttl,
      text_mask: textMask, latent_mask: latentMask, total_step: total, current_step: new ort.Tensor('float32', Float32Array.of(step), [1])
    })
    latent = Float32Array.from(out.denoised_latent.data)
  }
  const { wav_tts: wav } = await m.voc.run({ latent: new ort.Tensor('float32', latent, [1, dim, len]) })
  return { samples: Float32Array.from(wav.data).subarray(0, wavLen), sampleRate: m.sampleRate }
}
