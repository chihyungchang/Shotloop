// Publishes a built Shotloop as a GitHub release: the dmg to download,
// and for the in-app updater the signed app archive plus latest.json
// (version, notes, signature and URL per platform), which the updater
// reads from releases/latest/download/latest.json.
//
//   TAURI_SIGNING_PRIVATE_KEY=… pnpm app:build   (makes the .app.tar.gz + .sig)
//   node app/scripts/release.mjs [--notes notes.md] [--draft]
//
// Nothing is uploaded unless the release is what it says it is: a clean
// tree with HEAD pushed (the tag is made there), one version everywhere,
// a bundle built after the version was set (a stale archive would offer
// the old app under the new number), and a dmg that opens once
// downloaded (.claude/rules/macos-release.md, rule 4).

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { arch, BUNDLE, conf, dmgArch, productName, TAURI, version } from './build-info.mjs'

const { values } = parseArgs({ options: { notes: { type: 'string' }, draft: { type: 'boolean' } } })
const tag = `v${version}`
const repo = conf.plugins.updater.endpoints[0].match(/github\.com\/([^/]+\/[^/]+)\//)[1]
const PACKAGE = path.join(import.meta.dirname, '..', 'package.json')
const CARGO = path.join(TAURI, 'Cargo.toml')

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const rel = f => path.relative(process.cwd(), f)

// The release is tagged at HEAD, so HEAD must be what is published
function checkTree() {
  if (git('status', '--porcelain')) throw new Error('release: the working tree has changes; commit them first')
  git('fetch', '--quiet', 'origin')
  if (!git('branch', '-r', '--contains', 'HEAD')) throw new Error('release: HEAD is not on the remote; push it first')
}

// package.json holds the version; tauri.conf.json points at it and Cargo.toml repeats it
function checkVersions() {
  const cargo = fs.readFileSync(CARGO, 'utf8').match(/^version = "([^"]+)"/m)?.[1]
  const tauri = conf.version === '../package.json' ? version : conf.version
  if (cargo !== version || tauri !== version) {
    throw new Error(`release: versions differ: package.json ${version}, Cargo.toml ${cargo}, tauri.conf.json ${tauri}`)
  }
}

const plistVersion = xml => xml.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1]

// The app, its updater archive and the dmg are this version's, built after it was set
function checkFresh(app, archive, dmg) {
  const found = {
    [rel(app)]: plistVersion(fs.readFileSync(path.join(app, 'Contents', 'Info.plist'), 'utf8')),
    [rel(archive)]: plistVersion(execFileSync('tar', ['-xzOf', archive, `${productName}.app/Contents/Info.plist`], { encoding: 'utf8' }))
  }
  for (const [file, v] of Object.entries(found)) {
    if (v !== version) throw new Error(`release: ${file} is version ${v}, not ${version}; build again`)
  }
  const set = Math.max(...[PACKAGE, CARGO, path.join(TAURI, 'tauri.conf.json')].map(f => fs.statSync(f).mtimeMs))
  for (const f of [path.join(app, 'Contents', 'Info.plist'), archive, `${archive}.sig`, dmg]) {
    if (fs.statSync(f).mtimeMs <= set) throw new Error(`release: ${rel(f)} is older than the version; build again`)
  }
}

// The app as a person gets it: out of the dmg, quarantined by the browser
function checkDownloaded(dmg) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-release-'))
  const mount = path.join(tmp, 'dmg')
  fs.mkdirSync(mount)
  execFileSync('hdiutil', ['attach', dmg, '-nobrowse', '-readonly', '-mountpoint', mount], { stdio: 'ignore' })
  try {
    const app = path.join(tmp, `${productName}.app`)
    execFileSync('ditto', [path.join(mount, `${productName}.app`), app])
    execFileSync('xattr', ['-w', 'com.apple.quarantine', `0083;${Math.floor(Date.now() / 1000).toString(16)};Safari;`, app])
    const sign = spawnSync('codesign', ['--verify', '--deep', '--strict', app], { encoding: 'utf8' })
    if (sign.status !== 0 || sign.stderr.trim()) throw new Error(`release: the downloaded app's signature is invalid:\n${sign.stderr}`)
    // Not notarized yet, Gatekeeper rejects it (it opens with Open Anyway);
    // "damaged" or an invalid signature would mean it can't be opened at all
    const gate = spawnSync('spctl', ['-a', '-vv', '-t', 'exec', app], { encoding: 'utf8' })
    const said = `${gate.stdout}${gate.stderr}`
    if (/damaged|invalid/i.test(said) || (gate.status !== 0 && !/rejected/.test(said))) {
      throw new Error(`release: Gatekeeper would not open the downloaded app:\n${said}`)
    }
    // Opened once (Open Anyway, or xattr -dr as the notes say), its Node
    // must start: under a hardened runtime it crashes at once. Until then
    // macOS stops any quarantined program the app holds
    execFileSync('xattr', ['-dr', 'com.apple.quarantine', app])
    const node = path.join(app, 'Contents', 'MacOS', 'node')
    const one = spawnSync(node, ['-e', 'console.log(1)'], { encoding: 'utf8' })
    if (one.stdout.trim() !== '1') throw new Error(`release: the bundled Node does not run (${one.signal ?? `exit ${one.status}`}):\n${one.stderr}`)
    renderOneShot(app, node, tmp)
    console.log('release: the downloaded app is signed, opens with Open Anyway, and renders')
  } finally {
    execFileSync('hdiutil', ['detach', mount, '-quiet'])
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// One shot's stills with the bundled Node, ffmpeg and engine, from a copy
// of a bundled 2D example (the app's own folder is read-only)
function renderOneShot(app, node, tmp) {
  const resources = path.join(app, 'Contents', 'Resources')
  const examples = path.join(resources, 'examples')
  const name = fs.readdirSync(examples).find(n => {
    const file = path.join(examples, n, 'shotloop.json')
    return fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).track === '2d'
  })
  if (!name) throw new Error('release: the app carries no 2D example to render')
  const project = path.join(tmp, name)
  execFileSync('ditto', [path.join(examples, name), project])
  const shot = JSON.parse(fs.readFileSync(path.join(project, 'shotloop.json'), 'utf8')).shots[0].id
  const env = { ...process.env, PATH: `${path.dirname(node)}:${process.env.PATH}` }
  const render = spawnSync(node, [path.join(resources, 'engine', 'shotloop', 'cli.mjs'), '--json', 'render', project, '--shot', shot, '--stills'], { encoding: 'utf8', env })
  if (render.status !== 0) {
    const tail = render.stderr.trim().split('\n').slice(-6).join('\n')
    throw new Error(`release: the bundled engine could not render ${name} ${shot} (${render.signal ?? `exit ${render.status}`}):\n${tail}`)
  }
}

// While the app isn't notarized, every release says how to open it the first time
const FIRST_OPEN = `**First launch:** Shotloop isn't notarized by Apple yet, so macOS says it can't verify the developer. Open it once from System Settings → Privacy & Security → Open Anyway, or run \`xattr -dr com.apple.quarantine /Applications/Shotloop.app\` in Terminal. Updates after that install by themselves.

**第一次打开**：Shotloop 还没有经过 Apple 公证，macOS 会提示"无法验证开发者"。请在 系统设置 → 隐私与安全性 → 仍要打开 里打开一次，或者在终端运行 \`xattr -dr com.apple.quarantine /Applications/Shotloop.app\`。之后的更新会自动安装。`

function releaseNotes() {
  const notes = values.notes ? fs.readFileSync(values.notes, 'utf8').trim() : `Shotloop ${version}`
  return notes.includes('xattr -dr com.apple.quarantine') ? notes : `${notes}\n\n---\n\n${FIRST_OPEN}`
}

const app = path.join(BUNDLE, 'macos', `${productName}.app`)
const archive = path.join(BUNDLE, 'macos', `${productName}.app.tar.gz`)
const dmg = path.join(BUNDLE, 'dmg', `${productName}_${version}_${dmgArch}.dmg`)
for (const f of [app, archive, `${archive}.sig`, dmg]) {
  if (!fs.existsSync(f)) throw new Error(`release: ${rel(f)} not found; build with the signing key first`)
}
checkTree()
checkVersions()
checkFresh(app, archive, dmg)
checkDownloaded(dmg)

// The archive is uploaded under a versioned name, so each release keeps its own
const asset = `${productName}_${version}_${arch}.app.tar.gz`
const staged = path.join(BUNDLE, asset)
fs.copyFileSync(archive, staged)

const notes = releaseNotes()
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
  '--repo', repo, '--target', git('rev-parse', 'HEAD'), '--title', `${productName} ${version}`, '--notes-file', notesFile,
  ...(values.draft ? ['--draft'] : [])], { stdio: 'inherit' })
console.log(`release: ${tag} published to ${repo}`)
