// One tool output, mapped by each API backend: images after their labels,
// failures flagged, text alone kept as text.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toToolMessage } from '../src/local.ts'
import { toToolResult } from '../src/loop.ts'
import type { ToolOutput } from '../src/tools.ts'

const stills: ToolOutput = {
  text: ['Subtitle check: clear.'],
  images: [
    { mediaType: 'image/png', data: 'AAA', label: 'start frame' },
    { mediaType: 'image/jpeg', data: 'BBB' }
  ],
  isError: false
}
const failed: ToolOutput = { text: ['copy.md is not writable'], images: [], isError: true }

test('anthropic: text, then each image after its label; a failure is is_error', () => {
  const r = toToolResult('t1', stills)
  assert.deepEqual(r.content, [
    { type: 'text', text: 'Subtitle check: clear.' },
    { type: 'text', text: 'start frame:' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BBB' } }
  ])
  assert.equal(r.is_error, undefined)
  assert.deepEqual(toToolResult('t2', failed), { type: 'tool_result', tool_use_id: 't2', content: 'copy.md is not writable', is_error: true })
})

test('openai: text in the tool message, images per call after the tool name and label', () => {
  const call = { id: 'c1', type: 'function' as const, function: { name: 'render_stills', arguments: '{}' } }
  const { message, images } = toToolMessage(call, stills)
  assert.deepEqual(message, { role: 'tool', tool_call_id: 'c1', content: 'Subtitle check: clear. (the images follow)' })
  assert.deepEqual(images, [
    { type: 'text', text: 'render_stills (c1) start frame:' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
    { type: 'text', text: 'render_stills (c1) image 2:' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } }
  ])
  const err = toToolMessage({ ...call, id: 'c2' }, failed)
  assert.deepEqual(err, { message: { role: 'tool', tool_call_id: 'c2', content: 'Error: copy.md is not writable' }, images: [] })
})
