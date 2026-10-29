// Fetches the binaries bundled with the app as Tauri sidecars: Node.js,
// which runs the engine and the agent, and ffmpeg (libx264), which
// encodes and joins shots. Versions and SHA-256 sums are pinned; nothing
// is downloaded when the right versions are already in place.
//
// Output: src-tauri/binaries/<name>-<target triple>, as externalBin
// expects. Run by `pnpm dev` and `pnpm build`; `--force` fetches again.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const OUT = path.join(import.meta.dirname, '..', 'src-tauri', 'binaries')

const NODE = '24.22.2'
const FFMPEG = '9.0.2'
// Node.js: the official builds (nodejs.org/dist/v24.22.2/SHASUMS256.txt).
// ffmpeg: static GPL builds by Martin Riedl (ffmpeg.martin-riedl.de).
const BUILDS = {
  'aarch64-apple-darwin': {
    node: { url: `https://nodejs.org/dist/v${NODE}/node-v${NODE}-darwin-arm64.tar.gz`, sha256: 'aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a', file: `node-v${NODE}-darwin-arm64/bin/node` },
    ffmpeg: { url: `https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_${FFMPEG}/ffmpeg.zip`, sha256: 'c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924', file: 'ffmpeg' }
  },
  'x86_64-apple-darwin': {
    node: { url: `https://nodejs.org/dist/v${NODE}/node-v${NODE}-darwin-x64.tar.gz`, sha256: 'd5e336d588c45be0c37dbd52cc29895593009ca4997a77a1fd02815131ed0e52', file: `node-v${NODE}-darwin-x64/bin/node` },
    ffmpeg: { url: `https://ffmpeg.martin-riedl.de/download/macos/amd64/1789931006_${FFMPEG}/ffmpeg.zip`, sha256: '7c6b4125b191cbf773832dc51f424cf2b6bb7da43007d1e066f95909e47cacd4', file: 'ffmpeg' }
  }
}

// The target being built: what Tauri says, else the Rust host, else this machine
function triple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) return process.env.TAURI_ENV_TARGET_TRIPLE
  try {
    return execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)[1]
  } catch {
    return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
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
  // Downloaded files are quarantined; the app's signature covers them
  try { execFileSync('xattr', ['-d', 'com.apple.quarantine', dest], { stdio: 'ignore' }) } catch {}
  const version = execFileSync(dest, [name === 'node' ? '--version' : '-version'], { encoding: 'utf8' }).split('\n')[0]
  console.log(`sidecars: ${name} ok (${version.trim()})`)
}

const target = triple()
const builds = BUILDS[target]
if (!builds) throw new Error(`sidecars: no pinned builds for ${target}`)
fs.mkdirSync(OUT, { recursive: true })
const stamp = path.join(OUT, '.versions.json')
const want = JSON.stringify({ target, node: NODE, ffmpeg: FFMPEG })
const have = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8') : ''
const present = Object.keys(builds).every(n => fs.existsSync(path.join(OUT, `${n}-${target}`)))
if (have === want && present && !process.argv.includes('--force')) process.exit(0)

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-sidecars-'))
try {
  for (const [name, build] of Object.entries(builds)) await install(name, build, target, tmp)
  fs.writeFileSync(stamp, want)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
