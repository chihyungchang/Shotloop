import { useEffect, useState } from 'react'
import { api, type Detected, type Provider, type Settings } from '../api'
import { t } from '../i18n'
import type { Key } from '../i18n/en'
import { Icon } from './Icon'

const PROVIDERS: { id: Provider; title: Key; note: Key }[] = [
  { id: 'anthropic', title: 'ai.anthropic', note: 'ai.anthropicNote' },
  { id: 'cli', title: 'ai.cli', note: 'ai.cliNote' },
  { id: 'local', title: 'ai.local', note: 'ai.localNote' }
]

const PRESETS = [
  { id: 'ollama', name: 'Ollama', url: 'http://localhost:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', url: 'http://localhost:1234/v1' }
]

// Which model drives the agent (after open-design's agent picker): the
// Anthropic API with the user's key, a local CLI agent the user is
// already signed in to, or a local model on an OpenAI-compatible server.
// Whatever drives it, the agent only gets Shotloop's narrow tools.
export function AiSettings({ settings, update }: { settings: Settings; update: (s: Partial<Settings>) => void }) {
  const [detected, setDetected] = useState<Detected | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const [probe, setProbe] = useState<string | null>(null)
  const provider: Provider = settings.provider || 'anthropic'

  const detect = () => api.aiDetect().then(setDetected, () => setDetected({ clis: [], servers: [] }))
  useEffect(() => {
    detect()
  }, [])

  // Models of the chosen local server, for the model picker
  const test = async (url = settings.localUrl, key = settings.localKey) => {
    if (!url) return
    setProbe(null)
    setModels(null)
    try {
      const list = await api.aiModels(url, key)
      setModels(list)
      if (!settings.localModel && list[0]) update({ localModel: list[0] })
      setProbe(t('ai.connected', { n: list.length }))
    } catch (e) {
      setProbe(String(e))
      setModels([])
    }
  }

  return (
    <section className="panel setup ai-settings">
      <div className="row between">
        <h3>{t('ai.title')}</h3>
        <button className="ghost small" onClick={detect}>{t('setup.checkAgain')}</button>
      </div>
      <p className="muted small">{t('ai.intro')}</p>

      <div className="provider-cards" role="radiogroup" aria-label={t('ai.title')}>
        {PROVIDERS.map(p => (
          <button key={p.id} role="radio" aria-checked={provider === p.id}
            className={`provider-card${provider === p.id ? ' on' : ''}`} onClick={() => update({ provider: p.id, model: '' })}>
            <strong>{t(p.title)}</strong>
            <span className="small muted">{t(p.note)}</span>
          </button>
        ))}
      </div>

      {provider === 'anthropic' && (
        <div className="provider-body">
          <label className="field">
            <span>{t('setup.apiKey')}</span>
            <input type="password" value={settings.apiKey} placeholder="sk-ant-…" onChange={e => update({ apiKey: e.target.value })} />
            <small className="muted">{t('setup.apiKeyNote')}</small>
          </label>
          <label className="field">
            <span>{t('ai.model')}</span>
            <input value={settings.model} placeholder={t('ai.anthropicDefault')} onChange={e => update({ model: e.target.value })} />
          </label>
        </div>
      )}

      {provider === 'cli' && (
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
          <p className="muted small"><Icon name="check" size={12} /> {t('ai.cliSafety')}</p>
        </div>
      )}

      {provider === 'local' && (
        <div className="provider-body">
          <div className="option-list" role="radiogroup">
            {PRESETS.map(p => {
              const server = detected?.servers.find(s => s.id === p.id)
              return (
                <button key={p.id} role="radio" aria-checked={settings.localUrl === p.url}
                  className={`option${settings.localUrl === p.url ? ' on' : ''}`}
                  onClick={() => {
                    update({ localUrl: p.url, localModel: '' })
                    test(p.url, '')
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
              <button className="small" onClick={() => test()} disabled={!settings.localUrl}>{t('ai.test')}</button>
            </div>
            {probe && <small className={models?.length ? 'muted' : 'error'}>{probe}</small>}
          </label>
          <label className="field">
            <span>{t('ai.model')}</span>
            {models?.length
              ? (
                <select value={settings.localModel} onChange={e => update({ localModel: e.target.value })}>
                  {!models.includes(settings.localModel) && settings.localModel && <option value={settings.localModel}>{settings.localModel}</option>}
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )
              : <input value={settings.localModel} placeholder="qwen2.5vl:7b" onChange={e => update({ localModel: e.target.value })} />}
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
