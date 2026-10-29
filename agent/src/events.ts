// Output of the sidecar: with --json one JSON event per line on stdout
// (the app reads them), otherwise readable lines for a terminal.

export type AgentEvent = { type: string; [k: string]: unknown }

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
