import { Setup } from './Setup'

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="muted">What Shotloop needs on this Mac, and your key for the agent.</p>
      <Setup />
    </div>
  )
}
