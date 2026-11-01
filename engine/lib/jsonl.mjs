// The JSON-lines side of a command the app runs (the engine CLI, the
// agent): its flags in, its events out, one JSON object per line on
// stdout. The events are typed in engine/shotloop/protocol.d.ts.

import { parseArgs } from 'node:util'

export const emit = event => process.stdout.write(JSON.stringify(event) + '\n')

// Exits once stdout is written out: process.exit drops what a pipe hasn't
// taken yet, which cut long results (a status past 64 KB) short
export const exit = code => process.stdout.write('', () => process.exit(code))

// node:util parseArgs, except that a value starting with "-" ("-5 tips",
// "- a list") would read as an option: values of string options are
// joined to their flag first. A parse error comes back as a JSON error
// event and exits
export function parseFlags(argv, options) {
  const joined = []
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].startsWith('--') && !argv[i].includes('=') ? argv[i].slice(2) : null
    if (name && options[name]?.type === 'string' && i + 1 < argv.length) joined.push(`--${name}=${argv[++i]}`)
    else joined.push(argv[i])
  }
  try {
    return parseArgs({ args: joined, allowPositionals: true, options })
  } catch (err) {
    emit({ type: 'error', message: err.message })
    process.exit(1)
  }
}
