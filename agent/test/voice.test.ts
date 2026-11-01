import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lintVoice } from '../src/principles.ts'

test('a voiced plan: lines present, short, and the screen text a label', () => {
  const ok = [
    { title: 'Hook', duration: 4, say: 'What if you got one percent better every day?', text: '1.01³⁶⁵' },
    { title: 'End', duration: 2.5, say: '', text: '' }
  ]
  assert.deepEqual(lintVoice(ok), [])
  const bad = [
    { title: 'Hook', duration: 2, say: 'What if you got one percent better every single day, for a whole year, and kept it up through every week and every month of it without a single break, even on the days when nothing seemed to change?', text: 'What if you got one percent better every day?' },
    { title: 'Beat', duration: 4, say: '', text: '' },
    { title: 'End', duration: 2, say: '' }
  ]
  const issues = lintVoice(bad)
  assert.ok(issues.some(i => i.includes('too long')))
  assert.ok(issues.some(i => i.includes('short for its line')))
  assert.ok(issues.some(i => i.includes('on-screen text')))
  assert.ok(issues.some(i => i.startsWith('shot 2') && i.includes('no spoken line')))
  assert.ok(!issues.some(i => i.startsWith('shot 3')))
})
