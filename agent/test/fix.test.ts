// End-to-end test of the fix flow without the network: a scripted stand-in
// for the Messages API drives the real loop, tools and engine renders on a
// copy of the ep01 example (2D, renders in seconds).
//
//   node --test test/

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXAMPLE = path.resolve(HERE, '..', '..', 'examples', 'ep01-password-crack-time')
const MAIN = path.resolve(HERE, '..', 'src', 'main.ts')
const SHOT = '09-end-card-source'

type Block = Record<string, unknown>

// One scripted assistant turn per request; records what the client sent
function mockApi(turns: Block[][]) {
  const requests: any[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', d => (body += d))
    req.on('end', () => {
      const parsed = JSON.parse(body)
      requests.push(parsed)
      const content = turns[requests.length - 1] ?? [{ type: 'text', text: 'done' }]
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        id: `msg_${requests.length}`,
        type: 'message',
        role: 'assistant',
        model: parsed.model,
        content,
        stop_reason: content.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }
      }))
    })
  })
  return new Promise<{ url: string; requests: any[]; close: () => void }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({ url: `http://127.0.0.1:${port}`, requests, close: () => server.close() })
    })
  })
}

function runAgent(args: string[], baseURL: string) {
  return new Promise<{ code: number; events: any[] }>(resolve => {
    const p = spawn(process.execPath, [MAIN, ...args, '--json'], {
      env: { ...process.env, ANTHROPIC_API_KEY: 'test', ANTHROPIC_BASE_URL: baseURL },
      stdio: ['ignore', 'pipe', 'inherit']
    })
    let out = ''
    p.stdout.on('data', d => (out += d))
    p.on('close', code => resolve({
      code: code ?? 1,
      events: out.split('\n').filter(Boolean).map(l => JSON.parse(l))
    }))
  })
}

const use = (id: string, name: string, input: Block) => ({ type: 'tool_use', id, name, input })

test('fix: reads, edits only the shot, renders, reports checks, keeps before/after', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-agent-'))
  fs.cpSync(EXAMPLE, project, { recursive: true, filter: src => !/\.shotloop|\/out(\/|$)/.test(src) })
  const code = `shots/${SHOT}/shot.js`
  const original = fs.readFileSync(path.join(project, code), 'utf8')

  const api = await mockApi([
    [use('t1', 'read_file', { path: code }), use('t2', 'read_checklist', {})],
    [
      // Outside the project and in the cache: both refused
      use('t3', 'read_file', { path: '../../etc/hosts' }),
      use('t4', 'write_file', { path: 'copy.md', content: 'nope' })
    ],
    [use('t5', 'edit_file', {
      path: code,
      old_string: 'world(start + t)',
      new_string: 'world(start + t)\n  document.getElementById("follow").style.opacity = 1'
    })],
    [use('t6', 'render_stills', { shot: SHOT })],
    [use('t7', 'report_checks', {
      shot: SHOT,
      results: [{ rule: 'safe-area', pass: true, note: 'Text inside the safe area.' }],
      summary: 'The follow line now shows from the first frame.'
    })],
    [{ type: 'text', text: 'Made the follow line visible from the start of the end card.' }]
  ])
  try {
    const { code: exit, events } = await runAgent(
      ['fix', project, '--shot', SHOT, '--request', 'show "Follow for more" from the start'], api.url)
    assert.equal(exit, 0, JSON.stringify(events.filter(e => e.type === 'error')))
    const result = events.find(e => e.type === 'result').value

    // The request carries the stable system prompt, the narrow tools and the fallback
    const first = api.requests[0]
    assert.equal(first.model, 'claude-opus-5-5')
    assert.deepEqual(first.tools.map((t: any) => t.name),
      ['list_files', 'read_file', 'write_file', 'edit_file', 'render_stills', 'read_checklist', 'report_checks'])
    assert.equal(first.fallbacks, 'default')

    // Refusals came back as tool errors, and nothing outside the shot changed
    const refusals = api.requests[2].messages.at(-1).content
    assert.ok(refusals.every((r: any) => r.is_error))
    assert.match(refusals[0].content, /outside the project/)
    assert.match(refusals[1].content, /not writable/)
    assert.deepEqual(result.touched, [code])
    assert.equal(result.worldTouched, false)
    assert.deepEqual(result.affectedShots, [SHOT])
    assert.notEqual(fs.readFileSync(path.join(project, code), 'utf8'), original)

    // The render came back to the model as three images
    const images = api.requests[4].messages.at(-1).content[0].content.filter((b: any) => b.type === 'image')
    assert.equal(images.length, 3)

    // Before/after stills, checks and review history are on disk
    assert.equal(result.before.length, 3)
    assert.equal(result.after.length, 3)
    for (const f of [...result.before, ...result.after]) assert.ok(fs.existsSync(f))
    const checks = JSON.parse(fs.readFileSync(path.join(project, '.shotloop', 'shots', SHOT, 'checks.json'), 'utf8'))
    assert.equal(checks.results[0].rule, 'safe-area')
    assert.match(fs.readFileSync(path.join(project, 'shots', SHOT, 'notes.md'), 'utf8'), /fix "show "Follow for more"/)
    assert.equal(result.summary, 'Made the follow line visible from the start of the end card.')
  } finally {
    api.close()
    fs.rmSync(project, { recursive: true, force: true })
  }
})
