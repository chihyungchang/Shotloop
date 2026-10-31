// Gathers what Shotloop.app carries as resources, so it runs without the
// repository: the engine (only the parts it loads), the agent with its
// production dependencies, and the example projects. Output:
// src-tauri/bundle-resources/{engine,agent,examples}, laid out as in the
// repository, so the relative paths between them still hold.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { MODES, shotKey } from '../../engine/shotloop/cache.mjs'
import { loadProject } from '../../engine/shotloop/project.mjs'

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

// The examples ship with their current frames only, so they play at once:
// older renders, fix records, previews of the whole film and the music,
// and each shot's preview with music (all made again in a moment) stay
// behind. Takes name files by absolute
// path on this machine, so they go too; the current entries are found
// by their keys.
for (const name of fs.readdirSync(path.join(OUT, 'examples'))) {
  const root = path.join(OUT, 'examples', name)
  const state = path.join(root, '.shotloop')
  if (!fs.existsSync(path.join(root, 'shotloop.json')) || !fs.existsSync(state)) continue
  const project = loadProject(root)
  for (const d of ['film', 'music', 'screen']) fs.rmSync(path.join(state, d), { recursive: true, force: true })
  const shots = path.join(state, 'shots')
  for (const id of fs.existsSync(shots) ? fs.readdirSync(shots) : []) {
    const shot = project.shots.find(s => s.id === id)
    const dir = path.join(shots, id)
    if (!shot) {
      fs.rmSync(dir, { recursive: true, force: true })
      continue
    }
    const keep = new Set(MODES.map(m => `${m}-${shotKey(project, shot, m)}`))
    for (const e of fs.readdirSync(dir)) {
      if (!keep.has(e) && e !== 'checks.json') fs.rmSync(path.join(dir, e), { recursive: true, force: true })
      // Frames of renders that were cut short, and the shot with music
      else if (keep.has(e)) {
        for (const w of fs.readdirSync(path.join(dir, e))) {
          if (w.startsWith('work-') || /^preview-.*\.mp4$/.test(w)) fs.rmSync(path.join(dir, e, w), { recursive: true, force: true })
        }
      }
    }
    fs.writeFileSync(path.join(dir, 'takes.json'), '[]\n')
  }
}

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
