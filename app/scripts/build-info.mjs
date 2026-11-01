// What every build script needs to know about the build: the product,
// its version, the target and where Tauri puts the bundle. Read from the
// sources of truth, so the scripts can't disagree.
//
// The version lives in app/package.json; tauri.conf.json points at it
// ("version": "../package.json") and Cargo.toml repeats it (release.mjs
// refuses when they differ).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const TAURI = path.join(import.meta.dirname, '..', 'src-tauri')
export const BUNDLE = path.join(TAURI, 'target', 'release', 'bundle')

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
export const conf = readJson(path.join(TAURI, 'tauri.conf.json'))
export const { productName } = conf
export const version = readJson(path.join(import.meta.dirname, '..', 'package.json')).version

// The target being built: what Tauri says, else the Rust host, else this machine
function targetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) return process.env.TAURI_ENV_TARGET_TRIPLE
  try {
    return execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)[1]
  } catch {
    return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
  }
}

export const triple = targetTriple()
// aarch64 or x86_64, as the updater names platforms
export const arch = triple.split('-')[0]
// The dmg's name says x64 for Intel (the website's download regex expects it)
export const dmgArch = arch === 'x86_64' ? 'x64' : arch
