#!/usr/bin/env node
// Shotloop agent sidecar (docs/PRD.md §7.5, §7.6, §7.10).
//
//   shotloop-agent fix     <project> --shot <id> --request "the cable is hidden"
//   shotloop-agent check   <project> --shot <id> [--review-only]
//   shotloop-agent publish <project>
//   shotloop-agent detect                     CLI agents and local model servers here
//   shotloop-agent models  --url <…/v1>       the models a local server offers
//
// --json prints one JSON event per line for the app. The model backend
// (Anthropic API, a local CLI agent or a local model) comes from the
// environment: see providers.ts.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { renderStills, status, type ProjectStatus, type ShotStatus } from './engine.ts'
import { emit, setJson } from './events.ts'
import { describe, detect, listModels, preflight, runAgent } from './providers.ts'
import { checkSystem, fixSystem, publishSystem, replyLanguage } from './prompts.ts'
import type { ToolContext } from './tools.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    shot: { type: 'string' },
    request: { type: 'string' },
    model: { type: 'string' },
    'review-only': { type: 'boolean' },
    lang: { type: 'string' },
    url: { type: 'string' },
    key: { type: 'string' },
    json: { type: 'boolean' }
  }
})
setJson(!!values.json)
// --model picks the model of the chosen backend (see providers.ts)
if (values.model) process.env.SHOTLOOP_MODEL = values.model
const [task, dir] = positionals

const STILLS = ['start', 'middle', 'end']
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const today = () => new Date().toISOString().slice(0, 10)

function checklistPath(root: string) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'shotloop.json'), 'utf8'))
  const own = cfg.checklist && path.join(root, cfg.checklist)
  if (own && fs.existsSync(own)) return own
  return fileURLToPath(new URL('../../engine/shotloop/checklist.md', import.meta.url))
}

function context(root: string, writable: string[]): ToolContext {
  return { root, checklist: checklistPath(root), writable, touched: new Set(), renders: new Map(), checks: [] }
}

const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '(missing)')

function shotBrief(project: ProjectStatus, shot: ShotStatus) {
  const rel = (f: string) => path.relative(project.root, f)
  const others = project.shots.map(s => `${s.id} (${s.start}–${s.start + s.duration} s)${s.id === shot.id ? ' ← this shot' : ''}`)
  return `Project: "${project.title}", ${project.track.toUpperCase()} track, ${project.duration} s.
Shots: ${others.join(', ')}.

Shot ${shot.id}: film time ${shot.start}–${shot.start + shot.duration} s, ${shot.duration} s long.

${rel(shot.notes)}:
${read(shot.notes)}

${rel(shot.code)}:
${read(shot.code)}`
}

// Copies stills into the fix record, so before/after survive later renders
function keepStills(files: string[] | null | undefined, dir: string, prefix: string) {
  if (!files) return null
  fs.mkdirSync(dir, { recursive: true })
  return files.map((f, i) => {
    const out = path.join(dir, `${prefix}-${STILLS[i]}.png`)
    fs.copyFileSync(f, out)
    return out
  })
}

function saveChecks(project: ProjectStatus, ctx: ToolContext) {
  for (const c of ctx.checks) {
    const file = path.join(project.root, '.shotloop', 'shots', c.shot, 'checks.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...c }, null, 2) + '\n')
  }
}

function appendHistory(shot: ShotStatus, line: string) {
  if (!fs.existsSync(shot.notes)) return
  let text = fs.readFileSync(shot.notes, 'utf8')
  if (!/^## Review history/m.test(text)) text = `${text.trimEnd()}\n\n## Review history\n`
  fs.writeFileSync(shot.notes, `${text.trimEnd()}\n- ${today()}: ${line}\n`)
}

async function shotTask(kind: 'fix' | 'check') {
  if (!values.shot) throw new Error(`${kind} needs --shot <id>`)
  if (kind === 'fix' && !values.request?.trim()) throw new Error('fix needs --request "what is wrong"')
  const project = await status(dir)
  const shot = project.shots.find(s => s.id === values.shot)
  if (!shot) throw new Error(`no shot ${values.shot}`)

  const reviewOnly = kind === 'check' && !!values['review-only']
  const record = path.join(project.root, '.shotloop', 'shots', shot.id, 'fixes', stamp())
  // The before stills: the current draft stills, rendered if needed
  const current = shot.draft.stills ?? (await renderStills(project.root, shot.id)).stills
  const before = keepStills(current, record, 'before')

  const ctx = context(project.root, reviewOnly ? [] : [`shots/${shot.id}/`, 'world/', 'captions.html'])
  const ask = kind === 'fix'
    ? `The person says about shot ${shot.id}: "${values.request}"\n\nFix it, then check the shot.`
    : reviewOnly
      ? `Review shot ${shot.id} against the checklist and report. Do not edit files.`
      : `Check shot ${shot.id} against the checklist. Fix what you can, then report the rest.`
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent(kind === 'fix' ? 'code' : 'routine', {
    effort: kind === 'fix' ? 'high' : 'medium',
    system: (kind === 'fix' ? fixSystem() : checkSystem()) + replyLanguage(values.lang),
    prompt: `${ask}\n\n${shotBrief(project, shot)}`,
    ctx
  })

  // The after stills: the agent's last render of the shot
  const afterFiles = ctx.renders.get(shot.id) ?? (ctx.touched.size ? (await renderStills(project.root, shot.id)).stills : current)
  const after = keepStills(afterFiles, record, 'after')
  const touched = [...ctx.touched].sort()
  const worldTouched = touched.some(f => f.startsWith('world/') || f === 'captions.html')
  const result = {
    at: new Date().toISOString(),
    task: kind,
    shot: shot.id,
    request: values.request ?? null,
    summary,
    touched,
    worldTouched,
    // v1: a world change re-renders every shot (docs/PRD.md §8)
    affectedShots: worldTouched ? project.shots.map(s => s.id) : touched.length ? [shot.id] : [],
    checks: ctx.checks,
    before,
    after,
    record
  }
  fs.writeFileSync(path.join(record, 'fix.json'), JSON.stringify(result, null, 2) + '\n')
  saveChecks(project, ctx)
  const failed = ctx.checks.find(c => c.shot === shot.id)?.results.filter(r => !r.pass).map(r => r.rule) ?? []
  appendHistory(shot, kind === 'fix'
    ? `fix "${values.request}"${touched.length ? ` (changed ${touched.join(', ')})` : ''}${failed.length ? `; still failing: ${failed.join(', ')}` : ''}`
    : `check${failed.length ? `: failing ${failed.join(', ')}` : ': all rules pass'}`)
  return result
}

async function publishTask() {
  const project = await status(dir)
  const ctx = context(project.root, ['publish.md'])
  const docs = ['copy.md', 'script.md', 'publish.md']
    .map(f => `${f}:\n${read(path.join(project.root, f))}`)
    .join('\n\n')
  const summary = await runAgent('code', {
    effort: 'high',
    system: publishSystem(),
    prompt: `Write publish.md for "${project.title}" (${project.duration} s, ${project.track.toUpperCase()}).\n\n${docs}`,
    ctx
  })
  return { task: 'publish', summary, touched: [...ctx.touched], file: path.join(project.root, 'publish.md') }
}

try {
  let value: unknown
  if (task === 'detect') value = await detect()
  else if (task === 'models') {
    if (!values.url) throw new Error('models needs --url <base URL>')
    value = await listModels(values.url, values.key)
  } else {
    if (!dir || !['fix', 'check', 'publish'].includes(task)) {
      console.error('usage: shotloop-agent fix|check|publish <project> [--shot <id>] [--request "…"] [--json] | detect | models --url <…>')
      process.exit(1)
    }
    preflight()
    value = task === 'publish' ? await publishTask() : await shotTask(task as 'fix' | 'check')
  }
  emit({ type: 'result', value })
} catch (err) {
  emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  process.exit(1)
}
