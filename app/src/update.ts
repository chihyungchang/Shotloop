// Updates from GitHub releases (the Tauri updater: latest.json on the
// latest release, signed): checked at launch and every few hours in a
// built app, or on demand from Settings → About. Installing downloads the
// new version, replaces the app and restarts it.

import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useEffect, useState } from 'react'

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'available'; version: string; notes: string }
  | { kind: 'downloading'; version: string; done: number; total: number | null }
  | { kind: 'restarting' }
  | { kind: 'failed'; error: string }
  // Jobs are running: installing would restart the app under them
  | { kind: 'busy'; version: string }

const EVERY = 6 * 3600 * 1000

// One update state for the whole app, shared by the sidebar and Settings
let state: UpdateState = { kind: 'idle' }
let pending: Update | null = null
const listeners = new Set<(s: UpdateState) => void>()
const set = (s: UpdateState) => {
  state = s
  listeners.forEach(l => l(s))
}

export async function checkForUpdate(quiet = false) {
  if (state.kind === 'downloading' || state.kind === 'restarting') return
  if (!quiet) set({ kind: 'checking' })
  try {
    pending = await check()
    if (pending) set({ kind: 'available', version: pending.version, notes: pending.body ?? '' })
    else if (!quiet || state.kind === 'checking') set({ kind: 'none' })
  } catch (e) {
    // A quiet check failing (offline, no release yet) says nothing
    if (!quiet) set({ kind: 'failed', error: String(e) })
  }
}

export async function installUpdate() {
  if (!pending) return
  const version = pending.version
  const { api } = await import('./api')
  const jobs = await api.jobs().catch(() => [])
  if (jobs.some(j => j.state === 'running' || j.state === 'queued')) {
    set({ kind: 'busy', version })
    // Offered again once the queue may have finished
    setTimeout(() => state.kind === 'busy' && set({ kind: 'available', version, notes: pending?.body ?? '' }), 8000)
    return
  }
  let done = 0
  let total: number | null = null
  set({ kind: 'downloading', version, done, total })
  try {
    await pending.downloadAndInstall(e => {
      if (e.event === 'Started') total = e.data.contentLength ?? null
      if (e.event === 'Progress') done += e.data.chunkLength
      set({ kind: 'downloading', version, done, total })
    })
    set({ kind: 'restarting' })
    await relaunch()
  } catch (e) {
    set({ kind: 'failed', error: String(e) })
  }
}

let started = false
export function useUpdate(): UpdateState {
  const [s, setS] = useState(state)
  useEffect(() => {
    listeners.add(setS)
    // A built app checks by itself; a dev build only when asked
    if (!started && !import.meta.env.DEV) {
      started = true
      checkForUpdate(true)
      setInterval(() => checkForUpdate(true), EVERY)
    }
    return () => {
      listeners.delete(setS)
    }
  }, [])
  return s
}
