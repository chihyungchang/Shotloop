import { useEffect, useRef, useState } from 'react'
import { BrandIcon } from '../ai/BrandIcon'
import { detectBackends, useDetected } from '../ai/backends'
import { PRESETS, presetById, type Preset, type Protocol } from '../ai/presets'
import { api, type Detected, type Provider, type Settings } from '../api'
import { t } from '../i18n'
import type { Key } from '../i18n/en'
import { Icon } from './Icon'

const MODES: { id: Provider; title: Key }[] = [
  { id: 'cli', title: 'ai.cli' },
  { id: 'api', title: 'ai.api' },
  { id: 'local', title: 'ai.local' }
]

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))]
type Probe = { ok: boolean; text: string } | null
type Update = (s: Partial<Settings>) => void

// The outcome of a Test or a model listing, on one line
function ProbeLine({ probe }: { probe: Probe }) {
  if (!probe) return null
  return <small className={probe.ok ? 'probe ok' : 'probe bad'}>{probe.ok && <Icon name="check" size={12} />} {probe.text}</small>
}

// The panes' shared tools: listing an endpoint's models and one tiny test
// request, with their outcome on one line. A reply for a backend the person
// has since left (another preset, CLI or server) is dropped
function useProbes(settings: Settings, backend: string) {
  const [models, setModels] = useState<string[] | null>(null)
  const [probe, setProbe] = useState<Probe>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const current = useRef(backend)
  current.current = backend
  useEffect(() => {
    setModels(null)
    setProbe(null)
  }, [backend])

  const ask = async <T,>(id: string, run: () => Promise<T>, ok: (v: T) => string, failed?: () => void): Promise<T | null> => {
    const asked = current.current
    setBusy(id)
    setProbe(null)
    try {
      const v = await run()
      if (asked !== current.current) return null
      setProbe({ ok: true, text: ok(v) })
      return v
    } catch (e) {
      if (asked !== current.current) return null
      failed?.()
      setProbe({ ok: false, text: String(e).replace(/^Error: /, '') })
      return null
    } finally {
      if (asked === current.current) setBusy(null)
    }
  }

  // Lists an endpoint's models: the model picker's live half
  const listModels = async (url: string, key: string, protocol: Protocol) => {
    const list = await ask('models', () => api.aiModels(url, key, protocol), l => t('ai.connected', { n: l.length }), () => setModels([]))
    if (list) setModels(list)
    return list ?? []
  }
  // One tiny request through the backend as shown, saved or not
  const testButton = (patch: Partial<Settings> = {}, id = 'test') => (
    <button className="pill-button" onClick={() => ask(id, () => api.aiTest({ ...settings, ...patch }), r => t('ai.testOk', { s: (r.latencyMs / 1000).toFixed(1), reply: r.reply.slice(0, 40) }))} disabled={!!busy}>
      {busy === id ? <span className="spinner small" /> : <Icon name="play" size={12} />} {t('ai.test')}
    </button>
  )
  const fetchButton = (onClick: () => void, disabled: boolean) => (
    <button className="pill-button" onClick={onClick} disabled={!!busy || disabled}>
      {busy === 'models' ? <span className="spinner small" /> : <Icon name="refresh" size={12} />} {t('ai.fetchModels')}
    </button>
  )
  return { models, probe, busy, listModels, testButton, fetchButton }
}
type Probes = ReturnType<typeof useProbes>

// Which model drives the agent, after open-design's "Models and
// providers": a local CLI agent the user is signed in to, a hosted model
// API with the user's own key (presets over the Anthropic and OpenAI
// protocols), or a model on a local server. Each can be tested with one
// tiny request. Whatever drives it, the agent only gets Shotloop's
// narrow tools.
export function AiSettings({ settings, update }: { settings: Settings; update: Update }) {
  const detected = useDetected()
  const mode: Provider = settings.provider === 'cli' || settings.provider === 'local' ? settings.provider : 'api'
  const preset = presetById(settings.apiPreset || 'anthropic')
  // A local server's models are listed as it is picked: the server alone
  // doesn't make another backend
  const probes = useProbes(settings, `${mode}:${mode === 'api' ? preset.id : mode === 'cli' ? settings.cli : ''}`)

  const choosePreset = (p: Preset) =>
    update({ provider: 'api', apiPreset: p.id, apiProtocol: p.protocol, apiUrl: p.url, model: p.id === 'anthropic' ? '' : p.models[0] ?? '' })
  const chooseMode = (m: Provider) => (m === 'api' ? choosePreset(preset) : update({ provider: m, model: '' }))

  return (
    <section className="settings-block ai-settings">
      <div className="seg-control wide" role="tablist" aria-label={t('settings.ai')}>
        {MODES.map(m => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => chooseMode(m.id)}>{t(m.title)}</button>
        ))}
      </div>
      {mode === 'cli' && <CliPane settings={settings} update={update} detected={detected} probes={probes} />}
      {mode === 'api' && <ApiPane settings={settings} update={update} preset={preset} choosePreset={choosePreset} probes={probes} />}
      {mode === 'local' && <LocalPane settings={settings} update={update} detected={detected} probes={probes} />}
    </section>
  )
}

function Rescan({ detected }: { detected: Detected | null }) {
  return <button className="pill-button" onClick={detectBackends} disabled={!detected}><Icon name="refresh" size={12} /> {t('ai.rescan')}</button>
}

// A CLI agent the person is signed in to: the installed ones to pick, the
// others with how to install them
function CliPane({ settings, update, detected, probes }: { settings: Settings; update: Update; detected: Detected | null; probes: Probes }) {
  const installed = detected?.clis.filter(c => c.path) ?? []
  const missing = detected?.clis.filter(c => !c.path) ?? []
  return (
    <div className="provider-body">
      <p className="hint">{t('ai.cliIntro')}</p>
      <div className="row between">
        <h4>{t('ai.yourClis', { n: installed.length })}</h4>
        <Rescan detected={detected} />
      </div>
      {!detected && <p className="muted small">{t('setup.checking')}</p>}
      {detected && installed.length === 0 && <p className="empty">{t('ai.noClis')}</p>}
      <div className="cli-list" role="radiogroup">
        {installed.map(c => {
          const on = settings.cli === c.id
          return (
            <div key={c.id} className={`cli-card${on ? ' on' : ''}`}>
              <button role="radio" aria-checked={on} className="cli-card-head" onClick={() => update({ provider: 'cli', cli: c.id, model: on ? settings.model : '' })}>
                <span className="cli-logo"><BrandIcon id={`cli:${c.id}`} size={22} /></span>
                <span className="cli-name">
                  <strong>{c.name} <span className="muted">· {c.vendor}</span></strong>
                  <span className="muted small">{c.version ?? c.path}</span>
                </span>
                {c.note && <span className="tag">{t('ai.experimental')}</span>}
                {on && <span className="tag on"><Icon name="check" size={11} /> {t('ai.inUse')}</span>}
              </button>
              <span className="cli-test">{probes.testButton({ provider: 'cli', cli: c.id, model: on ? settings.model : '' }, c.id)}</span>
              {on && (
                <div className="cli-body">
                  <label className="field">
                    <span>{t('ai.model')} <span className="muted">· {t('ai.builtInList')}</span></span>
                    <select value={settings.model} onChange={e => update({ model: e.target.value })}>
                      <option value="">{t('ai.cliDefault')}</option>
                      {unique([...c.models, settings.model]).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {probes.busy !== 'models' && <ProbeLine probe={probes.probe} />}
      {missing.length > 0 && (
        <details className="install-list">
          <summary>{t('ai.installable', { n: missing.length })}</summary>
          {missing.map(c => (
            <div key={c.id} className="install-row">
              <span className="cli-logo"><BrandIcon id={`cli:${c.id}`} size={20} /></span>
              <span className="cli-name">
                <strong>{c.name} <span className="muted">· {c.vendor}</span></strong>
                <code>{c.install}</code>
              </span>
              <button className="pill-button" onClick={() => navigator.clipboard?.writeText(c.install)}>{t('ai.copy')}</button>
              <button className="pill-button" onClick={() => api.openUrl(c.url)}>{t('ai.website')} <Icon name="arrow" size={12} /></button>
            </div>
          ))}
        </details>
      )}
      <p className="hint"><Icon name="check" size={12} /> {t('ai.cliSafety')}</p>
    </div>
  )
}

// A hosted model API with the person's own key: a preset, its key, URL and model
function ApiPane({ settings, update, preset, choosePreset, probes }: { settings: Settings; update: Update; preset: Preset; choosePreset: (p: Preset) => void; probes: Probes }) {
  const key = settings.apiKeys[preset.id] ?? ''
  return (
    <div className="provider-body">
      <p className="hint">{t('ai.apiNote')}</p>
      <div className="field">
        <span>{t('ai.provider')}</span>
        {(['global', 'cn'] as const).map(region => (
          <div key={region} className="chip-row">
            <span className="chip-row-label">{t(`ai.region.${region}`)}</span>
            {PRESETS.filter(p => p.region === region && p.id !== 'custom').concat(region === 'global' ? [presetById('custom')] : []).map(p => (
              <button key={p.id} className={`provider-chip${preset.id === p.id ? ' on' : ''}`} aria-pressed={preset.id === p.id} onClick={() => choosePreset(p)}>
                {p.id === 'custom' ? <Icon name="settings" size={14} /> : <BrandIcon id={`api:${p.id}`} size={15} />}
                {p.id === 'custom' ? t('ai.custom') : p.name}
                {settings.apiKeys[p.id] && <span className="dot ok" />}
              </button>
            ))}
          </div>
        ))}
      </div>

      <label className="field">
        <span className="row between">
          {t('ai.key')}
          {preset.keyUrl && (
            <button type="button" className="link" onClick={() => api.openUrl(preset.keyUrl!)}>{t('ai.getKey')} <Icon name="arrow" size={12} /></button>
          )}
        </span>
        <input type="password" value={key} placeholder={preset.keyHint ?? (preset.id === 'custom' ? t('ai.keyOptional') : '')}
          onChange={e => update({ apiKeys: { ...settings.apiKeys, [preset.id]: e.target.value } })} />
        <small className="muted">{t('ai.keyNote')}</small>
      </label>

      {preset.id === 'custom' && (
        <div className="field">
          <span>{t('ai.protocol')}</span>
          <div className="seg-control" role="radiogroup">
            {(['openai', 'anthropic'] as const).map(p => (
              <button key={p} role="radio" aria-checked={settings.apiProtocol === p} className={settings.apiProtocol === p ? 'on' : ''}
                onClick={() => update({ apiProtocol: p })}>{t(`ai.protocol.${p}`)}</button>
            ))}
          </div>
        </div>
      )}

      <label className="field">
        <span>{t('ai.url')}</span>
        <input value={settings.apiUrl} placeholder={preset.protocol === 'anthropic' ? 'https://api.anthropic.com' : 'https://…/v1'}
          onChange={e => update({ apiUrl: e.target.value })} />
      </label>

      <div className="field">
        <span>{t('ai.model')}</span>
        <div className="row gap">
          <input list="api-models" value={settings.model}
            placeholder={preset.id === 'anthropic' ? t('ai.anthropicDefault') : t('ai.modelPick')}
            onChange={e => update({ model: e.target.value })} />
          <datalist id="api-models">
            {unique([...preset.models, ...(probes.models ?? [])]).map(m => <option key={m} value={m} />)}
          </datalist>
          {probes.fetchButton(() => probes.listModels(settings.apiUrl, key, settings.apiProtocol || preset.protocol), !key && preset.id !== 'custom')}
          {probes.testButton()}
        </div>
        <ProbeLine probe={probes.probe} />
        {preset.vision === false && <small className="warn-note">{t('ai.noVision')}</small>}
      </div>
    </div>
  )
}

// A model on a local OpenAI-compatible server: the servers the agent looks
// for (running or not), then its URL, model and optional key
function LocalPane({ settings, update, detected, probes }: { settings: Settings; update: Update; detected: Detected | null; probes: Probes }) {
  return (
    <div className="provider-body">
      <p className="hint">{t('ai.localNote')}</p>
      <div className="row between">
        <h4>{t('ai.servers')}</h4>
        <Rescan detected={detected} />
      </div>
      {!detected && <p className="muted small">{t('setup.checking')}</p>}
      <div className="option-list" role="radiogroup">
        {detected?.servers.map(server => (
          <button key={server.id} role="radio" aria-checked={settings.localUrl === server.url}
            className={`option${settings.localUrl === server.url ? ' on' : ''}`}
            onClick={async () => {
              update({ localUrl: server.url, localModel: '' })
              const list = await probes.listModels(server.url, '', 'openai')
              if (list[0]) update({ localModel: list[0] })
            }}>
            <span className="option-logo">{server.id === 'llamacpp' ? <Icon name="cpu" size={15} /> : <BrandIcon id={`local:${server.id}`} size={17} />}</span>
            <strong>{server.name}</strong>
            <span className={`dot ${server.running ? 'ok' : ''}`} />
            <span className="muted small option-meta">
              {server.running ? t('ai.running', { n: server.models.length }) : t('ai.notRunning')}
            </span>
          </button>
        ))}
      </div>
      <label className="field">
        <span>{t('ai.url')}</span>
        <input value={settings.localUrl} placeholder="http://localhost:11434/v1" onChange={e => update({ localUrl: e.target.value })} />
      </label>
      <div className="field">
        <span>{t('ai.model')}</span>
        <div className="row gap">
          <input list="local-models" value={settings.localModel} placeholder="qwen2.5vl:7b" onChange={e => update({ localModel: e.target.value })} />
          <datalist id="local-models">{(probes.models ?? []).map(m => <option key={m} value={m} />)}</datalist>
          {probes.fetchButton(() => probes.listModels(settings.localUrl, settings.localKey, 'openai'), !settings.localUrl)}
          {probes.testButton()}
        </div>
        <ProbeLine probe={probes.probe} />
        <small className="muted">{t('ai.visionNote')}</small>
      </div>
      <label className="field">
        <span>{t('ai.key')}</span>
        <input type="password" value={settings.localKey} placeholder={t('ai.keyOptional')} onChange={e => update({ localKey: e.target.value })} />
      </label>
    </div>
  )
}
