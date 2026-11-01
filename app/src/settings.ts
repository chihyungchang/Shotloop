// The saved settings (src-tauri/src/settings.rs), one store for the whole
// app: read once, shared by every component, and changed only through
// patchSettings, which saves the fields given onto the settings as saved
// now (update_settings) and hands everyone what was saved. No component
// keeps a copy to save back, so one part never undoes another's change.

import { useEffect, useState } from 'react'
import { api, type Settings } from './api'

interface SettingsState {
  settings: Settings | null
  // The settings could not be read (the shell kept the damaged file
  // aside): shown to the person; nothing is saved on top of them until
  // they choose to go on with the defaults
  error: string | null
}

let state: SettingsState = { settings: null, error: null }
const listeners = new Set<(s: SettingsState) => void>()
const set = (s: SettingsState) => {
  state = s
  listeners.forEach(l => l(s))
}

let loading = false
function load() {
  if (loading) return
  loading = true
  api.getSettings().then(
    settings => set({ settings, error: null }),
    e => set({ settings: null, error: String(e) })
  )
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const settings = await api.updateSettings(patch)
  set({ settings, error: null })
  return settings
}

// After a read error: the defaults, saved, become the settings
export const settingsFromDefaults = () => patchSettings({})

export function useSettings(): SettingsState {
  const [s, setS] = useState(state)
  useEffect(() => {
    listeners.add(setS)
    load()
    setS(state)
    return () => {
      listeners.delete(setS)
    }
  }, [])
  return s
}
