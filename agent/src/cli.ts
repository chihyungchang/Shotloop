// Local CLI agents (Claude Code, Codex, Gemini CLI) as the agent's brain.
// The CLI runs headless in an empty temporary folder with its own tools
// switched off or sandboxed read-only; the only way it can touch the
// project is the Shotloop MCP server (mcp.ts), which offers exactly the
// narrow tools of tools.ts (docs/PRD.md §9). What those tools did comes
// back through the session file.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { emit } from './events.ts'
import { loadSession, type ToolContext } from './tools.ts'

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

function run(bin: string, args: string[], cwd: string, onLine: (line: string) => void): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: searchDirs().join(':') } })
    let buf = ''
    let stderr = ''
    p.stdout.on('data', d => {
      buf += d
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        onLine(buf.slice(0, nl))
        buf = buf.slice(nl + 1)
      }
    })
    p.stderr.on('data', d => {
      stderr = (stderr + d).slice(-4000)
    })
    p.on('error', reject)
    p.on('close', code => {
      if (buf) onLine(buf)
      resolve({ code: code ?? 1, stderr })
    })
  })
}

// One line of tool input for the activity log
const brief = (input: unknown) => {
  const o = (input ?? {}) as Record<string, unknown>
  return String(o.path ?? o.shot ?? o.dir ?? '')
}
const shortTool = (name: string) => name.replace(/^mcp__shotloop__/, '')

export async function runCli(cli: CliId, model: string | undefined, system: string, prompt: string, ctx: ToolContext, effort?: string): Promise<string> {
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
        '--append-system-prompt', system, ...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])]
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
            if (b.type === 'tool_use') emit({ type: 'tool', name: shortTool(b.name), summary: brief(b.input) })
          }
        } else if (ev.type === 'result') {
          if (ev.is_error) failed = String(ev.result ?? ev.subtype ?? 'error')
          else result = ev.result ?? null
        }
      })
      if (failed || r.code) throw new Error(`Claude Code: ${failed ?? r.stderr.trim().split('\n').at(-1) ?? `exited ${r.code}`}`)
      last = result?.trim() || last
    } else if (cli === 'codex') {
      // Read-only sandbox; writes go through the MCP tools only
      const toml = (v: unknown) => JSON.stringify(v)
      const lastFile = path.join(work, 'last.txt')
      const envToml = `{${Object.entries(server.env).map(([k, v]) => `${k}=${toml(v)}`).join(',')}}`
      const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', '-C', work,
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
          const tool = ev.msg?.invocation?.tool ?? ev.item?.tool
          if (tool) emit({ type: 'tool', name: String(tool) })
        } catch {
          // not an event line
        }
      })
      if (r.code) throw new Error(`Codex: ${r.stderr.trim().split('\n').at(-1) ?? `exited ${r.code}`}`)
      if (fs.existsSync(lastFile)) last = fs.readFileSync(lastFile, 'utf8').trim() || last
    } else {
      // Gemini CLI reads MCP servers from .gemini/settings.json in its
      // working folder; its own file and shell tools are excluded
      fs.mkdirSync(path.join(work, '.gemini'))
      fs.writeFileSync(path.join(work, '.gemini', 'settings.json'), JSON.stringify({
        mcpServers: { shotloop: server },
        excludeTools: ['run_shell_command', 'write_file', 'replace', 'read_file', 'read_many_files', 'glob', 'search_file_content', 'list_directory', 'web_fetch', 'google_web_search', 'save_memory']
      }))
      const out: string[] = []
      const r = await run(bin, ['-p', `${system}\n\n${prompt}`, '--yolo', '--allowed-mcp-server-names', 'shotloop', ...(model ? ['-m', model] : [])], work, line => {
        out.push(line)
        if (line.trim()) emit({ type: 'log', message: line.trim().slice(0, 200) })
      })
      if (r.code) throw new Error(`Gemini CLI: ${r.stderr.trim().split('\n').at(-1) ?? `exited ${r.code}`}`)
      last = out.join('\n').trim()
    }
    loadSession(ctx, session)
    return last
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
