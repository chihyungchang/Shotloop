import { useState } from 'react'
import { useErrorLine } from '../hooks'
import { t } from '../i18n'
import { patchSettings, useSettings } from '../settings'

// The first-launch notice about the anonymous usage counts (src/telemetry.ts):
// they are on, here is what they hold, one click turns them off. Shown
// until the answer is saved; nothing is sent before that. Settings that
// can't be read show nothing here (the app's banner speaks for them)
export function TelemetryNotice() {
  const { settings } = useSettings()
  const [busy, setBusy] = useState(false)
  const { error, guard } = useErrorLine()
  if (!settings || settings.telemetryTold) return null

  const answer = async (off: boolean) => {
    setBusy(true)
    await guard(patchSettings({ telemetryTold: true, telemetryOff: off }))
    setBusy(false)
  }
  return (
    <div className="dialog telemetry-notice" role="dialog" aria-label={t('telemetry.title')}>
      <strong>{t('telemetry.title')}</strong>
      <p className="hint">{t('telemetry.note')}</p>
      {error && <p className="small error">{error}</p>}
      <div className="dialog-actions">
        <button className="ghost" onClick={() => answer(true)} disabled={busy}>{t('telemetry.turnOff')}</button>
        <button className="primary" onClick={() => answer(false)} disabled={busy}>{t('telemetry.ok')}</button>
      </div>
    </div>
  )
}
