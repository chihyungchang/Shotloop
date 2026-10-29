// Gathers what Shotloop.app carries as resources, so it runs without the
// repository: the engine (only the parts it loads), the agent with its
// production dependencies, and the example projects. Output:
// src-tauri/bundle-resources/{engine,agent,examples}, laid out as in the
// repository, so the relative paths between them still hold.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const REPO = path.resolve(import.meta.dirname, '..', '..')
const OUT = path.join(import.meta.dirname, '..', 'src-tauri', 'bundle-resources')

// Engine files the CLI imports or reads (see engine/shotloop/cache.mjs)
const ENGINE = [
  'engine/shotloop',
  'engine/lib',
  'engine/video/music.mjs',
  'engine/video/explainers/3d/lib',
  'engine/video/assets/README.md'
]
// Never shipped: renders, exports and OS litter
const SKIP = new Set(['out', '.DS_Store', '__pycache__', 'node_modules'])

const copy = (from, to) =>
  fs.cpSync(from, to, { recursive: true, filter: src => !SKIP.has(path.basename(src)) })

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

for (const rel of ENGINE) copy(path.join(REPO, rel), path.join(OUT, rel))
copy(path.join(REPO, 'examples'), path.join(OUT, 'examples'))

// The agent runs its TypeScript directly; its dependencies are deployed
// flat (no symlinks, which app bundles do not keep). pnpm needs the
// deploy folder on the repository's volume.
const tmp = path.join(OUT, '.agent-deploy')
try {
  execFileSync('pnpm', ['--filter', '@shotloop/agent', 'deploy', '--legacy', '--prod', '--config.node-linker=hoisted', tmp], {
    cwd: REPO,
    stdio: ['ignore', 'ignore', 'inherit']
  })
  const agent = path.join(OUT, 'agent')
  fs.mkdirSync(agent)
  for (const f of ['package.json', 'src', 'node_modules']) fs.cpSync(path.join(tmp, f), path.join(agent, f), { recursive: true })
  fs.rmSync(path.join(agent, 'node_modules', '.bin'), { recursive: true, force: true })
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

const size = execFileSync('du', ['-sh', OUT], { encoding: 'utf8' }).split('\t')[0]
console.log(`resources: engine, agent, examples → ${path.relative(REPO, OUT)} (${size})`)
