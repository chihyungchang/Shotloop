import type { ReactNode } from 'react'
import { agentError } from '../ai/errors'
import type { Job } from '../api'
import { t } from '../i18n'
import { ErrorText } from './ErrorDialog'
import { Icon } from './Icon'

// An agent job's failure in the person's words: a missing backend points
// to Settings, anything else is the message itself, its whole in the error
// dialog. Nothing when the job has not failed. `children` adds the
// place's own way on (a retry)
export function AgentError({ job, openSettings, className = 'error-box small', title, children }: {
  job: Job | null | undefined
  openSettings: () => void
  className?: string
  title?: string
  children?: ReactNode
}) {
  if (job?.state !== 'failed') return null
  const why = agentError(job.error)
  return (
    <div className={className}>
      {title && <span className="status">{title}</span>}
      <ErrorText error={job.error} summary={why.text} as="div" className={title ? 'small' : ''} title={title ?? t('agent.failed')} />
      {why.setup
        ? <button className="small" onClick={openSettings}><Icon name="settings" size={13} /> {t('agent.openSettings')}</button>
        : children}
    </div>
  )
}
