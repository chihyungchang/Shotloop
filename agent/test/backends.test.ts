// The other agent backends without the network: the MCP server local CLI
// agents use, and the OpenAI-compatible loop for local models, driven by
// a scripted stand-in for the chat API on a copy of the ep01 example.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXAMPLE = path.resolve(HERE, '..', '..', 'fixtures', 'ep01-password-crack-time')
const CHECKLIST = path.resolve(HERE, '..', '..', 'engine', 'shotloop', 'checklist.md')
const SHOT = '09-end-card-source'

function copyExample() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-backend-'))
  fs.cpSync(EXAMPLE, dir, { recursive: true, filter: src => !/\.shotloop|\/out(\/|$)/.test(src) })
  return dir
}

test('MCP server: the narrow tools only, scoped writes, session recorded', async () => {
  const project = copyExample()
  const session = path.join(project, 'session.json')
  const client = new Client({ name: 'test', version: '0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(HERE, '..', 'src', 'mcp.ts')],
    env: {
      ...process.env as Record<string, string>,
      SHOTLOOP_ROOT: project,
      SHOTLOOP_WRITABLE: `shots/${SHOT}/`,
      SHOTLOOP_CHECKLIST: CHECKLIST,
      SHOTLOOP_SESSION: session
    }
  }))
  try {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map(t => t.name),
      ['list_files', 'read_file', 'write_file', 'edit_file', 'render_stills', 'read_checklist', 'report_checks'])

    const read = await client.callTool({ name: 'read_file', arguments: { path: `shots/${SHOT}/shot.js` } })
    assert.match((read.content as any)[0].text, /export default function render/)

    const denied = await client.callTool({ name: 'write_file', arguments: { path: 'copy.md', content: 'x' } })
    assert.equal(denied.isError, true)
    assert.match((denied.content as any)[0].text, /not writable/)

    await client.callTool({ name: 'write_file', arguments: { path: `shots/${SHOT}/extra.txt`, content: 'ok' } })
    const stills = await client.callTool({ name: 'render_stills', arguments: { shot: SHOT } })
    assert.equal((stills.content as any[]).filter(b => b.type === 'image').length, 3)

    const recorded = JSON.parse(fs.readFileSync(session, 'utf8'))
    assert.deepEqual(recorded.touched, [`shots/${SHOT}/extra.txt`])
    assert.equal(recorded.renders[0][0], SHOT)
  } finally {
    await client.close()
    fs.rmSync(project, { recursive: true, force: true })
  }
})

// OpenAI-compatible chat API stand-in: one scripted assistant message
// per request
function mockChat(turns: any[]) {
  const requests: any[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', d => (body += d))
    req.on('end', () => {
      requests.push(JSON.parse(body))
      const message = turns[requests.length - 1] ?? { role: 'assistant', content: 'done' }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ choices: [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }))
    })
  })
  return new Promise<{ url: string; requests: any[]; close: () => void }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({ url: `http://127.0.0.1:${port}/v1`, requests, close: () => server.close() })
    })
  })
}

const call = (id: string, name: string, args: object) =>
  ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })

test('local model: OpenAI-compatible tool loop with stills as images', async () => {
  const project = copyExample()
  const code = `shots/${SHOT}/shot.js`
  const api = await mockChat([
    { role: 'assistant', content: null, tool_calls: [call('a', 'read_file', { path: code })] },
    { role: 'assistant', content: null, tool_calls: [call('b', 'edit_file', { path: code, old_string: 'world(start + t)', new_string: 'world(start + t) // local' })] },
    { role: 'assistant', content: null, tool_calls: [call('c', 'render_stills', { shot: SHOT })] },
    { role: 'assistant', content: null, tool_calls: [call('d', 'report_checks', { shot: SHOT, results: [{ rule: 'readable', pass: true, note: 'ok' }], summary: 'ok' })] },
    { role: 'assistant', content: 'Done locally.' }
  ])
  try {
    const out = await new Promise<string>(resolve => {
      const p = spawn(process.execPath, [path.resolve(HERE, '..', 'src', 'main.ts'), 'fix', project, '--shot', SHOT, '--request', 'tweak', '--json'], {
        env: { ...process.env, SHOTLOOP_PROVIDER: 'local', SHOTLOOP_LOCAL_URL: api.url, SHOTLOOP_LOCAL_MODEL: 'qwen2.5vl' },
        stdio: ['ignore', 'pipe', 'inherit']
      })
      let s = ''
      p.stdout.on('data', d => (s += d))
      p.on('close', () => resolve(s))
    })
    const events = out.split('\n').filter(Boolean).map(l => JSON.parse(l))
    const result = events.find(e => e.type === 'result')?.value
    assert.ok(result, JSON.stringify(events.filter(e => e.type === 'error')))
    assert.equal(result.summary, 'Done locally.')
    assert.deepEqual(result.touched, [code])
    assert.equal(api.requests[0].model, 'qwen2.5vl')
    assert.equal(api.requests[0].tools.length, 7)
    // After render_stills: a tool message, then the stills as image parts
    const afterRender = api.requests[3].messages
    assert.equal(afterRender.at(-2).role, 'tool')
    assert.equal(afterRender.at(-1).content.filter((p: any) => p.type === 'image_url').length, 3)
  } finally {
    api.close()
    fs.rmSync(project, { recursive: true, force: true })
  }
})
