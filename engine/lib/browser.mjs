// The browser a render drives: a Chromium browser on this Mac, or
// Chrome for Testing's headless shell, downloaded the first time a
// render finds none. Tried in order: the path set in Settings (CHROME),
// the downloaded shell, then the browsers in /Applications and
// ~/Applications.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { download, du } from './fetch.mjs'
import { onceUnderLock } from './lock.mjs'

export const BROWSERS_DIR = process.env.SHOTLOOP_BROWSERS ?? path.join(os.homedir(), '.shotloop', 'browsers')

// Chromium browsers by app name (the binary in Contents/MacOS has the
// same name), in order of preference
const APPS = [
  'Google Chrome',
  'Chromium',
  'Microsoft Edge',
  'Brave Browser',
  'Vivaldi',
  'Arc',
  'Google Chrome Beta',
  'Google Chrome Dev',
  'Google Chrome Canary',
  'Google Chrome for Testing'
]
const APP_DIRS = ['/Applications', path.join(os.homedir(), 'Applications')]

// The headless shell, pinned with its archives' size and SHA-256. A
// newer one: its version from Chrome for Testing's
// known-good-versions-with-downloads.json, then both archives hashed
const SHELL = {
  version: '156.0.8078.80',
  'mac-arm64': { bytes: 103982159, sha256: 'ea615baa2e9caf0d02d1898a6562b5f8fa9c35239707dae0f592178df5b986ac' },
  'mac-x64': { bytes: 109493298, sha256: '535d417d9034cbd11e7dacd1a71aa3d6e1b525e6d5dcd2671eb2532f01481228' }
}
const CFT = 'https://storage.googleapis.com/chrome-for-testing-public'
// Chrome for Testing's name for this Mac; null elsewhere (no shell offered)
const PLATFORM = process.platform === 'darwin' ? { arm64: 'mac-arm64', x64: 'mac-x64' }[process.arch] ?? null : null

const shellDir = () => path.join(BROWSERS_DIR, `chrome-headless-shell-${SHELL.version}`)
const shellBin = () => path.join(shellDir(), `chrome-headless-shell-${PLATFORM}`, 'chrome-headless-shell')
const shellInstalled = () => !!PLATFORM && fs.existsSync(path.join(shellDir(), '.complete'))

// { path, name, shell, app? } or null. shell: the headless shell, which
// takes the old --headless flag
export function findBrowser() {
  const set = process.env.CHROME
  if (set) return { path: set, name: path.basename(set), shell: path.basename(set) === 'chrome-headless-shell' }
  if (shellInstalled()) return { path: shellBin(), name: 'Chrome for Testing', shell: true }
  for (const name of APPS) {
    for (const dir of APP_DIRS) {
      const app = path.join(dir, `${name}.app`)
      const bin = path.join(app, 'Contents', 'MacOS', name)
      if (fs.existsSync(bin)) return { path: bin, name, shell: false, app }
    }
  }
  return null
}

// A browser's version, without opening it where that can be avoided:
// some browsers open a window on --version, so an app's comes from its
// Info.plist. Null when it can't be read
export function browserVersion(browser) {
  if (browser.shell && !process.env.CHROME) return SHELL.version
  const app = browser.app ?? browser.path.match(/^(.*\.app)\/Contents\/MacOS\//)?.[1]
  try {
    return app
      ? execFileSync('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', path.join(app, 'Contents', 'Info.plist')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      : execFileSync(browser.path, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    // Not readable, or not runnable: the browser is shown without a version
    return null
  }
}

// The download on offer: its version and size, and whether it is here;
// null where Chrome for Testing has no shell for this machine
export const shellOffer = () => (PLATFORM ? { version: SHELL.version, bytes: SHELL[PLATFORM].bytes, installed: shellInstalled() } : null)

// Folders a download is being filled in (left behind if it was killed)
const partial = () => (fs.existsSync(BROWSERS_DIR) ? fs.readdirSync(BROWSERS_DIR).filter(f => f.startsWith('.shell-')).map(f => path.join(BROWSERS_DIR, f)) : [])

// The shell, downloaded and unpacked once: another process fetching it
// (the app's download while a render needs it) is waited for, not
// repeated. onProgress(done, total, { waiting }) in bytes
export async function ensureShell(onProgress = () => {}) {
  if (!PLATFORM) throw new Error(`Chrome for Testing has no headless shell for ${process.platform} ${process.arch}`)
  const { bytes } = SHELL[PLATFORM]
  if (!shellInstalled()) {
    fs.mkdirSync(BROWSERS_DIR, { recursive: true })
    await onceUnderLock(path.join(BROWSERS_DIR, '.shell.lock'), shellInstalled, () => fetchShell(onProgress),
      () => onProgress(Math.min(partial().reduce((n, d) => n + du(d), 0), bytes - 1), bytes, { waiting: true }))
  }
  onProgress(bytes, bytes)
  return { path: shellBin(), name: 'Chrome for Testing', shell: true }
}

// The archive into a temporary folder, moved into place once unpacked;
// a shell of an older pin goes
async function fetchShell(onProgress) {
  for (const d of partial()) fs.rmSync(d, { recursive: true, force: true })
  const tmp = fs.mkdtempSync(path.join(BROWSERS_DIR, '.shell-'))
  const { bytes, sha256 } = SHELL[PLATFORM]
  let done = 0
  try {
    const zip = path.join(tmp, 'shell.zip')
    await download(`${CFT}/${SHELL.version}/${PLATFORM}/chrome-headless-shell-${PLATFORM}.zip`, zip, sha256, n => onProgress((done += n), bytes))
    const dir = path.join(tmp, 'shell')
    // ditto keeps the archive's permissions and symlinks
    execFileSync('ditto', ['-x', '-k', zip, dir])
    fs.writeFileSync(path.join(dir, '.complete'), new Date().toISOString() + '\n')
    fs.rmSync(shellDir(), { recursive: true, force: true })
    fs.renameSync(dir, shellDir())
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  for (const f of fs.readdirSync(BROWSERS_DIR)) {
    if (f.startsWith('chrome-headless-shell-') && path.join(BROWSERS_DIR, f) !== shellDir()) fs.rmSync(path.join(BROWSERS_DIR, f), { recursive: true, force: true })
  }
}

// How a download a render starts is reported: the CLI points this at its
// progress events
let report = () => {}
export const reportDownloads = fn => (report = fn)

// The browser for a render: the one found, else the shell, downloaded now
export const renderBrowser = async () => findBrowser() ?? ensureShell(report)
