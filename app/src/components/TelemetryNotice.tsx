import { useEffect, useState } from 'react'
import { api } from '../api'
import { t } from '../i18n'

// The first-launch notice about the anonymous usage counts (src/telemetry.ts):
// they are on, here is what they hold, one click turns them off. Shown
// until either button is pressed; nothing is sent before that
export function TelemetryNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    api.getSettings().then(s => setShow(!s.telemetryTold), () => {})
  }, [])
  if (!show) return null

  const answer = async (off: boolean) => {
    setShow(false)
    await api.patchSettings({ telemetryTold: true, telemetryOff: off })
  }
  return (
    <div className="dialog telemetry-notice" role="dialog" aria-label={t('telemetry.title')}>
      <strong>{t('telemetry.title')}</strong>
      <p className="hint">{t('telemetry.note')}</p>
      <div className="dialog-actions">
        <button className="ghost" onClick={() => answer(true)}>{t('telemetry.turnOff')}</button>
        <button className="primary" onClick={() => answer(false)}>{t('telemetry.ok')}</button>
      </div>
    </div>
  )
}
