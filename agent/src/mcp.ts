#!/usr/bin/env node
// The agent's tools as an MCP server (stdio), for local CLI agents
// (Claude Code, Codex, Gemini CLI). The CLI starts this process with the
// task's scope in the environment; it offers exactly the tools of
// tools.ts and nothing else, and records what they did in the session
// file the sidecar reads back.
//
//   SHOTLOOP_ROOT       project root
//   SHOTLOOP_WRITABLE   writable paths, comma-separated (see tools.ts)
//   SHOTLOOP_CHECKLIST  checklist file
//   SHOTLOOP_SESSION    session file to write after every call

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { toStderr } from './events.ts'
import { runTool, saveSession, TOOLS, type ToolContext } from './tools.ts'

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`${k} is not set`)
  return v
}

const ctx: ToolContext = {
  root: env('SHOTLOOP_ROOT'),
  checklist: env('SHOTLOOP_CHECKLIST'),
  writable: (process.env.SHOTLOOP_WRITABLE ?? '').split(',').filter(Boolean),
  touched: new Set(),
  renders: new Map(),
  checks: []
}
const session = env('SHOTLOOP_SESSION')

// stdout carries the MCP protocol: nothing else may be printed there
toStderr()
console.log = (...a: unknown[]) => console.error(...a)

const server = new Server({ name: 'shotloop', version: '0.1.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.input_schema }))
}))

server.setRequestHandler(CallToolRequestSchema, async req => {
  try {
    const result = await runTool(ctx, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>)
    saveSession(ctx, session)
    const blocks = typeof result === 'string' || result == null ? [{ type: 'text', text: result ?? '' }] : result
    return {
      content: blocks.map(b => {
        if (b.type === 'image' && 'source' in b && b.source.type === 'base64') {
          return { type: 'image' as const, data: b.source.data, mimeType: b.source.media_type }
        }
        return { type: 'text' as const, text: 'text' in b ? String(b.text) : '' }
      })
    }
  } catch (err) {
    return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true }
  }
})

await server.connect(new StdioServerTransport())
