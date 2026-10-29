import type { useTheme } from '../theme/theme'
import { Setup } from './Setup'
import { ThemeToggle } from './ThemeToggle'

export function SettingsPage({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="muted">What Shotloop needs on this Mac, your key for the agent, and how it looks.</p>
      <section className="panel setup appearance">
        <h3>Appearance</h3>
        <div className="field-row">
          <span>Mode</span>
          <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
        </div>
      </section>
      <Setup />
    </div>
  )
}
