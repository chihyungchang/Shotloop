// Model lists for the API presets, against a stand-in server: the
// Anthropic protocol's /v1/models with its headers, and an OpenAI-style
// /models with the non-chat models left out.

import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkContext, contextLength, MIN_CONTEXT, runLocal } from '../src/local.ts'
import { newContext } from '../src/tools.ts'
import { describe, isLoopback, listModels } from '../src/providers.ts'

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

// A streamed chat reply as server-sent events
const sse = (chunks: object[]) => chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
const delta = (d: object) => ({ choices: [{ index: 0, delta: d }] })

test('streamed reply: thinking (sent back with its turn), a tool call in pieces and the usage put back together; thinking off retried without reasoning_effort', async () => {
  const bodies: any[] = []
  const s = await serve((req, res) => {
    let body = ''
    req.on('data', d => (body += d))
    req.on('end', () => {
      const b = JSON.parse(body)
      bodies.push(b)
      // A server that doesn't know reasoning_effort refuses it
      if ('reasoning_effort' in b) {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: 'Unrecognized field: reasoning_effort' }))
      }
      res.setHeader('content-type', 'text/event-stream')
      const turn = bodies.filter(x => !('reasoning_effort' in x)).length
      res.end(turn === 1
        ? sse([
          delta({ reasoning_content: 'Let me ' }), delta({ reasoning_content: 'look.' }),
          delta({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'list_', arguments: '' } }] }),
          delta({ tool_calls: [{ index: 0, function: { name: 'files', arguments: '{"dir":' } }] }),
          delta({ tool_calls: [{ index: 0, function: { arguments: '"."}' } }] }),
          { choices: [], usage: { prompt_tokens: 100, completion_tokens: 9 } }
        ])
        : sse([delta({ content: 'All ' }), delta({ content: 'done.' })]))
    })
  })
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-stream-'))
  fs.writeFileSync(path.join(root, 'a.txt'), 'a')
  const ctx = newContext(root, path.join(root, 'checklist.md'), [])
  const meter = { input: 0, output: 0, thinking: 0, cacheRead: 0, cacheWrite: 0, cost: null, turns: 0, model: null } as any
  try {
    const reply = await runLocal({ url: `${s.url}/v1`, model: 'm' }, 'sys', 'go', ctx, { meter, think: false })
    assert.equal(reply, 'All done.')
    const sent = bodies.filter(b => !('reasoning_effort' in b))
    assert.equal(sent.length, 2)
    assert.deepEqual(sent[0].chat_template_kwargs, { enable_thinking: false })
    assert.equal(sent[0].stream, true)
    // The tool call went back whole, answered
    assert.deepEqual(sent[1].messages[2].tool_calls, [{ id: 'c1', type: 'function', function: { name: 'list_files', arguments: '{"dir":"."}' } }])
    // The thinking went back with its turn
    assert.equal(sent[1].messages[2].reasoning_content, 'Let me look.')
    assert.equal(sent[1].messages[3].role, 'tool')
    assert.match(sent[1].messages[3].content, /a\.txt/)
    assert.equal(meter.input, 100)
    assert.equal(meter.output, 9)
  } finally {
    s.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a CLI runs complex tasks and simple ones on their own models: its defaults, or the person\'s picks', () => {
  const saved = { ...process.env }
  try {
    Object.assign(process.env, { SHOTLOOP_PROVIDER: 'cli', SHOTLOOP_CLI: 'claude' })
    delete process.env.SHOTLOOP_MODEL
    delete process.env.SHOTLOOP_MODEL_SIMPLE
    assert.equal(describe(), 'Claude Code (opus / sonnet)')
    process.env.SHOTLOOP_MODEL_SIMPLE = 'opus'
    assert.equal(describe(), 'Claude Code (opus / opus)')
    Object.assign(process.env, { SHOTLOOP_CLI: 'codex', SHOTLOOP_MODEL: 'gpt-6.1-sol' })
    delete process.env.SHOTLOOP_MODEL_SIMPLE
    assert.equal(describe(), 'Codex CLI (gpt-6.1-sol / gpt-6.1-terra)')
  } finally {
    process.env = saved
  }
})
