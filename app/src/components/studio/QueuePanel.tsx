import { api, type Job, type Project } from '../../api'
import { useErrorLine, useTick } from '../../hooks'
import { agentNow, buildProgress, formatEta, formatSeconds, isActive, jobEstimate, jobLabel, stageName } from '../../model'
import { baseName } from '../../recent'
import { Icon } from '../Icon'
import { formatDate, t } from '../../i18n'

// The render queue (docs/PRD.md §7.7): renders one shot at a time,
// agent work alongside; progress and time estimates per job
export function QueuePanel({ project, jobs }: { project: Project; jobs: Job[] }) {
  const active = jobs.filter(isActive)
  const finished = jobs.filter(j => !isActive(j)).reverse()
  const left = active.filter(j => j.lane === 'render').reduce((t, j) => t + (jobEstimate(project, j) ?? 0), 0)
  useTick(active.length > 0)
  const doneAt = formatDate(Date.now() + left * 1000, { hour: '2-digit', minute: '2-digit' })
  const { error, guard } = useErrorLine()

  return (
    <div className="queue">
      {active.length > 0
        ? (
          <div className="queue-summary">
            <span className="small muted">{t('queue.summary', { n: active.length })}</span>
            {left > 0 && <strong>{t('queue.leftShort', { time: formatEta(left) })}</strong>}
            {left > 0 && <span className="small muted">{t('queue.doneAt', { at: doneAt })}</span>}
          </div>
        )
        : <p className="muted small">{t('queue.idle')}</p>}
      {error && <pre className="error-box small">{error}</pre>}
      {active.map(j => <JobRow key={j.id} job={j} project={project} cancel={() => guard(api.cancel(j.id))} />)}
      {finished.length > 0 && (
        <>
          <div className="row between">
            <h3>{t('queue.done')}</h3>
            <button className="link" onClick={() => guard(api.clearJobs())}>{t('queue.clear')}</button>
          </div>
          {finished.slice(0, 30).map(j => <JobRow key={j.id} job={j} project={project} />)}
        </>
      )}
    </div>
  )
}

const ABOUT: Partial<Record<Job['kind'], 'act.about.build' | 'act.about.plan' | 'act.about.fix'>> = {
  build: 'act.about.build', plan: 'act.about.plan', fix: 'act.about.fix'
}

function JobRow({ job, project, cancel }: { job: Job; project: Project; cancel?: () => void }) {
  const running = job.state === 'running'
  const queued = job.state === 'queued'
  useTick(running)
  const eta = jobEstimate(project, job)
  const elapsed = job.startedAt ? ((job.finishedAt ?? Date.now()) - job.startedAt) / 1000 : null
  const other = job.project !== project.root
  const agent = job.lane === 'agent'
  // Agents report steps, renders report frames
  const p = job.progress ?? buildProgress(job, project.shots.length)
  const pTotal = p?.total ?? 0
  const pct = pTotal ? Math.round((p!.done / pTotal) * 100) : null
  const now = job.log.at(-1)
  const doing = agent ? agentNow(job) : null
  return (
    <div className={`job ${job.state}`} title={elapsed != null && running ? t('act.elapsed', { time: formatSeconds(elapsed) }) : undefined}>
      <div className="job-head">
        {job.state === 'done' && <span className="job-ok"><Icon name="check" size={13} /></span>}
        <span className="job-name">
          {agent && <span className="lane agent">{t('lane.agent')}</span>}
          <span className="ellipsis">{jobLabel(job)}{other && job.project && <span className="muted small"> · {baseName(job.project)}</span>}</span>
        </span>
        <span className="job-side small muted">
          {running && pct != null && `${pct}%`}
          {queued && (eta != null ? `≈ ${formatEta(eta)}` : t('queue.waiting'))}
          {job.state === 'done' && (job.result?.cached ? t('queue.cachedShort') : formatSeconds(elapsed))}
          {job.state === 'cancelled' && t('queue.cancelled')}
        </span>
        {cancel && (
          <button className="icon-button job-x" onClick={cancel} title={t(running ? 'queue.stop' : 'queue.remove')} aria-label={t(running ? 'queue.stop' : 'queue.remove')}>
            <Icon name="x" size={12} />
          </button>
        )}
      </div>
      {running && agent && ABOUT[job.kind] && <p className="job-about small muted">{t(ABOUT[job.kind]!)}</p>}
      {running && (
        <div className={`bar${pTotal ? '' : ' indeterminate'}`}><i style={pTotal ? { width: `${Math.max(3, (p!.done / pTotal) * 100)}%` } : undefined} /></div>
      )}
      {running && agent && doing && (
        <div className="job-now small"><span className="pulse" /> <span className="ellipsis" title={now}>{doing}</span></div>
      )}
      {running && (
        <div className="muted small job-meta">
          {job.progress && !agent ? t('queue.stage', { stage: stageName(job.progress.stage), done: job.progress.done, total: job.progress.total })
            : p ? `${t('act.shots', { done: p.done, total: p.total })} · ${t('act.elapsed', { time: formatSeconds(elapsed) })}`
            : !agent ? (now ?? t('queue.starting')) : t('act.elapsed', { time: formatSeconds(elapsed) })}
          {eta != null && <span>{t('queue.etaLeft', { time: formatEta(eta) })}</span>}
        </div>
      )}
      {job.state === 'failed' && <pre className="error-box small">{job.error}</pre>}
    </div>
  )
}
