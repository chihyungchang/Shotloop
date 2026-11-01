// The speech models, downloaded on first use into one folder for every
// project ($SHOTLOOP_VOICES; the app sets its own data folder). Nothing
// ships inside the app: a model is fetched for the first film in its
// language, checked against its pinned SHA-256 and moved into place only
// when complete, so a cut-short download is never used.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { download } from './fetch.mjs'
import * as cosyvoice from './cosyvoice.mjs'

export const VOICES_DIR = process.env.SHOTLOOP_VOICES ?? path.join(os.homedir(), '.shotloop', 'voices')

const SHERPA = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models'
const SUPERTONIC = 'https://huggingface.co/Supertone/supertonic-3/resolve/3cadd1ee6394adea1bd021217a0e650ede09a323'

// Supertonic's built-in voices (voice_styles/<id>.json)
export const SUPERTONIC_VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5']

// Each model with the app's languages it speaks (Settings lists them;
// Supertonic speaks more, index.mjs engineFor routes by language).
// Kokoro 82M (hexgrad, Apache-2.0) as sherpa-onnx packs it, with its
// lexicons; int8 weights. CosyVoice 2 (FunAudioLLM, Apache-2.0) runs in
// its own Python install (cosyvoice.mjs); its bytes count what it fetches
// and what its Python takes
export const MODELS = {
  'kokoro-en': {
    name: 'Kokoro v1.0 (English)', license: 'Apache-2.0', kind: 'kokoro', bytes: 132353410, langs: ['en'],
    home: 'https://huggingface.co/hexgrad/Kokoro-82M',
    archive: { url: `${SHERPA}/kokoro-int8-multi-lang-v1_0.tar.bz2`, sha256: '72c347230107ef8a31098ec4d468a605244beef5f1ed00db97efa13518800653', dir: 'kokoro-int8-multi-lang-v1_0' }
  },
  'cosyvoice-zh': {
    name: 'CosyVoice 2 (Chinese)', license: 'Apache-2.0', kind: 'cosyvoice', bytes: cosyvoice.BYTES, langs: ['zh-CN', 'zh-TW'],
    home: 'https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B'
  },
  supertonic: {
    name: 'Supertonic 3', license: 'OpenRAIL-M', kind: 'supertonic', bytes: 401276744,
    langs: ['ja', 'ko', 'es', 'pt-BR', 'fr', 'de', 'it', 'ru', 'tr', 'vi', 'id'],
    home: 'https://huggingface.co/Supertone/supertonic-3',
    files: [
      ['onnx/duration_predictor.onnx', 'c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db'],
      ['onnx/text_encoder.onnx', 'c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff'],
      ['onnx/vector_estimator.onnx', '883ac868ea0275ef0e991524dc64f16b3c0376efd7c320af6b53f5b780d7c61c'],
      ['onnx/vocoder.onnx', '085de76dd8e8d5836d6ca66826601f615939218f90e519f70ee8a36ed2a4c4ba'],
      ['onnx/tts.json'], ['onnx/unicode_indexer.json'],
      ...SUPERTONIC_VOICES.map(v => [`voice_styles/${v}.json`])
    ]
  }
}

export const modelDir = id => path.join(VOICES_DIR, id)
export const installed = id => fs.existsSync(path.join(modelDir(id), '.complete'))

// The model's folder, downloaded first if needed. onProgress(done, total)
// in bytes
export async function ensureModel(id, onProgress = () => {}) {
  const m = MODELS[id]
  if (!m) throw new Error(`no speech model "${id}"`)
  const dir = modelDir(id)
  if (installed(id)) return dir
  fs.mkdirSync(VOICES_DIR, { recursive: true })
  // One download per model: another process fetching it (the app's
  // download while a build needs the voice) is waited for, not repeated
  const lock = path.join(VOICES_DIR, `.${id}.lock`)
  while (!tryLock(lock)) {
    await new Promise(r => setTimeout(r, 1000))
    if (installed(id)) return dir
  }
  try {
    return await fetchModel(id, m, dir, onProgress)
  } finally {
    fs.rmSync(lock, { force: true })
  }
}

// Takes the lock file, or false while a live process holds it (a lock
// left by a process that died is taken over)
function tryLock(lock) {
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' })
    return true
  } catch {
    const pid = Number(fs.readFileSync(lock, 'utf8'))
    try {
      process.kill(pid, 0)
      return false
    } catch {
      fs.rmSync(lock, { force: true })
      return tryLock(lock)
    }
  }
}

async function fetchModel(id, m, dir, onProgress) {
  if (m.kind === 'cosyvoice') {
    await cosyvoice.install(dir, onProgress)
    onProgress(m.bytes, m.bytes)
    return dir
  }
  // Folders left by a download that was killed (we hold the lock now)
  for (const f of fs.readdirSync(VOICES_DIR)) if (f.startsWith(`.${id}-`)) fs.rmSync(path.join(VOICES_DIR, f), { recursive: true, force: true })
  const tmp = fs.mkdtempSync(path.join(VOICES_DIR, `.${id}-`))
  let done = 0
  const tick = n => onProgress((done += n), m.bytes)
  try {
    if (m.archive) {
      const file = path.join(tmp, path.basename(m.archive.url))
      await download(m.archive.url, file, m.archive.sha256, tick)
      execFileSync('tar', ['-xjf', file, '-C', tmp])
      fs.rmSync(file)
      fs.renameSync(path.join(tmp, m.archive.dir), path.join(tmp, 'model'))
    } else {
      for (const [rel, sha256] of m.files) {
        const file = path.join(tmp, 'model', rel)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        await download(`${SUPERTONIC}/${rel}`, file, sha256, tick)
      }
    }
    fs.writeFileSync(path.join(tmp, 'model', '.complete'), new Date().toISOString() + '\n')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.renameSync(path.join(tmp, 'model'), dir)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  onProgress(m.bytes, m.bytes)
  return dir
}
