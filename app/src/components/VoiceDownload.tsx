import { api, type Job, type VoiceInfo } from '../api'
import { useEscape } from '../hooks'
import { t } from '../i18n'
import { Icon } from './Icon'
import { JobDownload } from './JobDownload'

// A speech model's download (a queue job, voiceModel)
export function VoiceDownload({ model, project, jobs, onDone }: {
  model: { id: string; name: string; bytes: number; installed: boolean }
  // The project that asked for it, whose speaking jobs wait for it
  project?: string
  jobs: Job[]
  onDone?: () => void
}) {
  return (
    <JobDownload
      job={jobs.filter(j => j.kind === 'voiceModel' && j.model === model.id).at(-1)}
      installed={model.installed}
      bytes={model.bytes}
      label={t('voiceDl.get', { name: model.name, mb: Math.round(model.bytes / 1e6) })}
      start={() => api.enqueue({ kind: 'voiceModel', model: model.id, project })}
      onDone={onDone}
    />
  )
}

type Model = NonNullable<VoiceInfo['model']>

// Before a voiced film plays: its voice model isn't on this Mac yet. The
// download, then the film (onDone); or the film without its voice now
export function VoiceModelDialog({ model, project, jobs, onDone, silent, close }: {
  model: Model
  project: string
  jobs: Job[]
  onDone: () => void
  silent: () => void
  close: () => void
}) {
  useEscape(close)
  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog column" role="dialog" aria-label={t('voiceDl.needTitle')} onClick={e => e.stopPropagation()}>
        <div className="row between">
          <strong>{t('voiceDl.needTitle')}</strong>
          <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" size={14} /></button>
        </div>
        <p className="muted small">{t('voiceDl.needNote', { name: model.name, mb: Math.round(model.bytes / 1e6) })}</p>
        <VoiceDownload model={model} project={project} jobs={jobs} onDone={onDone} />
        <div className="dialog-actions">
          <button className="ghost" onClick={silent}>{t('voiceDl.watchSilent')}</button>
        </div>
      </div>
    </div>
  )
}
