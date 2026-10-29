// Which model drives the agent, chosen in the app's Settings and passed
// in the environment:
//
//   SHOTLOOP_PROVIDER     api (default) | cli | local; "anthropic" is the
//                         api backend with Anthropic's own endpoint
//   SHOTLOOP_API_PROTOCOL api: anthropic (/v1/messages) | openai (chat completions)
//   SHOTLOOP_API_URL      api: base URL; empty for Anthropic's own API
//   SHOTLOOP_API_KEY      api: the user's key (or ANTHROPIC_API_KEY)
//   SHOTLOOP_CLI          cli: claude | codex | gemini
//   SHOTLOOP_MODEL        api or cli: a model name (optional for Anthropic)
//   SHOTLOOP_LOCAL_URL    local: OpenAI-compatible base URL (…/v1)
//   SHOTLOOP_LOCAL_MODEL  local: model name
//   SHOTLOOP_LOCAL_KEY    local: API key, if the server wants one
//
// The many hosted providers (OpenAI, Gemini, DeepSeek, OpenRouter, Qwen,
// GLM, Kimi, MiniMax…) are presets in the app: a protocol and a URL.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CLIS, findBin, runCli, type CliId } from './cli.ts'
import { listModels as listOpenAiModels, runLocal } from './local.ts'
import { MODELS, runAgent as runAnthropic, type AgentOptions } from './loop.ts'
import type { ToolContext } from './tools.ts'

export type Provider = 'api' | 'cli' | 'local'
export type Protocol = 'anthropic' | 'openai'

export function provider(): Provider {
  const p = process.env.SHOTLOOP_PROVIDER
  return p === 'cli' || p === 'local' ? p : 'api'
}

function api() {
  const protocol: Protocol = process.env.SHOTLOOP_API_PROTOCOL === 'openai' ? 'openai' : 'anthropic'
  const url = process.env.SHOTLOOP_API_URL || ''
  const key = process.env.SHOTLOOP_API_KEY || (protocol === 'anthropic' ? process.env.ANTHROPIC_API_KEY ?? '' : '')
  return { protocol, url, key, model: process.env.SHOTLOOP_MODEL || '' }
}

// Servers on this machine need no key
export const isLoopback = (url: string) => {
  try {
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

export function describe() {
  switch (provider()) {
    case 'cli':
      return `${CLIS.find(c => c.id === process.env.SHOTLOOP_CLI)?.name ?? 'CLI'}${process.env.SHOTLOOP_MODEL ? ` (${process.env.SHOTLOOP_MODEL})` : ''}`
    case 'local':
      return `${process.env.SHOTLOOP_LOCAL_MODEL} @ ${process.env.SHOTLOOP_LOCAL_URL}`
    default: {
      const { url, model } = api()
      return `${model || 'Claude'} @ ${url ? new URL(url).host : 'api.anthropic.com'}`
    }
  }
}

// Fails early with what to set when the chosen backend is not usable
export function preflight() {
  switch (provider()) {
    case 'api': {
      const { protocol, url, key, model } = api()
      if (!key && !isLoopback(url) && !process.env.ANTHROPIC_AUTH_TOKEN) {
        throw new Error('no API key: add yours in Settings, or choose a local CLI or a local model')
      }
      if (protocol === 'openai' && !url) throw new Error('no API base URL (Settings → AI)')
      if (url && !model) throw new Error('no model chosen (Settings → AI)')
      break
    }
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
    default: {
      const { protocol, url, key, model } = api()
      if (protocol === 'openai') return runLocal({ url, model, apiKey: key || undefined }, opts.system, opts.prompt, opts.ctx)
      return runAnthropic({ ...opts, model: model || MODELS[task], baseURL: url || undefined, apiKey: key || undefined })
    }
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
    { id: 'lmstudio', name: 'LM Studio', url: 'http://localhost:1234/v1' },
    { id: 'vllm', name: 'vLLM', url: 'http://localhost:8000/v1' },
    { id: 'llamacpp', name: 'llama.cpp', url: 'http://localhost:8080/v1' }
  ].map(async s => {
    try {
      return { ...s, running: true, models: await listOpenAiModels(s.url) }
    } catch {
      return { ...s, running: false, models: [] as string[] }
    }
  }))
  return { clis, servers }
}

// The chat models an endpoint offers, for the model picker; doubles as
// the connection test
export async function listModels(url: string, key?: string, protocol: Protocol = 'openai'): Promise<string[]> {
  if (protocol === 'openai') return listOpenAiModels(url, key)
  const base = (url || 'https://api.anthropic.com').replace(/\/+$/, '').replace(/\/v1$/, '')
  const res = await fetch(`${base}/v1/models?limit=1000`, {
    headers: { 'anthropic-version': '2023-06-01', ...(key ? { 'x-api-key': key, authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`${base}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { data?: { id: string }[] }
  return (body.data ?? []).map(d => d.id).sort()
}

// The Test button: one tiny request through the chosen backend, outside
// any project (an empty folder, nothing writable)
export async function smokeTest() {
  preflight()
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-test-'))
  const ctx: ToolContext = { root, checklist: path.join(root, 'checklist.md'), writable: [], touched: new Set(), renders: new Map(), checks: [] }
  fs.writeFileSync(ctx.checklist, '')
  const started = Date.now()
  try {
    const reply = await runAgent('routine', {
      effort: 'low',
      system: 'This is a connection test. Do not call any tools.',
      prompt: 'Reply with the single word OK.',
      ctx
    })
    return { ok: true, latencyMs: Date.now() - started, reply: reply.slice(0, 200), backend: describe() }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}
