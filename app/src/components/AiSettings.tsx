import { useEffect, useState } from 'react'
import { LOCAL_SERVERS, PRESETS, presetById, type Preset } from '../ai/presets'
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

// The outcome of a Test or a model listing, on one line
function ProbeLine({ probe }: { probe: Probe }) {
  if (!probe) return null
  return <small className={probe.ok ? 'probe ok' : 'probe bad'}>{probe.ok && <Icon name="check" size={12} />} {probe.text}</small>
}

// Which model drives the agent, after open-design's "Models and
// providers": a local CLI agent the user is signed in to, a hosted model
// API with the user's own key (presets over the Anthropic and OpenAI
// protocols), or a model on a local server. Each can be tested with one
// tiny request. Whatever drives it, the agent only gets Shotloop's
// narrow tools.
export function AiSettings({ settings, update }: { settings: Settings; update: (s: Partial<Settings>) => void }) {
  const [detected, setDetected] = useState<Detected | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const [probe, setProbe] = useState<Probe>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const mode: Provider = settings.provider === 'cli' || settings.provider === 'local' ? settings.provider : 'api'
  const preset = presetById(settings.apiPreset || 'anthropic')
  const key = settings.apiKeys[preset.id] ?? ''

  const detect = () => {
    setDetected(null)
    api.aiDetect().then(setDetected, () => setDetected({ clis: [], servers: [] }))
  }
  useEffect(detect, [])
  useEffect(() => {
    setModels(null)
    setProbe(null)
  }, [mode, preset.id, settings.cli])

  const choosePreset = (p: Preset) =>
    update({ provider: 'api', apiPreset: p.id, apiProtocol: p.protocol, apiUrl: p.url, model: p.id === 'anthropic' ? '' : p.models[0] ?? '' })
  const chooseMode = (m: Provider) => (m === 'api' ? choosePreset(preset) : update({ provider: m, model: '' }))

  // Lists an endpoint's models: the model picker's live half
  const listModels = async (url: string, k: string, protocol: 'anthropic' | 'openai') => {
    setBusy('models')
    setProbe(null)
    try {
      const list = await api.aiModels(url, k, protocol)
      setModels(list)
      setProbe({ ok: true, text: t('ai.connected', { n: list.length }) })
      return list
    } catch (e) {
      setModels([])
      setProbe({ ok: false, text: String(e) })
      return []
    } finally {
      setBusy(null)
    }
  }

  // One tiny request through the backend as shown, saved or not
  const test = async (patch: Partial<Settings> = {}, id = 'test') => {
    setBusy(id)
    setProbe(null)
    try {
      const r = await api.aiTest({ ...settings, ...patch })
      setProbe({ ok: true, text: t('ai.testOk', { s: (r.latencyMs / 1000).toFixed(1), reply: r.reply.slice(0, 40) }) })
    } catch (e) {
      setProbe({ ok: false, text: String(e).replace(/^Error: /, '') })
    } finally {
      setBusy(null)
    }
  }
  const testButton = (patch: Partial<Settings> = {}, id = 'test') => (
    <button className="pill-button" onClick={() => test(patch, id)} disabled={!!busy}>
      {busy === id ? <span className="spinner small" /> : <Icon name="play" size={12} />} {t('ai.test')}
    </button>
  )

  const installed = detected?.clis.filter(c => c.path) ?? []
  const missing = detected?.clis.filter(c => !c.path) ?? []

  return (
    <section className="settings-block ai-settings">
      <div className="seg-control wide" role="tablist" aria-label={t('settings.ai')}>
        {MODES.map(m => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => chooseMode(m.id)}>{t(m.title)}</button>
        ))}
      </div>

      {mode === 'cli' && (
        <div className="provider-body">
          <p className="hint">{t('ai.cliIntro')}</p>
          <div className="row between">
            <h4>{t('ai.yourClis', { n: installed.length })}</h4>
            <button className="pill-button" onClick={detect} disabled={!detected}><Icon name="refresh" size={12} /> {t('ai.rescan')}</button>
          </div>
          {!detected && <p className="muted small">{t('setup.checking')}</p>}
          {detected && installed.length === 0 && <p className="empty">{t('ai.noClis')}</p>}
          <div className="cli-list" role="radiogroup">
            {installed.map(c => {
              const on = settings.cli === c.id
              return (
                <div key={c.id} className={`cli-card${on ? ' on' : ''}`}>
                  <button role="radio" aria-checked={on} className="cli-card-head" onClick={() => update({ provider: 'cli', cli: c.id, model: on ? settings.model : '' })}>
                    <span className={`cli-logo ${c.id}`}><Icon name="terminal" size={18} /></span>
                    <span className="cli-name">
                      <strong>{c.name} <span className="muted">· {c.vendor}</span></strong>
                      <span className="muted small">{c.version ?? c.path}</span>
                    </span>
                    {c.note && <span className="tag">{t('ai.experimental')}</span>}
                    {on && <span className="tag on"><Icon name="check" size={11} /> {t('ai.inUse')}</span>}
                  </button>
                  <span className="cli-test">{testButton({ provider: 'cli', cli: c.id, model: on ? settings.model : '' }, c.id)}</span>
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
          {mode === 'cli' && busy !== 'models' && <ProbeLine probe={probe} />}
          {missing.length > 0 && (
            <details className="install-list">
              <summary>{t('ai.installable', { n: missing.length })}</summary>
              {missing.map(c => (
                <div key={c.id} className="install-row">
                  <span className="cli-logo"><Icon name="terminal" size={16} /></span>
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
      )}

      {mode === 'api' && (
        <div className="provider-body">
          <p className="hint">{t('ai.apiNote')}</p>
          <div className="field">
            <span>{t('ai.provider')}</span>
            {(['global', 'cn'] as const).map(region => (
              <div key={region} className="chip-row">
                <span className="chip-row-label">{t(`ai.region.${region}`)}</span>
                {PRESETS.filter(p => p.region === region && p.id !== 'custom').concat(region === 'global' ? [presetById('custom')] : []).map(p => (
                  <button key={p.id} className={`provider-chip${preset.id === p.id ? ' on' : ''}`} aria-pressed={preset.id === p.id} onClick={() => choosePreset(p)}>
                    {settings.apiKeys[p.id] && <span className="dot ok" />}
                    {p.id === 'custom' ? t('ai.custom') : p.name}
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
                {unique([...preset.models, ...(models ?? [])]).map(m => <option key={m} value={m} />)}
              </datalist>
              <button className="pill-button" disabled={!!busy || (!key && preset.id !== 'custom')}
                onClick={() => listModels(settings.apiUrl, key, (settings.apiProtocol || preset.protocol) as 'anthropic' | 'openai')}>
                {busy === 'models' ? <span className="spinner small" /> : <Icon name="refresh" size={12} />} {t('ai.fetchModels')}
              </button>
              {testButton()}
            </div>
            <ProbeLine probe={probe} />
            {preset.vision === false && <small className="warn-note">{t('ai.noVision')}</small>}
          </div>
        </div>
      )}

      {mode === 'local' && (
        <div className="provider-body">
          <p className="hint">{t('ai.localNote')}</p>
          <div className="row between">
            <h4>{t('ai.servers')}</h4>
            <button className="pill-button" onClick={detect} disabled={!detected}><Icon name="refresh" size={12} /> {t('ai.rescan')}</button>
          </div>
          <div className="option-list" role="radiogroup">
            {LOCAL_SERVERS.map(p => {
              const server = detected?.servers.find(s => s.id === p.id)
              return (
                <button key={p.id} role="radio" aria-checked={settings.localUrl === p.url}
                  className={`option${settings.localUrl === p.url ? ' on' : ''}`}
                  onClick={async () => {
                    update({ localUrl: p.url, localModel: '' })
                    const list = await listModels(p.url, '', 'openai')
                    if (list[0]) update({ localModel: list[0] })
                  }}>
                  <span className={`dot ${server?.running ? 'ok' : ''}`} />
                  <strong>{p.name}</strong>
                  <span className="muted small option-meta">
                    {server?.running ? t('ai.running', { n: server.models.length }) : t('ai.notRunning')}
                  </span>
                </button>
              )
            })}
          </div>
          <label className="field">
            <span>{t('ai.url')}</span>
            <input value={settings.localUrl} placeholder="http://localhost:11434/v1" onChange={e => update({ localUrl: e.target.value })} />
          </label>
          <div className="field">
            <span>{t('ai.model')}</span>
            <div className="row gap">
              <input list="local-models" value={settings.localModel} placeholder="qwen2.5vl:7b" onChange={e => update({ localModel: e.target.value })} />
              <datalist id="local-models">{(models ?? []).map(m => <option key={m} value={m} />)}</datalist>
              <button className="pill-button" onClick={() => listModels(settings.localUrl, settings.localKey, 'openai')} disabled={!settings.localUrl || !!busy}>
                {busy === 'models' ? <span className="spinner small" /> : <Icon name="refresh" size={12} />} {t('ai.fetchModels')}
              </button>
              {testButton()}
            </div>
            <ProbeLine probe={probe} />
            <small className="muted">{t('ai.visionNote')}</small>
          </div>
          <label className="field">
            <span>{t('ai.key')}</span>
            <input type="password" value={settings.localKey} placeholder={t('ai.keyOptional')} onChange={e => update({ localKey: e.target.value })} />
          </label>
        </div>
      )}
    </section>
  )
}
