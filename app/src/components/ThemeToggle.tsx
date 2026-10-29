import type { ThemePref } from '../theme/theme'
import { Icon } from './Icon'

const OPTIONS: [ThemePref, 'monitor' | 'sun' | 'moon', string][] = [
  ['system', 'monitor', 'Follow the system'],
  ['light', 'sun', 'Light'],
  ['dark', 'moon', 'Dark']
]

// Light / dark / system, as three icon buttons
export function ThemeToggle({ pref, setPref }: { pref: ThemePref; setPref: (p: ThemePref) => void }) {
  return (
    <div className="segmented theme-toggle" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(([value, icon, label]) => (
        <button key={value} role="radio" aria-checked={pref === value} className={pref === value ? 'on' : ''}
          onClick={() => setPref(value)} title={label} aria-label={label}>
          <Icon name={icon} size={14} />
        </button>
      ))}
    </div>
  )
}
