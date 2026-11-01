import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { ask, speak } from '../src/cosyvoice.mjs'

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-voice-test-'))

// A server on a temporary Unix socket that answers each request with
// reply(socket), and a client connected to it
async function fake(reply) {
  const dir = tmpDir()
  fs.writeFileSync(path.join(dir, 'server.log'), 'loading\nRuntimeError: out of memory\n')
  const sock = path.join(dir, 's.sock')
  const server = net.createServer(s => s.once('data', () => reply(s)))
  await new Promise(r => server.listen(sock, r))
  const c = await new Promise((resolve, reject) => {
    const c = net.connect(sock, () => resolve(c))
    c.once('error', reject)
  })
  return { c, dir, close: () => server.close() }
}

test('a reply line resolves', async () => {
  const f = await fake(s => s.write('{"ok": true, "rate": 24000, "samples": 3}\n'))
  try {
    assert.deepEqual(await ask(f.c, { text: '你好' }, { timeout: 5000, dir: f.dir }), { ok: true, rate: 24000, samples: 3 })
  } finally {
    f.c.end()
    f.close()
  }
})

test('a server that dies before answering fails the request, with its log', async () => {
  const f = await fake(s => s.end())
  try {
    await assert.rejects(ask(f.c, { text: '你好' }, { timeout: 5000, dir: f.dir }), /stopped before it answered.*server\.log:\nloading\nRuntimeError: out of memory$/s)
  } finally {
    f.close()
  }
})

test('a reply that is not JSON fails the request', async () => {
  const f = await fake(s => s.write('Traceback (most recent call last)\n'))
  try {
    await assert.rejects(ask(f.c, { text: '你好' }, { timeout: 5000, dir: f.dir }), /answered something unreadable \(Traceback/)
  } finally {
    f.close()
  }
})

test('a server that never answers times out', async () => {
  const f = await fake(() => {})
  try {
    await assert.rejects(ask(f.c, { text: '你好' }, { timeout: 200, dir: f.dir }), /took over 0 s on one sentence/)
    assert.ok(f.c.destroyed)
  } finally {
    f.close()
  }
})

test("a server that exits as it starts fails at once, with its log", async () => {
  const dir = tmpDir()
  const python = path.join(dir, 'venv', 'bin', 'python')
  fs.mkdirSync(path.dirname(python), { recursive: true })
  fs.writeFileSync(python, '#!/bin/sh\necho "ModuleNotFoundError: No module named torch" >&2\nexit 1\n', { mode: 0o755 })
  const t0 = Date.now()
  await assert.rejects(speak(dir, '你好', { voice: 'female' }), /stopped while starting \(exit code 1\).*No module named torch/s)
  assert.ok(Date.now() - t0 < 10_000)
})
