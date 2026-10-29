import { useEffect, useState } from 'react'
import { api, type Doctor, type Settings } from '../api'
import { t } from '../i18n'
import { Icon } from './Icon'

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
  // build from source without them). Chrome is the one thing to install;
  // Blender is optional (3D only).
  type Row = [string, string | null, string | null, boolean]
  const inApp = !!(doctor?.bundled?.node && doctor.bundled.ffmpeg)
  const rows: Row[] = doctor
    ? [
        ...(doctor.nodePath ? [] : [['Node.js', null, t('setup.nodeHint'), true] as Row]),
        ['Chrome', doctor.chrome?.version ?? null, doctor.install.chrome, true],
        ...(doctor.ffmpeg ? [] : [['ffmpeg', null, doctor.install.ffmpeg, true] as Row]),
        ['Blender', doctor.blender?.version ?? null, null, false]
      ]
    : []

  return (
    <section className="settings-block setup">
      <div className="row between">
        <h3>{t('setup.deps')}</h3>
        <button className="ghost small" onClick={check}>{t('setup.checkAgain')}</button>
      </div>
      {doctorError && <p className="error">{doctorError}</p>}
      {!doctor && !doctorError && <p className="muted">{t('setup.checking')}</p>}
      {doctor && (
        <table className="deps">
          <tbody>
            {rows.map(([name, version, hint, required]) => (
              <tr key={name}>
                <td>
                  <span className={`dot ${version ? 'ok' : required ? 'bad' : 'warn'}`} /> {name}
                </td>
                <td className={version ? '' : 'muted'}>
                  {version ?? (required ? (
                    <>
                      {t('setup.notFound')} <code>{hint}</code>
                    </>
                  ) : (
                    <>
                      {t('setup.only3d')}{' '}
                      <button className="link" onClick={() => api.openBlenderDownload()}>{t('blender.download')}</button>
                    </>
                  ))}
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
          <span>Blender</span>
          <input
            value={settings.blender}
            placeholder="/Applications/Blender.app/Contents/MacOS/Blender"
            onChange={e => update({ blender: e.target.value })}
          />
        </label>
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
