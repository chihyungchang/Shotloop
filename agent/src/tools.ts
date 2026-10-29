// The agent's tools, deliberately narrow (docs/PRD.md §9): read and write
// files inside the project, render stills through the engine, read the
// checklist, report checks. No shell, no network, nothing outside the
// project folder.

import type Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { renderStills } from './engine.ts'
import { emit } from './events.ts'

type Tool = Anthropic.Beta.BetaTool
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam['content']

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
}

const HIDDEN = /^(\.shotloop|out|\.git|node_modules)(\/|$)/
const MAX_READ = 256 * 1024

// Resolves a model-supplied path, refusing anything outside the project
// or in the cache and output folders
function resolve(ctx: ToolContext, p: string) {
  const abs = path.resolve(ctx.root, p)
  const rel = path.relative(ctx.root, abs).split(path.sep).join('/')
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${p} is outside the project`)
  if (HIDDEN.test(rel)) throw new Error(`${p} is managed by Shotloop and cannot be accessed`)
  return { abs, rel }
}

function canWrite(ctx: ToolContext, rel: string) {
  return ctx.writable.some(w => (w.endsWith('/') ? rel.startsWith(w) : rel === w))
}

const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object' as const,
  properties,
  required,
  additionalProperties: false
})

export const TOOLS: Tool[] = [
  {
    name: 'list_files',
    description: 'List the files of the project (or of one folder in it), with sizes. Cache and output folders are not listed.',
    strict: true,
    input_schema: object({ dir: { type: 'string', description: 'Folder relative to the project root; "." for all.' } }, ['dir'])
  },
  {
    name: 'read_file',
    description: 'Read a text file of the project. Paths are relative to the project root, e.g. "shots/01-room/shot.py" or "world/world.py".',
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

function stillBlocks(files: string[]): ToolResult {
  const names = ['start', 'middle', 'end']
  const blocks: Exclude<ToolResult, string | undefined> = []
  files.forEach((f, i) => {
    blocks.push({ type: 'text', text: `${names[i]} frame:` })
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: fs.readFileSync(f).toString('base64') }
    })
  })
  return blocks
}

export async function runTool(ctx: ToolContext, name: string, input: Record<string, unknown>): Promise<ToolResult> {
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
      fs.writeFileSync(abs, content)
      ctx.touched.add(rel)
      emit({ type: 'tool', name, summary: rel, path: rel })
      return `${rel} saved`
    }
    case 'render_stills': {
      const shot = str('shot')
      emit({ type: 'tool', name, summary: shot, shot })
      const r = await renderStills(ctx.root, shot)
      if (!r.stills) throw new Error('the render produced no stills')
      ctx.renders.set(shot, r.stills)
      return stillBlocks(r.stills)
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
      ctx.checks.push({ shot, results, summary })
      const failed = results.filter(r => !r.pass).map(r => r.rule)
      emit({ type: 'tool', name, summary: `${shot}: ${failed.length ? `failed ${failed.join(', ')}` : 'all passed'}`, shot })
      return 'recorded'
    }
    default:
      throw new Error(`unknown tool ${name}`)
  }
}

// ---------------------------------------------------------------- session

// When a local CLI agent drives the tools, they run in an MCP server
// process the CLI starts (mcp.ts); what they did comes back to the
// sidecar through this file
interface Session {
  touched: string[]
  renders: [string, string[]][]
  checks: ToolContext['checks']
}

export function saveSession(ctx: ToolContext, file: string) {
  const s: Session = { touched: [...ctx.touched], renders: [...ctx.renders], checks: ctx.checks }
  fs.writeFileSync(file, JSON.stringify(s))
}

export function loadSession(ctx: ToolContext, file: string) {
  if (!fs.existsSync(file)) return
  const s = JSON.parse(fs.readFileSync(file, 'utf8')) as Session
  for (const f of s.touched) ctx.touched.add(f)
  for (const [shot, stills] of s.renders) ctx.renders.set(shot, stills)
  ctx.checks.push(...s.checks)
}
