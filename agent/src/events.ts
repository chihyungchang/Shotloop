// Output of the sidecar: with --json one JSON event per line on stdout
// (the app reads them), otherwise readable lines for a terminal.

// A build's progress (main.ts build): the phase it is in, and each shot
// as its agent starts, writes the shot's code and finishes
export type BuildPhase = 'world' | 'parts' | 'shots'
export type ShotState = 'start' | 'written' | 'done'

export type AgentEvent =
  | { type: 'phase'; phase: BuildPhase }
  | { type: 'shot'; id: string; state: ShotState }
  | { type: string; [k: string]: unknown }

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
    process.stdout.write(JSON.stringify(ev) + '\n')
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
      process.stdout.write(`\r  ${ev.shot ?? ''} ${ev.stage} ${ev.done}/${ev.total}   ${ev.done === ev.total ? '\n' : ''}`)
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

// Something went wrong that the task survives: said, not swallowed
export const warn = (message: string) => emit({ type: 'log', level: 'warning', message: `warning: ${message}` })

// Exits once stdout is written out: process.exit drops what a pipe hasn't
// taken yet (the same as engine/shotloop/cli.mjs). Never resolves, so
// `await exit(1)` stops the caller.
export const exit = (code: number) =>
  new Promise<never>(() => process.stdout.write('', () => process.exit(code)))
