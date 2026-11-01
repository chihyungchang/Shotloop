// The turn loop every API backend shares: one model request per turn,
// its tool calls answered, until the model stops calling tools.

import { emit } from './events.ts'

// Turns a task may take unless it says otherwise (CLI agents get it too)
export const MAX_TURNS = 40

// turn() makes one request and answers its tool calls; it passes the
// model's text to say() and returns whether another turn follows. The
// result is the model's last text: its summary for the person
export async function runTurns(maxTurns: number, turn: (say: (text: string | null | undefined) => void) => Promise<boolean>): Promise<string> {
  let last = ''
  const say = (text: string | null | undefined) => {
    if (!text?.trim()) return
    last = text.trim()
    emit({ type: 'text', text: last })
  }
  for (let i = 0; i < maxTurns; i++) {
    if (!(await turn(say))) return last
  }
  throw new Error(`stopped after ${maxTurns} turns without finishing`)
}
