// Kokoro 82M through sherpa-onnx (Apache-2.0): its lexicons turn English
// into phonemes in C++, so nothing needs Python.

import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)

export function load(dir, lexicons) {
  const sherpa = require('sherpa-onnx-node')
  const file = f => path.join(dir, f)
  const model = fs.existsSync(file('model.int8.onnx')) ? 'model.int8.onnx' : 'model.onnx'
  return new sherpa.OfflineTts({
    model: {
      kokoro: {
        model: file(model), voices: file('voices.bin'), tokens: file('tokens.txt'),
        lexicon: lexicons.map(file).join(',')
      },
      numThreads: Math.min(4, Math.max(1, os.availableParallelism() - 1)),
      provider: 'cpu'
    },
    maxNumSentences: 1
  })
}

// One sentence → mono samples
export function speak(tts, text, { sid, speed = 1 }) {
  const a = tts.generate({ text, sid, speed })
  return { samples: Float32Array.from(a.samples), sampleRate: a.sampleRate }
}
