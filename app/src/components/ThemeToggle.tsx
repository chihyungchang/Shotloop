import type { ThemePref } from '../theme/theme'
import { Icon } from './Icon'
import type { Key } from '../i18n/en'
import { t } from '../i18n'

const OPTIONS: [ThemePref, 'monitor' | 'sun' | 'moon', Key][] = [
  ['system', 'monitor', 'theme.system'],
  ['light', 'sun', 'theme.light'],
  ['dark', 'moon', 'theme.dark']
]

// Light / dark / system, as three icon buttons
export function ThemeToggle({ pref, setPref }: { pref: ThemePref; setPref: (p: ThemePref) => void }) {
  return (
    <div className="segmented theme-toggle" role="radiogroup" aria-label={t('theme.label')}>
      {OPTIONS.map(([value, icon, key]) => {
        const label = t(key)
        return (
        <button key={value} role="radio" aria-checked={pref === value} className={pref === value ? 'on' : ''}
          onClick={() => setPref(value)} title={label} aria-label={label}>
          <Icon name={icon} size={14} />
        </button>
      )})}
    </div>
  )
}
