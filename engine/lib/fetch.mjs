// Requests to the web services Shotloop uses (the asset library, web
// search), with failures as errors the person can act on; downloads with
// progress (the speech models in voice/, the render browser in
// browser.mjs): one file checked against its pinned SHA-256, and the size
// of a folder being filled, for progress that has no byte count of its own

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const UA = { 'user-agent': 'Shotloop (https://github.com/chihyungchang/Shotloop)' }

// A request, its failures said so the person can act: no network, a
// refused API key (keyed: the request carries one), too many requests
export async function request(url, { headers = {}, timeout = 20000, method = 'GET', body, keyed = true } = {}) {
  const host = new URL(url).host
  const res = await fetch(url, { method, body, headers: { ...UA, ...headers }, signal: AbortSignal.timeout(timeout) }).catch(e => {
    // A source that is up but slow to answer is not the person's network
    if (e.name === 'TimeoutError') throw new Error(`${host} took too long to answer; try again in a moment`)
    throw new Error(`could not reach ${host} (${e.cause?.code ?? e.name}): check the network`)
  })
  if (keyed && (res.status === 401 || res.status === 403)) throw new Error(`${host}: the API key was refused (${res.status}); check it in Settings`)
  if (res.status === 429) throw new Error(`${host}: too many requests; try again in a moment`)
  if (res.status >= 500) throw new Error(`${host} is having trouble (${res.status}); try again in a moment`)
  if (!res.ok) throw new Error(`${host}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

// A download that receives nothing for this long (no answer, or no bytes)
// is given up, so a stalled connection fails (and frees the lock)
// instead of hanging
const STALL = 60_000

// Fetches url into file, reporting bytes as they come; checked against
// sha256 when given (a file without one is fetched at a pinned revision)
export async function download(url, file, sha256, onBytes) {
  const abort = new AbortController()
  let timer
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(() => abort.abort(), STALL)
  }
  const hash = createHash('sha256')
  arm()
  try {
    const res = await fetch(url, { redirect: 'follow', signal: abort.signal })
    if (!res.ok || !res.body) {
      await res.body?.cancel()
      throw new Error(`${url}: HTTP ${res.status}`)
    }
    const body = Readable.fromWeb(res.body)
    body.on('data', d => {
      arm()
      hash.update(d)
      onBytes(d.length)
    })
    await pipeline(body, fs.createWriteStream(file))
  } catch (err) {
    throw abort.signal.aborted ? new Error(`${path.basename(url)}: the download stalled; check the connection and try again`) : err
  } finally {
    clearTimeout(timer)
  }
  const sum = hash.digest('hex')
  if (sha256 && sum !== sha256) throw new Error(`${path.basename(url)}: SHA-256 ${sum}, expected ${sha256}`)
}

// A folder's size in bytes, 0 when it doesn't exist; files come and go
// while it fills, and du still prints its total when one vanishes under it
export function du(dir) {
  let out
  try {
    out = execFileSync('du', ['-sk', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (err) {
    out = err.stdout ?? ''
  }
  return (Number(out.split('\t')[0]) || 0) * 1024
}
