import { useEffect, useState } from 'react'
import { api, type Doctor, type Settings } from '../api'
import { t } from '../i18n'
import { Icon } from './Icon'
import { ErrorText } from './ErrorDialog'

// First-run checks (docs/PRD.md §9, External): what is installed, how to
// install what is missing, and where the tools are
export function Setup({ settings, update }: { settings: Settings; update: (s: Partial<Settings>) => void }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [doctorError, setDoctorError] = useState<string | null>(null)

  const check = () => {
    setDoctorError(null)
    api.doctor().then(setDoctor, e => setDoctorError(String(e)))
  }
  useEffect(check, [])

  // Node and ffmpeg ship inside the app: listed only when missing (a
  // build from source without them). Chrome is the one thing to install
  type Row = [string, string | null, string]
  const inApp = !!(doctor?.bundled?.node && doctor.bundled.ffmpeg)
  const rows: Row[] = doctor
    ? [
        ...(doctor.nodePath ? [] : [['Node.js', null, t('setup.nodeHint')] as Row]),
        ['Chrome', doctor.chrome?.version ?? null, doctor.install.chrome],
        ...(doctor.ffmpeg ? [] : [['ffmpeg', null, doctor.install.ffmpeg] as Row])
      ]
    : []

  return (
    <section className="settings-block setup">
      <div className="row between">
        <h3>{t('setup.deps')}</h3>
        <button className="ghost small" onClick={check}>{t('setup.checkAgain')}</button>
      </div>
      <ErrorText error={doctorError} className="error" />
      {!doctor && !doctorError && <p className="muted">{t('setup.checking')}</p>}
      {doctor && (
        <table className="deps">
          <tbody>
            {rows.map(([name, version, hint]) => (
              <tr key={name}>
                <td>
                  <span className={`dot ${version ? 'ok' : 'bad'}`} /> {name}
                </td>
                <td className={version ? '' : 'muted'}>
                  {version ?? <>{t('setup.notFound')} <code>{hint}</code></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {inApp && <p className="hint"><Icon name="check" size={12} /> {t('setup.bundledNote')}</p>}
      <details>
        <summary className="muted">{t('setup.toolPaths')}</summary>
        <label className="field">
          <span>Chrome</span>
          <input
            value={settings.chrome}
            placeholder="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            onChange={e => update({ chrome: e.target.value })}
          />
        </label>
      </details>
      {doctor && <p className="muted small">{t('setup.engine', { path: doctor.root })}</p>}
    </section>
  )
}
