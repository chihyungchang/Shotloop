// Local CLI agents (Claude Code, Codex, Gemini CLI) as the agent's brain.
// The CLI runs headless in an empty temporary folder; it works on the
// project only through the Shotloop MCP server (mcp.ts), which offers
// exactly the narrow tools of tools.ts (docs/PRD.md §9). What those tools
// did comes back through the session file. How far each CLI's own tools
// are shut:
// - Claude Code: none of its built-in tools, only the Shotloop server.
// - Gemini CLI: an empty core tool list (tools.core) and the Shotloop
//   server trusted, so no --yolo is needed and nothing else runs.
// - Codex: its shell tool switched off (features.shell_tool) inside a
//   read-only sandbox. A Codex version without that switch keeps its
//   shell, which can then read (never write) the disk outside the project.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { emit } from './events.ts'
import { failure, spawnLines, type Run } from './spawn.ts'
import { codeOf, loadSession, type ToolContext } from './tools.ts'

export type CliId = 'claude' | 'codex' | 'gemini'

// Each CLI with its maker, a few models for the picker (the CLI's own
// default when none is chosen) and how to install it
export const CLIS: { id: CliId; name: string; bin: string; vendor: string; note?: string; models: string[]; install: string; url: string }[] = [
  { id: 'claude', name: 'Claude Code', bin: 'claude', vendor: 'Anthropic',
    models: ['opus', 'sonnet', 'haiku', 'claude-opus-5-5', 'claude-sonnet-5-5'],
    install: 'npm install -g @anthropic-ai/claude-code', url: 'https://docs.anthropic.com/en/docs/claude-code' },
  { id: 'codex', name: 'Codex CLI', bin: 'codex', vendor: 'OpenAI', note: 'experimental',
    models: ['gpt-5.5', 'gpt-5.2'], install: 'npm install -g @openai/codex', url: 'https://github.com/openai/codex' },
  { id: 'gemini', name: 'Gemini CLI', bin: 'gemini', vendor: 'Google', note: 'experimental',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-pro'], install: 'npm install -g @google/gemini-cli', url: 'https://github.com/google-gemini/gemini-cli' }
]

const MCP = fileURLToPath(new URL('./mcp.ts', import.meta.url))

// Where CLIs are installed besides PATH (apps started from Finder get a
// short PATH)
function searchDirs() {
  const home = os.homedir()
  const dirs = [path.join(home, '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.npm-global/bin'), path.join(home, '.bun/bin')]
  const nvm = path.join(home, '.nvm/versions/node')
  if (fs.existsSync(nvm)) for (const v of fs.readdirSync(nvm)) dirs.push(path.join(nvm, v, 'bin'))
  return [...(process.env.PATH ?? '').split(':'), ...dirs]
}

export function findBin(bin: string): string | null {
  for (const d of searchDirs()) {
    const p = path.join(d, bin)
    if (d && fs.existsSync(p)) return p
  }
  return null
}

// A run longer than this is stopped: a CLI stuck in a loop or waiting on
// something never ends otherwise. Generous: a 3D world renders for minutes
const CLI_TIMEOUT_MIN = 45

const run = (bin: string, args: string[], cwd: string, onLine: (line: string) => void) =>
  spawnLines(bin, args, { cwd, env: { ...process.env, PATH: searchDirs().join(':') }, timeoutMs: CLI_TIMEOUT_MIN * 60_000 }, onLine)

// What a failed run says: its own error, else its stderr's last line
function check(name: string, r: Run, error?: string | null) {
  if (r.timedOut) throw new Error(`${name} ran longer than ${CLI_TIMEOUT_MIN} minutes and was stopped (CLI_TIMEOUT_MIN in agent/src/cli.ts)`)
  if (error || r.code) throw new Error(`${name}: ${error || failure(r)}`)
}

// One line of tool input for the activity log (Codex may send it as JSON text)
const brief = (input: unknown) => {
  let o = (input ?? {}) as Record<string, unknown>
  if (typeof input === 'string') {
    try {
      o = JSON.parse(input)
    } catch {
      // free text: nothing to show
      o = {}
    }
  }
  return String(o.path ?? o.shot ?? o.dir ?? '')
}
const shortTool = (name: string) => name.replace(/^mcp__shotloop__/, '')

// A tool call the CLI reports. The tools run in the MCP server, whose
// events don't reach the app, so a shot's code being written is told
// from the call
function toolCalled(name: string, input: unknown) {
  const tool = shortTool(name)
  emit({ type: 'tool', name: tool, summary: brief(input) })
  const shot = /^(write|edit)_file$/.test(tool) && codeOf(brief(input))
  if (shot) emit({ type: 'shot', id: shot, state: 'written' })
}

export interface CliOptions {
  model?: string
  system: string
  prompt: string
  ctx: ToolContext
  effort?: string
  maxTurns: number
}

export async function runCli(cli: CliId, { model, system, prompt, ctx, effort, maxTurns }: CliOptions): Promise<string> {
  const def = CLIS.find(c => c.id === cli)!
  const bin = findBin(def.bin)
  if (!bin) throw new Error(`${def.name} is not installed (${def.bin} not found)`)

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-agent-'))
  const session = path.join(work, 'session.json')
  const server = {
    command: process.execPath,
    args: [MCP],
    env: {
      SHOTLOOP_ROOT: ctx.root,
      SHOTLOOP_WRITABLE: ctx.writable.join(','),
      SHOTLOOP_CHECKLIST: ctx.checklist,
      SHOTLOOP_SESSION: session,
      ...(process.env.SHOTLOOP_ENGINE ? { SHOTLOOP_ENGINE: process.env.SHOTLOOP_ENGINE } : {})
    }
  }
  let last = ''

  try {
    if (cli === 'claude') {
      // Built-in tools off, only the Shotloop server, anything else denied
      const config = path.join(work, 'mcp.json')
      fs.writeFileSync(config, JSON.stringify({ mcpServers: { shotloop: server } }))
      const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose',
        '--mcp-config', config, '--strict-mcp-config', '--tools', '',
        '--allowedTools', 'mcp__shotloop', '--permission-mode', 'dontAsk',
        '--max-turns', String(maxTurns), '--append-system-prompt', system, ...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])]
      // Assigned in the line callback, so TypeScript can't narrow them
      let result = null as string | null
      let failed = null as string | null
      const r = await run(bin, args, work, line => {
        let ev: any
        try {
          ev = JSON.parse(line)
        } catch {
          return
        }
        if (ev.type === 'assistant') {
          for (const b of ev.message?.content ?? []) {
            if (b.type === 'text' && b.text.trim()) emit({ type: 'text', text: (last = b.text.trim()) })
            if (b.type === 'tool_use') toolCalled(b.name, b.input)
          }
        } else if (ev.type === 'rate_limit_event') {
          // The subscription's limits (5-hour and weekly windows), for the app
          const info = ev.rate_limit_info ?? {}
          emit({ type: 'usage', cli: 'claude', status: info.status, windows: info.unifiedWindows ?? null })
        } else if (ev.type === 'result') {
          if (ev.is_error) failed = String(ev.result ?? ev.subtype ?? 'error')
          else result = ev.result ?? null
        }
      })
      check(def.name, r, failed)
      last = result?.trim() || last
    } else if (cli === 'codex') {
      // No shell, a read-only sandbox; writes go through the MCP tools only.
      // Codex has no turn limit: the timeout bounds it
      const toml = (v: unknown) => JSON.stringify(v)
      const lastFile = path.join(work, 'last.txt')
      const envToml = `{${Object.entries(server.env).map(([k, v]) => `${k}=${toml(v)}`).join(',')}}`
      const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', '-C', work,
        '-c', 'features.shell_tool=false',
        '-c', `mcp_servers.shotloop.command=${toml(server.command)}`,
        '-c', `mcp_servers.shotloop.args=${toml(server.args)}`,
        '-c', `mcp_servers.shotloop.env=${envToml}`,
        '--output-last-message', lastFile, ...(model ? ['-m', model] : []),
        ...(effort ? ['-c', `model_reasoning_effort=${toml(effort === 'max' || effort === 'xhigh' ? 'high' : effort)}`] : []),
        `${system}\n\n${prompt}`]
      const r = await run(bin, args, work, line => {
        try {
          const ev = JSON.parse(line)
          const text = ev.msg?.message ?? ev.item?.text
          if (typeof text === 'string' && text.trim()) emit({ type: 'text', text: (last = text.trim()) })
          const call = ev.msg?.invocation ?? ev.item
          if (call?.tool) toolCalled(String(call.tool), call.arguments)
        } catch {
          // not an event line
        }
      })
      check(def.name, r)
      if (fs.existsSync(lastFile)) last = fs.readFileSync(lastFile, 'utf8').trim() || last
    } else {
      // Gemini CLI reads its settings from .gemini/settings.json in its
      // working folder: an allowlist, not a denylist. No core tools at all
      // (an empty tools.core enables none); the Shotloop server trusted, so
      // its calls need no confirmation and the run needs no --yolo (which
      // would also approve anything else)
      fs.mkdirSync(path.join(work, '.gemini'))
      fs.writeFileSync(path.join(work, '.gemini', 'settings.json'), JSON.stringify({
        mcpServers: { shotloop: { ...server, trust: true } },
        tools: { core: [] },
        model: { maxSessionTurns: maxTurns }
      }))
      const out: string[] = []
      const r = await run(bin, ['-p', `${system}\n\n${prompt}`, '--allowed-mcp-server-names', 'shotloop', ...(model ? ['-m', model] : [])], work, line => {
        out.push(line)
        if (line.trim()) emit({ type: 'log', message: line.trim().slice(0, 200) })
      })
      check(def.name, r)
      last = out.join('\n').trim()
    }
    loadSession(ctx, session)
    return last
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
