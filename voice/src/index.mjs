// Text to speech for Shotloop's voice-over, on this Mac: Kokoro for
// English, CosyVoice 2 for Chinese, Supertonic 3 for the other languages
// (listened side by side: Kokoro sounds best in English, CosyVoice far
// more natural in Chinese, and Supertonic needs no phonemizer).
//
//   voicesFor(lang)                  the voices a film in lang can use
//   synthesize(text, { lang, voice, speed, onProgress })
//                                    one sentence → { samples, sampleRate }
//
// lang is the project's language code (en, zh-CN, pt-BR, …). The model
// is downloaded the first time a language is spoken (models.mjs).

import fs from 'node:fs'
import path from 'node:path'
import { ensureModel, installed, modelDir, MODELS, SUPERTONIC_VOICES } from './models.mjs'
import * as cosyvoice from './cosyvoice.mjs'
import * as english from './english.mjs'
import * as kokoro from './kokoro.mjs'
import * as supertonic from './supertonic.mjs'

export { MODELS, installed, VOICES_DIR, ensureModel } from './models.mjs'

// Kokoro speaker ids, from the models' own speaker tables
const KOKORO_EN = [
  { id: 'af_heart', sid: 3, gender: 'f', name: 'Heart (US)' },
  { id: 'am_michael', sid: 16, gender: 'm', name: 'Michael (US)' },
  { id: 'bf_emma', sid: 21, gender: 'f', name: 'Emma (UK)' },
  { id: 'bm_george', sid: 26, gender: 'm', name: 'George (UK)' }
]
const COSYVOICE_ZH = cosyvoice.VOICES.map(({ id, gender, name }) => ({ id, gender, name }))
const SUPERTONIC = SUPERTONIC_VOICES
  .map(id => ({ id, gender: id[0].toLowerCase(), name: `${id[0] === 'F' ? 'Female' : 'Male'} ${id[1]}` }))
// The English lexicons Kokoro reads: the model's, then the word forms
// english.mjs writes next to it (inflections)
const INFLECTED = 'lexicon-inflected.txt'
const EN_LEXICONS = ['lexicon-us-en.txt', 'lexicon-gb-en.txt', INFLECTED]

// The engine behind a project language, and its code there
export function engineFor(lang) {
  const base = String(lang ?? '').split('-')[0].toLowerCase()
  if (base === 'en') return { model: 'kokoro-en', voices: KOKORO_EN, lexicons: EN_LEXICONS }
  if (base === 'zh') return { model: 'cosyvoice-zh', voices: COSYVOICE_ZH }
  if (supertonic.LANGS.includes(base)) return { model: 'supertonic', voices: SUPERTONIC, code: base }
  return null
}

export const speaks = lang => !!engineFor(lang)
export const voicesFor = lang => engineFor(lang)?.voices ?? []
export const defaultVoice = lang => voicesFor(lang)[0]?.id ?? null

// Loaded models, kept for the life of the process
const loaded = new Map()

// English word forms the lexicon lacks, written next to the model once
function withInflections(dir) {
  const file = path.join(dir, INFLECTED)
  if (!fs.existsSync(file)) {
    fs.writeFileSync(`${file}.${process.pid}`, english.inflections(path.join(dir, 'lexicon-us-en.txt'), path.join(dir, 'lexicon-gb-en.txt')))
    fs.renameSync(`${file}.${process.pid}`, file)
  }
}

async function model(e, onProgress) {
  if (!loaded.has(e.model)) {
    loaded.set(e.model, (async () => {
      const dir = await ensureModel(e.model, onProgress)
      if (e.model === 'kokoro-en') withInflections(dir)
      const kind = MODELS[e.model].kind
      // CosyVoice runs in its own server: its folder is all it needs here
      return kind === 'kokoro' ? kokoro.load(dir, e.lexicons) : kind === 'supertonic' ? supertonic.load(dir) : dir
    })())
    // A failed download or load can be tried again
    loaded.get(e.model).catch(() => loaded.delete(e.model))
  }
  return loaded.get(e.model)
}

export async function synthesize(text, { lang, voice, speed = 1, onProgress } = {}) {
  const e = engineFor(lang)
  if (!e) throw new Error(`no voice for the language "${lang}"`)
  const v = e.voices.find(x => x.id === voice) ?? e.voices[0]
  const m = await model(e, onProgress)
  if (MODELS[e.model].kind === 'cosyvoice') return cosyvoice.speak(m, text, { voice: v.id, speed })
  if (MODELS[e.model].kind === 'supertonic') return supertonic.speak(m, text, { lang: e.code, voice: v.id, speed })
  if (e.model === 'kokoro-en') text = englishFor(text).text
  return kokoro.speak(m, text, { sid: v.sid, speed })
}

const englishFor = text => {
  const dir = modelDir('kokoro-en')
  withInflections(dir)
  english.loadLexicon(...EN_LEXICONS.map(f => path.join(dir, f)))
  return english.prepare(text)
}

// The words of a line the voice would drop (English only: Kokoro reads
// only words its lexicon has), so the plan can respell them. Empty when
// the model isn't downloaded yet
export function unspoken(text, lang) {
  if (engineFor(lang)?.model !== 'kokoro-en' || !installed('kokoro-en')) return []
  return englishFor(text).unknown
}
