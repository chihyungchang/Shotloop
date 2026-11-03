// What each AI run costs, kept with its project in .shotloop/ai-usage.jsonl
// (one JSON line a step), for the app's Usage page: which steps of which
// task take the tokens and the time, so they can be made cheaper.

import fs from 'node:fs'
import path from 'node:path'
import type { AiMeter, AiStep } from '../../engine/shotloop/protocol.d.ts'
import { warn } from './events.ts'

export const meter = (): AiMeter => ({ input: 0, output: 0, thinking: 0, cacheRead: 0, cacheWrite: 0, cost: null, turns: 0, model: null })

// The project and task this process records for; one run of a task, by
// when it started
let book: { file: string; run: string; task: string } | null = null

export function openLedger(root: string, task: string) {
  book = { file: path.join(root, '.shotloop', 'ai-usage.jsonl'), run: new Date().toISOString(), task }
}

// One step's line. Appended whole in one write (steps that run at once
// share the process), so a reader sees complete lines; a failure to
// record is told, never fails the run
export function record(entry: Omit<AiStep, 'run' | 'task' | 'at'>) {
  if (!book) return
  try {
    fs.mkdirSync(path.dirname(book.file), { recursive: true })
    fs.appendFileSync(book.file, JSON.stringify({ run: book.run, task: book.task, at: new Date().toISOString(), ...entry }) + '\n')
  } catch (err) {
    warn(`the AI usage could not be recorded (${(err as Error).message})`)
  }
}
