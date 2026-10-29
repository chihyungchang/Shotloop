import { useEffect, useState } from 'react'
import { api, EMPTY_SETTINGS, type Settings } from '../api'
import { LANGS, t, type LangPref, type useLanguage } from '../i18n'
import type { Key } from '../i18n/en'
import type { useTheme } from '../theme/theme'
import { AiSettings } from './AiSettings'
import { Icon } from './Icon'
import { Setup } from './Setup'
import { ThemeToggle } from './ThemeToggle'

type Section = 'ai' | 'appearance' | 'deps'

const SECTIONS: [Section, Key, Parameters<typeof Icon>[0]['name']][] = [
  ['ai', 'ai.title', 'spark'],
  ['appearance', 'theme.label', 'palette'],
  ['deps', 'setup.deps', 'box']
]

// Settings, after open-design's: a section list on the left, one section
// at a time on the right. Appearance and language apply at once; the AI
// backend and the tool paths are saved together with one button.
export function SettingsPage({ theme, language }: {
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
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
  const save = async () => {
    await api.saveSettings(settings)
    setSaved(settings)
  }

  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label={t('settings.title')}>
        <h1>{t('settings.title')}</h1>
        {SECTIONS.map(([id, label, icon]) => (
          <button key={id} className={`settings-nav-item${section === id ? ' on' : ''}`} aria-current={section === id} onClick={() => setSection(id)}>
            <Icon name={icon} size={16} /> {t(label)}
          </button>
        ))}
      </nav>
      <div className="settings-body">
        <div className="settings-head">
          <p className="muted">{t('settings.intro')}</p>
          {section !== 'appearance' && (
            <button className="primary" onClick={save} disabled={!dirty}>{dirty ? t('setup.save') : t('common.saved')}</button>
          )}
        </div>
        {section === 'appearance' && (
          <section className="settings-block">
            <h3>{t('theme.label')}</h3>
            <div className="field-row">
              <span>{t('settings.mode')}</span>
              <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
            </div>
            <div className="field-row">
              <span>{t('settings.language')}</span>
              <select className="inline-select" value={language.pref} onChange={e => language.setPref(e.target.value as LangPref)}>
                <option value="system">{t('lang.system')}</option>
                {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </section>
        )}
        {section === 'ai' && <AiSettings settings={settings} update={update} />}
        {section === 'deps' && <Setup settings={settings} update={update} />}
      </div>
    </div>
  )
}
