import { api, type Job, type Project } from '../../api'
import { activityLine, buildProgress, formatSeconds, jobEstimate, jobLabel } from '../../model'
import { useEffect, useState } from 'react'
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

// While a job runs, a tick a second for its elapsed time
function useTick(on: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => set(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
}

const ABOUT: Partial<Record<Job['kind'], 'act.about.build' | 'act.about.plan' | 'act.about.fix'>> = {
  build: 'act.about.build', plan: 'act.about.plan', fix: 'act.about.fix'
}

function JobRow({ job, project }: { job: Job; project: Project }) {
  const running = job.state === 'running'
  useTick(running)
  const eta = jobEstimate(project, job)
  const elapsed = job.startedAt ? ((job.finishedAt ?? Date.now()) - job.startedAt) / 1000 : null
  const other = job.project !== project.root
  const agent = job.lane === 'agent'
  // Agents report steps, renders report frames
  const p = job.progress ?? buildProgress(job, project.shots.length)
  const pTotal = p?.total ?? 0
  const now = job.log.at(-1)
  return (
    <div className={`job ${job.state}`}>
      <div className="row between">
        <span className="job-name">
          <span className={`lane ${job.lane}`}>{t(`lane.${job.lane}`)}</span>
          <span>{jobLabel(job)}{other && <span className="muted small"> · {job.project.split('/').at(-1)}</span>}</span>
        </span>
        {(running || job.state === 'queued') && (
          <button className="link" onClick={() => api.cancel(job.id)}>{t(running ? 'queue.stop' : 'queue.remove')}</button>
        )}
      </div>
      {running && agent && ABOUT[job.kind] && <p className="job-about small muted">{t(ABOUT[job.kind]!)}</p>}
      {running && (
        <div className={`bar${pTotal ? '' : ' indeterminate'}`}><i style={pTotal ? { width: `${Math.max(4, (p!.done / pTotal) * 100)}%` } : undefined} /></div>
      )}
      {running && agent && now && (
        <div className="job-now small"><span className="pulse" /> <span className="ellipsis" title={now}>{activityLine(now)}</span></div>
      )}
      <div className="muted small job-meta">
        {running && job.progress && !agent && `${job.progress.stage} ${job.progress.done}/${job.progress.total}`}
        {running && !job.progress && p && t('act.shots', { done: p.done, total: p.total })}
        {running && !job.progress && !p && !agent && (now ?? t('queue.starting'))}
        {running && elapsed != null && <span>{t('act.elapsed', { time: formatSeconds(elapsed) })}</span>}
        {running && eta != null && <span>{t('queue.etaLeft', { time: formatSeconds(eta) })}</span>}
        {job.state === 'queued' && (eta != null ? t('queue.waitingEta', { time: formatSeconds(eta) }) : t('queue.waiting'))}
        {job.state === 'done' && t(job.result?.cached ? 'queue.doneCached' : 'queue.doneIn', { time: formatSeconds(elapsed) })}
        {job.state === 'cancelled' && t('queue.cancelled')}
      </div>
      {job.state === 'failed' && <pre className="error-box small">{job.error}</pre>}
    </div>
  )
}
