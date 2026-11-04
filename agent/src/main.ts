#!/usr/bin/env node
// Shotloop agent sidecar (docs/PRD.md §7.5, §7.6, §7.10).
//
//   shotloop-agent propose <project> --shot <id> --request "…" [--element '<pick result>']
//                                             ways to make the change, for the person to pick (no edits)
//   shotloop-agent fix     <project> --shot <id> --request "the cable is hidden" [--element '<pick result>']
//   shotloop-agent check   <project> --shot <id>   review the shot against the checklist (no edits)
//   shotloop-agent publish <project>
//   shotloop-agent cover   <project> [--request "…"] [--template <id> | --reference]
//                                             design the cover (thumb.html) in the video's look,
//                                             fill a saved cover template, or recreate the design
//                                             of an uploaded image (cover-reference.png)
//   shotloop-agent detect                     CLI agents and local model servers here
//   shotloop-agent test                       one tiny request through the chosen backend
//   shotloop-agent plan    <project> [--request "…"]  copy and storyboard (storyboard.json)
//   shotloop-agent build   <project> [--shot <id>] the world and every shot, from the plan
//                                             (--shot: that shot alone, on the world there)
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
import { assetsBrief, credits, elementBrief, head, ideaOf, looksBrief, promoBrief, read, recurring, shotBrief, stylesBrief, subtitlesBrief, trackBrief, worldFiles } from './briefs.ts'
import type { PickedElement } from '../../engine/shotloop/protocol.d.ts'
import { engine, readRepo, readSite, renderCover, renderStills, status, type ProjectStatus, type ShotStatus } from './engine.ts'
import { lookFits, memory, pageLayout, pageOf, parseFlags, planIssues, rules, STILLS, type Memory } from './enginelib.ts'
import { emit, exit, reason, setJson, warn } from './events.ts'
import { openLedger } from './ledger.ts'
import { describe, detect, listModels, preflight, runAgent, smokeTest } from './providers.ts'
import { buildLayoutSystem, buildPartsSystem, buildShotSystem, buildWorldSystem, checkSystem, coverSystem, fixSystem, memoryPrompt, planSystem, proposeSystem, postLanguage, publishSystem, REFERENCE_RULES, replyLanguage, revisePlanPrompt, SOUND_PARTS, soundSystem, TEMPLATE_RULES, type SoundPart } from './prompts.ts'
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
  writeAtomic(made, rules.checklist(cfg.track === '3d' ? '3d' : '2d', own && fs.existsSync(own) ? fs.readFileSync(own, 'utf8') : null, { promo: !!cfg.promo, voice: !!cfg.voice?.on }))
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

// The tasks on one shot. A request is first answered with ways to make it
// (propose, no edits, quick); the way the person picks is then a fix. A
// check only looks and reports; fixing what it found is a fix too
type ShotKind = 'propose' | 'fix' | 'check'
async function shotTask(kind: ShotKind) {
  if (!values.shot) throw new Error(`${kind} needs --shot <id>`)
  if (kind !== 'check' && !values.request?.trim()) throw new Error(`${kind} needs --request "what is wrong"`)
  const project = await status(dir)
  const shot = project.shots.find(s => s.id === values.shot)
  if (!shot) throw new Error(`no shot ${values.shot}`)

  const edits = kind === 'fix'
  // What the person picked in the frame (engine pick), when they did
  const element: PickedElement | null = values.element ? JSON.parse(values.element) : null
  const record = path.join(project.root, '.shotloop', 'shots', shot.id, 'fixes', stamp())
  // The before stills, in the editor's quality (3D previews, 2D final),
  // the same the agent's renders make; rendered if needed
  const current = shot.final.stills ?? (await renderStills(project.root, shot.id)).stills
  const before = keepStills(current, record, 'before')

  const ctx = { ...context(project.root, edits ? [`shots/${shot.id}/`, 'world/'] : []), learn: edits }
  const said = `The person says about shot ${shot.id}: "${values.request}"${element ? `\n${elementBrief(element)}` : ''}`
  const ask = kind === 'fix' ? `${said}\n\nFix it.`
    : kind === 'propose' ? `${said}\n\nLook at the shot and offer ways to make this change with offer_options. Do not edit files.`
    : `Review shot ${shot.id} against the checklist and report. Do not edit files.`
  emit({ type: 'log', message: `agent: ${describe()}` })
  const summary = await runAgent(kind === 'check' ? 'routine' : 'code', {
    step: { kind, shot: shot.id },
    // A proposal and the fix of the way picked are quick (the thinking is
    // in the plan the person picked); a check judges every rule
    effort: kind === 'check' ? 'medium' : 'low',
    system: { fix: fixSystem, check: checkSystem, propose: proposeSystem }[kind](project.track, !!project.voiced) + remembered(project.track, edits) + replyLanguage(values.lang),
    prompt: `${ask}\n\n${shotBrief(project, shot)}${promoBrief(project)}`,
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
    options: ctx.options,
    before,
    after,
    record
  }
  fs.writeFileSync(path.join(record, 'fix.json'), JSON.stringify(result, null, 2) + '\n')
  // A fix doesn't review the whole checklist: the checks of the shots it
  // changed described the code before it, so they go (until the next check)
  for (const id of result.affectedShots) fs.rmSync(path.join(project.root, '.shotloop', 'shots', id, 'checks.json'), { force: true })
  saveChecks(project, ctx)
  const failed = ctx.checks.find(c => c.shot === shot.id)?.results.filter(r => !r.pass).map(r => r.rule) ?? []
  // Options change nothing: the shot's history keeps what was done
  if (kind === 'fix') appendHistory(shot, `fix "${values.request}"${touched.length ? ` (changed ${touched.join(', ')})` : ''}${failed.length ? `; still failing: ${failed.join(', ')}` : ''}`)
  if (kind === 'check') appendHistory(shot, `check${failed.length ? `: failing ${failed.join(', ')}` : ': all rules pass'}`)
  return result
}

// Copy and storyboard in storyboard.json, from the idea (or revised on request)
async function planTask() {
  const project = await readPromoSources(await status(dir))
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
    step: { kind: 'plan' },
    effort: 'medium',
    system,
    prompt: `${ask}

Idea: ${ideaOf(project)}
Title: ${project.title}
${trackBrief(project)} · frame ${size} · target length ${project.lengthAuto ? 'auto (choose it from the content, 15 to 60 s, then make the shots add up to it)' : `${project.duration} s`}${stylesBrief(project)}${await looksBrief(project)}${subtitlesBrief(project)}${promoBrief(project, { plan: true })}`,
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
  // up to 12% faster to land the cuts, engine/shotloop/sound/bed.mjs)
  const bpm = Number(JSON.parse(read(path.join(project.root, 'music.json')).replace(/^\(missing\)$/, '{}')).bpm) || 0
  const bar = bpm ? 240 / (bpm * 1.12) : 0
  // A voiced film is timed by its lines (fitted when it's built), so its
  // lines are measured instead of the captions' reading time
  // A promo is held to its frames too: every shot's beat, headlines that
  // fit their column (kits/promo-layout.js)
  const framed = () => (project.promo ? planIssues(pageOf(pageLayout(project.size)), sb.shots) : [])
  const lint = () => [...(speaks ? lintVoice(sb.shots) : project.track === '2d' ? lintPlan(sb.shots, bar) : []), ...framed()]
  let issues = lint()
  let final = summary
  if (issues.length) {
    emit({ type: 'log', message: `plan breaks ${issues.length} measured rule(s); revising` })
    final = await runAgent('copy', {
      step: { kind: 'revise' },
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

// A promo's repository, then its product page (the repository's home page
// when none was given), each read once before its first plan (a new plan
// keeps what was read; removing repo/ or site/ reads it again). One that
// can't be read is said, and the plan goes on from what there is. Gives
// back the project as it now is
async function readPromoSources(project: ProjectStatus) {
  const unread = (dir: string, file: string) => !fs.existsSync(path.join(project.root, dir, file))
  const repo = !!project.promo?.repo && unread('repo', 'repo.json')
  if (!repo && !(project.promo?.site && unread('site', 'brief.json'))) return project
  emit({ type: 'phase', phase: 'site' })
  if (repo) {
    try {
      const read = await readRepo(project.root)
      emit({ type: 'log', message: `repo: read ${read.name} (${read.docs} docs, ${read.pictures} pictures)` })
    } catch (err) {
      warn(`the repository could not be read (${reason(err)}); planning from what else there is`)
    }
  }
  const now = await status(project.root)
  if (now.promo?.site && unread('site', 'brief.json')) {
    try {
      const read = await readSite(now.root)
      emit({ type: 'log', message: `site: read ${read.name} (${read.pictures} pictures)` })
    } catch (err) {
      warn(`the product page could not be read (${reason(err)}); planning from what else there is`)
    }
  }
  emit({ type: 'phase', phase: 'plan' })
  return now
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

// How hard a shot's agent thinks: Settings → General, low unless chosen.
// Measured on 3 shots: low takes ~1.3 min a shot, medium ~4 (it fixes the
// framing from its stills more often), high ~6 for little more
const SHOT_EFFORTS = ['low', 'medium', 'high'] as const
const SHOT_EFFORT = SHOT_EFFORTS.find(e => e === process.env.SHOTLOOP_SHOT_EFFORT) ?? 'low'

// A second look at each built shot by a reviewer that didn't build it:
// on unless turned off, for a quicker build (SHOTLOOP_REVIEW=off); the
// engine's measure, which costs no images, runs either way
const REVIEW = process.env.SHOTLOOP_REVIEW !== 'off'

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

  // --shot: that shot alone, on the world and pictures there already
  const only = values.shot ? project.shots.find(s => s.id === values.shot) : null
  if (values.shot && !only) throw new Error(`no shot ${values.shot}`)
  if (!only) {
    const look = project.track === '2d' && /shotloop-look: /.test(read(path.join(project.root, 'world', 'page.html')))
    if (!look) project = await buildWorld(project, b)
    await buildParts(project, b)
  }
  await buildShots(project, b, only)
  if (!b.done.length) throw new Error(b.failed[0] ?? 'no shot was built')
  await renderStale(b)

  const summary = [...b.done, ...b.failed.map(f => `✗ ${f}`)].join('\n')
  return { task: 'build', summary, touched: [...b.touched].sort(), failed: [...new Set(b.failed.map(f => f.split(':')[0]))] }
}

// A shot's folder lent as a test sheet (the world's or a picture's
// proof): its code is kept aside in .shotloop/sheets and put back when
// the work is done, and the shot is built later with the others. A run
// stopped meanwhile (cancelled, the app quit) can't put it back: the
// next task does (restoreSheets)
const sheetsDir = (root: string) => path.join(root, '.shotloop', 'sheets')
async function onSheet<T>(sheet: ShotStatus, work: () => Promise<T>): Promise<T> {
  const kept = path.join(sheetsDir(dir), `${sheet.id}.js`)
  if (fs.existsSync(sheet.code)) {
    fs.mkdirSync(path.dirname(kept), { recursive: true })
    writeAtomic(kept, fs.readFileSync(sheet.code, 'utf8'))
  }
  try {
    return await work()
  } finally {
    if (fs.existsSync(kept)) {
      writeAtomic(sheet.code, fs.readFileSync(kept, 'utf8'))
      fs.rmSync(kept)
    }
  }
}

// Shots a stopped run left as test sheets get their own code back
function restoreSheets(root: string) {
  const kept = sheetsDir(root)
  if (!fs.existsSync(kept)) return
  for (const f of fs.readdirSync(kept).filter(f => f.endsWith('.js'))) {
    const code = path.join(root, 'shots', f.slice(0, -3), 'shot.js')
    if (fs.existsSync(path.dirname(code))) writeAtomic(code, fs.readFileSync(path.join(kept, f), 'utf8'))
    fs.rmSync(path.join(kept, f))
  }
}

// One visual system for the whole film, proved on a test sheet in the
// first shot; returns the project as it now is
async function buildWorld(project: ProjectStatus, b: Build) {
  emit({ type: 'phase', phase: 'world' })
  const sheet = project.shots[0]
  const ctx = { ...context(project.root, ['world/', `shots/${sheet.id}/`]), sheet: sheet.id }
  await onSheet(sheet, () => runAgent('code', {
    step: { kind: 'world' },
    effort: 'medium',
    system: buildWorldSystem(project.track, !!project.voiced) + remembered(project.track, false) + replyLanguage(values.lang),
    prompt: `Design the world of ${head(project)} from its plan, and prove it on a test sheet in shot ${sheet.id}.\n\ncopy.md:\n${b.copy}\n\n${worldFiles(project)}\n\n${project.shots.map(s => shotBrief(project, s)).join('\n\n---\n\n')}${promoBrief(project)}`,
    ctx
  }))
  collect(b, project, ctx)
  return status(dir)
}

// The recurring pictures (2D), drawn once before any shot, so every shot
// shows them the same: each in its own file (world/parts/part-N.js), by
// its own agent, PARALLEL at a time, then gathered in world/parts.js (each
// file's documentation and its exports), which the shots import. The
// agents don't see each other's code: with two pictures or more, a shared
// layout (world/parts/layout.js) is written first, where every picture
// sits and the anchors they share, so pictures the plan relates (one
// inside another, at its place and scale) line up. An agent proves its
// picture on a test sheet, a shot's folder no other agent holds; the
// shot's code is put back after, and it is built with the others
async function buildParts(project: ProjectStatus, b: Build) {
  const parts = project.track === '2d' ? recurring(project) : []
  if (!parts.length) return
  emit({ type: 'phase', phase: 'parts' })
  const file = (i: number) => `world/parts/part-${i + 1}.js`
  // A promo laid out from its plan (world/frames.json) needs no layout
  // written: its drawings sit in their beats' picture boxes
  const framed = fs.existsSync(path.join(project.root, 'world', 'frames.json'))
  const layout = parts.length > 1 && !framed ? await writeLayout(project, b, parts) : null
  // The sheets free to take, the shots that show a picture first
  const free = [...new Set([...parts.flatMap(r => r.shots).map(n => project.shots[n - 1]), ...project.shots].filter(Boolean))]
  const drawn: number[] = []
  await pool(parts.map((r, i) => ({ r, i })), Math.min(PARALLEL, free.length), async ({ r, i }) => {
    const sheet = free.shift()!
    const users = r.shots.map(n => project.shots[n - 1]).filter(Boolean)
    const others = parts.filter(o => o !== r)
    const ctx = { ...context(project.root, [file(i), `shots/${sheet.id}/`]), sheet: sheet.id }
    try {
      const summary = await onSheet(sheet, () => runAgent('code', {
        step: { kind: 'part', name: r.name },
        effort: 'medium',
        system: buildPartsSystem(!!project.voiced) + remembered('2d', false) + replyLanguage(values.lang),
        prompt: `Draw the recurring picture "${r.name}" of ${head(project)} in ${file(i)}, and prove it on a test sheet in shot ${sheet.id} (import it there from '../../${file(i)}').\n\nIts design (shots ${r.shots.join(', ')}): ${r.design}${others.length ? `\n\nThe film's other recurring pictures, drawn by other agents at the same time in their own files (never draw them):\n${others.map(o => `- ${o.name} (shots ${o.shots.join(', ')}): ${o.design}`).join('\n')}` : ''}${layout ? `\n\nThe shared layout, ${layout} (import it in your file from './layout.js'): your picture's default place and size, and every anchor it shares with the others, come from it, exactly, so the pictures line up:\n${read(path.join(project.root, layout))}` : ''}${framed ? '\n\nThe film is laid out in world/frames.json (screens.js frame()): your drawing sits in its beat\'s picture box, at the size it reads best at, balanced in it.' : ''}\n\nWhat the shots that show it need of it:\n${users.map(s => `### ${s.id}\n${read(s.notes)}`).join('\n\n')}\n\n${worldFiles(project, { docs: true })}`,
        ctx
      }))
      if (fs.existsSync(path.join(project.root, file(i)))) drawn.push(i)
      b.done.push(`${file(i)}: ${summary}`)
    } catch (err) {
      warn(`the recurring picture "${r.name}" failed (${reason(err)}); its shots draw it themselves`)
    } finally {
      free.push(sheet)
    }
    collect(b, project, ctx)
  })
  // None drawn: the last build's pictures stay, for the shots that use them
  if (!drawn.length) return
  const keep = [...(layout ? [{ name: 'the shared layout', file: layout }] : []), ...drawn.sort((x, y) => x - y).map(i => ({ name: parts[i].name, file: file(i) }))]
  const folder = path.join(project.root, 'world', 'parts')
  for (const f of fs.readdirSync(folder)) if (!keep.some(k => k.file === `world/parts/${f}`)) fs.rmSync(path.join(folder, f), { recursive: true, force: true })
  writePartsIndex(project, keep)
}

// The recurring pictures' shared layout, before they are drawn: plain
// constants, quick to write (low effort, no render). Its file, or null
// when it couldn't be written (each picture then follows its design alone)
async function writeLayout(project: ProjectStatus, b: Build, parts: ReturnType<typeof recurring>) {
  const rel = 'world/parts/layout.js'
  // An earlier build's layout is for an earlier plan: never taken for this one's
  fs.rmSync(path.join(project.root, rel), { force: true })
  const ctx = context(project.root, [rel])
  try {
    await runAgent('code', {
      step: { kind: 'layout' },
      effort: 'low',
      system: buildLayoutSystem() + replyLanguage(values.lang),
      prompt: `The recurring pictures of ${head(project)}:\n${parts.map(r => `- ${r.name} (shots ${r.shots.join(', ')}): ${r.design}`).join('\n')}\n\n${worldFiles(project, { docs: true })}`,
      ctx
    })
  } catch (err) {
    warn(`the recurring pictures' layout failed (${reason(err)}); each follows its design alone`)
  }
  collect(b, project, ctx)
  return fs.existsSync(path.join(project.root, rel)) ? rel : null
}

// world/parts.js: every drawn picture's documentation (its file's leading
// comment) and its exports, by name, for the shots to import from one
// place. Pictures drawn apart may export the same name (a helper): the
// first file's is kept, and said (an ambiguous name would break every
// shot importing it)
function writePartsIndex(project: ProjectStatus, drawn: { name: string; file: string }[]) {
  const docs = (text: string) => text.match(/^(?:\s*(?:\/\/.*|\/\*[\s\S]*?\*\/)\n)+/)?.[0].trim() ?? ''
  const taken = new Set<string>()
  const blocks = drawn.map(d => {
    const text = read(path.join(project.root, d.file))
    const from = `./${d.file.replace(/^world\//, '')}`
    const names = exportNames(text)
    const mine = names.filter(n => !taken.has(n))
    for (const n of names.filter(n => taken.has(n))) warn(`${d.file} exports ${n}, as an earlier picture does: the earlier one is kept`)
    mine.forEach(n => taken.add(n))
    return `// ${d.name}: ${d.file}\n${docs(text)}\n${mine.length ? `export { ${mine.join(', ')} } from '${from}'` : ''}`
  })
  writeAtomic(path.join(project.root, 'world', 'parts.js'), `// world/parts.js · the film's recurring pictures, one file each; import them from here\n\n${blocks.join('\n\n')}\n`)
}

// The names an ES module exports (declarations and export lists)
function exportNames(text: string) {
  const declared = [...text.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1])
  const listed = [...text.matchAll(/^export\s*\{([^}]*)\}(?!\s*from)/gm)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()!).filter(Boolean))
  return [...new Set([...declared, ...listed])]
}

// Every shot, PARALLEL at a time, on the finished world
async function buildShots(project: ProjectStatus, b: Build, only: ShotStatus | null = null) {
  emit({ type: 'phase', phase: 'shots' })
  const world = worldFiles(project, { docs: true })
  await pool(only ? [only] : project.shots, PARALLEL, async shot => {
    emit({ type: 'shot', id: shot.id, state: 'start' })
    const ctx = context(project.root, [`shots/${shot.id}/`])
    try {
      const summary = await runAgent('code', {
        step: { kind: 'shot', shot: shot.id },
        effort: SHOT_EFFORT,
        system: buildShotSystem(project.track, !!project.voiced, !!project.promo) + remembered(project.track, false) + replyLanguage(values.lang),
        prompt: `Build shot ${shot.id} of ${head(project)} from its plan.\n\ncopy.md:\n${b.copy}\n\n${world}\n\n${shotBrief(project, shot)}${promoBrief(project)}`,
        ctx,
        maxTurns: 30
      })
      b.done.push(`${shot.id}: ${summary}`)
      collect(b, project, ctx)
      await reviewShot(project, shot, b, world)
    } catch (err) {
      b.failed.push(`${shot.id}: ${reason(err)}`)
      collect(b, project, ctx)
    }
    emit({ type: 'shot', id: shot.id, state: 'done' })
  })
}

// A second look at a built shot. First what the engine measures in its
// page (overlaps, cuts, the desktop, empty bands): exact and costing no
// images, so a fault found there goes straight back to be fixed. Then,
// with nothing measured wrong, a reviewer that didn't write the shot
// judges its stills against the checklist (quick, low effort), since a
// builder passes its own work too easily; what fails goes back once
async function reviewShot(project: ProjectStatus, shot: ShotStatus, b: Build, world: string) {
  const brief = `${shotBrief(project, shot)}${promoBrief(project)}`
  const measured = (await renderStills(project.root, shot.id).catch(() => null))?.layout ?? []
  if (measured.length) return fixShot(project, shot, b, world, brief, 'measured in its page', measured.map(i => `- ${i.rule}, ${i.from.toFixed(1)}–${i.to.toFixed(1)} s: ${i.what}`))
  if (!REVIEW) return
  const look = context(project.root, [])
  await runAgent('routine', {
    step: { kind: 'check', shot: shot.id },
    effort: 'low',
    system: checkSystem(project.track, !!project.voiced) + replyLanguage(values.lang),
    prompt: `Review shot ${shot.id} against the checklist and report. Do not edit files.\n\n${brief}`,
    ctx: look
  })
  saveChecks(project, look)
  const failed = look.checks.at(-1)?.results.filter(r => !r.pass) ?? []
  if (failed.length) await fixShot(project, shot, b, world, brief, 'reviewed from its stills', failed.map(r => `- ${r.rule}: ${r.note}`))
}

// What a review or the measure found, back to a builder once
async function fixShot(project: ProjectStatus, shot: ShotStatus, b: Build, world: string, brief: string, how: string, faults: string[]) {
  const ctx = context(project.root, [`shots/${shot.id}/`])
  await runAgent('code', {
    step: { kind: 'fix', shot: shot.id },
    effort: SHOT_EFFORT,
    system: buildShotSystem(project.track, !!project.voiced, !!project.promo) + remembered(project.track, false) + replyLanguage(values.lang),
    prompt: `Shot ${shot.id} of ${head(project)} was ${how}, and these rules fail:\n${faults.join('\n')}\n\nFix them, render its stills and check it again.\n\n${world}\n\n${brief}`,
    ctx,
    maxTurns: 20
  })
  collect(b, project, ctx)
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
    step: { kind: 'publish' },
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
    step: { kind: 'sound' },
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
    step: { kind: 'cover' },
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
    if (!dir || !['propose', 'fix', 'check', 'publish', 'cover', 'plan', 'build', 'sound'].includes(task)) {
      console.error('usage: shotloop-agent fix|check|publish|cover|plan|build <project> [--shot <id>] [--request "…"] [--json] | detect | models --url <…>')
      await exit(1)
    }
    preflight()
    // Every AI step of this task is recorded with the project (ledger.ts)
    openLedger(dir, task)
    restoreSheets(dir)
    value = task === 'publish' ? await publishTask() : task === 'cover' ? await coverTask() : task === 'plan' ? await planTask() : task === 'build' ? await buildTask() : task === 'sound' ? await soundTask() : await shotTask(task as ShotKind)
  }
  emit({ type: 'result', value })
} catch (err) {
  emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  await exit(1)
}
