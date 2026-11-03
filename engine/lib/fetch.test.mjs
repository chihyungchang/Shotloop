import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mock, test } from 'node:test'
import { download } from './fetch.mjs'

// A local server answering every request with handle(req, res)
async function serve(handle) {
  const server = http.createServer(handle)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${server.address().port}/model.onnx`, close: () => server.closeAllConnections() || server.close() }
}

const file = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-fetch-test-')), 'model.onnx')

test('a file arrives whole and checked', async () => {
  const s = await serve((req, res) => res.end('hello'))
  try {
    const to = file()
    let got = 0
    await download(s.url, to, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', n => (got += n))
    assert.equal(fs.readFileSync(to, 'utf8'), 'hello')
    assert.equal(got, 5)
    await assert.rejects(download(s.url, to, '0'.repeat(64), () => {}), /SHA-256 2cf24d.*, expected 0000/)
  } finally {
    s.close()
  }
})

test('an error status fails with it', async () => {
  const s = await serve((req, res) => {
    res.statusCode = 404
    res.end('not here')
  })
  try {
    await assert.rejects(download(s.url, file(), null, () => {}), /model\.onnx: HTTP 404$/)
  } finally {
    s.close()
  }
})

test('a server that never answers is a stalled download', async t => {
  const s = await serve(() => {})
  t.after(() => s.close())
  mock.timers.enable({ apis: ['setTimeout'] })
  t.after(() => mock.timers.reset())
  const p = download(s.url, file(), null, () => {})
  mock.timers.tick(60_000)
  await assert.rejects(p, /^Error: model\.onnx: the download stalled; check the connection and try again$/)
})
