// One file downloaded with progress, checked against its pinned SHA-256
// when it has one (models.mjs and cosyvoice.mjs fetch through it)

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// A download that receives nothing for this long is given up, so a
// stalled connection fails (and frees the lock) instead of hanging
const STALL = 60_000

// Fetches url into file, reporting bytes as they come
export async function download(url, file, sha256, onBytes) {
  const abort = new AbortController()
  let timer = setTimeout(() => abort.abort(), STALL)
  const res = await fetch(url, { redirect: 'follow', signal: abort.signal })
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`)
  const hash = createHash('sha256')
  const body = Readable.fromWeb(res.body)
  body.on('data', d => {
    clearTimeout(timer)
    timer = setTimeout(() => abort.abort(), STALL)
    hash.update(d)
    onBytes(d.length)
  })
  try {
    await pipeline(body, fs.createWriteStream(file))
  } catch (err) {
    throw abort.signal.aborted ? new Error(`${path.basename(url)}: the download stalled; check the connection and try again`) : err
  } finally {
    clearTimeout(timer)
  }
  const sum = hash.digest('hex')
  if (sha256 && sum !== sha256) throw new Error(`${path.basename(url)}: SHA-256 ${sum}, expected ${sha256}`)
}
