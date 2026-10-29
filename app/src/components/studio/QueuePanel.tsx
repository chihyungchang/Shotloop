import { api, type Job, type Project } from '../../api'
import { formatSeconds, jobEstimate, jobLabel } from '../../model'
import { t } from '../../i18n'

// The render queue (docs/PRD.md §7.7): renders one shot at a time,
// agent work alongside; progress and time estimates per job
export function QueuePanel({ project, jobs }: { project: Project; jobs: Job[] }) {
  const active = jobs.filter(j => j.state === 'running' || j.state === 'queued')
  const finished = jobs.filter(j => !(j.state === 'running' || j.state === 'queued')).reverse()
  const total = active.filter(j => j.lane === 'render').reduce((t, j) => t + (jobEstimate(project, j) ?? 0), 0)

  return (
    <div className="queue">
      <div className="row between">
        <h3>{t('queue.active')}</h3>
        {total > 0 && <span className="muted small">{t('queue.left', { time: formatSeconds(total) })}</span>}
      </div>
      {!active.length && <p className="muted small">{t('queue.idle')}</p>}
      {active.map(j => <JobRow key={j.id} job={j} project={project} />)}
      {finished.length > 0 && (
        <>
          <div className="row between">
            <h3>{t('queue.done')}</h3>
            <button className="link" onClick={() => api.clearJobs()}>{t('queue.clear')}</button>
          </div>
          {finished.slice(0, 30).map(j => <JobRow key={j.id} job={j} project={project} />)}
        </>
      )}
    </div>
  )
}

function JobRow({ job, project }: { job: Job; project: Project }) {
  const p = job.progress
  const eta = jobEstimate(project, job)
  const elapsed = job.startedAt ? ((job.finishedAt ?? Date.now()) - job.startedAt) / 1000 : null
  const other = job.project !== project.root
  return (
    <div className={`job ${job.state}`}>
      <div className="row between">
        <span className="label">
          <span className={`lane ${job.lane}`}>{t(`lane.${job.lane}`)}</span> {jobLabel(job)}
          {other && <span className="muted small"> · {job.project.split('/').at(-1)}</span>}
        </span>
        {(job.state === 'running' || job.state === 'queued') && (
          <button className="link" onClick={() => api.cancel(job.id)}>{t(job.state === 'running' ? 'queue.stop' : 'queue.remove')}</button>
        )}
      </div>
      {job.state === 'running' && p && p.total > 0 && (
        <div className="bar"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
      )}
      <div className="muted small">
        {job.state === 'running' && (p ? `${p.stage} ${p.done}/${p.total}` : job.log.at(-1) ?? t('queue.starting'))}
        {job.state === 'running' && eta != null && ` · ${t('queue.etaLeft', { time: formatSeconds(eta) })}`}
        {job.state === 'queued' && (eta != null ? t('queue.waitingEta', { time: formatSeconds(eta) }) : t('queue.waiting'))}
        {job.state === 'done' && t(job.result?.cached ? 'queue.doneCached' : 'queue.doneIn', { time: formatSeconds(elapsed) })}
        {job.state === 'cancelled' && t('queue.cancelled')}
      </div>
      {job.state === 'failed' && <pre className="error-box small">{job.error}</pre>}
    </div>
  )
}
