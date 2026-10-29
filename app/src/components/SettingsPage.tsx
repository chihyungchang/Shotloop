import { useEffect, useState } from 'react'
import { SAVED } from '../ai/useSettings'
import { api, EMPTY_SETTINGS, type About, type Settings } from '../api'
import { LANGS, t, type LangPref, type useLanguage } from '../i18n'
import type { Key } from '../i18n/en'
import type { useTheme } from '../theme/theme'
import { AiSettings } from './AiSettings'
import { Icon } from './Icon'
import { Setup } from './Setup'
import { ThemeToggle } from './ThemeToggle'

type Section = 'ai' | 'assets' | 'general' | 'deps' | 'about'

const SECTIONS: [Section, Key, Parameters<typeof Icon>[0]['name']][] = [
  ['ai', 'settings.ai', 'spark'],
  ['assets', 'settings.assets', 'cube'],
  ['general', 'settings.general', 'settings'],
  ['deps', 'setup.deps', 'cpu'],
  ['about', 'settings.about', 'info']
]

// Settings, after open-design's: the whole window, a back link and a
// section list on the ground, one section at a time on the card.
// General applies at once; the AI backend and tool paths save together.
export function SettingsPage({ theme, language, back }: {
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
  back: () => void
}) {
  const [section, setSection] = useState<Section>('ai')
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [saved, setSaved] = useState<Settings | null>(null)

  useEffect(() => {
    api.getSettings().then(s => {
      const full = { ...EMPTY_SETTINGS, ...s }
      setSettings(full)
      setSaved(full)
    })
  }, [])

  const update = (s: Partial<Settings>) => setSettings(cur => ({ ...cur, ...s }))
  const dirty = saved != null && JSON.stringify(settings) !== JSON.stringify(saved)
  const persist = async (next: Settings) => {
    await api.saveSettings(next)
    setSaved(next)
    window.dispatchEvent(new Event(SAVED))
  }
  // A General switch: saved at once, without the AI edits not yet saved
  const savePref = async (patch: Partial<Settings>) => {
    if (!saved) return
    update(patch)
    await persist({ ...saved, ...patch })
  }

  return (
    <div className="settings-shell">
      <nav className="settings-nav" aria-label={t('settings.title')}>
        <button className="settings-back" onClick={back}><Icon name="back" size={16} /> {t('settings.back')}</button>
        {SECTIONS.map(([id, label, icon]) => (
          <button key={id} className={`settings-nav-item${section === id ? ' on' : ''}`} aria-current={section === id} onClick={() => setSection(id)}>
            <Icon name={icon} size={16} /> {t(label)}
          </button>
        ))}
      </nav>
      <main className="settings-card">
        <div className="settings-body">
          {(section === 'ai' || section === 'deps' || section === 'assets') && (
            <div className="settings-savebar">
              <span className="muted small">{dirty ? t('settings.unsaved') : ''}</span>
              <button className="primary" onClick={() => persist(settings)} disabled={!dirty}>{dirty ? t('setup.save') : t('common.saved')}</button>
            </div>
          )}
          {section === 'ai' && <AiSettings settings={settings} update={update} />}
          {section === 'general' && <General settings={settings} savePref={savePref} theme={theme} language={language} />}
          {section === 'deps' && <Setup settings={settings} update={update} />}
          {section === 'assets' && <AssetSources settings={settings} update={update} />}
          {section === 'about' && <AboutSection />}
        </div>
      </main>
    </div>
  )
}

function General({ settings, savePref, theme, language }: {
  settings: Settings
  savePref: (patch: Partial<Settings>) => void
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
}) {
  const toggle = (key: 'notifySound' | 'notifyDesktop', label: Key) => (
    <div className="pref-row">
      <span>{t(label)}</span>
      <div className="seg-control" role="radiogroup" aria-label={t(label)}>
        <button role="radio" aria-checked={settings[key]} className={settings[key] ? 'on' : ''} onClick={() => savePref({ [key]: true })}>{t('settings.on')}</button>
        <button role="radio" aria-checked={!settings[key]} className={settings[key] ? '' : 'on'} onClick={() => savePref({ [key]: false })}>{t('settings.off')}</button>
      </div>
    </div>
  )
  return (
    <>
      <section className="settings-block">
        <h3>{t('settings.language')}</h3>
        <select className="inline-select" value={language.pref} onChange={e => language.setPref(e.target.value as LangPref)}>
          <option value="system">{t('lang.system')}</option>
          {LANGS.map(l => <option key={l.id} value={l.id}>{l.name} · {l.id}</option>)}
        </select>
      </section>
      <section className="settings-block">
        <h3>{t('theme.label')}</h3>
        <div className="pref-row">
          <span>{t('settings.mode')}</span>
          <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
        </div>
      </section>
      <section className="settings-block">
        <h3>{t('settings.alerts')}</h3>
        <p className="hint">{t('settings.alertsNote')}</p>
        {toggle('notifySound', 'settings.sound')}
        {toggle('notifyDesktop', 'settings.desktop')}
      </section>
    </>
  )
}

function AboutSection() {
  const [about, setAbout] = useState<About | null>(null)
  useEffect(() => {
    api.about().then(setAbout, () => setAbout(null))
  }, [])
  if (!about) return <p className="muted">{t('common.loading')}</p>
  const rows: [Key, string][] = [
    ['about.version', about.version],
    ['about.runtime', t(about.bundled ? 'about.bundled' : 'about.source')],
    ['about.platform', about.os === 'macos' ? 'macOS' : about.os],
    ['about.arch', about.arch === 'aarch64' ? 'arm64 (Apple silicon)' : about.arch],
    ['about.engine', about.root]
  ]
  return (
    <section className="settings-block about">
      <h3>{t('settings.about')}</h3>
      {rows.map(([k, v]) => (
        <div key={k} className="about-row"><span className="muted">{t(k)}</span><span className="ellipsis" title={v}>{v}</span></div>
      ))}
      {about.data && (
        <div className="pref-row boxed">
          <div><strong>{t('about.data')}</strong><p className="hint">{about.data}</p></div>
          <button className="small" onClick={() => api.reveal(about.data!)}>{t('studio.finder')}</button>
        </div>
      )}
    </section>
  )
}

// The asset library's sources and the person's keys for them
function AssetSources({ settings, update }: { settings: Settings; update: (s: Partial<Settings>) => void }) {
  const rows: { key: 'polypizzaKey' | 'smithsonianKey'; name: string; note: Key; url: string; hint: string }[] = [
    { key: 'polypizzaKey', name: 'Poly Pizza', note: 'assets.polypizzaNote', url: 'https://poly.pizza/settings/api', hint: '' },
    { key: 'smithsonianKey', name: 'Smithsonian Open Access', note: 'assets.smithsonianNote', url: 'https://api.data.gov/signup/', hint: 'DEMO_KEY' }
  ]
  return (
    <section className="settings-block">
      <h3>{t('settings.assets')}</h3>
      <p className="hint">{t('assets.intro')}</p>
      {rows.map(r => (
        <label key={r.key} className="field">
          <span className="row between">
            {r.name}
            <button type="button" className="link" onClick={() => api.openUrl(r.url)}>{t('ai.getKey')} <Icon name="arrow" size={12} /></button>
          </span>
          <input type="password" value={settings[r.key]} placeholder={r.hint} onChange={e => update({ [r.key]: e.target.value })} />
          <small className="muted">{t(r.note)}</small>
        </label>
      ))}
    </section>
  )
}
