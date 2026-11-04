// The agent's tools, deliberately narrow (docs/PRD.md §9): read and write
// files inside the project, render stills through the engine, read the
// checklist, report checks, keep a lesson in the AI's memory. No shell, no
// network, nothing else outside the project folder.

import type Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import type { VoiceResult } from '../../engine/shotloop/protocol.d.ts'
import { engine, renderCover, renderStills } from './engine.ts'
import { emit, reason, warn } from './events.ts'
import { isKit, notesOf } from './notes.ts'
import { AMBIENCE_NAMES, findText, memory, pictureText, STYLES, styleById, styleStills } from './enginelib.ts'

type Tool = Anthropic.Beta.BetaTool

// What a tool call returns, in no backend's format: each backend (loop.ts,
// local.ts, mcp.ts) maps it to its own. An image's label says what it is
// ("start frame"); a failure is its message, with isError
interface ToolImage {
  mediaType: 'image/png' | 'image/jpeg'
  data: string
  label?: string
}
export interface ToolOutput {
  text: string[]
  images: ToolImage[]
  isError: boolean
}
type Output = string | { text?: string[]; images?: ToolImage[] }

export interface CheckResult {
  rule: string
  pass: boolean
  note: string
}

export interface ToolContext {
  root: string
  checklist: string
  // Relative paths (posix) the agent may write; a trailing / means a folder
  writable: string[]
  // What the agent changed, for the before/after report
  touched: Set<string>
  renders: Map<string, string[]>
  checks: { shot: string; results: CheckResult[]; summary: string }[]
  // The ways to make a change the AI offers, for the person to pick from
  options: ShotOption[]
  // A shot written only as a test sheet (the recurring pictures' proof):
  // not the shot, so its writes aren't told as the shot's progress
  sheet?: string
  // May keep a lesson (remember): only a change the person asked for,
  // where what it took is worth keeping; a build's slips are its own
  learn?: boolean
}

export interface ShotOption { title: string; plan: string }

export function newContext(root: string, checklist: string, writable: string[]): ToolContext {
  return { root, checklist, writable, touched: new Set(), renders: new Map(), checks: [], options: [] }
}

// Case-insensitive: macOS file systems are, so .Shotloop is .shotloop
const HIDDEN = /^(\.shotloop|out|\.git|node_modules)(\/|$)/i
const MAX_READ = 256 * 1024

const posix = (root: string, abs: string) => path.relative(root, abs).split(path.sep).join('/')

// The project-relative path of abs, refusing anything outside the root or
// in the cache and output folders (p: what the model asked for)
function within(root: string, abs: string, p: string) {
  const rel = posix(root, abs)
  if (rel === '..' || rel.startsWith('../') || path.isAbsolute(rel)) throw new Error(`${p} is outside the project`)
  if (HIDDEN.test(rel)) throw new Error(`${p} is managed by Shotloop and cannot be accessed`)
  return rel
}

// Where abs really is, symlinks followed: the real path of its nearest
// part that exists (the file, or the folder it would be created in)
function realPath(abs: string, p: string) {
  let probe = abs
  while (!fs.existsSync(probe) && path.dirname(probe) !== probe) {
    // A link whose target is missing would be written through
    if (isLink(probe)) throw new Error(`${p} is a broken link`)
    probe = path.dirname(probe)
  }
  return path.join(fs.realpathSync(probe), path.relative(probe, abs))
}
const isLink = (f: string) => {
  try {
    return fs.lstatSync(f).isSymbolicLink()
  } catch {
    // nothing there
    return false
  }
}

// Resolves a model-supplied path: inside the project both as written and
// with symlinks followed, so a link can't lead out of it
function resolve(ctx: ToolContext, p: string) {
  const abs = path.resolve(ctx.root, p)
  const rel = within(ctx.root, abs, p)
  within(fs.realpathSync(ctx.root), realPath(abs, p), p)
  return { abs, rel }
}

// Writes under a temporary name and renames, so a reader never sees half
// a file (the engine may read a shot while its agent writes it)
export function writeAtomic(file: string, content: string) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}-${Math.random().toString(36).slice(2)}.tmp`)
  fs.writeFileSync(tmp, content)
  try {
    fs.renameSync(tmp, file)
  } catch (err) {
    fs.rmSync(tmp, { force: true })
    throw err
  }
}

// The shot whose code a project path is (shots/<id>/shot.js)
export const codeOf = (rel: string) => rel.match(/^shots\/([^/]+)\/shot\.js$/)?.[1] ?? null

function canWrite(ctx: ToolContext, rel: string) {
  return ctx.writable.some(w => (w.endsWith('/') ? rel.startsWith(w) : rel === w))
}

// Parts of shotloop.json a task may set through a tool (the sound pass):
// listed among its writable paths like files
export const SET_AMBIENCE = 'shotloop.json#sound'
export const SET_LINES = 'shotloop.json#say'

const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object' as const,
  properties,
  required,
  additionalProperties: false
})

const STYLE_IDS = STYLES.map(s => s.id)

export const TOOLS: Tool[] = [
  {
    name: 'list_files',
    description: 'List the files of the project (or of one folder in it), with sizes. Cache and output folders are not listed.',
    strict: true,
    input_schema: object({ dir: { type: 'string', description: 'Folder relative to the project root; "." for all.' } }, ['dir'])
  },
  {
    name: 'read_file',
    description: 'Read a text file of the project. Paths are relative to the project root, e.g. "shots/01-room/shot.js" or "world/page.html".',
    strict: true,
    input_schema: object({ path: { type: 'string' } }, ['path'])
  },
  {
    name: 'write_file',
    description: 'Create or replace a text file. Only the files this task allows can be written; the error says which.',
    strict: true,
    input_schema: object({ path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content'])
  },
  {
    name: 'edit_file',
    description: 'Replace one exact, unique occurrence of old_string with new_string in a file. Prefer this to write_file for small changes.',
    strict: true,
    input_schema: object({
      path: { type: 'string' },
      old_string: { type: 'string' },
      new_string: { type: 'string' }
    }, ['path', 'old_string', 'new_string'])
  },
  {
    name: 'render_stills',
    description: 'Render the stills of a shot (in the editor’s quality) (its first, middle and last frame, captions composited) with the current code, and return them as images. Takes from seconds (2D) to a minute or two (3D). A render error is returned as text.',
    strict: true,
    input_schema: object({ shot: { type: 'string', description: 'Shot id, e.g. "01-room".' } }, ['shot'])
  },
  {
    name: 'view_style',
    description: `Look at the reference stills of a visual style (from the example videos that define it): ${STYLE_IDS.join(', ')}. Look before you choose a style, and before you build in one, to see the quality to reach.`,
    strict: true,
    input_schema: object({ style: { type: 'string', enum: STYLE_IDS, description: 'Style id.' } }, ['style'])
  },
  {
    name: 'view_image',
    description: 'Look at a PNG or JPEG image of the project, e.g. "cover-reference.png". Returns it as an image.',
    strict: true,
    input_schema: object({ path: { type: 'string' } }, ['path'])
  },
  {
    name: 'find_text',
    description: 'Where words are in a picture of the project (a screenshot): each line holding them with its box { x, y, w, h } in the picture\'s own pixels, read exactly by the system (not guessed). Use it for every control a shot marks, clicks or types into: the box is the region for mark() or field(), its centre the point for desktopPoint(). text "" lists every line of the picture.',
    strict: true,
    input_schema: object({
      path: { type: 'string', description: 'The picture, e.g. "repo/pictures/08-export.jpg".' },
      text: { type: 'string', description: 'The words on the control, e.g. "Export"; "" for every line.' }
    }, ['path', 'text'])
  },
  {
    name: 'render_cover',
    description: 'Render the cover page (thumb.html) at 1080×1920 and return it as an image. Sets its background frame first: a moment of one shot, which the page can show from out/cover-frame.png. frame_shot "" means no frame (the file is removed).',
    strict: true,
    input_schema: object({
      frame_shot: { type: 'string', description: 'Shot id the frame comes from, e.g. "03-speed"; "" for none.' },
      frame_time: { type: 'number', description: 'Seconds into that shot (0 for none).' }
    }, ['frame_shot', 'frame_time'])
  },
  {
    name: 'read_checklist',
    description: 'Read the checklist every shot must pass, with the rule ids to report against.',
    strict: true,
    input_schema: object({}, [])
  },
  {
    name: 'report_checks',
    description: 'Record the result of reviewing a shot\'s latest stills against every checklist rule. Call once per reviewed shot, after the last render of it.',
    strict: true,
    input_schema: object({
      shot: { type: 'string' },
      results: {
        type: 'array',
        items: object({
          rule: { type: 'string', description: 'Checklist rule id.' },
          pass: { type: 'boolean' },
          note: { type: 'string', description: 'What you saw, in one sentence; for a failure, where and why.' }
        }, ['rule', 'pass', 'note'])
      },
      summary: { type: 'string', description: 'One or two sentences for the person: what passed, what is left.' }
    }, ['shot', 'results', 'summary'])
  },
  {
    name: 'offer_options',
    description: 'Offer the person ways to make the change they asked for, for them to pick one before anything is edited. Call once, with two to four options.',
    strict: true,
    input_schema: object({
      options: {
        type: 'array',
        items: object({
          title: { type: 'string', description: 'The option in a few words, in the person\'s language.' },
          plan: { type: 'string', description: 'One or two sentences: what changes on screen, and how in the code.' }
        }, ['title', 'plan'])
      }
    }, ['options'])
  },
  {
    name: 'remember',
    description: 'Keep a lesson in Shotloop\'s memory, for every later video: what to do and why, in one or two general sentences. Pass the id of a lesson from the memory as replaces to merge into it.',
    strict: true,
    input_schema: object({
      text: { type: 'string', description: 'The lesson, at most 500 characters, about no video in particular.' },
      track: { type: 'string', enum: ['all', '2d', '3d'], description: 'The videos it applies to.' },
      replaces: { type: 'string', description: 'Id of the lesson this one merges into and replaces; "" for a new one.' }
    }, ['text', 'track', 'replaces'])
  },
  {
    name: 'set_ambience',
    description: 'Set the sound under the whole film (only in the sound pass).',
    strict: true,
    input_schema: object({
      ambience: { type: 'string', description: `One of ${AMBIENCE_NAMES.join(', ')}, the id of a sound in the project's assets, or "none".` }
    }, ['ambience'])
  },
  {
    name: 'set_lines',
    description: 'Set the narration, every shot\'s line at once (only when the person asked for narration in the sound pass). The lines are spoken and fitted to the shots, which keep their lengths; the answer lists any line too long for its shot.',
    strict: true,
    input_schema: object({
      lines: {
        type: 'array',
        description: 'One entry per shot, in film order; an empty say leaves a shot silent.',
        items: object({ shot: { type: 'string', description: 'Shot id.' }, say: { type: 'string', description: 'What the voice says over it.' } }, ['shot', 'say'])
      }
    }, ['lines'])
  }
]

function listFiles(ctx: ToolContext, dir: string) {
  const { abs } = dir === '.' ? { abs: ctx.root } : resolve(ctx, dir)
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      const rel = path.relative(ctx.root, p).split(path.sep).join('/')
      if (HIDDEN.test(rel) || e.name.startsWith('.') || e.name === '__pycache__') continue
      if (e.isDirectory()) walk(p)
      else out.push(`${rel} (${fs.statSync(p).size} B)${canWrite(ctx, rel) ? ' [writable]' : ''}`)
    }
  }
  walk(abs)
  return out.join('\n') || '(empty)'
}

// A PNG or JPEG file's type (null for another kind of file)
const imageType = (file: string): ToolImage['mediaType'] | null =>
  (/\.png$/i.test(file) ? 'image/png' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : null)
function image(file: string, label?: string): ToolImage {
  const mediaType = imageType(file)
  if (!mediaType) throw new Error(`${path.basename(file)} is not a PNG or JPEG image`)
  return { mediaType, data: fs.readFileSync(file).toString('base64'), ...(label ? { label } : {}) }
}

const STILL_NAMES = ['start', 'middle', 'end']
// What to do about a blown area: told with the exposure check
const EXPOSURE_FIX = 'A light source may clip (a lamp, the sun, a screen, a glint). A lit surface or the subject may not (skin, paper, a white body or shell): it loses its shape. Fix that before you finish: move back or dim the light near it, make the material off-white (about #d8d4cc) instead of white, or lower the bloom or exposure; then render again.'

// Runs one tool call; a failure comes back as its message (and is shown
// in the activity log), for the model to read and recover from
export async function runTool(ctx: ToolContext, name: string, input: Record<string, unknown>): Promise<ToolOutput> {
  try {
    const out = await execute(ctx, name, input)
    return typeof out === 'string'
      ? { text: [out], images: [], isError: false }
      : { text: out.text ?? [], images: out.images ?? [], isError: false }
  } catch (err) {
    const message = reason(err)
    emit({ type: 'tool', name, summary: `failed: ${message.split('\n')[0]}` })
    return { text: [message], images: [], isError: true }
  }
}

async function execute(ctx: ToolContext, name: string, input: Record<string, unknown>): Promise<Output> {
  const str = (k: string) => {
    if (typeof input[k] !== 'string') throw new Error(`${k} must be a string`)
    return input[k] as string
  }
  switch (name) {
    case 'list_files':
      return listFiles(ctx, str('dir'))
    case 'read_file': {
      const { abs, rel } = resolve(ctx, str('path'))
      if (!fs.existsSync(abs)) throw new Error(`${rel} does not exist`)
      if (fs.statSync(abs).size > MAX_READ) throw new Error(`${rel} is larger than ${MAX_READ / 1024} KB`)
      emit({ type: 'tool', name, summary: rel })
      // The kit is the engine's: its interface, as the prompt lists it
      if (rel.startsWith('world/') && isKit(rel.slice(6))) return notesOf(rel.slice(6), fs.readFileSync(abs, 'utf8'))
      return fs.readFileSync(abs, 'utf8')
    }
    case 'write_file':
    case 'edit_file': {
      const { abs, rel } = resolve(ctx, str('path'))
      if (!canWrite(ctx, rel)) throw new Error(`${rel} is not writable in this task (writable: ${ctx.writable.join(', ')})`)
      let content: string
      if (name === 'write_file') content = str('content')
      else {
        const before = fs.readFileSync(abs, 'utf8')
        const old = str('old_string')
        const count = before.split(old).length - 1
        if (count !== 1) throw new Error(`old_string occurs ${count} times in ${rel}; it must occur exactly once`)
        content = before.replace(old, () => str('new_string'))
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      writeAtomic(abs, content)
      ctx.touched.add(rel)
      emit({ type: 'tool', name, summary: rel, path: rel })
      const shot = codeOf(rel)
      if (shot && shot !== ctx.sheet) emit({ type: 'shot', id: shot, state: 'written' })
      return `${rel} saved`
    }
    case 'render_stills': {
      const shot = str('shot')
      emit({ type: 'tool', name, summary: shot, shot })
      const r = await renderStills(ctx.root, shot)
      if (!r.stills) throw new Error('the render produced no stills')
      ctx.renders.set(shot, r.stills)
      const images = r.stills.map((f, i) => image(f, `${STILL_NAMES[i]} frame`))
      const text: string[] = []
      // The subtitle check that ran before the render: the stills don't
      // show the subtitles, so what they would cover is said in words
      if (r.subtitles) text.push(r.subtitles.length
        ? `Subtitle check: the voice-over's subtitles would cover\n${r.subtitles.map(i => `- ${i.from.toFixed(1)}–${i.to.toFixed(1)} s: ${i.what}`).join('\n')}\nMove it out of the subtitle band, or let it pass under only if it is background.`
        : 'Subtitle check: nothing the viewer must see is under the subtitles.')
      // The layout as the engine measured it in the page: exact, where the
      // stills would be judged by eye
      if (r.layout) text.push(r.layout.length
        ? `Layout check (measured in the page, every 0.1 s):\n${r.layout.map(i => `- ${i.rule}, ${i.from.toFixed(1)}–${i.to.toFixed(1)} s: ${i.what}`).join('\n')}\nFix each; these are measured, not opinions.`
        : 'Layout check: nothing measured wrong (overlaps, cuts, the desktop\'s size and place, empty bands, anything laid over the screen).')
      // The exposure check: blown areas striped, beside the stills
      const blown = (r.exposure ?? []).map((e, i) => ({ ...e, name: STILL_NAMES[i] })).filter(e => e.zebra)
      if (blown.length) {
        images.push(...blown.map(e => image(e.zebra!, `${e.name} frame, blown areas striped red`)))
        text.push(`Exposure check: areas blown to white, striped red and boxed: ${blown.map(e => `${e.name} ${e.areas.map(a => `${(a.share * 100).toFixed(1)}%`).join(', ')} of the frame`).join('; ')}. ${EXPOSURE_FIX}`)
      }
      return text.length ? { images, text } : { images }
    }
    case 'view_style': {
      const id = str('style')
      const style = styleById(id)
      if (!style) throw new Error(`no style ${id} (${STYLE_IDS.join(', ')})`)
      emit({ type: 'tool', name, summary: id })
      return { text: [style.why], images: styleStills(id).map((f, i) => image(f, `${id} reference ${i + 1}`)) }
    }
    case 'view_image': {
      const { abs, rel } = resolve(ctx, str('path'))
      if (!imageType(rel)) throw new Error(`${rel} is not a PNG or JPEG image`)
      if (!fs.existsSync(abs)) throw new Error(`${rel} does not exist`)
      if (fs.statSync(abs).size > 4 * 1024 * 1024) throw new Error(`${rel} is larger than 4 MB`)
      emit({ type: 'tool', name, summary: rel })
      return { images: [image(abs, rel)] }
    }
    case 'find_text': {
      const { rel } = resolve(ctx, str('path'))
      if (!imageType(rel)) throw new Error(`${rel} is not a PNG or JPEG image`)
      const words = str('text').trim()
      emit({ type: 'tool', name, summary: words ? `${rel}: "${words}"` : rel })
      const lines = words ? await findText(ctx.root, rel, words) : await pictureText(ctx.root, rel)
      if (!lines.length) return words ? `"${words}" is not written anywhere in ${rel} (it may be an icon with no words: place it from find_text "" and the picture)` : `${rel} has no text`
      const shown = lines.slice(0, words ? 8 : 150)
      return shown.map(l => `"${l.text}" x ${l.x}, y ${l.y}, w ${l.w}, h ${l.h}`).join('\n') + (lines.length > shown.length ? `\n(${lines.length - shown.length} more)` : '')
    }
    case 'render_cover': {
      // Only the cover task, which may write the cover page
      const page = JSON.parse(fs.readFileSync(path.join(ctx.root, 'shotloop.json'), 'utf8')).cover
      if (!page || !canWrite(ctx, page)) throw new Error('the cover is not part of this task')
      const shot = str('frame_shot')
      const time = Number(input.frame_time ?? 0)
      emit({ type: 'tool', name, summary: shot ? `${shot} @ ${time} s` : 'no frame' })
      const file = await renderCover(ctx.root, shot ? { shot, time } : null)
      if (!file) throw new Error('this project has no cover page')
      return { images: [image(file, 'cover')] }
    }
    case 'read_checklist':
      emit({ type: 'tool', name })
      return fs.readFileSync(ctx.checklist, 'utf8')
    case 'report_checks': {
      const shot = str('shot')
      // Only the project's own shots, and results of the expected shape
      // (models without strict schemas may send anything)
      if (!/^[\w][\w.-]*$/.test(shot) || !fs.existsSync(path.join(ctx.root, 'shots', shot))) throw new Error(`no shot ${shot} in this project`)
      const raw = input.results
      if (!Array.isArray(raw) || !raw.every(r => r && typeof r.rule === 'string' && typeof r.pass === 'boolean')) {
        throw new Error('results must be a list of { rule, pass, note }')
      }
      const results = raw.map(r => ({ rule: r.rule, pass: r.pass, note: String(r.note ?? '') })) as CheckResult[]
      const summary = str('summary')
      recordCheck(ctx, { shot, results, summary })
      const failed = results.filter(r => !r.pass).map(r => r.rule)
      emit({ type: 'tool', name, summary: `${shot}: ${failed.length ? `failed ${failed.join(', ')}` : 'all passed'}`, shot })
      return 'recorded'
    }
    case 'offer_options': {
      const raw = input.options
      if (!Array.isArray(raw) || !raw.length || !raw.every(o => o && typeof o.title === 'string' && typeof o.plan === 'string')) {
        throw new Error('options must be a list of { title, plan }')
      }
      ctx.options = raw.slice(0, 4).map(o => ({ title: o.title.trim(), plan: o.plan.trim() }))
      emit({ type: 'tool', name, summary: ctx.options.map(o => o.title).join(' · ') })
      return 'offered'
    }
    case 'remember': {
      if (!ctx.learn) throw new Error('lessons are kept only from a change the person asks for, not here')
      const title = JSON.parse(fs.readFileSync(path.join(ctx.root, 'shotloop.json'), 'utf8')).title
      const m = memory.add({ text: str('text'), by: 'ai', track: str('track'), from: typeof title === 'string' ? title : null, replaces: str('replaces') || null })
      emit({ type: 'tool', name, summary: m.text })
      return `kept as ${m.id}`
    }
    case 'set_ambience': {
      if (!canWrite(ctx, SET_AMBIENCE)) throw new Error('the ambience is set in the sound pass only')
      const ambience = str('ambience') || 'none'
      emit({ type: 'tool', name, summary: ambience })
      await engine(['sound', ctx.root, '--ambience', ambience])
      ctx.touched.add('shotloop.json')
      return `ambience: ${ambience}`
    }
    case 'set_lines': {
      if (!canWrite(ctx, SET_LINES)) throw new Error('narration is set only when the person asked for it in the sound pass')
      const list = Array.isArray(input.lines) ? (input.lines as { shot: string; say: string }[]) : []
      emit({ type: 'tool', name, summary: `${list.filter(l => l.say.trim()).length} lines` })
      const lines = Object.fromEntries(list.map(l => [l.shot, l.say]))
      // The picture leads: the shots keep their lengths, long lines come back
      const r = await engine<VoiceResult>(['voice', ctx.root, '--on', '--picture', '--lines', JSON.stringify(lines)])
      ctx.touched.add('shotloop.json')
      const over = r.fit?.overruns ?? []
      const crossing = r.fit?.crossings ?? []
      const unspoken = r.fit?.unspoken ?? []
      return [
        over.length ? `Too long even spoken faster; shorten these and set the lines again:\n${over.map(o => `- ${o.shot}: ${o.spoken} s spoken, ${o.room} s of shot`).join('\n')}` : 'Every line fits.',
        ...(crossing.length ? [`Over a cut: ${crossing.map(c => `${c.shot} (${c.over.map(o => (o === 'next' ? 'on into the next shot' : 'starting in the previous shot')).join(', ')})`).join('; ')}.`] : []),
        ...(unspoken.length ? [`The voice can't say ${unspoken.map(u => `${u.words.join(', ')} (${u.shot})`).join('; ')}: respell them as they sound.`] : [])
      ].join('\n')
    }
    default:
      throw new Error(`unknown tool ${name}`)
  }
}

// A shot's latest review replaces an earlier one, so the checks saved and
// the notes' history agree
function recordCheck(ctx: ToolContext, check: ToolContext['checks'][number]) {
  const i = ctx.checks.findIndex(c => c.shot === check.shot)
  if (i >= 0) ctx.checks[i] = check
  else ctx.checks.push(check)
}

// ---------------------------------------------------------------- session

// When a local CLI agent drives the tools, they run in an MCP server
// process the CLI starts (mcp.ts); what they did comes back to the
// sidecar through this file
interface Session {
  touched: string[]
  renders: [string, string[]][]
  checks: ToolContext['checks']
  options: ShotOption[]
}

export function saveSession(ctx: ToolContext, file: string) {
  const s: Session = { touched: [...ctx.touched], renders: [...ctx.renders], checks: ctx.checks, options: ctx.options }
  writeAtomic(file, JSON.stringify(s))
}

export function loadSession(ctx: ToolContext, file: string) {
  if (!fs.existsSync(file)) return
  let s: Session
  try {
    s = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    // The files the agent wrote are on disk all the same; only the record
    // of them is lost, so the task goes on and says so
    warn(`the record of what the CLI agent changed is unreadable (${reason(err)}); its changes and checks are not listed`)
    return
  }
  for (const f of s.touched) ctx.touched.add(f)
  for (const [shot, stills] of s.renders) ctx.renders.set(shot, stills)
  for (const c of s.checks) recordCheck(ctx, c)
  if (s.options?.length) ctx.options = s.options
}
