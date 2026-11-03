// CosyVoice 2 (FunAudioLLM, Apache-2.0) for Chinese: a natural voice from
// a short reference recording. It runs in PyTorch, so it lives in its own
// Python install (models.mjs, 'cosyvoice-zh') as a local server
// (py/cosyvoice_server.py) that loads the model once and serves every
// engine process over a Unix socket, one sentence at a time. Started here
// when nothing answers; it quits after ten idle minutes.

import { execFile, execFileSync, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { download, du } from '../../engine/lib/fetch.mjs'
import { tryLock } from '../../engine/lib/lock.mjs'

const PY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'py')
const SERVER = path.join(PY, 'cosyvoice_server.py')
// How long a cold start may take: the model loads in about 15 s
const START = 180_000
// How long one sentence may take, waiting for other processes' sentences
// included: two minutes, and a second per character (it speaks about four
// a second, at a fraction of real time on this Mac's CPU)
const sentenceTimeout = text => 120_000 + 1000 * [...text].length

// The socket lives in the temp folder (Unix socket paths are short), one
// per install: named by a hash of its folder
const socketFor = dir => path.join(os.tmpdir(), `shotloop-cosyvoice-${createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 12)}.sock`)
const logFile = dir => path.join(dir, 'server.log')

// The end of the server's log, to say why it failed
function logTail(dir) {
  let fd
  try {
    fd = fs.openSync(logFile(dir), 'r')
  } catch {
    // No log yet (it never ran): nothing to add
    return ''
  }
  try {
    const size = fs.fstatSync(fd).size
    const buf = Buffer.alloc(Math.min(size, 4096))
    fs.readSync(fd, buf, 0, buf.length, size - buf.length)
    const lines = buf.toString('utf8').trimEnd().split('\n').slice(-6).join('\n')
    return lines ? `:\n${lines}` : ''
  } finally {
    fs.closeSync(fd)
  }
}

const failure = (dir, why) => new Error(`the Chinese voice ${why}; see ${logFile(dir)}${logTail(dir)}`)

function connect(sock) {
  return new Promise((resolve, reject) => {
    const c = net.connect(sock)
    c.once('connect', () => resolve(c))
    c.once('error', reject)
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Starts the server (one process starts it, the others wait for it) and
// resolves once its socket answers
async function start(dir, sock) {
  const t0 = Date.now()
  while (Date.now() - t0 < START) {
    const release = tryLock(`${sock}.starting`)
    if (release) {
      try {
        // Another process may have started it since our connect failed
        return await connect(sock).catch(() => launch(dir, sock))
      } finally {
        release()
      }
    }
    try {
      return await connect(sock)
    } catch {
      await sleep(500)
    }
  }
  throw failure(dir, `didn't start in ${START / 1000} s`)
}

// Spawns the server and waits for its socket; fails as soon as it exits
async function launch(dir, sock) {
  const log = fs.openSync(logFile(dir), 'a')
  const p = spawn(path.join(dir, 'venv', 'bin', 'python'), [SERVER, dir, sock], { detached: true, stdio: ['ignore', log, log] })
  fs.closeSync(log)
  p.unref()
  let died = null
  p.once('error', err => (died = `couldn't run (${err.message})`))
  p.once('exit', (code, signal) => (died = `stopped while starting (${signal ?? `exit code ${code}`})`))
  const t0 = Date.now()
  while (!died && Date.now() - t0 < START) {
    try {
      return await connect(sock)
    } catch {
      await sleep(500)
    }
  }
  // Given up: it is stopped, so the next try starts afresh
  if (!died) {
    p.kill()
    died = `didn't start in ${START / 1000} s`
  }
  throw failure(dir, died)
}

// One request, one reply line. Fails when the server closes the
// connection first (it died), answers something that isn't a reply, or
// takes longer than timeout
export function ask(c, req, { timeout, dir }) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const settle = () => {
      clearTimeout(timer)
      c.off('data', onData).off('error', onError).off('close', onClose)
    }
    const fail = why => {
      settle()
      c.destroy()
      reject(failure(dir, why))
    }
    const onData = d => {
      buf += d
      const nl = buf.indexOf('\n')
      if (nl < 0) return
      let reply
      try {
        reply = JSON.parse(buf.slice(0, nl))
      } catch {
        return fail(`answered something unreadable (${buf.slice(0, 120)})`)
      }
      settle()
      reply.ok ? resolve(reply) : reject(new Error(`the Chinese voice failed: ${reply.error}`))
    }
    const onError = err => fail(`couldn't be reached (${err.message})`)
    const onClose = () => fail('stopped before it answered')
    const timer = setTimeout(() => fail(`took over ${Math.round(timeout / 1000)} s on one sentence`), timeout)
    c.setEncoding('utf8')
    c.on('data', onData).on('error', onError).on('close', onClose)
    c.write(JSON.stringify(req) + '\n')
  })
}

// One sentence → mono samples
export async function speak(dir, text, { voice, speed = 1 }) {
  const sock = socketFor(dir)
  const c = await connect(sock).catch(() => start(dir, sock))
  const out = path.join(os.tmpdir(), `shotloop-cosyvoice-${randomUUID()}.f32`)
  try {
    const reply = await ask(c, { text, voice, speed, out }, { timeout: sentenceTimeout(text), dir })
    const buf = fs.readFileSync(out)
    return { samples: new Float32Array(buf.buffer, buf.byteOffset, reply.samples), sampleRate: reply.rate }
  } finally {
    c.end()
    fs.rmSync(out, { force: true })
  }
}

// ------------------------------------------------------------- install

// Everything pinned: uv (which brings Python 3.10 and the packages of
// py/requirements.txt), the code at a commit, the model at a revision,
// wetext's rules from WeTextProcessing's wheel (ModelScope, where wetext
// looks, refuses requests too often); every file with its SHA-256
const UV = { url: 'https://github.com/astral-sh/uv/releases/download/0.13.6/uv-aarch64-apple-darwin.tar.gz', sha256: '60fbd5c8a1ed681845eea28d9d622fcde03c51e91a43465b64a1e17db1ed3472', bytes: 14235670 }
// GitHub's archives of a commit, byte for byte the same on every fetch
const CODE = [
  { url: 'https://codeload.github.com/FunAudioLLM/CosyVoice/tar.gz/074ca6dc9e80a2f424f1f74b48bdd7d3fea531cc', to: 'CosyVoice', bytes: 1505172, sha256: '10c587f0853db27667a64a0a2dc0788b1c782cdab223682691db78702082a550' },
  { url: 'https://codeload.github.com/shivammehta25/Matcha-TTS/tar.gz/dd9105b34bf2be2230f4aa1e4769fb586a3c824e', to: 'CosyVoice/third_party/Matcha-TTS', bytes: 484695, sha256: '59c43afae79110e4057eaa43f45b5558b556435da8fc85eab83f0c819ba3358d' }
]
// The model's two homes, each at a pinned commit, with the same files
// (checked by SHA-256, so either serves): Hugging Face, and ModelScope,
// the publisher's own, often several times faster in China. ModelScope
// lacks config.json, so it comes from Hugging Face
const SOURCES = [
  'https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B/resolve/eec1ae6c79877dbd9379285cf8789c9e0879293d',
  'https://www.modelscope.cn/models/iic/CosyVoice2-0.5B/resolve/6e3aa301f53582fa2de88625f89a29cb80d0fba1'
]
const MODEL = [
  ['CosyVoice-BlankEN/config.json', 659, '168aa1bd401abc3bc262ba15ba4e499627a8b4e006e9d050b47c22de20660185'],
  ['CosyVoice-BlankEN/generation_config.json', 242, 'e558847a8b4402616f1273797b015104dc266fe4b520056fca88823ba8f8ebe6'],
  ['CosyVoice-BlankEN/merges.txt', 1402109, 'ac8ff86a72bee70828fbc1119bc4398c6f3a9a6e490d7b0dbe917be025478bd0'],
  ['CosyVoice-BlankEN/model.safetensors', 988097824, '130282af0dfa9fe5840737cc49a0d339d06075f83c5a315c3372c9a0740d0b96'],
  ['CosyVoice-BlankEN/tokenizer_config.json', 1287, '482bd979881423375ca5414e4e0d94cd7c5349dbb17fffd46b4d36d71e62a1bc'],
  ['CosyVoice-BlankEN/vocab.json', 2776833, 'ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910'],
  ['campplus.onnx', 28303423, 'a6ac6a63997761ae2997373e2ee1c47040854b4b759ea41ec48e4e42df0f4d73'],
  ['config.json', 2, '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'],
  ['configuration.json', 47, 'c502b6328c67638b401df8dd05de89e9e8d1cff9cd0ada10dfbdbe13556c20de'],
  ['cosyvoice2.yaml', 7330, '0af2c0d010c477187c39f3e8fd5f1ae2e4e6f90ad03ba37c10ed6c6a87b05959'],
  ['flow.pt', 450575567, 'ff4c2f867674411e0a08cee702996df13fa67c1cd864c06108da88d16d088541'],
  ['hift.pt', 83390254, '3386cc880324d4e98e05987b99107f49e40ed925b8ecc87c1f4939432d429879'],
  ['llm.pt', 2023316821, 'b144ef55b51ce8cfb79a73c90dbba0bdaba4e451c0ebcfab20f769264f84a608'],
  ['speech_tokenizer_v2.onnx', 496082973, 'd43342aa12163a80bf07bffb94c9de2e120a8df2f9917cd2f642e7f4219c6f71']
]
const WETEXT = { url: 'https://files.pythonhosted.org/packages/d9/81/351722ec61dbdf96cca59edac14ce620be273fa98a9fab9e1a2aa524c3e1/wetextprocessing-1.2.0-py3-none-any.whl', sha256: '2c7c1e048ede69b67e8a0921093c08a591bc9d7566ad70f5343686196f97aea9', bytes: 2012397 }
// What Python and its packages take once installed (measured)
const PYTHON_BYTES = 1_250_000_000
// The voices: each a reference recording in the install and its words
// (CosyVoice's own sample)
export const VOICES = [
  { id: 'female', gender: 'f', name: '女声', from: 'CosyVoice/asset/zero_shot_prompt.wav', words: '希望你以后能够做的比我还好呦。' }
]

// What the Chinese voice downloads besides the model, for the app's list
// of third-party software (app/scripts/licenses.mjs) and the README
export const CREDITS = [
  { name: 'CosyVoice', version: '074ca6d', license: 'Apache-2.0', url: 'https://github.com/FunAudioLLM/CosyVoice' },
  { name: 'Matcha-TTS', version: 'dd9105b', license: 'MIT', url: 'https://github.com/shivammehta25/Matcha-TTS' },
  { name: 'PyTorch', version: '2.3.1', license: 'BSD-3-Clause', url: 'https://pytorch.org' },
  { name: 'torchaudio', version: '2.3.1', license: 'BSD-2-Clause', url: 'https://github.com/pytorch/audio' },
  { name: 'Transformers', version: '4.51.3', license: 'Apache-2.0', url: 'https://github.com/huggingface/transformers' },
  { name: 'ONNX Runtime', version: '1.18.0', license: 'MIT', url: 'https://onnxruntime.ai' },
  { name: 'Whisper', version: '20231117', license: 'MIT', url: 'https://github.com/openai/whisper' },
  { name: 'WeTextProcessing / wetext', version: '1.2.0', license: 'Apache-2.0', url: 'https://github.com/wenet-e2e/WeTextProcessing' },
  { name: 'librosa', version: null, license: 'ISC', url: 'https://librosa.org' },
  { name: 'uv', version: '0.13.6', license: 'MIT OR Apache-2.0', url: 'https://github.com/astral-sh/uv' },
  { name: 'Python', version: '3.10', license: 'PSF-2.0', url: 'https://www.python.org' }
]

export const BYTES = UV.bytes + PYTHON_BYTES + WETEXT.bytes
  + CODE.reduce((n, c) => n + c.bytes, 0) + MODEL.reduce((n, [, b]) => n + b, 0)

// The sources, fastest first: each sends the first 4 MB of a large file,
// timed (one that fails goes last)
async function fastest(sources, probe) {
  const timed = await Promise.all(sources.map(async src => {
    const t0 = Date.now()
    try {
      const res = await fetch(`${src}/${probe}`, { headers: { range: 'bytes=0-4194303' }, signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await res.arrayBuffer()
      return { src, ms: Date.now() - t0 }
    } catch {
      return { src, ms: Infinity }
    }
  }))
  return timed.sort((a, b) => a.ms - b.ms).map(t => t.src)
}

// A file from the first source that delivers it whole and checked; the
// progress a failed try counted is taken back
async function fromAny(urls, file, sha256, tick) {
  let last
  for (const url of urls) {
    let got = 0
    try {
      await download(url, file, sha256, n => { got += n; tick(n) })
      return
    } catch (err) {
      tick(-got)
      fs.rmSync(file, { force: true })
      last = err
    }
  }
  throw last
}

const run = promisify(execFile)

// Builds the install in dir itself (a Python environment can't be moved
// once made; models.mjs marks it complete); any failure removes it, so it
// is retried whole
export async function install(dir, onProgress) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  let done = 0
  const tick = n => onProgress((done += n), BYTES)
  const tmp = path.join(dir, '.download')
  fs.mkdirSync(tmp)
  try {
    // uv, then Python 3.10 and the packages, kept inside dir
    const uvTar = path.join(tmp, 'uv.tar.gz')
    await download(UV.url, uvTar, UV.sha256, tick)
    fs.mkdirSync(path.join(dir, 'uv'))
    execFileSync('tar', ['-xzf', uvTar, '-C', path.join(dir, 'uv'), '--strip-components', '1'])
    const uv = path.join(dir, 'uv', 'uv')
    const env = { ...process.env, UV_PYTHON_INSTALL_DIR: path.join(dir, 'python'), UV_CACHE_DIR: path.join(tmp, 'uv-cache'), UV_NO_CONFIG: '1' }
    await run(uv, ['venv', '--python', '3.10', path.join(dir, 'venv')], { env })
    // The packages' progress: what Python takes so far, every two seconds
    const base = done
    const watch = setInterval(() => {
      const now = Math.min(PYTHON_BYTES, du(path.join(dir, 'venv')) + du(path.join(dir, 'python')))
      onProgress((done = base + now), BYTES)
    }, 2000)
    try {
      await run(uv, ['pip', 'sync', '--python', path.join(dir, 'venv', 'bin', 'python'), '--build-constraint', path.join(PY, 'build-constraints.txt'),
        path.join(PY, 'requirements.txt')], { env, maxBuffer: 64 * 1024 * 1024 })
    } finally {
      clearInterval(watch)
    }
    done = base + PYTHON_BYTES

    for (const c of CODE) {
      const file = path.join(tmp, 'code.tar.gz')
      await download(c.url, file, c.sha256, tick)
      fs.rmSync(path.join(dir, c.to), { recursive: true, force: true })
      fs.mkdirSync(path.join(dir, c.to), { recursive: true })
      execFileSync('tar', ['-xzf', file, '-C', path.join(dir, c.to), '--strip-components', '1'])
    }
    const sources = await fastest(SOURCES, 'llm.pt')
    for (const [rel, , sha256] of MODEL) {
      const file = path.join(dir, 'model', rel)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      await fromAny(sources.map(s => `${s}/${rel}`), file, sha256, tick)
    }
    // wetext's zh and en rules, laid out where it looks for them
    const wheel = path.join(tmp, 'wetext.whl')
    await download(WETEXT.url, wheel, WETEXT.sha256, tick)
    for (const lang of ['zh', 'en']) {
      for (const part of ['tagger', 'verbalizer']) {
        const to = path.join(dir, 'wetext', lang, 'tn', `${part}.fst`)
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.writeFileSync(to, execFileSync('unzip', ['-p', wheel, `tn/${lang}_tn_${part}.fst`], { maxBuffer: 64 * 1024 * 1024 }))
      }
    }
    fs.mkdirSync(path.join(dir, 'voices'))
    for (const v of VOICES) {
      fs.copyFileSync(path.join(dir, v.from), path.join(dir, 'voices', `${v.id}.wav`))
      fs.writeFileSync(path.join(dir, 'voices', `${v.id}.txt`), v.words)
    }
    fs.rmSync(tmp, { recursive: true, force: true })
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw err
  }
}
