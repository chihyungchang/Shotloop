import { LANGS, t, type LangPref, type useLanguage } from '../i18n'
import type { useTheme } from '../theme/theme'
import { Setup } from './Setup'
import { ThemeToggle } from './ThemeToggle'

export function SettingsPage({ theme, language }: {
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
}) {
  return (
    <div className="settings-page">
      <h1>{t('settings.title')}</h1>
      <p className="muted">{t('settings.intro')}</p>
      <section className="panel setup appearance">
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
      <Setup />
    </div>
  )
}
