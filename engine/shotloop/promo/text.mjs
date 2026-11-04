// The text in a product's picture and where it is, read by macOS's own
// Vision framework (text.swift): each line { text, x, y, w, h } in the
// picture's pixels. A shot marks or clicks a control from these boxes
// instead of a guess by eye, so it lands on it at once (the find_text
// tool). Read once per picture and kept by its bytes in
// .shotloop/text/<sha>.json.
//
// The reader is the app's helper (shotloop-text, beside its ffmpeg); in
// development it is built from text.swift on first use with the Swift
// compiler, and kept.

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { readJson, writeJson } from '../project/files.mjs'

const exec = promisify(execFile)
const SOURCE = fileURLToPath(new URL('text.swift', import.meta.url))
const HELPER = 'shotloop-text'

// The helper to run: the app's, or one built here from the source
let built = null
async function helper() {
  try {
    await exec(HELPER, [], { timeout: 10000 })
  } catch (err) {
    // Present: it ran and said how it's used
    if (err.code !== 'ENOENT') return HELPER
    built ??= buildHelper()
    return built
  }
  return HELPER
}

async function buildHelper() {
  const source = fs.readFileSync(SOURCE)
  const sum = createHash('sha256').update(source).digest('hex').slice(0, 12)
  const out = path.join(os.tmpdir(), `shotloop-text-${sum}`)
  if (fs.existsSync(out)) return out
  // Built under a temporary name and renamed, so two processes never run
  // a half-written helper
  const work = `${out}.${process.pid}`
  try {
    await exec('swiftc', ['-O', SOURCE, '-o', work], { timeout: 180000 })
  } catch (err) {
    throw new Error(err.code === 'ENOENT'
      ? 'reading text in pictures needs the app\'s shotloop-text helper or the Swift compiler (Xcode Command Line Tools)'
      : `building the text reader failed: ${err.stderr || err.message}`)
  }
  fs.renameSync(work, out)
  return out
}

// Every line of text in a project's picture, with its box in the
// picture's pixels
export async function pictureText(root, file) {
  const abs = path.resolve(root, file)
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error(`${file} is outside the project`)
  if (!fs.existsSync(abs)) throw new Error(`${file} does not exist`)
  const sum = createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 16)
  const kept = path.join(root, '.shotloop', 'text', `${sum}.json`)
  const known = readJson(kept, null)
  if (known) return known
  const { stdout } = await exec(await helper(), [abs], { timeout: 60000, maxBuffer: 16 << 20 })
  const lines = JSON.parse(stdout)
  writeJson(kept, lines)
  return lines
}

// The lines that hold the words asked for, the closest first: the whole
// line, then a line starting with them, then any that holds them (case
// and spacing aside)
export async function findText(root, file, words) {
  const lines = await pictureText(root, file)
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const want = norm(words)
  const rank = l => {
    const t = norm(l.text)
    return t === want ? 0 : t.replace(/^[^a-z0-9一-鿿]+/, '') === want ? 1 : t.startsWith(want) ? 2 : 3
  }
  return lines.filter(l => norm(l.text).includes(want)).sort((a, b) => rank(a) - rank(b))
}
