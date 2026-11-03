import { useEffect, useRef } from 'react'
import { type Job } from '../api'
import { useErrorLine } from '../hooks'
import { formatEta, isActive } from '../model'
import { t } from '../i18n'
import { Icon } from './Icon'
import { ErrorText } from './ErrorDialog'

// A download run as a queue job (a speech model, the render browser): a
// button with its size, then a bar with MB and the time left; onDone runs
// when it lands, so whatever waited for it goes on. job: its latest one
export function JobDownload({ job, installed, bytes, label, start, onDone }: {
  job: Job | undefined
  installed: boolean
  bytes: number
  // The button's words, with its size
  label: string
  start: () => Promise<unknown>
  onDone?: () => void
}) {
  const busy = !!job && isActive(job)
  const { error, guard } = useErrorLine()
  // Once per download that finishes while shown
  const seen = useRef(job?.state)
  useEffect(() => {
    if (seen.current !== job?.state && job?.state === 'done') onDone?.()
    seen.current = job?.state
  }, [job?.state, onDone])

  // Downloaded (what was read before it landed may still say not)
  if ((installed || job?.state === 'done') && !busy) return null
  const mb = Math.round(bytes / 1e6)
  const p = job?.progress
  if (busy) {
    return (
      <div className="job-dl">
        <div className={`bar${p?.total ? '' : ' indeterminate'}`}><i style={p?.total ? { width: `${Math.max(3, (p.done / p.total) * 100)}%` } : undefined} /></div>
        <span className="muted small">
          {job?.state === 'queued' ? t('queue.waiting') : t('download.progress', { done: p?.done ?? 0, total: p?.total || mb })}
          {p?.eta != null && p.done < p.total && ` · ${t('queue.etaLeft', { time: formatEta(p.eta) })}`}
        </span>
      </div>
    )
  }
  const failure = error ?? (job?.state === 'failed' ? job.error : null)
  return (
    <div className="job-dl">
      <button className="small" onClick={() => guard(start())}>
        <Icon name="download" size={12} /> {job?.state === 'failed' ? t('download.retry', { mb }) : label}
      </button>
      <ErrorText error={failure} as="span" className="error small ellipsis" />
    </div>
  )
}
