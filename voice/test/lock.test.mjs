import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { tryLock } from '../src/lock.mjs'

const lockFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-lock-test-')), 'x.lock')
const ago = (file, ms) => fs.utimesSync(file, new Date(Date.now() - ms), new Date(Date.now() - ms))

test('one holder at a time; released, it is free again', () => {
  const lock = lockFile()
  const release = tryLock(lock)
  assert.ok(release)
  assert.equal(fs.readFileSync(lock, 'utf8'), String(process.pid))
  assert.equal(tryLock(lock), null)
  release()
  assert.ok(!fs.existsSync(lock))
  tryLock(lock)()
})

test('a lock held by a live process is waited for', () => {
  const lock = lockFile()
  fs.writeFileSync(lock, String(process.ppid))
  assert.equal(tryLock(lock), null)
})

test('a lock left by a dead process is taken over', () => {
  const lock = lockFile()
  // A pid that existed and has exited
  const { pid } = spawnSync('true')
  fs.writeFileSync(lock, String(pid))
  const release = tryLock(lock)
  assert.ok(release)
  assert.equal(fs.readFileSync(lock, 'utf8'), String(process.pid))
  release()
})

test('an empty lock file is taken over once it is a moment old', () => {
  const lock = lockFile()
  fs.writeFileSync(lock, '')
  // Just made: its owner may be about to write its pid
  assert.equal(tryLock(lock), null)
  ago(lock, 10_000)
  const release = tryLock(lock)
  assert.ok(release)
  release()
})

test('a lock untouched for long is taken over, though its pid lives (reused)', () => {
  const lock = lockFile()
  fs.writeFileSync(lock, String(process.ppid))
  ago(lock, 60 * 60_000)
  const release = tryLock(lock)
  assert.ok(release)
  release()
})
