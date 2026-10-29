import { useEffect, useState } from 'react'
import { api, type Doctor, type Settings } from '../api'

// First-run checks (docs/PRD.md §9, External): what is installed, how to
// install what is missing, and the user's own API key for the agent
export function Setup() {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [doctorError, setDoctorError] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>({ apiKey: '', blender: '', chrome: '' })
  const [saved, setSaved] = useState(false)

  const check = () => {
    setDoctorError(null)
    api.doctor().then(setDoctor, e => setDoctorError(String(e)))
  }
  useEffect(() => {
    check()
    api.getSettings().then(setSettings)
  }, [])

  const save = async () => {
    await api.saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    check()
  }

  const rows: [string, string | null, string | null, boolean][] = doctor
    ? [
        ['Node.js', doctor.nodePath ? `${doctor.node}` : null, 'brew install node (23 or newer)', true],
        ['Chrome', doctor.chrome?.version ?? null, doctor.install.chrome, true],
        ['ffmpeg', doctor.ffmpeg?.version?.replace(/ Copyright.*/, '') ?? null, doctor.install.ffmpeg, true],
        ['Blender', doctor.blender?.version ?? null, doctor.install.blender, false]
      ]
    : []

  return (
    <section className="panel setup">
      <h3>Dependencies</h3>
      {doctorError && <p className="error">{doctorError}</p>}
      {!doctor && !doctorError && <p className="muted">Checking dependencies…</p>}
      {doctor && (
        <table className="deps">
          <tbody>
            {rows.map(([name, version, hint, required]) => (
              <tr key={name}>
                <td>
                  <span className={`dot ${version ? 'ok' : required ? 'bad' : 'warn'}`} /> {name}
                </td>
                <td className={version ? '' : 'muted'}>
                  {version ?? (
                    <>
                      Not found{required ? '' : ' (3D projects only)'}. <code>{hint}</code>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Agent</h3>
      <label className="field">
        <span>Anthropic API key</span>
        <input
          type="password"
          value={settings.apiKey}
          placeholder="sk-ant-…"
          onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
        />
        <small className="muted">Your own key. Used for fixes, checks and publish copy; stored on this Mac only.</small>
      </label>
      <details>
        <summary className="muted">Tool paths</summary>
        <label className="field">
          <span>Blender</span>
          <input
            value={settings.blender}
            placeholder="/Applications/Blender.app/Contents/MacOS/Blender"
            onChange={e => setSettings({ ...settings, blender: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Chrome</span>
          <input
            value={settings.chrome}
            placeholder="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            onChange={e => setSettings({ ...settings, chrome: e.target.value })}
          />
        </label>
      </details>
      <div className="row gap">
        <button onClick={save}>{saved ? 'Saved' : 'Save settings'}</button>
        <button className="ghost" onClick={check}>Check again</button>
      </div>
      {doctor && <p className="muted small">Engine: {doctor.root}</p>}
    </section>
  )
}
