// The AI subscription's usage as Claude Code last reported it (the 5-hour
// and weekly windows): read at start, updated whenever an agent runs
import { useEffect, useState } from 'react'
import { api, onUsage, type Usage } from '../api'

let last: Usage | null = null
const listeners = new Set<(u: Usage | null) => void>()
let started = false

export function useUsage(): Usage | null {
  const [u, setU] = useState(last)
  useEffect(() => {
    listeners.add(setU)
    if (!started) {
      started = true
      api.aiUsage().then(v => {
        if (v && (!last || v.at > last.at)) listeners.forEach(l => l((last = v)))
      }, () => {})
      onUsage(v => listeners.forEach(l => l((last = v))))
    }
    return () => {
      listeners.delete(setU)
    }
  }, [])
  return u
}

// A window's share used, 0–100, or null when unknown or reset since
export function windowUse(w: { utilization: number; resetsAt: number } | undefined, now = Date.now()) {
  if (!w || w.resetsAt * 1000 < now) return null
  return Math.round(w.utilization * 100)
}
