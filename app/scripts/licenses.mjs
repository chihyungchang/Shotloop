// The third-party software Shotloop.app carries or fetches, with versions
// and licenses, for Settings → About: the bundled programs (Node.js,
// FFmpeg), the speech models and what the Chinese voice runs on
// (downloaded on first use), the npm packages of the app, the agent and
// the voice-over, and the Rust crates of the shell. Read from the sources
// of truth (scripts/sidecars.mjs, voice/src/models.mjs and cosyvoice.mjs,
// pnpm, cargo), never written by hand.
//
// Output: app/src/licenses.json. Run by `pnpm build` (tauri.bundle.json)
// and by hand after a dependency changes.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CREDITS as CHINESE_VOICE } from '../../voice/src/cosyvoice.mjs'
import { MODELS } from '../../voice/src/models.mjs'
import { TAURI, triple } from './build-info.mjs'
import { FFMPEG, NODE } from './sidecars.mjs'

const REPO = path.resolve(import.meta.dirname, '..', '..')
const OUT = path.join(import.meta.dirname, '..', 'src', 'licenses.json')

const programs = [
  { name: 'Node.js', version: NODE, license: 'MIT', url: 'https://nodejs.org' },
  { name: 'FFmpeg', version: FFMPEG, license: 'GPL-3.0', url: 'https://ffmpeg.org' }
]

const models = Object.values(MODELS).map(m => ({ name: m.name, version: null, license: m.license, url: m.home }))

// Production npm packages of the workspace's shipped parts, one entry per
// package and version
function npm() {
  const seen = new Map()
  for (const pkg of ['@shotloop/app', '@shotloop/agent', '@shotloop/voice']) {
    const out = JSON.parse(execFileSync('pnpm', ['--filter', pkg, 'licenses', 'list', '--prod', '--json'], { cwd: REPO, encoding: 'utf8' }))
    for (const [license, list] of Object.entries(out)) {
      for (const p of list) {
        for (const version of p.versions) {
          seen.set(`${p.name}@${version}`, { name: p.name, version, license, url: p.homepage ?? `https://www.npmjs.com/package/${p.name}` })
        }
      }
    }
  }
  return [...seen.values()]
}

// The shell's crates on the target being built (normal and build
// dependencies of the release, not dev tools)
function crates() {
  const meta = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--filter-platform', triple], {
    cwd: TAURI, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }))
  const used = new Set(meta.resolve.nodes.map(n => n.id))
  return meta.packages
    .filter(p => used.has(p.id) && p.source)
    .map(p => ({ name: p.name, version: p.version, license: p.license ?? 'see repository', url: p.repository ?? p.homepage ?? `https://crates.io/crates/${p.name}` }))
}

const byName = (a, b) => a.name.localeCompare(b.name) || String(a.version).localeCompare(String(b.version))
const groups = [
  { id: 'programs', items: programs },
  { id: 'models', items: models },
  { id: 'chineseVoice', items: CHINESE_VOICE },
  { id: 'npm', items: npm().sort(byName) },
  { id: 'crates', items: crates().sort(byName) }
]
fs.writeFileSync(OUT, JSON.stringify({ groups }, null, 1) + '\n')
console.log(`licenses: ${groups.map(g => `${g.items.length} ${g.id}`).join(', ')} → ${path.relative(REPO, OUT)}`)
