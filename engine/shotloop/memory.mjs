// The AI's memory, one for every project: notes the person wrote, and
// lessons the AI learned while building (what took more than one render
// to get right). Every agent task reads it in its instructions, so it is
// kept short: a lesson is a sentence or two, the AI may keep at most
// MAX_LEARNED, and when it is full a new lesson has to be merged into an
// old one. The person can delete any entry.
//
//   memory/<id>.json   { by: user|ai, track: all|2d|3d, text, from, created }
//
// One file per entry, so agents building shots at the same time (each its
// own process with a CLI agent) never overwrite each other's lessons.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readJson, safeId, writeJson } from './files.mjs'

const MEMORY = process.env.SHOTLOOP_MEMORY ?? path.join(os.homedir(), '.shotloop', 'memory')
export const MAX_LEARNED = 30
export const MAX_CHARS = 500
const TRACKS = ['all', '2d', '3d']

const memoryId = s => safeId(s, 'a memory id')
const fileOf = id => path.join(MEMORY, `${memoryId(id)}.json`)

function read(id) {
  const m = readJson(fileOf(id), null)
  return m && { id, by: m.by === 'ai' ? 'ai' : 'user', track: TRACKS.includes(m.track) ? m.track : 'all',
    text: String(m.text ?? ''), from: m.from ?? null, created: m.created ?? null }
}

// Oldest first, so the instructions keep their order as entries are added
export function list() {
  if (!fs.existsSync(MEMORY)) return []
  return fs.readdirSync(MEMORY)
    .filter(f => /^[\w.-]+\.json$/.test(f))
    .map(f => read(f.slice(0, -5)))
    .filter(m => m?.text)
    .sort((a, b) => String(a.created).localeCompare(String(b.created)))
}

// A new entry. by "ai": a lesson, which may replace one of the AI's own
// (a merge) and is refused when the AI's share is full; the person's
// notes are always for every track
export function add({ text, by = 'user', track = 'all', from = null, replaces = null }) {
  text = String(text ?? '').trim().replace(/\s+/g, ' ')
  if (!text) throw new Error('a memory needs some text')
  if (text.length > MAX_CHARS) throw new Error(`a memory is at most ${MAX_CHARS} characters (this one has ${text.length}); say it shorter`)
  const ai = by === 'ai'
  if (!TRACKS.includes(track)) throw new Error(`track is one of ${TRACKS.join(', ')}`)
  const old = replaces ? read(memoryId(replaces)) : null
  if (replaces && (!old || old.by !== 'ai')) throw new Error(`no lesson ${replaces} to replace (only the AI's own lessons can be)`)
  if (ai && !old && list().filter(m => m.by === 'ai').length >= MAX_LEARNED) {
    throw new Error(`the memory holds ${MAX_LEARNED} lessons: merge this one into the closest lesson (replaces its id) or leave it out`)
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  writeJson(fileOf(id), { by: ai ? 'ai' : 'user', track: ai ? track : 'all', text, from, created: new Date().toISOString() })
  if (old) fs.rmSync(fileOf(old.id), { force: true })
  return read(id)
}

export function remove(id) {
  const file = fileOf(id)
  if (!fs.existsSync(file)) throw new Error(`no memory ${id}`)
  fs.rmSync(file)
  return { removed: memoryId(id) }
}
