import { useEffect, useState } from 'react'
import { api, EMPTY_SETTINGS, type Settings } from '../api'
import { LANGS, t, type LangPref, type useLanguage } from '../i18n'
import { ACCENTS, type useTheme } from '../theme/theme'
import { AiSettings } from './AiSettings'
import { Setup } from './Setup'
import { ThemeToggle } from './ThemeToggle'

// Settings: appearance and language apply at once; the AI backend and the
// tool paths are saved together with one button
export function SettingsPage({ theme, language }: {
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
}) {
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
      <div className="row between settings-head">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="muted">{t('settings.intro')}</p>
        </div>
        <button className="primary" onClick={save} disabled={!dirty}>{dirty ? t('setup.save') : t('common.saved')}</button>
      </div>
      <section className="panel setup appearance">
        <h3>{t('theme.label')}</h3>
        <div className="field-row">
          <span>{t('settings.mode')}</span>
          <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
        </div>
        <div className="field-row">
          <span>{t('settings.accent')}</span>
          <div className="swatches" role="radiogroup" aria-label={t('settings.accent')}>
            {ACCENTS.map(a => (
              <button key={a.id} role="radio" aria-checked={theme.accent === a.id} title={t(`accent.${a.id}`)} aria-label={t(`accent.${a.id}`)}
                className={`swatch${theme.accent === a.id ? ' on' : ''}`} style={{ background: a.swatch }} onClick={() => theme.setAccent(a.id)} />
            ))}
          </div>
        </div>
        <div className="field-row">
          <span>{t('settings.language')}</span>
          <select className="inline-select" value={language.pref} onChange={e => language.setPref(e.target.value as LangPref)}>
            <option value="system">{t('lang.system')}</option>
            {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </section>
      <AiSettings settings={settings} update={update} />
      <Setup settings={settings} update={update} />
    </div>
  )
}
