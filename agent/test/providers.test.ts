// Model lists for the API presets, against a stand-in server: the
// Anthropic protocol's /v1/models with its headers, and an OpenAI-style
// /models with the non-chat models left out.

import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { isLoopback, listModels } from '../src/providers.ts'

async function serve(handler: http.RequestListener) {
  const server = http.createServer(handler)
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() }
}

test('anthropic protocol: GET /v1/models with x-api-key and a version', async () => {
  let seen: http.IncomingHttpHeaders = {}
  let path = ''
  const s = await serve((req, res) => {
    seen = req.headers
    path = req.url ?? ''
    res.end(JSON.stringify({ data: [{ id: 'MiniMax-M2.7' }, { id: 'MiniMax-M2.5' }] }))
  })
  try {
    assert.deepEqual(await listModels(`${s.url}/anthropic`, 'k-1', 'anthropic'), ['MiniMax-M2.5', 'MiniMax-M2.7'])
    assert.equal(path, '/anthropic/v1/models?limit=1000')
    assert.equal(seen['x-api-key'], 'k-1')
    assert.equal(seen['anthropic-version'], '2023-06-01')
  } finally {
    s.close()
  }
})

test('openai protocol: chat models only, Gemini prefixes dropped', async () => {
  const s = await serve((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer k-2')
    res.end(JSON.stringify({ data: ['models/gemini-3.5-flash', 'text-embedding-3-small', 'whisper-1', 'gpt-5.5', 'tts-1', 'dall-e-3'].map(id => ({ id })) }))
  })
  try {
    assert.deepEqual(await listModels(`${s.url}/v1`, 'k-2'), ['gemini-3.5-flash', 'gpt-5.5'])
  } finally {
    s.close()
  }
})

test('loopback servers need no key', () => {
  assert.ok(isLoopback('http://localhost:11434/v1'))
  assert.ok(isLoopback('http://127.0.0.1:8000/v1'))
  assert.ok(!isLoopback('https://api.deepseek.com'))
})
