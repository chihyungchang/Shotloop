import { useState } from 'react'
import { api, type Job, type Project } from '../../api'
import { useErrorLine, useEscape } from '../../hooks'
import { t } from '../../i18n'
import { isActive } from '../../model'
import { Icon } from '../Icon'

// The film's sound, asked for once the shots are approved: the AI gives
// every shot its effects and picks the ambience in one pass; a film
// without a voice-over may get narration written to fit its shots
export function SoundDialog({ project, jobs, started, close }: { project: Project; jobs: Job[]; started: () => void; close: () => void }) {
  const [narrate, setNarrate] = useState(false)
  const { error, guard } = useErrorLine()
  useEscape(close)
  const running = jobs.some(j => j.kind === 'sound' && j.project === project.root && isActive(j))
  const start = async () => {
    if ((await guard(api.enqueue({ kind: 'sound', project: project.root, narrate: narrate || undefined }))) == null) return
    started()
    close()
  }
  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog column" role="dialog" aria-label={t('sound.title')} onClick={e => e.stopPropagation()}>
        <strong><Icon name="volume" size={15} /> {t('sound.title')}</strong>
        <p className="muted small">{t('sound.dialogNote')}</p>
        {!project.voiced && (
          <label className="check-inline">
            <input type="checkbox" checked={narrate} onChange={e => setNarrate(e.target.checked)} /> {t('sound.narrate')}
          </label>
        )}
        {!project.voiced && narrate && <p className="muted small">{t('sound.narrateNote')}</p>}
        {error && <p className="small error">{error}</p>}
        <div className="dialog-actions">
          <button className="ghost" onClick={close}>{t('plan.cancel')}</button>
          <button className="primary" onClick={start} disabled={running}>
            {running ? <span className="spinner small" /> : <Icon name="spark" size={13} />} {t(running ? 'sound.running' : 'sound.start')}
          </button>
        </div>
      </div>
    </div>
  )
}
