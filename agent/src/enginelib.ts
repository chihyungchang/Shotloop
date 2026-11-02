// The engine modules the agent runs in-process, imported once, typed, from
// the same engine the CLI bridge runs (engine.ts, SHOTLOOP_ENGINE): its
// shared data (styles, looks, the reading time), the voice-over's timing
// and subtitle band, its stills, the AI's memory, the video rules and the
// JSON-lines side of a command.

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { parseArgs, ParseArgsOptionsConfig } from 'node:util'

// The engine CLI: a bundled app's, or this repo's
export const CLI = process.env.SHOTLOOP_ENGINE
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'engine', 'shotloop', 'cli.mjs')
const SHOTLOOP = path.dirname(CLI)
const load = <T>(file: string) => import(pathToFileURL(path.join(SHOTLOOP, file)).href) as Promise<T>

export interface Style {
  id: string
  track: string
  name: { en: string }
  when: string
  avoid: string
  frames: string
  why: string
  looks: string[]
}
export interface Look { id: string; about: string; mood: string; scene?: unknown }

export const { STYLES, styleById, lookFits, LOOKS, readTime } = await load<{
  STYLES: Style[]
  styleById: (id: string) => Style | null
  lookFits: (style: string | null | undefined, look: string) => boolean
  LOOKS: Look[]
  readTime: (text: string) => number
}>('data.mjs')
export const { styleStills } = await load<{ styleStills: (id: string) => string[] }>('styles.mjs')
export const { SUBTITLE_BAND, VOICE_LEAD, VOICE_TAIL } = await load<{
  SUBTITLE_BAND: Record<'portrait' | 'landscape', [number, number]>
  VOICE_LEAD: number
  VOICE_TAIL: number
}>('cues.mjs')
export interface Memory {
  id: string
  by: 'user' | 'ai'
  track: 'all' | '2d' | '3d'
  text: string
  from: string | null
  created: string | null
}
export const memory = await load<{
  list: () => Memory[]
  add: (m: { text: string; by: 'ai'; track: string; from: string | null; replaces: string | null }) => Memory
}>('memory.mjs')
export interface Rule { id: string; track: 'all' | '2d' | '3d'; name: string | null; rule?: string; off?: boolean }
export interface Tool { id: string; group: 'story' | 'science' | 'camera' | 'frame' | 'cut' | 'staging' | 'light' | 'explain' | 'mine'; tracks: ('2d' | '3d')[]; name: string; text: string; text3d?: string; off?: boolean }
export const rules = await load<{
  list: () => { damaged: string | null; fixed: Rule[]; taste: Rule[]; tools: Tool[] }
  asBuilt: (id: string) => boolean
  checklist: (track: string, own?: string | null) => string
}>('rules.mjs')
export const { STILLS } = await load<{ STILLS: readonly string[] }>('cache.mjs')
export const { emit: emitLine, exit, parseFlags } = await load<{
  emit: (event: object) => void
  exit: (code: number) => void
  // node:util parseArgs, with values starting with "-" joined to their flag
  parseFlags: <O extends ParseArgsOptionsConfig>(argv: string[], options: O) => ReturnType<typeof parseArgs<{ args: string[]; options: O; allowPositionals: true }>>
}>('../lib/jsonl.mjs')
