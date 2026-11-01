// The CLI backend against a stand-in `claude` on PATH: the flags it is
// started with, and what a failed run says.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { runCli } from '../src/cli.ts'
import type { ToolContext } from '../src/tools.ts'

// A fake claude that records its arguments, prints `stderr` and exits with `code`
function fakeClaude(stderr: string, code: number) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-cli-'))
  const args = path.join(dir, 'args.txt')
  fs.writeFileSync(path.join(dir, 'claude'), `#!/bin/sh\nprintf '%s\\n' "$@" > '${args}'\nprintf '${stderr}' >&2\nexit ${code}\n`, { mode: 0o755 })
  return { dir, args }
}

async function withPath<T>(dir: string, f: () => Promise<T>) {
  const before = process.env.PATH
  process.env.PATH = `${dir}:${before}`
  try {
    return await f()
  } finally {
    process.env.PATH = before
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const ctx = (): ToolContext => ({ root: os.tmpdir(), checklist: '', writable: [], touched: new Set(), renders: new Map(), checks: [] })

test('cli: a failed run with no stderr says how it exited, and the turn limit reaches Claude Code', async () => {
  const fake = fakeClaude('', 3)
  let args: string[] = []
  await withPath(fake.dir, async () => {
    await assert.rejects(runCli('claude', { system: 's', prompt: 'p', ctx: ctx(), maxTurns: 7 }), { message: 'Claude Code: exited 3' })
    args = fs.readFileSync(fake.args, 'utf8').split('\n')
  })
  assert.equal(args[args.indexOf('--max-turns') + 1], '7')
})

test('cli: a failed run says the last line of its stderr', async () => {
  const fake = fakeClaude('starting\\nboom\\n', 1)
  await withPath(fake.dir, () =>
    assert.rejects(runCli('claude', { system: 's', prompt: 'p', ctx: ctx(), maxTurns: 7 }), { message: 'Claude Code: boom' }))
})
