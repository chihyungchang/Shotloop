// Publishes a built Shotloop as a GitHub release: the dmg to download,
// and for the in-app updater the signed app archive plus latest.json
// (version, notes, signature and URL per platform), which the updater
// reads from releases/latest/download/latest.json.
//
//   TAURI_SIGNING_PRIVATE_KEY=… pnpm app:build   (makes the .app.tar.gz + .sig)
//   node app/scripts/release.mjs [--notes notes.md] [--draft]

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { notes: { type: 'string' }, draft: { type: 'boolean' } } })
const TAURI = path.join(import.meta.dirname, '..', 'src-tauri')
const BUNDLE = path.join(TAURI, 'target', 'release', 'bundle')
const conf = JSON.parse(fs.readFileSync(path.join(TAURI, 'tauri.conf.json'), 'utf8'))
const { productName, version } = conf
const tag = `v${version}`
const repo = conf.plugins.updater.endpoints[0].match(/github\.com\/([^/]+\/[^/]+)\//)[1]

const arch = execFileSync('uname', ['-m'], { encoding: 'utf8' }).trim() === 'arm64' ? 'aarch64' : 'x86_64'
const archive = path.join(BUNDLE, 'macos', `${productName}.app.tar.gz`)
const dmg = path.join(BUNDLE, 'dmg', `${productName}_${version}_${arch === 'x86_64' ? 'x64' : arch}.dmg`)
for (const f of [archive, `${archive}.sig`, dmg]) {
  if (!fs.existsSync(f)) throw new Error(`release: ${path.relative(process.cwd(), f)} not found; build with the signing key first`)
}

// The archive is uploaded under a versioned name, so each release keeps its own
const asset = `${productName}_${version}_${arch}.app.tar.gz`
const staged = path.join(BUNDLE, asset)
fs.copyFileSync(archive, staged)

const notes = values.notes ? fs.readFileSync(values.notes, 'utf8').trim() : `Shotloop ${version}`
const latest = path.join(BUNDLE, 'latest.json')
fs.writeFileSync(latest, JSON.stringify({
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    [`darwin-${arch}`]: {
      signature: fs.readFileSync(`${archive}.sig`, 'utf8').trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${asset}`
    }
  }
}, null, 2) + '\n')

const notesFile = path.join(BUNDLE, 'release-notes.md')
fs.writeFileSync(notesFile, notes + '\n')
execFileSync('gh', ['release', 'create', tag, dmg, staged, latest,
  '--repo', repo, '--title', `${productName} ${version}`, '--notes-file', notesFile,
  ...(values.draft ? ['--draft'] : [])], { stdio: 'inherit' })
console.log(`release: ${tag} published to ${repo}`)
