// What can drive the agent on this Mac, and which one does: the agent's
// detection (its CLI agents and local servers, agent/src/providers.ts,
// the one list of them) run once a session and shared, and the summary
// the sidebar and the composer show.

import { useEffect, useState } from 'react'
import { api, type Detected, type Provider, type Settings } from '../api'
import { t } from '../i18n'
import { presetById } from './presets'

let detected: Detected | null = null
let running: Promise<void> | null = null
const listeners = new Set<(d: Detected | null) => void>()
const set = (d: Detected | null) => {
  detected = d
  listeners.forEach(l => l(d))
}

// Looks again (Settings' Rescan); a failed look finds nothing, and the
// panels then offer only what can be typed in
export function detectBackends() {
  set(null)
  running = api.aiDetect().then(set, () => set({ clis: [], servers: [] }))
  return running
}

// The detection, started by the first component that needs it (it starts
// each CLI for its version, a second or two in the background)
export function useDetected(): Detected | null {
  const [d, setD] = useState(detected)
  useEffect(() => {
    listeners.add(setD)
    if (!running) detectBackends()
    setD(detected)
    return () => {
      listeners.delete(setD)
    }
  }, [])
  return d
}

// The maker of a model, told by its name (claude-…, anthropic/claude-…,
// qwen2.5:7b), as the provider key whose mark it shares
const MAKERS: [RegExp, string][] = [
  [/claude|opus|sonnet|haiku/, 'api:anthropic'],
  [/gpt|codex|openai|\bo\d/, 'api:openai'],
  [/gemini|gemma/, 'api:gemini'],
  [/deepseek/, 'api:deepseek'],
  [/qwen|qwq/, 'api:qwen'],
  [/kimi|moonshot/, 'api:moonshot'],
  [/glm|zhipu/, 'api:zhipu'],
  [/grok/, 'api:xai'],
  [/mistral|mixtral|codestral|devstral/, 'api:mistral'],
  [/minimax/, 'api:minimax'],
  [/doubao/, 'api:doubao']
]

// A CLI left on its default model runs its maker's
const CLI_MAKER: Record<string, string> = { claude: 'api:anthropic', codex: 'api:openai', gemini: 'api:gemini' }

const makerOf = (model: string) => MAKERS.find(([re]) => re.test(model.toLowerCase()))?.[1]

// What drives the agent, in a few words, and whether it is set up. A CLI's
// or a server's name comes from the detection; until it has answered, the
// kind of backend stands in for it. `brand` is the tool or provider, `mark`
// the model's maker, falling back to the brand when the name doesn't tell
export function aiSummary(s: Settings, found: Detected | null): { mode: Provider; name: string; model: string; ready: boolean; brand: string; mark: string } {
  if (s.provider === 'cli') {
    const cli = found?.clis.find(c => c.id === s.cli)
    const brand = `cli:${s.cli}`
    return { mode: 'cli', name: cli?.name ?? t('ai.mode.cli'), model: s.model, ready: !!s.cli, brand, mark: makerOf(s.model) ?? CLI_MAKER[s.cli] ?? brand }
  }
  if (s.provider === 'local') {
    const server = found?.servers.find(l => l.url === s.localUrl)
    const brand = `local:${server?.id ?? ''}`
    return { mode: 'local', name: server?.name ?? t('ai.mode.local'), model: s.localModel, ready: !!(s.localUrl && s.localModel), brand, mark: makerOf(s.localModel) ?? brand }
  }
  const preset = presetById(s.apiPreset || 'anthropic')
  const key = s.apiKeys[preset.id] ?? ''
  const brand = `api:${preset.id}`
  return { mode: 'api', name: preset.name, model: s.model, ready: !!key || preset.id === 'custom', brand, mark: makerOf(s.model) ?? brand }
}
