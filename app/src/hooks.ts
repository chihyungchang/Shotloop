// UI behaviour several components share: a clock for elapsed times, Esc
// for the topmost dialog, popovers that close on a click outside, edits
// that save themselves, a sound to listen to, and actions whose errors
// show on the component's error line.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { fileUrl } from './api'

// Re-renders every second while on, for elapsed times and countdowns
export function useTick(on: boolean) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
}

// Esc goes to the dialog or popover opened last (a confirm over the export
// dialog closes only the confirm): one listener, a stack of handlers
const escapes: { current: () => void }[] = []
function onEscape(e: KeyboardEvent) {
  const top = escapes.at(-1)
  if (e.key !== 'Escape' || !top) return
  e.preventDefault()
  top.current()
}

export function useEscape(handler: () => void, enabled = true) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    if (!enabled) return
    const entry = { current: () => latest.current() }
    if (!escapes.length) window.addEventListener('keydown', onEscape)
    escapes.push(entry)
    return () => {
      escapes.splice(escapes.indexOf(entry), 1)
      if (!escapes.length) window.removeEventListener('keydown', onEscape)
    }
  }, [enabled])
}

// A popover: closes on a click outside `ref`, or Esc
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEscape(close, open)
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) latest.current()
    }
    window.addEventListener('mousedown', away)
    return () => window.removeEventListener('mousedown', away)
  }, [ref, open])
}

type SaveState = { state: 'saved' } | { state: 'pending' } | { state: 'failed'; error: string }

// Edits that save themselves a moment after the last change; a failed
// write stays visible ("not saved") until the next one lands. flush()
// writes what is pending now, and throws when that fails
export function useAutosave<T>(write: (value: T) => Promise<unknown>, delay = 500) {
  const [status, setStatus] = useState<SaveState>({ state: 'saved' })
  const timer = useRef<number | null>(null)
  const pending = useRef<{ value: T } | null>(null)
  const latest = useRef(write)
  latest.current = write

  const run = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    if (!next) return
    pending.current = null
    try {
      await latest.current(next.value)
      if (!pending.current) setStatus({ state: 'saved' })
    } catch (e) {
      setStatus({ state: 'failed', error: String(e) })
      throw e
    }
  }, [])

  const save = useCallback((value: T) => {
    pending.current = { value }
    setStatus({ state: 'pending' })
    if (timer.current) window.clearTimeout(timer.current)
    // The failure is shown by the status; nothing else waits for it
    timer.current = window.setTimeout(() => run().catch(() => undefined), delay)
  }, [run, delay])

  // Leaving with edits not written yet: written now
  useEffect(() => () => {
    if (pending.current) run().catch(() => undefined)
  }, [run])

  return { save, flush: run, status }
}

// The sound playing now, stopped when another starts: one at a time
// across the app (a preview, the timeline's playback)
let playingNow: (() => void) | null = null
export function takeTurn(stop: () => void) {
  if (playingNow !== stop) playingNow?.()
  playingNow = stop
}
export const hasTurn = (stop: () => void) => playingNow === stop
export function releaseTurn(stop: () => void) {
  if (playingNow === stop) playingNow = null
}

// A sound to listen to (a voice sample, the music bed): `fetchFile` makes
// it and gives its path; toggle plays it or stops it. A failure to make or
// play it goes to `onError`

export function useAudioPreview(fetchFile: () => Promise<string | null | undefined>, onError: (e: string) => void) {
  const [playing, setPlaying] = useState<'loading' | 'on' | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const stop = useCallback(() => {
    audio.current?.pause()
    setPlaying(null)
  }, [])
  useEffect(() => () => {
    audio.current?.pause()
    releaseTurn(stop)
  }, [stop])

  const play = useCallback(async () => {
    takeTurn(stop)
    setPlaying('loading')
    try {
      const file = await fetchFile()
      if (!file) return setPlaying(null)
      audio.current?.pause()
      const a = new Audio(fileUrl(file, Date.now()))
      a.onended = () => setPlaying(null)
      audio.current = a
      await a.play()
      // Another sound may have started while this one was fetched
      if (hasTurn(stop)) setPlaying('on')
      else a.pause()
    } catch (e) {
      setPlaying(null)
      onError(String(e))
    }
  }, [fetchFile, onError])
  return { playing, play, stop, toggle: playing ? stop : play }
}

// An error line for a component's actions: `guard` runs one and shows
// its failure there (the queue's enqueue, a rename, a removal)
// Copies text to the clipboard: copied is true for a moment after, or
// 'failed' when the clipboard refused (the text stays there to select)
export function useCopy() {
  const [copied, setCopied] = useState<boolean | 'failed'>(false)
  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied(false), 1500)
  }, [])
  return { copied, copy }
}

export function useErrorLine() {
  const [error, setError] = useState<string | null>(null)
  const guard = useCallback(async <T,>(p: Promise<T>): Promise<T | undefined> => {
    setError(null)
    try {
      return await p
    } catch (e) {
      setError(String(e))
      return undefined
    }
  }, [])
  return { error, setError, guard }
}
