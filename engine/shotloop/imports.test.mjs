// The engine's import graph: no module imports itself through others
// (a cycle leaves one side half-initialized at load), and data.mjs, which
// the app's browser bundle imports, reaches no Node module.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const ENGINE = path.resolve(import.meta.dirname, '..')
const IMPORT = /^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm

// Each module's static imports: relative ones as absolute paths, the rest
// (node:…) as they are written
function importsOf(file) {
  const out = []
  for (const m of fs.readFileSync(file, 'utf8').matchAll(IMPORT)) {
    const spec = m[1] ?? m[2]
    out.push(spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : spec)
  }
  return out
}

const modules = ['shotloop', 'lib'].flatMap(d => fs.readdirSync(path.join(ENGINE, d))
  .filter(f => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map(f => path.join(ENGINE, d, f)))
const graph = new Map(modules.map(f => [f, importsOf(f)]))

test('engine modules import each other without cycles', () => {
  const done = new Set()
  const visit = (file, trail) => {
    if (trail.includes(file)) {
      const cycle = [...trail.slice(trail.indexOf(file)), file].map(f => path.relative(ENGINE, f))
      assert.fail(`import cycle: ${cycle.join(' → ')}`)
    }
    if (done.has(file) || !graph.has(file)) return
    for (const dep of graph.get(file)) visit(dep, [...trail, file])
    done.add(file)
  }
  for (const file of modules) visit(file, [])
})

test('data.mjs reaches no Node module', () => {
  const seen = new Set()
  const walk = file => {
    if (seen.has(file)) return
    seen.add(file)
    for (const dep of graph.get(file) ?? importsOf(file)) {
      assert.ok(path.isAbsolute(dep), `${path.relative(ENGINE, file)} imports ${dep}`)
      walk(dep)
    }
  }
  walk(path.join(ENGINE, 'shotloop', 'data.mjs'))
})
