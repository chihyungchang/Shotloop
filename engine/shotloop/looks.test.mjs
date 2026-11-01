// A look's page shaded by the planner (storyboard.json lookTune): its
// accents and ground change, a malformed value is dropped, and the page
// is still known as the look's own
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookPage, untouchedLook } from './looks.mjs'

const SIZE = { width: 1080, height: 1920 }

test('lookTune shades the accents and the ground, and nothing malformed passes', () => {
  const page = lookPage('midnight', SIZE, 'infographic', { accent: '#ff5500', bg: 'linear-gradient(180deg, #101010, #202040)', accent2: 'red; }', accent3: '#12' })
  assert.match(page, /--accent: #ff5500/)
  assert.match(page, /linear-gradient\(180deg, #101010, #202040\)/)
  assert.doesNotMatch(page, /red; \}/)
  assert.equal(lookPage('midnight', SIZE, 'infographic').match(/--accent2: (#\w+)/)[1], page.match(/--accent2: (#\w+)/)[1])
  assert.ok(untouchedLook(page))
})
