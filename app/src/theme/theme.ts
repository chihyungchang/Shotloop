// Light / dark mode and the accent colour. The mode preference
// ("system", "light" or "dark") and the accent are kept per user; "system"
// follows macOS live. They are set on <html> as data-theme and
// data-accent (see tokens.css). index.html applies the saved values
// before the first paint, so the window never flashes the wrong look.

import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type Accent = 'teal' | 'azure' | 'amber' | 'coral' | 'violet' | 'lime'

// The presets, with a swatch for the picker (the dark-theme fill)
export const ACCENTS: { id: Accent; swatch: string }[] = [
  { id: 'teal', swatch: '#2dd4bf' },
  { id: 'azure', swatch: '#38bdf8' },
  { id: 'amber', swatch: '#fbbf24' },
  { id: 'coral', swatch: '#fb923c' },
  { id: 'violet', swatch: '#a78bfa' },
  { id: 'lime', swatch: '#a3e635' }
]
const KEY_THEME = 'shotloop.theme'
const KEY_ACCENT = 'shotloop.accent'
const dark = window.matchMedia('(prefers-color-scheme: dark)')

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the choice lasts this session
  }
}

export const readThemePref = () => read<ThemePref>(KEY_THEME, ['system', 'light', 'dark'], 'system')
export const readAccent = () => read<Accent>(KEY_ACCENT, ACCENTS.map(a => a.id), 'teal')

export function apply(pref: ThemePref) {
  document.documentElement.dataset.theme = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref
}

// The current preference and a setter; re-applies when the system mode
// changes while the preference is "system"
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readThemePref)
  const [accent, setAccent] = useState<Accent>(readAccent)

  useEffect(() => {
    document.documentElement.dataset.accent = accent
  }, [accent])

  useEffect(() => {
    apply(pref)
    if (pref !== 'system') return
    const onChange = () => apply(pref)
    dark.addEventListener('change', onChange)
    return () => dark.removeEventListener('change', onChange)
  }, [pref])

  return {
    pref,
    accent,
    setPref: (p: ThemePref) => {
      save(KEY_THEME, p)
      setPref(p)
    },
    setAccent: (a: Accent) => {
      save(KEY_ACCENT, a)
      setAccent(a)
    }
  }
}
