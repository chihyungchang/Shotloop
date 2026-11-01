// Kokoro 82M through sherpa-onnx (Apache-2.0): its lexicons and rules
// turn English and Chinese into phonemes in C++, so nothing needs Python.

import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)

// rules: the text normalizers (fst) to apply, Chinese dates, phone
// numbers and numbers for the Chinese model; none for English, whose
// lexicon reads digits itself
export function load(dir, lexicons, rules = []) {
  const sherpa = require('sherpa-onnx-node')
  const file = f => path.join(dir, f)
  const model = fs.existsSync(file('model.int8.onnx')) ? 'model.int8.onnx' : 'model.onnx'
  const fsts = rules.filter(f => fs.existsSync(file(f)))
  return new sherpa.OfflineTts({
    model: {
      kokoro: {
        model: file(model), voices: file('voices.bin'), tokens: file('tokens.txt'),
        lexicon: lexicons.map(file).join(','), dictDir: file('dict')
      },
      numThreads: Math.min(4, Math.max(1, os.availableParallelism() - 1)),
      provider: 'cpu'
    },
    ruleFsts: fsts.map(file).join(','),
    maxNumSentences: 1
  })
}

// One sentence → mono samples
export function speak(tts, text, { sid, speed = 1 }) {
  const a = tts.generate({ text, sid, speed })
  return { samples: Float32Array.from(a.samples), sampleRate: a.sampleRate }
}
