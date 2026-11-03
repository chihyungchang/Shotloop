import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

// The folders are read when the module loads: set before importing it
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-browsers-test-'))
process.env.SHOTLOOP_BROWSERS = dir
delete process.env.CHROME
const { findBrowser, shellOffer } = await import('./browser.mjs')

test('a browser set by hand comes first, a headless shell known by its name', () => {
  process.env.CHROME = '/opt/chrome-headless-shell/chrome-headless-shell'
  try {
    assert.deepEqual(findBrowser(), { path: process.env.CHROME, name: 'chrome-headless-shell', shell: true })
    process.env.CHROME = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    assert.equal(findBrowser().shell, false)
  } finally {
    delete process.env.CHROME
  }
})

test('the downloaded shell comes before the browsers installed, once complete', { skip: !shellOffer() }, () => {
  const { version } = shellOffer()
  const shell = path.join(dir, `chrome-headless-shell-${version}`)
  fs.mkdirSync(shell, { recursive: true })
  // Half unpacked: not taken
  assert.notEqual(findBrowser()?.name, 'Chrome for Testing')
  fs.writeFileSync(path.join(shell, '.complete'), '')
  const found = findBrowser()
  assert.equal(found.shell, true)
  assert.ok(found.path.startsWith(shell))
  assert.equal(shellOffer().installed, true)
})
