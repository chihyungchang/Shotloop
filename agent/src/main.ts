#!/usr/bin/env node
// Shotloop agent sidecar (docs/PRD.md §7.5, §7.6, §7.10).
//
//   shotloop-agent fix     <project> --shot <id> --request "the cable is hidden"
//   shotloop-agent check   <project> --shot <id> [--review-only]
//   shotloop-agent publish <project>
//   shotloop-agent detect                     CLI agents and local model servers here
//   shotloop-agent test                       one tiny request through the chosen backend
//   shotloop-agent plan    <project> [--request "…"]  copy and storyboard (storyboard.json)
//   shotloop-agent build   <project>             the world and every shot, from the plan
//   shotloop-agent models  --url <…> [--key k] [--protocol anthropic|openai]
//                                             the chat models an endpoint offers
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
import { describe, detect, listModels, preflight, runAgent, smokeTest } from './providers.ts'
import { buildSystem, checkSystem, fixSystem, planSystem, postLanguage, publishSystem, replyLanguage } from './prompts.ts'
import type { ToolContext } from './tools.ts'

const OPTIONS = {
    shot: { type: 'string' },
    request: { type: 'string' },
    model: { type: 'string' },
    'review-only': { type: 'boolean' },
    lang: { type: 'string' },
    url: { type: 'string' },
    key: { type: 'string' },
    protocol: { type: 'string' },
    json: { type: 'boolean' }
} as const

// A request that starts with "-" ("-make it slower") must not read as an
// option: string values are joined to their flag before parsing
function parse(argv: string[]) {
  const joined: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].startsWith('--') && !argv[i].includes('=') ? argv[i].slice(2) : null
    if (name && (OPTIONS as Record<string, { type: string }>)[name]?.type === 'string' && i + 1 < argv.length) joined.push(`--${name}=${argv[++i]}`)
    else joined.push(argv[i])
  }
  try {
    return parseArgs({ args: joined, allowPositionals: true, options: OPTIONS })
  } catch (err) {
    console.log(JSON.stringify({ type: 'error', message: (err as Error).message }))
    process.exit(1)
  }
}
const { values, positionals } = parse(process.argv.slice(2))
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

// The models in the project's assets/ (from the asset library)
function assetList(project: ProjectStatus) {
  const dir = path.join(project.root, 'assets')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap(id => {
    const meta = path.join(dir, id, 'asset.json')
    if (!fs.existsSync(meta)) return []
    const a = JSON.parse(fs.readFileSync(meta, 'utf8'))
    return [{ id, name: String(a.name ?? id), license: String(a.license ?? ''), author: String(a.author ?? ''), page: a.page ? String(a.page) : '', attribution: a.attribution ? String(a.attribution) : '' }]
  })
}

// CC-BY models need their authors credited in every post
function credits(project: ProjectStatus) {
  const byl = assetList(project).filter(a => /cc-by/i.test(a.license))
  if (!byl.length) return ''
  return `\n\nThe video uses these CC-BY models: credit each one in every platform's description or caption, as "<name>" by <author> (<license>)${'<link if any>'}:\n${byl.map(a => `- ${a.attribution || `"${a.name}" by ${a.author || 'unknown'} (${a.license})${a.page ? ` ${a.page}` : ''}`}`).join('\n')}`
}

function assetsBrief(project: ProjectStatus) {
  const assets = assetList(project)
  if (!assets.length) return ''
  return `\n\nModels in assets/ (import them as the format describes):\n${assets.map(a => `- assets/${a.id}/model.glb: ${a.name} (${a.license}${a.author ? `, ${a.author}` : ''})`).join('\n')}`
}

function shotBrief(project: ProjectStatus, shot: ShotStatus) {
  const rel = (f: string) => path.relative(project.root, f)
  const others = project.shots.map(s => `${s.id} (${s.start}–${s.start + s.duration} s)${s.id === shot.id ? ' ← this shot' : ''}`)
  return `Project: "${project.title}", ${project.track.toUpperCase()} track, ${project.duration} s.
Shots: ${others.join(', ')}.

Shot ${shot.id}: film time ${shot.start}–${shot.start + shot.duration} s, ${shot.duration} s long.

${rel(shot.notes)}:
${read(shot.notes)}

${rel(shot.code)}:
${read(shot.code)}${assetsBrief(project)}`
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
  // The before stills, in the editor's quality (3D previews, 2D final),
  // the same the agent's renders make; rendered if needed
  const current = (project.track === '3d' ? shot.draft : shot.final).stills ?? (await renderStills(project.root, shot.id)).stills
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

// The idea, from copy.md's Idea section
function ideaOf(project: ProjectStatus) {
  const copy = read(path.join(project.root, 'copy.md'))
  return copy.match(/## Idea\n+([\s\S]*?)(\n## |$)/)?.[1]?.trim() || project.title
}

// Copy and storyboard in storyboard.json, from the idea (or revised on request)
async function planTask() {
  const project = await status(dir)
  const file = path.join(project.root, 'storyboard.json')
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  const ctx = context(project.root, ['storyboard.json'])
  const size = `${project.size.width}×${project.size.height}`
  const ask = existing && values.request
    ? `The person asks for changes to the plan: "${values.request}"\n\nThe current storyboard.json:\n${existing}`
    : existing
      ? `Plan this video again, from the idea, with fresh ideas. The current storyboard.json, for reference:\n${existing}`
      : 'Plan this video.'
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent('code', {
    effort: 'high',
    system: planSystem() + replyLanguage(values.lang),
    prompt: `${ask}

Idea: ${ideaOf(project)}
Title: ${project.title}
Track: ${project.track.toUpperCase()} · frame ${size} · target length ${project.duration} s`,
    ctx
  })
  // The page reads it: it has to be valid
  const sb = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(sb.shots) || !sb.shots.length) throw new Error('the plan has no shots; try again')
  return { task: 'plan', summary, shots: sb.shots.length }
}

// The world and every shot, from the applied storyboard
async function buildTask() {
  const project = await status(dir)
  const ctx = context(project.root, ['world/', 'shots/', 'captions.html'])
  // The world's text files (not folders such as __pycache__, not media)
  const worldDir = path.join(project.root, 'world')
  const worldFiles = fs.existsSync(worldDir)
    ? fs.readdirSync(worldDir, { withFileTypes: true })
      .filter(e => e.isFile() && /\.(py|js|mjs|html|css|json|md|txt|svg)$/i.test(e.name))
      .map(e => `world/${e.name}:\n${read(path.join(worldDir, e.name))}`).join('\n\n')
    : ''
  const shots = project.shots.map(s => shotBrief(project, s)).join('\n\n---\n\n')
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent('code', {
    effort: 'high',
    system: buildSystem() + replyLanguage(values.lang),
    prompt: `Build "${project.title}" (${project.track.toUpperCase()}, ${project.size.width}×${project.size.height}, ${project.duration} s, ${project.shots.length} shots) from its plan.

copy.md:
${read(path.join(project.root, 'copy.md'))}

${worldFiles}

${shots}`,
    ctx,
    maxTurns: 40 + 20 * project.shots.length
  })
  saveChecks(project, ctx)
  // A late change to the world leaves the earlier shots' stills out of
  // date: render them again, so every shot ends with current stills
  const after = await status(dir)
  for (const s of after.shots) {
    if ((after.track === '3d' ? s.draft : s.final).stills) continue
    emit({ type: 'tool', name: 'render_stills', summary: s.id })
    await renderStills(after.root, s.id).catch(() => null)
  }
  return { task: 'build', summary, touched: [...ctx.touched].sort() }
}

interface PublishPost { id: string; name: string; title?: string; description?: string; tags?: string[]; pinned?: string; label?: string }

function publishMarkdown(title: string, posts: PublishPost[]) {
  const block = (label: string, text?: string) => (text?.trim() ? `${label}:\n\n\`\`\`\n${text.trim()}\n\`\`\`\n` : '')
  return `# ${title} · Publish\n\n` + posts.map(p => [
    `## ${p.name}\n`,
    block('Title', p.title),
    block('Description', p.description),
    block('Tags', (p.tags ?? []).join(', ')),
    block('Pinned comment', p.pinned),
    p.label?.trim() ? `AI label: ${p.label.trim()}\n` : ''
  ].filter(Boolean).join('\n')).join('\n')
}

async function publishTask() {
  const project = await status(dir)
  const ctx = context(project.root, ['publish.json'])
  const docs = ['copy.md', 'script.md', 'publish.json']
    .map(f => `${f}:\n${read(path.join(project.root, f))}`)
    .join('\n\n')
  const summary = await runAgent('code', {
    effort: 'high',
    system: publishSystem() + postLanguage(values.lang),
    prompt: `Write publish.json for "${project.title}" (${project.duration} s, ${project.track.toUpperCase()}).\n\n${docs}${credits(project)}`,
    ctx
  })
  // The fields, checked; publish.md is the same kit to read, kept for the export folder
  const file = path.join(project.root, 'publish.json')
  const kit = JSON.parse(fs.readFileSync(file, 'utf8')) as { platforms?: PublishPost[] }
  if (!Array.isArray(kit.platforms) || !kit.platforms.length) throw new Error('publish.json has no platforms; try again')
  fs.writeFileSync(path.join(project.root, 'publish.md'), publishMarkdown(project.title, kit.platforms))
  return { task: 'publish', summary, touched: [...ctx.touched], file }
}

try {
  let value: unknown
  if (task === 'detect') value = await detect()
  else if (task === 'test') value = await smokeTest()
  else if (task === 'models') {
    const protocol = values.protocol === 'anthropic' ? 'anthropic' : 'openai'
    if (!values.url && protocol === 'openai') throw new Error('models needs --url <base URL>')
    value = await listModels(values.url ?? '', values.key, protocol)
  } else {
    if (!dir || !['fix', 'check', 'publish', 'plan', 'build'].includes(task)) {
      console.error('usage: shotloop-agent fix|check|publish|plan|build <project> [--shot <id>] [--request "…"] [--json] | detect | models --url <…>')
      process.exit(1)
    }
    preflight()
    value = task === 'publish' ? await publishTask() : task === 'plan' ? await planTask() : task === 'build' ? await buildTask() : await shotTask(task as 'fix' | 'check')
  }
  emit({ type: 'result', value })
} catch (err) {
  emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  process.exit(1)
}
