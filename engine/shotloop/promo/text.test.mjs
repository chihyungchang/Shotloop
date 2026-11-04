// The text in a picture, read by the system: found by its words, with its
// box in the picture's pixels, and read once
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { findText, pictureText } from './text.mjs'

// The reader is the app's helper or built with the Swift compiler: on a
// machine with neither, there is nothing to test
const canRead = ['shotloop-text', 'swiftc'].some(cmd => {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})

test('text: a control found by its words, its box in the picture, read once', { skip: !canRead && 'no text reader here' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-text-'))
  try {
    fs.copyFileSync(new URL('../tools/highlight.jpg', import.meta.url), path.join(root, 'shot.jpg'))
    const [hit] = await findText(root, 'shot.jpg', 'type it')
    assert.ok(hit, 'the headline is found')
    // The headline sits in the left third of the 640×360 still
    assert.ok(hit.x < 213 && hit.y < 180 && hit.w > 20 && hit.h > 5, JSON.stringify(hit))
    const kept = fs.readdirSync(path.join(root, '.shotloop', 'text'))
    assert.equal(kept.length, 1)
    assert.deepEqual(await pictureText(root, 'shot.jpg'), JSON.parse(fs.readFileSync(path.join(root, '.shotloop', 'text', kept[0]), 'utf8')))
    await assert.rejects(pictureText(root, '../outside.jpg'), /outside the project/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
