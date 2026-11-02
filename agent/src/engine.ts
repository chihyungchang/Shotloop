// Bridge to the Shotloop engine CLI (engine/shotloop/cli.mjs). The agent
// renders only through it: it never runs arbitrary commands.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLI } from './enginelib.ts'
import { emit } from './events.ts'
import { spawnLines } from './spawn.ts'


export interface ShotStatus {
  id: string
  title: string | null
  start: number
  duration: number
  code: string
  notes: string
  // The voice-over: the shot's line, and its sentences timed in the shot
  say?: string | null
  cues?: { text: string; at: number; end: number }[]
  draft: { key: string; state: string; stills: string[] | null; clip: string | null }
  final: { key: string; state: string; stills: string[] | null; clip: string | null }
}

export interface ProjectStatus {
  root: string
  title: string
  slug: string
  track: '2d' | '3d'
  // How its frames are drawn: a page (2D), WebGL or Blender (3D)
  renderer: 'page' | 'webgl' | 'blender'
  size: { width: number; height: number }
  duration: number
  files: { captions: string | null; music: string | null; cover: string | null; publish: string | null }
  shots: ShotStatus[]
  // 2D: the look; the visual style (engine/shotloop/styles.mjs); what the
  // planner still decides (2D or 3D, the length)
  look?: string | null
  style?: string | null
  // The person chose the style: the planner keeps it
  styleChosen?: boolean
  trackAuto?: boolean
  lengthAuto?: boolean
  // The language spoken and written; the voice-over (engine/shotloop/voice.mjs)
  lang?: string | null
  voice?: { on: boolean; voice?: string; speed?: number; gain?: number } | null
  // The voice-over plays: on, with lines (engine/shotloop/cues.mjs voiceOn)
  voiced?: boolean
}

export interface RenderResult {
  shot: string
  key: string
  stills: string[] | null
  clip: string | null
  // A voiced 2D shot's subtitle check, run before the render: what the
  // subtitles would cover, in shot seconds (engine/shotloop/check.mjs)
  subtitles?: { from: number; to: number; what: string }[]
}

// Runs one engine command with --json; progress events are passed on to
// our own output so the app can show them while the agent waits
export async function engine<T>(args: string[]): Promise<T> {
  let result: T | undefined
  let error = ''
  const r = await spawnLines(process.execPath, [CLI, ...args, '--json'], {}, line => {
    if (!line.trim()) return
    try {
      const ev = JSON.parse(line)
      if (ev.type === 'result') result = ev.value
      else if (ev.type === 'error') error = ev.message
      else emit({ ...ev, source: 'engine' })
    } catch {
      // not an event line
    }
  })
  if (r.code === 0 && result !== undefined) return result
  // The engine's own error, else what it printed (a stack trace)
  throw new Error(error.trim() || r.stderr.trim().slice(-2000) || `engine exited ${r.code}`)
}

export const status = (project: string) => engine<ProjectStatus>(['status', project])

export const renderStills = (project: string, shot: string) =>
  engine<RenderResult>(['render', project, '--shot', shot, '--stills'])

// The cover (thumb.html) rendered to .shotloop/cover.png, its background
// frame set first: { shot, time } or null for none (undefined: unchanged)
export const renderCover = (project: string, frame?: { shot: string; time: number } | null) =>
  engine<string | null>(['cover', project, '--preview',
    ...(frame ? ['--frame', `${frame.shot}@${frame.time}`] : frame === null ? ['--none'] : [])])
