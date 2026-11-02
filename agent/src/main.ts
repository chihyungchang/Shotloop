#!/usr/bin/env node
// Shotloop agent sidecar (docs/PRD.md §7.5, §7.6, §7.10).
//
//   shotloop-agent fix     <project> --shot <id> --request "the cable is hidden" [--element '<pick result>']
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
//   shotloop-agent sound   <project> [--parts effects,ambience,narration] [--request "…"]
//                                             the film's sound once its shots are approved: the
//                                             parts asked for (default effects and ambience);
//                                             narration fits the finished shots
//   shotloop-agent models  --url <…> [--key k] [--protocol anthropic|openai]
//                                             the chat models an endpoint offers
//
// --json prints one JSON event per line for the app. The model backend
// (Anthropic API, a local CLI agent or a local model) comes from the
// environment: see providers.ts.

import fs from 'node:fs'
import path from 'node:path'
import { assetsBrief, credits, elementBrief, head, ideaOf, looksBrief, read, recurring, shotBrief, stylesBrief, trackBrief, worldFiles } from './briefs.ts'
import type { PickedElement } from '../../engine/shotloop/protocol.d.ts'
import { engine, renderCover, renderStills, status, type ProjectStatus, type ShotStatus } from './engine.ts'
import { lookFits, memory, parseFlags, rules, STILLS, type Memory } from './enginelib.ts'
import { emit, exit, reason, setJson, warn } from './events.ts'
import { describe, detect, listModels, preflight, runAgent, smokeTest } from './providers.ts'
import { buildPartsSystem, buildShotSystem, buildWorldSystem, checkSystem, coverSystem, fixSystem, memoryPrompt, planSystem, postLanguage, publishSystem, REFERENCE_RULES, replyLanguage, revisePlanPrompt, SOUND_PARTS, soundSystem, TEMPLATE_RULES, type SoundPart } from './prompts.ts'
import { lintPlan, lintVoice } from './principles.ts'
import { newContext, SET_AMBIENCE, SET_LINES, writeAtomic, type ToolContext } from './tools.ts'

const OPTIONS = {
    shot: { type: 'string' },
    request: { type: 'string' },
    element: { type: 'string' },
    template: { type: 'string' },
    reference: { type: 'boolean' },
    parts: { type: 'string' },
    model: { type: 'string' },
    'review-only': { type: 'boolean' },
    lang: { type: 'string' },
    url: { type: 'string' },
    key: { type: 'string' },
    protocol: { type: 'string' },
    json: { type: 'boolean' }
} as const

// A request that starts with "-" ("-make it slower") must not read as an
// option: engine/lib/jsonl.mjs joins string values to their flag first
const { values, positionals } = parseFlags(process.argv.slice(2), OPTIONS)
setJson(!!values.json)
// --model picks the model of the chosen backend (see providers.ts)
if (values.model) process.env.SHOTLOOP_MODEL = values.model
const [task, dir] = positionals
// A damaged rules file was set aside (engine/shotloop/rules.mjs): this
// task follows the default rules, and says so
const damaged = rules.list().damaged
if (damaged) warn(`your rules could not be read and were kept as ${damaged}; this task follows the default rules until you change a rule in Settings → Rules`)

// The memory as the task starts: lessons kept during it apply from the
// next task, so agents working side by side share one system prompt (and
// its cache)
let MEMORY: Memory[] | undefined
const remembered = (track: ProjectStatus['track'], learn: boolean) => memoryPrompt(MEMORY ??= memory.list(), track, learn)

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const today = () => new Date().toISOString().slice(0, 10)

// The checklist for this task, made from the rules as the person set
// them: the fixed rules, then their taste or the project's own checklist
// (shotloop.json "checklist")
function checklistPath(root: string) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'shotloop.json'), 'utf8'))
  const own = cfg.checklist && path.join(root, cfg.checklist)
  const made = path.join(root, '.shotloop', 'checklist.md')
  fs.mkdirSync(path.dirname(made), { recursive: true })
  writeAtomic(made, rules.checklist(cfg.track === '3d' ? '3d' : '2d', own && fs.existsSync(own) ? fs.readFileSync(own, 'utf8') : null))
  return made
}

const context = (root: string, writable: string[]) => newContext(root, checklistPath(root), writable)

// Copies stills into the fix record, so before/after survive later renders
function keepStills(files: string[] | null | undefined, dir: string, prefix: string) {
  if (!files) return null
  fs.mkdirSync(dir, { recursive: true })
  return files.map((f, i) => {
    const out = path.join(dir, `${prefix}-${STILLS[i]}${path.extname(f)}`)
    fs.copyFileSync(f, out)
    return out
  })
}

function saveChecks(project: ProjectStatus, ctx: ToolContext) {
  for (const c of ctx.checks) {
    const file = path.join(project.root, '.shotloop', 'shots', c.shot, 'checks.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    writeAtomic(file, JSON.stringify({ at: new Date().toISOString(), ...c }, null, 2) + '\n')
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
  // What the person picked in the frame (engine pick), when they did
  const element: PickedElement | null = values.element ? JSON.parse(values.element) : null
  const record = path.join(project.root, '.shotloop', 'shots', shot.id, 'fixes', stamp())
  // The before stills, in the editor's quality (3D previews, 2D final),
  // the same the agent's renders make; rendered if needed
  const current = shot.final.stills ?? (await renderStills(project.root, shot.id)).stills
  const before = keepStills(current, record, 'before')

  const ctx = context(project.root, reviewOnly ? [] : [`shots/${shot.id}/`, 'world/'])
  const ask = kind === 'fix'
    ? `The person says about shot ${shot.id}: "${values.request}"${element ? `\n${elementBrief(element)}` : ''}\n\nFix it, then check the shot.`
    : reviewOnly
      ? `Review shot ${shot.id} against the checklist and report. Do not edit files.`
      : `Check shot ${shot.id} against the checklist. Fix what you can, then report the rest.`
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent(kind === 'fix' ? 'code' : 'routine', {
    effort: kind === 'fix' ? 'high' : 'medium',
    system: (kind === 'fix' ? fixSystem : checkSystem)(project.track, !!project.voiced) + remembered(project.track, !reviewOnly) + replyLanguage(values.lang),
    prompt: `${ask}\n\n${shotBrief(project, shot)}`,
    ctx
  })

  // The after stills: the agent's last render of the shot
  const afterFiles = ctx.renders.get(shot.id) ?? (ctx.touched.size ? (await renderStills(project.root, shot.id)).stills : current)
  const after = keepStills(afterFiles, record, 'after')
  const touched = [...ctx.touched].sort()
  const worldTouched = touched.some(f => f.startsWith('world/'))
  const result = {
    at: new Date().toISOString(),
    task: kind,
    shot: shot.id,
    request: values.request ?? null,
    element,
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
  // The plan writes the lines when the voice-over is on (a new film has
  // none yet, so it isn't "voiced" until this plan)
  const speaks = !!project.voice?.on
  const system = planSystem(project.track, speaks) + remembered(project.track, false) + replyLanguage(values.lang)
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent('copy', {
    effort: 'medium',
    system,
    prompt: `${ask}

Idea: ${ideaOf(project)}
Title: ${project.title}
${trackBrief(project)} · frame ${size} · target length ${project.lengthAuto ? 'auto (choose it from the content, 15 to 60 s, then make the shots add up to it)' : `${project.duration} s`}${stylesBrief(project)}${await looksBrief(project)}`,
    ctx
  })
  // The page reads it: it has to be valid
  const load = () => {
    const sb = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(sb.shots) || !sb.shots.length) throw new Error('the plan has no shots; try again')
    return sb as { target?: number; shots: { title?: string; duration: number; text?: string; say?: string }[] }
  }
  let sb = load()
  const aiLook = keepChosenLook(project, existing)
  sb = load()
  // 2D: measured against the rules; what breaks them goes back once
  // A bar of the music: no caption is up for less (the bed may be tuned
  // up to 12% faster to land the cuts, engine/shotloop/bed.mjs)
  const bpm = Number(JSON.parse(read(path.join(project.root, 'music.json')).replace(/^\(missing\)$/, '{}')).bpm) || 0
  const bar = bpm ? 240 / (bpm * 1.12) : 0
  // A voiced film is timed by its lines (fitted when it's built), so its
  // lines are measured instead of the captions' reading time
  const lint = () => (speaks ? lintVoice(sb.shots) : project.track === '2d' ? lintPlan(sb.shots, bar) : [])
  let issues = lint()
  let final = summary
  if (issues.length) {
    emit({ type: 'log', message: `plan breaks ${issues.length} reading rule(s); revising` })
    final = await runAgent('copy', {
      effort: 'medium',
      system,
      prompt: revisePlanPrompt(issues, speaks, Number(sb.target) || (project.lengthAuto ? null : project.duration), fs.readFileSync(file, 'utf8')),
      ctx
    })
    keepChosenLook(project, existing, aiLook)
    sb = load()
    issues = lint()
  }
  return { task: 'plan', summary: final, shots: sb.shots.length, warnings: issues }
}

// The look the planner picked is the AI's (lookAi, offered on the plan
// page as "AI picks"); a look the person chose, on the plan page before
// this plan or on Home, is laid over it while its style can draw it.
// After a revision, which sees the person's look in the file, the AI's
// pick is the one it made first (earlier), unless it picked anew.
// Gives back the AI's pick
function keepChosenLook(project: ProjectStatus, before: string | null, earlier?: string) {
  if (project.track !== '2d') return undefined
  const file = path.join(project.root, 'storyboard.json')
  const sb = JSON.parse(fs.readFileSync(file, 'utf8'))
  const prev = before ? JSON.parse(before) : null
  const home = (JSON.parse(read(path.join(project.root, 'shotloop.json'))) as { look?: string }).look
  const chosen = prev?.lookChosen ? prev.look : prev ? null : home
  const ai = earlier && chosen && sb.look === chosen ? earlier : sb.look
  const next = { ...sb, lookAi: ai }
  if (chosen && lookFits(sb.style, chosen)) Object.assign(next, { look: chosen, lookChosen: true })
  else delete next.lookChosen
  writeAtomic(file, JSON.stringify(next, null, 2) + '\n')
  return ai
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

// What a build has done so far, across its phases
interface Build {
  copy: string
  touched: Set<string>
  done: string[]
  failed: string[]
}

// A finished agent's changes and checks, kept
function collect(b: Build, project: ProjectStatus, ctx: ToolContext) {
  ctx.touched.forEach(f => b.touched.add(f))
  saveChecks(project, ctx)
}

// The world and every shot, from the applied storyboard: the world first
// (unless a 2D look already is one), then the recurring pictures, then the
// shots PARALLEL at a time, each by its own agent that may write only its shot
async function buildTask() {
  let project = await status(dir)
  // The voice leads the cut: every line spoken and its shot fitted to it
  // before anything is drawn, so each shot is built at its final length
  if (project.voiced) {
    emit({ type: 'log', message: 'voice-over: speaking the lines' })
    await engine(['voice', project.root, '--fit'])
    project = await status(dir)
  }
  const b: Build = { copy: read(path.join(project.root, 'copy.md')), touched: new Set(), done: [], failed: [] }
  emit({ type: 'log', message: `agent: ${describe()}` })

  const look = project.track === '2d' && /shotloop-look: /.test(read(path.join(project.root, 'world', 'page.html')))
  if (!look) project = await buildWorld(project, b)
  const lead = await buildParts(project, b)
  await buildShots(project, b, lead)
  if (!b.done.length) throw new Error(b.failed[0] ?? 'no shot was built')
  await renderStale(b)

  const summary = [...b.done, ...b.failed.map(f => `✗ ${f}`)].join('\n')
  return { task: 'build', summary, touched: [...b.touched].sort(), failed: [...new Set(b.failed.map(f => f.split(':')[0]))] }
}

// One visual system for the whole film; returns the project as it now is
async function buildWorld(project: ProjectStatus, b: Build) {
  emit({ type: 'phase', phase: 'world' })
  const ctx = context(project.root, ['world/'])
  await runAgent('code', {
    effort: 'high',
    system: buildWorldSystem(project.track, !!project.voiced) + remembered(project.track, true) + replyLanguage(values.lang),
    prompt: `Design the world of ${head(project)} from its plan.\n\ncopy.md:\n${b.copy}\n\n${worldFiles(project)}\n\n${project.shots.map(s => shotBrief(project, s)).join('\n\n---\n\n')}`,
    ctx
  })
  collect(b, project, ctx)
  return status(dir)
}

// 2D: the recurring pictures drawn once (world/parts.js), built into the
// first shot that shows them as their proof; returns that shot, or
// nothing when there are none or they failed (then every shot draws its own)
async function buildParts(project: ProjectStatus, b: Build): Promise<ShotStatus | undefined> {
  const parts = project.track === '2d' ? recurring(project) : []
  const first = Math.min(...parts.flatMap(r => r.shots).filter(n => n >= 1 && n <= project.shots.length))
  const lead = Number.isFinite(first) ? project.shots[first - 1] : undefined
  if (!lead) return undefined
  emit({ type: 'phase', phase: 'parts' })
  emit({ type: 'shot', id: lead.id, state: 'start' })
  const ctx = context(project.root, ['world/parts.js', `shots/${lead.id}/`])
  let built = false
  try {
    const summary = await runAgent('code', {
      effort: 'high',
      system: buildPartsSystem(!!project.voiced) + remembered('2d', true) + replyLanguage(values.lang),
      prompt: `Draw the recurring pictures of ${head(project)} in world/parts.js, then build shot ${lead.id} with them.\n\nRecurring pictures:\n${parts.map(r => `- ${r.name} (shots ${r.shots.join(', ')}): ${r.design}`).join('\n')}\n\ncopy.md:\n${b.copy}\n\n${worldFiles(project)}\n\n${shotBrief(project, lead)}`,
      ctx
    })
    b.done.push(`${lead.id}: ${summary}`)
    built = true
  } catch (err) {
    warn(`the recurring pictures failed (${reason(err)}); every shot draws its own`)
  }
  collect(b, project, ctx)
  if (!built) return undefined
  emit({ type: 'shot', id: lead.id, state: 'done' })
  return lead
}

// Every other shot, PARALLEL at a time, on the finished world
async function buildShots(project: ProjectStatus, b: Build, lead: ShotStatus | undefined) {
  emit({ type: 'phase', phase: 'shots' })
  const world = worldFiles(project)
  await pool(project.shots.filter(s => s.id !== lead?.id), PARALLEL, async shot => {
    emit({ type: 'shot', id: shot.id, state: 'start' })
    const ctx = context(project.root, [`shots/${shot.id}/`])
    try {
      const summary = await runAgent('code', {
        effort: 'medium',
        system: buildShotSystem(project.track, !!project.voiced) + remembered(project.track, true) + replyLanguage(values.lang),
        prompt: `Build shot ${shot.id} of ${head(project)} from its plan.\n\ncopy.md:\n${b.copy}\n\n${world}\n\n${shotBrief(project, shot)}`,
        ctx,
        maxTurns: 30
      })
      b.done.push(`${shot.id}: ${summary}`)
    } catch (err) {
      b.failed.push(`${shot.id}: ${reason(err)}`)
    }
    collect(b, project, ctx)
    emit({ type: 'shot', id: shot.id, state: 'done' })
  })
}

// Stills out of date (a shot that never rendered, a world changed after
// its stills): render them, so every shot ends with current stills. A shot
// that doesn't render is broken: it joins the failed ones
async function renderStale(b: Build) {
  const after = await status(dir)
  for (const s of after.shots) {
    if (s.final.stills) continue
    emit({ type: 'tool', name: 'render_stills', summary: s.id })
    try {
      await renderStills(after.root, s.id)
    } catch (err) {
      warn(`shot ${s.id} does not render (${reason(err)})`)
      b.failed.push(`${s.id}: its stills do not render: ${reason(err)}`)
    }
  }
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

// The film's sound, once its shots are approved: one pass over every shot
// for the parts the person chose (the effects, the ambience, narration
// written to fit the finished shots, the picture leading); the others are
// left as they are
async function soundTask() {
  const project = await status(dir)
  const parts = new Set((values.parts ?? 'effects,ambience').split(',').map(p => p.trim()))
  const unknown = [...parts].filter(p => !SOUND_PARTS.includes(p as SoundPart))
  if (unknown.length || !parts.size) throw new Error(`--parts takes some of ${SOUND_PARTS.join(', ')}`)
  const has = (p: SoundPart) => parts.has(p)
  if (has('narration') && project.voiced) throw new Error('this film already has a voice-over')
  const sounds = has('effects') ? project.shots.map(s => `shots/${s.id}/sounds.json`) : []
  const ctx = context(project.root, [...sounds, ...(has('ambience') ? [SET_AMBIENCE] : []), ...(has('narration') ? [SET_LINES] : [])])
  const shots = project.shots.map(s => `- ${s.id}${s.title ? ` (${s.title})` : ''}: ${s.duration} s${s.say ? `, says "${s.say}"` : ''}`).join('\n')
  const ask = values.request?.trim() ? `The person asks: "${values.request.trim()}"\n\n` : ''
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent('code', {
    effort: 'medium',
    system: soundSystem(project.track, !!project.voiced, SOUND_PARTS.filter(has)) + replyLanguage(values.lang),
    prompt: `${ask}Give ${head(project)} its ${SOUND_PARTS.filter(has).join(' and ')}.\n\nShots:\n${shots}${assetsBrief(project)}\n\ncopy.md:\n${read(path.join(project.root, 'copy.md'))}`,
    ctx
  })
  return { task: 'sound', summary, touched: [...ctx.touched].sort() }
}

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
    system: coverSystem(project.track) + remembered(project.track, false) + replyLanguage(values.lang),
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
  let value: unknown
  if (task === 'detect') value = await detect()
  else if (task === 'test') value = await smokeTest()
  else if (task === 'models') {
    const protocol = values.protocol === 'anthropic' ? 'anthropic' : 'openai'
    if (!values.url && protocol === 'openai') throw new Error('models needs --url <base URL>')
    value = await listModels(values.url ?? '', values.key, protocol)
  } else {
    if (!dir || !['fix', 'check', 'publish', 'cover', 'plan', 'build', 'sound'].includes(task)) {
      console.error('usage: shotloop-agent fix|check|publish|cover|plan|build <project> [--shot <id>] [--request "…"] [--json] | detect | models --url <…>')
      await exit(1)
    }
    preflight()
    value = task === 'publish' ? await publishTask() : task === 'cover' ? await coverTask() : task === 'plan' ? await planTask() : task === 'build' ? await buildTask() : task === 'sound' ? await soundTask() : await shotTask(task as 'fix' | 'check')
  }
  emit({ type: 'result', value })
} catch (err) {
  emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  await exit(1)
}
