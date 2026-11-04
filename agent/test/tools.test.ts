// The tools' boundaries on a scratch project: links out of it, the cache
// folder in another case, writes that never leave half a file, and a
// shot's latest review replacing the one before.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { loadSession, newContext, runTool, saveSession, writeAtomic } from '../src/tools.ts'

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-tools-'))
  fs.mkdirSync(path.join(root, 'shots', '01-a'), { recursive: true })
  return root
}

test('resolve: a symlink out of the project is refused, for reading and writing', async () => {
  const root = scratch()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-outside-'))
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret')
  fs.symlinkSync(outside, path.join(root, 'shots', '01-a', 'link'))
  fs.symlinkSync(path.join(outside, 'gone.txt'), path.join(root, 'shots', '01-a', 'dangling.js'))
  const ctx = newContext(root, '', ['shots/01-a/'])
  try {
    const read = await runTool(ctx, 'read_file', { path: 'shots/01-a/link/secret.txt' })
    assert.equal(read.isError, true)
    assert.match(read.text[0], /outside the project/)
    const write = await runTool(ctx, 'write_file', { path: 'shots/01-a/link/new.txt', content: 'x' })
    assert.equal(write.isError, true)
    assert.ok(!fs.existsSync(path.join(outside, 'new.txt')))
    const dangling = await runTool(ctx, 'write_file', { path: 'shots/01-a/dangling.js', content: 'x' })
    assert.match(dangling.text[0], /broken link/)
    assert.ok(!fs.existsSync(path.join(outside, 'gone.txt')))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})

test('resolve: the cache folder is hidden in any case', async () => {
  const root = scratch()
  const ctx = newContext(root, '', ['.Shotloop/'])
  try {
    for (const p of ['.Shotloop/x.json', '.SHOTLOOP/x.json', 'OUT/a.mp4']) {
      const r = await runTool(ctx, 'write_file', { path: p, content: 'x' })
      assert.match(r.text[0], /managed by Shotloop/, p)
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('writeAtomic: the content in place, no temporary file left', () => {
  const root = scratch()
  try {
    const file = path.join(root, 'a.json')
    writeAtomic(file, 'one')
    writeAtomic(file, 'two')
    assert.equal(fs.readFileSync(file, 'utf8'), 'two')
    assert.deepEqual(fs.readdirSync(root).sort(), ['a.json', 'shots'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('report_checks: a shot reviewed twice keeps its latest review, through the session too', async () => {
  const root = scratch()
  const ctx = newContext(root, '', [])
  const report = (pass: boolean) => runTool(ctx, 'report_checks', { shot: '01-a', results: [{ rule: 'motion', pass, note: '' }], summary: String(pass) })
  try {
    await report(false)
    await report(true)
    assert.equal(ctx.checks.length, 1)
    assert.equal(ctx.checks[0].results[0].pass, true)

    const session = path.join(root, 'session.json')
    saveSession(ctx, session)
    const parent = newContext(root, '', [])
    parent.checks.push({ shot: '01-a', results: [], summary: 'older' })
    loadSession(parent, session)
    assert.deepEqual(parent.checks.map(c => c.summary), ['true'])

    // A corrupt session is reported and leaves the context as it was
    fs.writeFileSync(session, '{"touched": [')
    loadSession(parent, session)
    assert.equal(parent.checks.length, 1)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('read_page records the page read; a fact sourced to it passes, one from memory or unread does not', async () => {
  const http = await import('node:http')
  const { lintSources } = await import('../src/principles.ts')
  const words = 'Thrust vectoring turns the engine\'s push to steer the craft. '.repeat(10)
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<html><head><title>Thrust</title><script>x()</script></head><body><nav>menu</nav><article><h1>Thrust</h1><p>${words}</p></article></body></html>`)
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/wiki/Thrust`
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-page-'))
  try {
    const ctx = newContext(root, '', [])
    const out = await runTool(ctx, 'read_page', { url, find: '' })
    assert.equal(out.isError, false)
    assert.match(out.text[0], /^Thrust\n/)
    assert.match(out.text[0], /turns the engine's push/)
    assert.doesNotMatch(out.text[0], /menu|x\(\)/)
    const unsourced = lintSources([
      { text: 'Read', source: `Wikipedia, ${url}/.` },
      { text: 'Remembered', source: 'Jetson official specifications' },
      { text: 'Unread', source: 'https://example.com/specs' }
    ], ctx.pages)
    assert.deepEqual(unsourced.map(f => f.text), ['Remembered', 'Unread'])
  } finally {
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})
