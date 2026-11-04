// Output of the sidecar: with --json one JSON event per line on stdout
// (the app reads them), otherwise readable lines for a terminal.

import { emitLine, exit as exitAfterFlush } from './enginelib.ts'
import type { PhaseEvent, ShotEvent } from '../../engine/shotloop/protocol.d.ts'

// The events are typed in engine/shotloop/protocol.d.ts; a build's
// progress (main.ts build) is its phase and each shot's state
export type AgentEvent = PhaseEvent | ShotEvent | { type: string; [k: string]: unknown }

let json = false
let quiet = false
export const setJson = (on: boolean) => {
  json = on
}
// In the MCP server stdout is the protocol: events go to stderr
export const toStderr = () => {
  quiet = true
}

export function emit(ev: AgentEvent) {
  if (quiet) {
    process.stderr.write(JSON.stringify(ev) + '\n')
    return
  }
  if (json) {
    emitLine(ev)
    return
  }
  switch (ev.type) {
    case 'text':
      console.log(`\n${ev.text}`)
      break
    case 'tool':
      console.log(`  → ${ev.name} ${ev.summary ?? ''}`)
      break
    case 'progress':
      // A model's tokens have no total (local.ts)
      process.stdout.write(ev.total ? `\r  ${ev.shot ?? ''} ${ev.stage} ${ev.done}/${ev.total}   ${ev.done === ev.total ? '\n' : ''}` : `\r  ${ev.stage} ${ev.done}   `)
      break
    case 'phase':
      console.log(`\n${ev.phase}`)
      break
    case 'shot':
      console.log(`  ${ev.id} ${ev.state}`)
      break
    case 'log':
      console.log(`  ${ev.message}`)
      break
    case 'error':
      console.error(`error: ${ev.message}`)
      break
    case 'result':
      console.log(JSON.stringify(ev.value, null, 2))
      break
  }
}

// An error's message
export const reason = (err: unknown) => (err instanceof Error ? err.message : String(err))

// Something went wrong that the task survives: said, not swallowed
export const warn = (message: string) => emit({ type: 'log', level: 'warning', message: `warning: ${message}` })

// Exits once stdout is written out (engine/lib/jsonl.mjs). Never resolves,
// so `await exit(1)` stops the caller.
export const exit = (code: number) => new Promise<never>(() => exitAfterFlush(code))
