// Light / dark mode. The preference ("system", "light" or "dark") is kept
// per user; "system" follows macOS live. It is set on <html> as
// data-theme (see tokens.css). index.html applies the saved value before
// the first paint, so the window never flashes the wrong look.

import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

const KEY_THEME = 'shotloop.theme'
const dark = window.matchMedia('(prefers-color-scheme: dark)')

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY_THEME)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function save(value: string) {
  try {
    localStorage.setItem(KEY_THEME, value)
  } catch {
    // storage unavailable: the choice lasts this session
  }
}

export function apply(pref: ThemePref) {
  document.documentElement.dataset.theme = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref
}

// The current preference and a setter; re-applies when the system mode
// changes while the preference is "system"
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readThemePref)

  useEffect(() => {
    apply(pref)
    if (pref !== 'system') return
    const onChange = () => apply(pref)
    dark.addEventListener('change', onChange)
    return () => dark.removeEventListener('change', onChange)
  }, [pref])

  return {
    pref,
    setPref: (p: ThemePref) => {
      save(p)
      setPref(p)
    }
  }
}
