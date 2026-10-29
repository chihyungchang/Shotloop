// Bridge to the Shotloop engine CLI (engine/shotloop/cli.mjs). The agent
// renders only through it: it never runs arbitrary commands.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { emit } from './events.ts'

const CLI = process.env.SHOTLOOP_ENGINE
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'engine', 'shotloop', 'cli.mjs')

export interface ShotStatus {
  id: string
  title: string | null
  start: number
  duration: number
  code: string
  notes: string
  draft: { key: string; state: string; stills: string[] | null; clip: string | null }
  final: { key: string; state: string; stills: string[] | null; clip: string | null }
}

export interface ProjectStatus {
  root: string
  title: string
  slug: string
  track: '2d' | '3d'
  duration: number
  files: { captions: string | null; music: string | null; cover: string | null; publish: string | null }
  shots: ShotStatus[]
}

export interface RenderResult {
  shot: string
  key: string
  stills: string[] | null
  clip: string | null
}

// Runs one engine command with --json; progress events are passed on to
// our own output so the app can show them while the agent waits
export function engine<T>(args: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [CLI, ...args, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let result: T | undefined
    let error = ''
    let buf = ''
    p.stdout.on('data', d => {
      buf += d
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (!line.trim()) continue
        try {
          const ev = JSON.parse(line)
          if (ev.type === 'result') result = ev.value
          else if (ev.type === 'error') error = ev.message
          else emit({ ...ev, source: 'engine' })
        } catch {
          // not an event line
        }
      }
    })
    p.stderr.on('data', d => {
      error = (error + d).slice(-2000)
    })
    p.on('error', reject)
    p.on('close', code => {
      if (code === 0 && result !== undefined) resolve(result)
      else reject(new Error(error.trim() || `engine exited ${code}`))
    })
  })
}

export const status = (project: string) => engine<ProjectStatus>(['status', project])

export const renderStills = (project: string, shot: string) =>
  engine<RenderResult>(['render', project, '--shot', shot, '--stills'])
