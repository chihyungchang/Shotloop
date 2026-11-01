import { useEffect, useRef } from 'react'
import { api, type Job } from '../api'
import { formatEta } from '../model'
import { t } from '../i18n'
import { Icon } from './Icon'

// A speech model's download (a queue job, voiceModel): a button with its
// size, then a bar with MB and the time left; onDone runs when it lands,
// so whatever waited for the voice goes on
export function VoiceDownload({ model, jobs, onDone }: {
  model: { id: string; name: string; bytes: number; installed: boolean }
  jobs: Job[]
  onDone?: () => void
}) {
  const job = jobs.filter(j => j.kind === 'voiceModel' && j.model === model.id).at(-1)
  const busy = job?.state === 'queued' || job?.state === 'running'
  // Once per download that finishes while shown
  const seen = useRef(job?.state)
  useEffect(() => {
    if (seen.current !== job?.state && job?.state === 'done') onDone?.()
    seen.current = job?.state
  }, [job?.state, onDone])

  if (model.installed && !busy) return null
  const mb = Math.round(model.bytes / 1e6)
  const p = job?.progress
  if (busy) {
    return (
      <div className="voice-dl">
        <div className={`bar${p?.total ? '' : ' indeterminate'}`}><i style={p?.total ? { width: `${Math.max(3, (p.done / p.total) * 100)}%` } : undefined} /></div>
        <span className="muted small">
          {job?.state === 'queued' ? t('queue.waiting') : t('voiceDl.progress', { done: p?.done ?? 0, total: p?.total || mb })}
          {p?.eta != null && p.done < p.total && ` · ${t('queue.etaLeft', { time: formatEta(p.eta) })}`}
        </span>
      </div>
    )
  }
  return (
    <div className="voice-dl">
      <button className="small" onClick={() => api.enqueue({ kind: 'voiceModel', model: model.id })}>
        <Icon name="download" size={12} /> {t(job?.state === 'failed' ? 'voiceDl.retry' : 'voiceDl.get', { name: model.name, mb })}
      </button>
      {job?.state === 'failed' && <span className="error small ellipsis" title={job.error ?? ''}>{job.error}</span>}
    </div>
  )
}
