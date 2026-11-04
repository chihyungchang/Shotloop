// Model lists for the API presets, against a stand-in server: the
// Anthropic protocol's /v1/models with its headers, and an OpenAI-style
// /models with the non-chat models left out.

import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { checkContext, contextLength, MIN_CONTEXT } from '../src/local.ts'
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

// A stand-in server answering only the given paths, 404 elsewhere
const answering = (routes: Record<string, unknown>) => serve((req, res) => {
  const body = routes[req.url ?? '']
  res.statusCode = body ? 200 : 404
  res.end(body ? JSON.stringify(body) : '')
})

test('context length: LM Studio, vLLM, llama.cpp and Ollama each say it their way', async () => {
  const cases: [Record<string, unknown>, number | null][] = [
    [{ '/api/v0/models': { data: [{ id: 'other', loaded_context_length: 999 }, { id: 'qwen/qwen3', loaded_context_length: 65533 }] } }, 65533],
    [{ '/v1/models': { data: [{ id: 'qwen/qwen3', max_model_len: 40960 }] } }, 40960],
    [{ '/props': { default_generation_settings: { n_ctx: 8192 } } }, 8192],
    [{ '/api/ps': { models: [{ name: 'qwen/qwen3', context_length: 4096 }] } }, 4096],
    // LM Studio lists a model it hasn't loaded yet without a window
    [{ '/api/v0/models': { data: [{ id: 'qwen/qwen3', state: 'not-loaded', max_context_length: 262144 }] } }, null]
  ]
  for (const [routes, want] of cases) {
    const s = await answering(routes)
    try {
      assert.equal(await contextLength({ url: `${s.url}/v1`, model: 'qwen/qwen3' }), want)
    } finally {
      s.close()
    }
  }
})

test('context check: a window known too small fails before the run, an unknown one passes', async () => {
  const small = await answering({ '/api/v0/models': { data: [{ id: 'm', loaded_context_length: 4096 }] } })
  const silent = await answering({})
  try {
    await assert.rejects(checkContext({ url: `${small.url}/v1`, model: 'm' }), new RegExp(`context length of 4096 tokens; Shotloop needs at least ${MIN_CONTEXT}`))
    assert.equal(await checkContext({ url: `${silent.url}/v1`, model: 'm' }), null)
  } finally {
    small.close()
    silent.close()
  }
})
