import { useState } from 'react'
import { t } from '../i18n'
import { settingsFromDefaults, useSettings } from '../settings'
import { ErrorText } from './ErrorDialog'

// The settings file could not be read (the shell set it aside as
// settings.json.bad): what happened, and the way on with the defaults.
// Until the person chooses, nothing is saved over the old file
export function SettingsProblem() {
  const { error } = useSettings()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  if (!error) return null
  const reset = async () => {
    setBusy(true)
    setFailed(null)
    try {
      await settingsFromDefaults()
    } catch (e) {
      setFailed(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="error banner floating settings-problem" role="alert">
      <span>{t('settings.unreadable', { error })}</span>
      <ErrorText error={failed} as="span" className="small" />
      <button className="small" onClick={reset} disabled={busy}>{busy && <span className="spinner small" />} {t('settings.useDefaults')}</button>
    </div>
  )
}
