// Which model drives the agent, chosen in the app's Settings and passed
// in the environment:
//
//   SHOTLOOP_PROVIDER    anthropic (default) | cli | local
//   ANTHROPIC_API_KEY    anthropic: the user's own key
//   SHOTLOOP_CLI         cli: claude | codex | gemini
//   SHOTLOOP_MODEL       cli or anthropic: a model name (optional)
//   SHOTLOOP_LOCAL_URL   local: OpenAI-compatible base URL (…/v1)
//   SHOTLOOP_LOCAL_MODEL local: model name
//   SHOTLOOP_LOCAL_KEY   local: API key, if the server wants one

import { CLIS, findBin, runCli, type CliId } from './cli.ts'
import { listModels, runLocal } from './local.ts'
import { MODELS, runAgent as runAnthropic, type AgentOptions } from './loop.ts'

export type Provider = 'anthropic' | 'cli' | 'local'

export function provider(): Provider {
  const p = process.env.SHOTLOOP_PROVIDER
  return p === 'cli' || p === 'local' ? p : 'anthropic'
}

export function describe() {
  switch (provider()) {
    case 'cli':
      return `${CLIS.find(c => c.id === process.env.SHOTLOOP_CLI)?.name ?? 'CLI'}${process.env.SHOTLOOP_MODEL ? ` (${process.env.SHOTLOOP_MODEL})` : ''}`
    case 'local':
      return `${process.env.SHOTLOOP_LOCAL_MODEL} @ ${process.env.SHOTLOOP_LOCAL_URL}`
    default:
      return 'Anthropic API'
  }
}

// Fails early with what to set when the chosen backend is not usable
export function preflight() {
  switch (provider()) {
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
        throw new Error('no API key: add yours in Settings, or choose a local CLI or a local model')
      }
      break
    case 'cli': {
      const cli = CLIS.find(c => c.id === process.env.SHOTLOOP_CLI)
      if (!cli) throw new Error('no CLI chosen (Settings → AI)')
      if (!findBin(cli.bin)) throw new Error(`${cli.name} is not installed`)
      break
    }
    case 'local':
      if (!process.env.SHOTLOOP_LOCAL_URL || !process.env.SHOTLOOP_LOCAL_MODEL) {
        throw new Error('no local model chosen (Settings → AI)')
      }
  }
}

// task: "code" for fixes and copy (the stronger model), "routine" for checks
export function runAgent(task: 'code' | 'routine', opts: Omit<AgentOptions, 'model'>): Promise<string> {
  switch (provider()) {
    case 'cli':
      return runCli(process.env.SHOTLOOP_CLI as CliId, process.env.SHOTLOOP_MODEL || undefined, opts.system, opts.prompt, opts.ctx)
    case 'local':
      return runLocal({
        url: process.env.SHOTLOOP_LOCAL_URL!,
        model: process.env.SHOTLOOP_LOCAL_MODEL!,
        apiKey: process.env.SHOTLOOP_LOCAL_KEY || undefined
      }, opts.system, opts.prompt, opts.ctx)
    default:
      return runAnthropic({ ...opts, model: process.env.SHOTLOOP_MODEL || MODELS[task] })
  }
}

// What is available on this machine: CLI agents and local model servers
export async function detect() {
  const { execFileSync } = await import('node:child_process')
  const clis = CLIS.map(c => {
    const bin = findBin(c.bin)
    let version: string | null = null
    if (bin) {
      try {
        version = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0]
      } catch {
        version = null
      }
    }
    return { ...c, path: bin, version }
  })
  const servers = await Promise.all([
    { id: 'ollama', name: 'Ollama', url: 'http://localhost:11434/v1' },
    { id: 'lmstudio', name: 'LM Studio', url: 'http://localhost:1234/v1' }
  ].map(async s => {
    try {
      return { ...s, running: true, models: await listModels(s.url) }
    } catch {
      return { ...s, running: false, models: [] as string[] }
    }
  }))
  return { clis, servers }
}

export { listModels }
