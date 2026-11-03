import { useState } from 'react'
import { api } from '../api'
import { useErrorLine } from '../hooks'
import { t } from '../i18n'
import { patchSettings, useSettings } from '../settings'
import { privacyUrl } from '../telemetry'
import { ErrorText } from './ErrorDialog'

// The first-launch notice about the anonymous usage counts (src/telemetry.ts):
// what they are for in one line, the full privacy notice one click away
// (the product site), one click turns them off. Shown until the answer is
// saved; nothing is sent before that. Settings that can't be read show
// nothing here (the app's banner speaks for them)
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
    <div className="dialog telemetry-notice" role="dialog" aria-label={t('telemetry.ask')}>
      <strong>{t('telemetry.ask')}</strong>
      <p className="hint">{t('telemetry.short')} <button className="link" onClick={() => guard(api.openUrl(privacyUrl()))}>{t('telemetry.details')}</button></p>
      <ErrorText error={error} className="small error" />
      <div className="dialog-actions">
        <button className="ghost" onClick={() => answer(true)} disabled={busy}>{t('telemetry.turnOff')}</button>
        <button className="primary" onClick={() => answer(false)} disabled={busy}>{t('telemetry.ok')}</button>
      </div>
    </div>
  )
}
