#!/usr/bin/env node
// Shotloop agent sidecar (docs/PRD.md §7.5, §7.6, §7.10).
//
//   shotloop-agent fix     <project> --shot <id> --request "the cable is hidden"
//   shotloop-agent check   <project> --shot <id> [--review-only]
//   shotloop-agent publish <project>
//   shotloop-agent cover   <project> [--request "…"] [--template <id> | --reference]
//                                             design the cover (thumb.html) in the video's look,
//                                             fill a saved cover template, or recreate the design
//                                             of an uploaded image (cover-reference.png)
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
import { engine, renderCover, renderStills, status, type ProjectStatus, type ShotStatus } from './engine.ts'
import { emit, setJson } from './events.ts'
import { describe, detect, listModels, preflight, runAgent, smokeTest } from './providers.ts'
import { buildPartsSystem, buildShotSystem, buildWorldSystem, checkSystem, coverSystem, fixSystem, planSystem, postLanguage, publishSystem, replyLanguage } from './prompts.ts'
import { lintPlan } from './principles.ts'
import type { ToolContext } from './tools.ts'

const OPTIONS = {
    shot: { type: 'string' },
    request: { type: 'string' },
    template: { type: 'string' },
    reference: { type: 'boolean' },
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

// A project in one line, for prompts
const head = (p: ProjectStatus) => `"${p.title}" (${p.track.toUpperCase()}, ${p.size.width}×${p.size.height}, ${p.duration} s, ${p.shots.length} shots)`

// The plan's pictures that appear in more than one shot (storyboard.json
// "recurring"), each with its fixed design and the 1-based shots it is in
interface Recurring { name: string; design: string; shots: number[] }
function recurring(project: ProjectStatus): Recurring[] {
  try {
    const sb = JSON.parse(fs.readFileSync(path.join(project.root, 'storyboard.json'), 'utf8'))
    return (Array.isArray(sb.recurring) ? sb.recurring : [])
      .filter((r: Recurring) => r && String(r.name ?? '').trim() && Array.isArray(r.shots) && r.shots.length)
      .map((r: Recurring) => ({ name: String(r.name), design: String(r.design ?? ''), shots: r.shots.map(Number) }))
  } catch {
    return []
  }
}

// 2D: the recurring pictures a shot shows, to draw from world/parts.js
function recurringBrief(project: ProjectStatus, shot: ShotStatus) {
  if (project.track !== '2d') return ''
  const n = project.shots.findIndex(s => s.id === shot.id) + 1
  const mine = recurring(project).filter(r => r.shots.includes(n))
  if (!mine.length) return ''
  return `\n\nRecurring pictures in this shot (draw them with their functions in world/parts.js when it has them; keep their design exactly):\n${mine.map(r => `- ${r.name}: ${r.design}`).join('\n')}`
}

// 2D: the project's visual style, what its frames are made of and the
// reference that sets the bar
let stylesCache: Style[] | null = null
function styleBrief(project: ProjectStatus) {
  const s = project.track === '2d' && project.style ? stylesCache?.find(x => x.id === project.style) : null
  if (!s) return ''
  return `\n\nVisual style: ${s.id} (${s.name.en}). ${s.frames} Reference: ${s.why} Look at its reference stills (view_style "${s.id}") before you build, and reach that quality.`
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
${read(shot.code)}${styleBrief(project)}${recurringBrief(project, shot)}${assetsBrief(project)}`
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
    system: (kind === 'fix' ? fixSystem(project.track) : checkSystem(project.track)) + replyLanguage(values.lang),
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
  const summary = await runAgent('copy', {
    effort: 'medium',
    system: planSystem(project.track) + replyLanguage(values.lang),
    prompt: `${ask}

Idea: ${ideaOf(project)}
Title: ${project.title}
${await trackBrief(project)} · frame ${size} · target length ${project.lengthAuto ? 'auto (choose it from the content, 15 to 60 s, then make the shots add up to it)' : `${project.duration} s`}${await stylesBrief(project)}${await looksBrief(project)}`,
    ctx
  })
  // The page reads it: it has to be valid
  const load = () => {
    const sb = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(sb.shots) || !sb.shots.length) throw new Error('the plan has no shots; try again')
    return sb as { shots: { title?: string; duration: number; text?: string }[] }
  }
  let sb = load()
  // 2D: measured against the principles; what breaks them goes back once
  // A bar of the music: no caption is up for less (the bed may be tuned
  // up to 12% faster to land the cuts, engine/shotloop/bed.mjs)
  const bpm = Number(JSON.parse(read(path.join(project.root, 'music.json')).replace(/^\(missing\)$/, '{}')).bpm) || 0
  const bar = bpm ? 240 / (bpm * 1.12) : 0
  let issues = project.track === '2d' ? lintPlan(sb.shots, bar) : []
  let final = summary
  if (issues.length) {
    emit({ type: 'log', message: `plan breaks ${issues.length} reading rule(s); revising` })
    final = await runAgent('copy', {
      effort: 'medium',
      system: planSystem(project.track) + replyLanguage(values.lang),
      prompt: `storyboard.json breaks the 2D principles where they can be measured:\n${issues.map(i => `- ${i}`).join('\n')}\n\nFix it: sum captions up shorter, move words into the picture, split a crowded beat into two shots, or give a shot more time while the total stays ${project.duration} s. Keep everything else.\n\nstoryboard.json:\n${fs.readFileSync(file, 'utf8')}`,
      ctx
    })
    sb = load()
    issues = lintPlan(sb.shots, bar)
  }
  return { task: 'plan', summary: final, shots: sb.shots.length, warnings: issues }
}

interface Style { id: string; track: string; name: { en: string }; when: string; avoid: string; frames: string; why: string; looks: string[] }
const loadStyles = async () =>
  (await import(new URL('../../engine/shotloop/styles.mjs', import.meta.url).href) as { STYLES: Style[] }).STYLES

// 3D is a choice only for a project made with "auto" and a Mac with Blender
async function threeDPossible(project: ProjectStatus) {
  if (!project.trackAuto) return false
  const doctor = await engine<{ blender: unknown }>(['doctor']).catch(() => ({ blender: null }))
  return !!doctor.blender
}

async function trackBrief(project: ProjectStatus) {
  if (project.trackAuto) return `Track: chosen by you through the style (${(await threeDPossible(project)) ? '2D or 3D' : '2D; Blender is not installed, so no 3D'})`
  return `Track: ${project.track.toUpperCase()} (chosen by the person)`
}

// The visual styles the plan picks from (engine/shotloop/styles.mjs)
async function stylesBrief(project: ProjectStatus) {
  const all = await loadStyles()
  const threeD = await threeDPossible(project)
  const open = all.filter(s => (s.track === project.track && project.track === '2d') || (s.track === '3d' && threeD))
  if (project.track === '3d' || !open.length) return ''
  return `\n\nVisual styles (pick one for "style"; look at each candidate's reference stills with view_style before you decide):\n${open.map(s =>
    `- ${s.id} (${s.name.en}): use when ${s.when} Avoid when: ${s.avoid} Frames: ${s.frames} Reference: ${s.why}${s.looks.length ? ` Looks: ${s.looks.join(', ')}.` : ''}`).join('\n')}`
}

// The looks a 2D plan picks from, or the one the person chose
async function looksBrief(project: ProjectStatus) {
  if (project.track !== '2d') return ''
  const { LOOKS } = await import(new URL('../../engine/shotloop/looks.mjs', import.meta.url).href) as { LOOKS: { id: string; about: string; scene?: unknown }[] }
  const chosen = (JSON.parse(read(path.join(project.root, 'shotloop.json'))) as { look?: string }).look
  if (chosen) return `\nLook: "${chosen}" (chosen by the person; keep it unless the style you pick cannot use it).`
  return `\nLooks (pick one for "look", one the style can use):\n${LOOKS.map(l => `- ${l.id}: ${l.about}${l.scene ? '' : ' (infographic only)'}`).join('\n')}`
}

// At most n at a time, in order
async function pool<T>(items: T[], n: number, f: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await f(items[next++])
  }))
}

// Shots built at the same time: Settings → General (the app resolves
// "auto" by the machine), 1–5
const PARALLEL = Math.min(5, Math.max(1, Number(process.env.SHOTLOOP_PARALLEL) || 3))

// The world and every shot, from the applied storyboard: the world first
// (unless a 2D look already is one), then the shots five at a time, each by
// its own agent that may write only its shot
async function buildTask() {
  let project = await status(dir)
  const worldDir = path.join(project.root, 'world')
  // The world's text files (not folders such as __pycache__, not media)
  const worldFiles = () => fs.existsSync(worldDir)
    ? fs.readdirSync(worldDir, { withFileTypes: true })
      .filter(e => e.isFile() && /\.(py|js|mjs|html|css|json|md|txt|svg)$/i.test(e.name))
      .map(e => `world/${e.name}:\n${read(path.join(worldDir, e.name))}`).join('\n\n')
    : ''
  const copy = read(path.join(project.root, 'copy.md'))
  const touched = new Set<string>()
  emit({ type: 'log', message: `agent: ${describe()}` })

  const look = project.track === '2d' && /shotloop-look: /.test(read(path.join(worldDir, 'page.html')))
  if (!look) {
    emit({ type: 'log', message: 'phase world' })
    const ctx = context(project.root, ['world/', 'captions.html'])
    await runAgent('code', {
      effort: 'high',
      system: buildWorldSystem(project.track) + replyLanguage(values.lang),
      prompt: `Design the world of ${head(project)} from its plan.\n\ncopy.md:\n${copy}\n\n${worldFiles()}\n\n${project.shots.map(s => shotBrief(project, s)).join('\n\n---\n\n')}`,
      ctx
    })
    ctx.touched.forEach(f => touched.add(f))
    project = await status(dir)
  }

  const done: string[] = []
  const failed: string[] = []
  // 2D: the recurring pictures drawn once (world/parts.js), built into the
  // first shot that shows them as their proof; failing that, every shot
  // draws its own
  const parts = project.track === '2d' ? recurring(project) : []
  const first = Math.min(...parts.flatMap(r => r.shots).filter(n => n >= 1 && n <= project.shots.length))
  let lead: ShotStatus | undefined = Number.isFinite(first) ? project.shots[first - 1] : undefined
  if (lead) {
    emit({ type: 'log', message: 'phase parts' })
    emit({ type: 'log', message: `shot_start ${lead.id}` })
    const ctx = context(project.root, ['world/parts.js', `shots/${lead.id}/`])
    try {
      const summary = await runAgent('code', {
        effort: 'high',
        system: buildPartsSystem() + replyLanguage(values.lang),
        prompt: `Draw the recurring pictures of ${head(project)} in world/parts.js, then build shot ${lead.id} with them.\n\nRecurring pictures:\n${parts.map(r => `- ${r.name} (shots ${r.shots.join(', ')}): ${r.design}`).join('\n')}\n\ncopy.md:\n${copy}\n\n${worldFiles()}\n\n${shotBrief(project, lead)}`,
        ctx,
        maxTurns: 40
      })
      done.push(`${lead.id}: ${summary}`)
    } catch (err) {
      emit({ type: 'log', message: `parts failed: ${err instanceof Error ? err.message : String(err)}` })
      lead = undefined
    }
    ctx.touched.forEach(f => touched.add(f))
    saveChecks(project, ctx)
    if (lead) emit({ type: 'log', message: `shot_done ${lead.id}` })
  }

  emit({ type: 'log', message: 'phase shots' })
  const world = worldFiles()
  await pool(project.shots.filter(s => s.id !== lead?.id), PARALLEL, async shot => {
    emit({ type: 'log', message: `shot_start ${shot.id}` })
    const ctx = context(project.root, [`shots/${shot.id}/`])
    try {
      const summary = await runAgent('code', {
        effort: 'medium',
        system: buildShotSystem(project.track) + replyLanguage(values.lang),
        prompt: `Build shot ${shot.id} of ${head(project)} from its plan.\n\ncopy.md:\n${copy}\n\n${world}\n\n${shotBrief(project, shot)}`,
        ctx,
        maxTurns: 30
      })
      done.push(`${shot.id}: ${summary}`)
    } catch (err) {
      failed.push(`${shot.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
    ctx.touched.forEach(f => touched.add(f))
    saveChecks(project, ctx)
    emit({ type: 'log', message: `shot_done ${shot.id}` })
  })
  if (!done.length) throw new Error(failed[0] ?? 'no shot was built')

  // Stills out of date (a shot that never rendered, a world changed after
  // its stills): render them, so every shot ends with current stills
  const after = await status(dir)
  for (const s of after.shots) {
    if ((after.track === '3d' ? s.draft : s.final).stills) continue
    emit({ type: 'tool', name: 'render_stills', summary: s.id })
    await renderStills(after.root, s.id).catch(() => null)
  }
  const summary = [...done, ...failed.map(f => `✗ ${f}`)].join('\n')
  return { task: 'build', summary, touched: [...touched].sort(), failed: failed.map(f => f.split(':')[0]) }
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

const TEMPLATE_RULES = `A template mixes two kinds of things; tell them apart before you edit.
- The series design, which you keep exactly, even where this video's look differs: the fonts, sizes and weights of every text, where each text sits, the text and accent colors, how the background is treated (its darkening or tint), and series marks (a name, an episode label, a logo, a border or a rule).
- The last video's content, which you replace: every word and number, and anything that illustrates the last video's subject (drawings, icons, diagrams, labels about its topic). Remove such an illustration, or draw this video's equivalent in the same style and place; never relabel the old one to fit.
- The background frame: pick this video's own with render_cover (when the template shows no frame, set none). It fills the whole page (object-fit: cover, no bands), and the overlay is adjusted so the frame sits in the template's tone and the text keeps its contrast.
- When a text is longer than the template's, shorten it first; only then reduce its font size or let it wrap.`

const REFERENCE_RULES = `The person uploaded cover-reference.png, a cover whose design they want for this video and the next ones of the series. Look at it with view_image first, and describe to yourself what makes it: the layout and where each text sits, the size, weight and style of each text, the colors, the background and how it is treated, decorations and marks.
- Recreate that design in thumb.html at 1080×1920 (scale the reference's layout to it when its shape differs, keeping the 3:4 crop rule), with the closest system fonts.
- Fill it with this video's content: its own words in the same roles (kicker, headline, highlighted words, a number), and this video's own imagery (a frame through render_cover, or drawings) where the reference has its imagery. Every number from copy.md.
- Never put the reference itself on the cover as a picture: its words and imagery are baked in. The one exception is when it is itself a logo, frame or overlay (transparent areas, nothing about another video): then use the file as a layer, cropped with CSS.
- Render with render_cover and compare with the reference (view_image again if needed). Fix the largest difference in design, not content, and render again; stop after four renders.`

// The cover: thumb.html designed from the copy, the look and the shots'
// stills, then rendered for the export panel's preview
async function coverTask() {
  const project = await status(dir)
  if (!project.files.cover) throw new Error('this project has no cover page (shotloop.json "cover")')
  const page = path.relative(project.root, project.files.cover).split(path.sep).join('/')
  const ctx = context(project.root, [page])
  const docs = ['copy.md', 'script.md', 'storyboard.json']
    .filter(f => fs.existsSync(path.join(project.root, f)))
    .map(f => `${f}:\n${read(path.join(project.root, f))}`)
    .join('\n\n')
  const shots = project.shots.map(s => `- ${s.id}${s.title ? ` (${s.title})` : ''}: ${s.duration} s`).join('\n')
  const ask = values.request?.trim() ? `The person asks: "${values.request.trim()}"\n\n` : ''
  // A saved template: it becomes this cover's page, for the AI to fill
  let template = ''
  if (values.template) {
    const t = await engine<{ name: string }>(['covers', 'apply', project.root, values.template])
    template = `${page} is the person's cover template "${t.name}", shared by the covers of a series. ${TEMPLATE_RULES}\n\n`
  } else if (values.reference) {
    if (!fs.existsSync(path.join(path.dirname(project.files.cover), 'cover-reference.png'))) throw new Error('no cover-reference.png to design after')
    template = `${REFERENCE_RULES}\n\n`
  }
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent('code', {
    effort: template ? 'medium' : 'high',
    system: coverSystem() + replyLanguage(values.lang),
    prompt: `${ask}${template}${values.template ? 'Fill the template for' : values.reference ? 'Recreate that design for' : 'Design the cover of'} ${head(project)}.\n\nShots:\n${shots}\n\n${docs}\n\n${page} now:\n${read(project.files.cover)}`,
    ctx
  })
  // How the cover was made, for the export dialog to say
  const made = values.template ? { how: 'template', template: (await engine<{ name: string }[]>(['covers', 'list'])).find((x: any) => x.id === values.template)?.name ?? values.template }
    : { how: values.reference ? 'reference' : 'free' }
  fs.mkdirSync(path.join(project.root, '.shotloop'), { recursive: true })
  fs.writeFileSync(path.join(project.root, '.shotloop', 'cover.json'), JSON.stringify({ ...made, at: new Date().toISOString() }) + '\n')
  // The cover as it now is, whether or not the agent rendered it last
  const file = await renderCover(project.root)
  return { task: 'cover', summary, touched: [...ctx.touched], file }
}

try {
  stylesCache = await loadStyles()
  let value: unknown
  if (task === 'detect') value = await detect()
  else if (task === 'test') value = await smokeTest()
  else if (task === 'models') {
    const protocol = values.protocol === 'anthropic' ? 'anthropic' : 'openai'
    if (!values.url && protocol === 'openai') throw new Error('models needs --url <base URL>')
    value = await listModels(values.url ?? '', values.key, protocol)
  } else {
    if (!dir || !['fix', 'check', 'publish', 'cover', 'plan', 'build'].includes(task)) {
      console.error('usage: shotloop-agent fix|check|publish|cover|plan|build <project> [--shot <id>] [--request "…"] [--json] | detect | models --url <…>')
      process.exit(1)
    }
    preflight()
    value = task === 'publish' ? await publishTask() : task === 'cover' ? await coverTask() : task === 'plan' ? await planTask() : task === 'build' ? await buildTask() : await shotTask(task as 'fix' | 'check')
  }
  emit({ type: 'result', value })
} catch (err) {
  emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  process.exit(1)
}
