import { useEffect, useState } from 'react'
import { LOCAL_SERVERS, PRESETS, presetById, type Preset } from '../ai/presets'
import { api, type Detected, type Provider, type Settings } from '../api'
import { t } from '../i18n'
import type { Key } from '../i18n/en'
import { Icon } from './Icon'

const MODES: { id: Provider; title: Key; note: Key; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'api', title: 'ai.api', note: 'ai.apiNote', icon: 'cloud' },
  { id: 'cli', title: 'ai.cli', note: 'ai.cliNote', icon: 'terminal' },
  { id: 'local', title: 'ai.local', note: 'ai.localNote', icon: 'cpu' }
]

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))]

// Which model drives the agent (after open-design's execution settings):
// a hosted model API with the user's key (Anthropic, OpenAI, Gemini,
// DeepSeek, Qwen, Kimi, GLM… as presets), a local CLI agent the user is
// signed in to, or a model on a local OpenAI-compatible server. Whatever
// drives it, the agent only gets Shotloop's narrow tools.
export function AiSettings({ settings, update }: { settings: Settings; update: (s: Partial<Settings>) => void }) {
  const [detected, setDetected] = useState<Detected | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const [probe, setProbe] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const mode: Provider = settings.provider === 'cli' || settings.provider === 'local' ? settings.provider : 'api'
  const preset = presetById(settings.apiPreset || 'anthropic')
  const key = settings.apiKeys[preset.id] ?? ''

  const detect = () => api.aiDetect().then(setDetected, () => setDetected({ clis: [], servers: [] }))
  useEffect(() => {
    detect()
  }, [])
  useEffect(() => {
    setModels(null)
    setProbe(null)
  }, [mode, preset.id])

  const choosePreset = (p: Preset) =>
    update({ provider: 'api', apiPreset: p.id, apiProtocol: p.protocol, apiUrl: p.url, model: p.id === 'anthropic' ? '' : p.models[0] ?? '' })

  // Lists the endpoint's models: the connection test and the model picker
  const test = async (url: string, k: string, protocol: 'anthropic' | 'openai') => {
    setBusy(true)
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
      setBusy(false)
    }
  }

  const status = probe && <small className={probe.ok ? 'probe ok' : 'probe bad'}>{probe.ok && <Icon name="check" size={12} />} {probe.text}</small>

  return (
    <section className="settings-block ai-settings">
      <div className="row between">
        <h3>{t('ai.title')}</h3>
        <button className="ghost small" onClick={detect}><Icon name="refresh" size={14} /> {t('setup.checkAgain')}</button>
      </div>
      <p className="hint">{t('ai.intro')}</p>

      <div className="mode-cards" role="radiogroup" aria-label={t('ai.title')}>
        {MODES.map(m => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} className={`mode-card${mode === m.id ? ' on' : ''}`}
            onClick={() => (m.id === 'api' ? choosePreset(preset) : update({ provider: m.id, model: '' }))}>
            <span className="mode-icon"><Icon name={m.icon} size={16} /></span>
            <strong>{t(m.title)}</strong>
            <span className="small muted">{t(m.note)}</span>
          </button>
        ))}
      </div>

      {mode === 'api' && (
        <div className="provider-body">
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
              <button className="small" disabled={busy || (!key && preset.id !== 'custom')}
                onClick={() => test(settings.apiUrl, key, (settings.apiProtocol || preset.protocol) as 'anthropic' | 'openai')}>
                {busy ? <span className="spinner small" /> : <Icon name="refresh" size={14} />} {t('ai.fetchModels')}
              </button>
            </div>
            {status}
            {preset.vision === false && <small className="warn-note">{t('ai.noVision')}</small>}
          </div>
        </div>
      )}

      {mode === 'cli' && (
        <div className="provider-body">
          {!detected && <p className="muted small">{t('setup.checking')}</p>}
          <div className="option-list" role="radiogroup">
            {detected?.clis.map(c => (
              <button key={c.id} role="radio" aria-checked={settings.cli === c.id} disabled={!c.path}
                className={`option${settings.cli === c.id ? ' on' : ''}`} onClick={() => update({ cli: c.id })}>
                <span className={`dot ${c.path ? 'ok' : ''}`} />
                <strong>{c.name}</strong>
                {c.note && <span className="tag">{t('ai.experimental')}</span>}
                <span className="muted small option-meta">{c.path ? c.version ?? c.path : t('ai.notInstalled')}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('ai.model')}</span>
            <input value={settings.model} placeholder={t('ai.cliDefault')} onChange={e => update({ model: e.target.value })} />
          </label>
          <p className="hint"><Icon name="check" size={12} /> {t('ai.cliSafety')}</p>
        </div>
      )}

      {mode === 'local' && (
        <div className="provider-body">
          <div className="option-list" role="radiogroup">
            {LOCAL_SERVERS.map(p => {
              const server = detected?.servers.find(s => s.id === p.id)
              return (
                <button key={p.id} role="radio" aria-checked={settings.localUrl === p.url}
                  className={`option${settings.localUrl === p.url ? ' on' : ''}`}
                  onClick={async () => {
                    update({ localUrl: p.url, localModel: '' })
                    const list = await test(p.url, '', 'openai')
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
            <div className="row gap">
              <input value={settings.localUrl} placeholder="http://localhost:11434/v1" onChange={e => update({ localUrl: e.target.value })} />
              <button className="small" onClick={() => test(settings.localUrl, settings.localKey, 'openai')} disabled={!settings.localUrl || busy}>
                {busy ? <span className="spinner small" /> : null} {t('ai.test')}
              </button>
            </div>
            {status}
          </label>
          <label className="field">
            <span>{t('ai.model')}</span>
            <input list="local-models" value={settings.localModel} placeholder="qwen2.5vl:7b" onChange={e => update({ localModel: e.target.value })} />
            <datalist id="local-models">{(models ?? []).map(m => <option key={m} value={m} />)}</datalist>
            <small className="muted">{t('ai.visionNote')}</small>
          </label>
          <label className="field">
            <span>{t('ai.key')}</span>
            <input type="password" value={settings.localKey} placeholder={t('ai.keyOptional')} onChange={e => update({ localKey: e.target.value })} />
          </label>
        </div>
      )}
    </section>
  )
}
