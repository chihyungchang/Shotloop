// Packs the built Shotloop.app into a disk image with an Applications
// link to drag it onto. Used instead of Tauri's dmg bundler, whose script
// breaks on paths with spaces. Run after `tauri build --bundles app`.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const TAURI = path.join(import.meta.dirname, '..', 'src-tauri')
const BUNDLE = path.join(TAURI, 'target', 'release', 'bundle')
const { productName, version } = JSON.parse(fs.readFileSync(path.join(TAURI, 'tauri.conf.json'), 'utf8'))

const app = path.join(BUNDLE, 'macos', `${productName}.app`)
if (!fs.existsSync(app)) throw new Error(`dmg: ${app} not found; build the app first`)

const arch = execFileSync('uname', ['-m'], { encoding: 'utf8' }).trim() === 'arm64' ? 'aarch64' : 'x64'
const dir = path.join(BUNDLE, 'dmg')
const out = path.join(dir, `${productName}_${version}_${arch}.dmg`)
const staging = path.join(dir, '.staging')

fs.rmSync(staging, { recursive: true, force: true })
fs.mkdirSync(staging, { recursive: true })
try {
  // ditto keeps the bundle's signatures, extended attributes and modes
  execFileSync('ditto', [app, path.join(staging, `${productName}.app`)])
  fs.symlinkSync('/Applications', path.join(staging, 'Applications'))
  fs.rmSync(out, { force: true })
  execFileSync('hdiutil', ['create', '-volname', productName, '-srcfolder', staging, '-fs', 'HFS+', '-format', 'UDZO', '-ov', out], { stdio: ['ignore', 'ignore', 'inherit'] })
} finally {
  fs.rmSync(staging, { recursive: true, force: true })
}
const size = (fs.statSync(out).size / 1e6).toFixed(0)
console.log(`dmg: ${path.relative(process.cwd(), out)} (${size} MB)`)
