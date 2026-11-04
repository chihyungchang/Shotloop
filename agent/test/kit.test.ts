// The engine's kit in a project's world is read as its interface: what
// each piece is and takes, never the code behind it
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const { newContext, runTool } = await import('../src/tools.ts')

test('read_file: a kit file gives its pieces and their parameters, not its code; a shot gives its code', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-kit-'))
  try {
    fs.mkdirSync(path.join(root, 'world', 'screens'), { recursive: true })
    fs.mkdirSync(path.join(root, 'shots', '01-a'), { recursive: true })
    fs.writeFileSync(path.join(root, 'world', 'screens', 'act.js'), `// world/screens/act.js: an action on the product.
import { n } from './base.js'

// One action, step by step
export function act(t, { box, steps }) {
  return n(t) // the body
}
`)
    fs.writeFileSync(path.join(root, 'shots', '01-a', 'shot.js'), 'export default function render() { /* the shot */ }\n')
    const kit = await runTool(newContext(root, '', []), 'read_file', { path: 'world/screens/act.js' })
    assert.equal(kit.isError, false)
    const said = kit.text.join("\n")
    assert.match(said, /act\(t, \{ box, steps \}\): One action, step by step/)
    assert.doesNotMatch(said, /the body/)
    const shot = await runTool(newContext(root, '', []), 'read_file', { path: 'shots/01-a/shot.js' })
    assert.match(shot.text.join("\n"), /the shot/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
