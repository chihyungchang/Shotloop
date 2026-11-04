// Fetches the binaries bundled with the app as Tauri sidecars: Node.js,
// which runs the engine and the agent, and ffmpeg (libx264), which
// encodes and joins shots. Versions and SHA-256 sums are pinned; nothing
// is downloaded when the right versions are already in place. Builds the
// one of our own, shotloop-text (engine/shotloop/promo/text.swift: the
// text in a picture, read by macOS's Vision), with the Swift compiler.
//
// Output: src-tauri/binaries/<name>-<target triple>, as externalBin
// expects. Run by `pnpm dev` and `pnpm build`; `--force` fetches again.
// Imported (licenses.mjs), it only tells the pinned versions.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TAURI, triple } from './build-info.mjs'

const OUT = path.join(TAURI, 'binaries')
const TEXT_SOURCE = path.join(TAURI, '..', '..', 'engine', 'shotloop', 'promo', 'text.swift')
// The Swift target for a Rust target triple
const SWIFT_TARGET = { 'aarch64-apple-darwin': 'arm64-apple-macos13', 'x86_64-apple-darwin': 'x86_64-apple-macos13' }

export const NODE = '24.22.2'
export const FFMPEG = '9.0.2'
// Node.js: the official builds (nodejs.org/dist/v24.22.2/SHASUMS256.txt).
// ffmpeg: static GPL builds by Martin Riedl (ffmpeg.martin-riedl.de).
export const BUILDS = {
  'aarch64-apple-darwin': {
    node: { url: `https://nodejs.org/dist/v${NODE}/node-v${NODE}-darwin-arm64.tar.gz`, sha256: 'aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a', file: `node-v${NODE}-darwin-arm64/bin/node` },
    ffmpeg: { url: `https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_${FFMPEG}/ffmpeg.zip`, sha256: 'c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924', file: 'ffmpeg' }
  },
  'x86_64-apple-darwin': {
    node: { url: `https://nodejs.org/dist/v${NODE}/node-v${NODE}-darwin-x64.tar.gz`, sha256: 'd5e336d588c45be0c37dbd52cc29895593009ca4997a77a1fd02815131ed0e52', file: `node-v${NODE}-darwin-x64/bin/node` },
    ffmpeg: { url: `https://ffmpeg.martin-riedl.de/download/macos/amd64/1789931006_${FFMPEG}/ffmpeg.zip`, sha256: '7c6b4125b191cbf773832dc51f424cf2b6bb7da43007d1e066f95909e47cacd4', file: 'ffmpeg' }
  }
}

async function fetchChecked({ url, sha256 }) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  const sum = createHash('sha256').update(data).digest('hex')
  if (sum !== sha256) throw new Error(`${url}: SHA-256 ${sum}, expected ${sha256}`)
  return data
}

async function install(name, build, target, tmp) {
  console.log(`sidecars: ${name} ← ${build.url}`)
  const archive = path.join(tmp, path.basename(build.url))
  fs.writeFileSync(archive, await fetchChecked(build))
  if (archive.endsWith('.zip')) execFileSync('unzip', ['-q', '-o', archive, build.file, '-d', tmp])
  else execFileSync('tar', ['-xzf', archive, '-C', tmp, build.file])
  const dest = path.join(OUT, `${name}-${target}`)
  fs.copyFileSync(path.join(tmp, build.file), dest)
  fs.chmodSync(dest, 0o755)
  // Node's local symbols are a fifth of its size and only serve a
  // debugger: stripped, then signed again ad hoc so it still runs here
  // (the app's own signature covers it in the bundle)
  if (name === 'node') {
    execFileSync('strip', ['-x', dest])
    execFileSync('codesign', ['--force', '--sign', '-', dest], { stdio: 'ignore' })
  }
  // Downloaded files are quarantined; the app's signature covers them
  try { execFileSync('xattr', ['-d', 'com.apple.quarantine', dest], { stdio: 'ignore' }) } catch {}
  const version = execFileSync(dest, [name === 'node' ? '--version' : '-version'], { encoding: 'utf8' }).split('\n')[0]
  console.log(`sidecars: ${name} ok (${version.trim()})`)
}

// shotloop-text from its source, for the target, signed ad hoc like Node
// (the app's signature covers it in the bundle)
function buildText(target) {
  if (!SWIFT_TARGET[target]) throw new Error(`sidecars: no Swift target for ${target}`)
  const dest = path.join(OUT, `shotloop-text-${target}`)
  console.log('sidecars: shotloop-text ← text.swift')
  execFileSync('swiftc', ['-O', '-target', SWIFT_TARGET[target], TEXT_SOURCE, '-o', dest], { stdio: 'inherit' })
  execFileSync('codesign', ['--force', '--sign', '-', dest], { stdio: 'ignore' })
  console.log('sidecars: shotloop-text ok')
}

// Only when run, not when imported
if (path.resolve(process.argv[1] ?? '') === import.meta.filename) await fetchSidecars()

async function fetchSidecars() {
  const builds = BUILDS[triple]
  if (!builds) throw new Error(`sidecars: no pinned builds for ${triple}`)
  fs.mkdirSync(OUT, { recursive: true })
  const stamp = path.join(OUT, '.versions.json')
  const text = createHash('sha256').update(fs.readFileSync(TEXT_SOURCE)).digest('hex').slice(0, 12)
  const want = JSON.stringify({ target: triple, node: NODE, ffmpeg: FFMPEG, stripped: true, text })
  const have = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8') : ''
  const present = [...Object.keys(builds), 'shotloop-text'].every(n => fs.existsSync(path.join(OUT, `${n}-${triple}`)))
  // Nothing to fetch when the right versions are in place
  if (have === want && present && !process.argv.includes('--force')) return
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-sidecars-'))
  try {
    for (const [name, build] of Object.entries(builds)) await install(name, build, triple, tmp)
    buildText(triple)
    fs.writeFileSync(stamp, want)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
