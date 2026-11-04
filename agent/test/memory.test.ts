// The remember tool and the memory in the instructions, on a memory of
// its own (set before the engine module reads where it lives).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-memory-'))
process.env.SHOTLOOP_MEMORY = dir
after(() => fs.rmSync(dir, { recursive: true, force: true }))
const { memory } = await import('../src/enginelib.ts')
const { memoryPrompt } = await import('../src/prompts.ts')
const { newContext, runTool } = await import('../src/tools.ts')

test('remember: a lesson kept with the project it came from; the prompt lists it for its track only', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-tools-'))
  fs.writeFileSync(path.join(root, 'shotloop.json'), JSON.stringify({ title: 'Lift' }))
  try {
    // A build's agent keeps none: only a change the person asked for does
    const build = await runTool(newContext(root, '', []), 'remember', { text: 'A build slip', track: '2d', replaces: '' })
    assert.equal(build.isError, true)
    const out = await runTool({ ...newContext(root, '', []), learn: true }, 'remember', { text: 'Compute flows from a model', track: '2d', replaces: '' })
    assert.equal(out.isError, false)
    memory.add({ text: 'Plain words', by: 'ai', track: 'all', from: null, replaces: null })
    const kept = memory.list()
    assert.equal(kept[0].from, 'Lift')
    assert.match(memoryPrompt(kept, '2d', false), /\(2D\) Compute flows/)
    assert.doesNotMatch(memoryPrompt(kept, '3d', false), /Compute flows/)
    assert.match(memoryPrompt(kept, '3d', false), /Plain words/)
    assert.doesNotMatch(memoryPrompt(kept, '2d', false), /call remember/)
    assert.match(memoryPrompt(kept, '2d', true), /call remember/)
    assert.equal(memoryPrompt([], '2d', false), '')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
