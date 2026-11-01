// The engine's JSON files on disk (shotloop.json, the cache's records).
// Kept below project.mjs and cache.mjs so both import it without a cycle.
// A write goes to a temporary name and is renamed into place, so a reader
// (the app, a second engine process) never sees half a file.

import fs from 'node:fs'
import path from 'node:path'

// A missing file reads as `fallback`; one that is there but doesn't parse
// is an error naming the file, never silently the fallback
export function readJson(file, fallback) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`${file}: ${err.message}`)
  }
}

export function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  try {
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, file)
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

export const writeJson = (file, value) => writeAtomic(file, JSON.stringify(value, null, 2) + '\n')
