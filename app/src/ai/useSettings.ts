import { useEffect, useState } from 'react'
import { api, EMPTY_SETTINGS, type Settings } from '../api'
import { LOCAL_SERVERS, presetById } from './presets'

// Settings shared by the sidebar, the composer and Settings: read once,
// re-read whenever Settings saves (it dispatches SAVED).
export const SAVED = 'shotloop:settings-saved'

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    const load = () => api.getSettings().then(s => setSettings({ ...EMPTY_SETTINGS, ...s }), () => setSettings(EMPTY_SETTINGS))
    load()
    window.addEventListener(SAVED, load)
    return () => window.removeEventListener(SAVED, load)
  }, [])
  return settings
}

const CLI_NAMES: Record<string, string> = { claude: 'Claude Code', codex: 'Codex CLI', gemini: 'Gemini CLI' }

// What drives the agent, in a few words, and whether it is set up
export function aiSummary(s: Settings): { mode: 'api' | 'cli' | 'local'; name: string; model: string; ready: boolean } {
  if (s.provider === 'cli') return { mode: 'cli', name: CLI_NAMES[s.cli] ?? 'CLI', model: s.model, ready: !!s.cli }
  if (s.provider === 'local') {
    const server = LOCAL_SERVERS.find(l => l.url === s.localUrl)
    return { mode: 'local', name: server?.name ?? 'Local', model: s.localModel, ready: !!(s.localUrl && s.localModel) }
  }
  const preset = presetById(s.apiPreset || 'anthropic')
  const key = s.apiKeys[preset.id] ?? ''
  return { mode: 'api', name: preset.name, model: s.model, ready: !!key || preset.id === 'custom' }
}
