import { fileUrl, type Job, type Project, type Storyboard } from '../../api'
import { useTick } from '../../hooks'
import { t } from '../../i18n'
import { agentNow, buildStepList, buildSteps, editMode, formatSeconds, isActive, isWide, planSteps, type Step } from '../../model'
import { Icon } from '../Icon'
import { ShotSketch } from './ShotSketch'
import { shotHue } from './Storyboard'

// The plan has 2D pictures that recur (drawn once before the shots), as
// the agent reads them (agent/src/briefs.ts recurring)
const hasParts = (project: Project, plan: Storyboard | null) =>
  project.track === '2d' && !!plan?.recurring?.some(r => String(r.name ?? '').trim() && r.shots?.length)

// The build: what the AI is doing now, and each shot as its stills land.
// A build runs for minutes with long quiet turns, so the page always says
// what is happening and for how long
export function BuildView({ project, plan, job, toStudio, back }: { project: Project; plan: Storyboard | null; job: Job | null; toStudio: () => void; back: () => void }) {
  const running = !!job && isActive(job)
  useTick(running)
  // The stills the editor shows: Blender's previews, a page's finals
  const stills = (s: Project['shots'][number]) => s[editMode(project)].stills
  const ready = project.shots.filter(s => stills(s)).length
  const steps = buildSteps(job)
  const elapsed = job?.startedAt ? ((job.finishedAt ?? Date.now()) - job.startedAt) / 1000 : null
  const wide = isWide(project.size)
  const total = project.shots.length
  // Each shot's state: stills, in work (and how), code written, waiting
  const view = project.shots.map((s, i) => {
    const current = stills(s)
    const still = current ?? latestStills(s)
    const action = steps.active.get(s.id)
    const written = steps.written.has(s.id) || steps.done.has(s.id)
    const state = action ? t(action === 'stills' ? 'build.rendering' : 'build.writing')
      : current ? null
      : written ? t(still ? 'build.updating' : 'build.written')
      : running ? t('build.waiting') : null
    return { s, i, current, still, stale: !current && !!still, action, written, state, text: plan?.shots[i]?.text || s.title || s.id }
  })
  return (
    <div className="build">
      <div className="build-head">
        <span className="agent-avatar large">{running ? <span className="spinner" /> : <Icon name="check" size={20} />}</span>
        <div className="build-words">
          <strong>{t(running ? 'plan.building' : job?.state === 'failed' ? 'plan.buildFailed' : 'plan.built')}</strong>
          <p className="muted small">
            {t('build.readyCount', { done: ready, total })}
            {elapsed != null && ` · ${t(running ? 'act.elapsed' : 'build.took', { time: formatSeconds(elapsed) })}`}
            {running && ` · ${t('build.usual')}`}
          </p>
        </div>
        <div className="spacer" />
        {!running && <button className="ghost" onClick={back}>{t('plan.backToPlan')}</button>}
        <button className={running ? '' : 'primary'} onClick={toStudio}>{t(running ? 'plan.openNow' : 'plan.openStudio')} <Icon name="arrow" size={13} /></button>
      </div>
      <div className="build-bar" aria-hidden>
        {view.map(v => (
          <i key={v.s.id} title={`${v.i + 1}. ${v.s.title ?? v.s.id}`} style={{ flex: Math.max(0.5, v.s.duration), '--hue': shotHue(v.i) } as React.CSSProperties}
            className={v.current ? 'done' : v.action ? 'active' : v.written ? 'written' : ''} />
        ))}
      </div>
      {running && job!.state === 'queued' && <p className="muted small">{t('queue.waiting')}</p>}
      {running && job!.state === 'running' && <StepList steps={buildStepList(job!, project.shots, project.look ?? null, hasParts(project, plan))} row />}
      {job?.state === 'failed' && job.error && <pre className="error-box small">{job.error}</pre>}
      <div className={`build-grid${wide ? ' wide' : ''}`}>
        {view.map(v => (
          <figure key={v.s.id} className={`build-shot${v.still ? ' ready' : ''}${v.stale ? ' stale' : ''}${v.action ? ' active' : ''}`}>
            <div className={`build-frame${wide ? ' wide' : ''}`}>
              {v.still
                ? <img src={fileUrl(v.still[1])} alt="" />
                : <ShotSketch look={project.look} text={v.text} n={v.i + 1} total={total} wide={wide} faint={!v.action} />}
              {v.action && !v.still && <span className="shimmer sweep" />}
              {v.state && <span className="build-state small">{v.action && <span className="pulse" />}{v.state}</span>}
            </div>
            <figcaption>
              <span className="shot-no" style={{ background: shotHue(v.i) }}>{v.i + 1}</span>
              <span className="ellipsis">{v.s.title ?? v.s.id}</span>
              <span className="muted">{t('unit.s', { n: v.s.duration })}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

// Before the plan exists: what the AI is doing, for how long, and the
// outline of what it will hand back (the copy and a column of frames)
export function PlanWait({ project, job, reading }: { project: Project; job: Job | null; reading: boolean }) {
  useTick(!!job)
  const elapsed = job?.startedAt ? (Date.now() - job.startedAt) / 1000 : null
  const n = Math.max(4, Math.min(8, Math.round(project.duration / 5)))
  return (
    <div className="plan-wait">
      <div className="wait-card">
        <span className="agent-avatar large">{job ? <span className="spinner" /> : <Icon name="spark" size={22} />}</span>
        <div className="wait-words">
          <strong>{t(reading ? 'plan.reading' : job ? 'plan.writing' : 'plan.none')}</strong>
          {!reading && <p className="muted small">{t('plan.writingNote')}</p>}
        </div>
        {job && (
          <span className="wait-time small muted">
            {job.state === 'queued' ? t('queue.waiting') : elapsed != null ? `${t('act.elapsed', { time: formatSeconds(elapsed) })} · ${t('plan.usualShort')}` : ''}
          </span>
        )}
        {job?.state === 'running' && <StepList steps={planSteps(job)} row />}
      </div>
      <div className="plan-skeleton" aria-hidden>
        <div className="sk-col">
          <span className="sk-label">{t('plan.idea')}</span>
          <p className="sk-idea">{project.title}</p>
          <span className="sk-label">{t('plan.hook')}</span>
          <span className="sk-line w80" />
          <span className="sk-label">{t('plan.body')}</span>
          <span className="sk-line" /><span className="sk-line" /><span className="sk-line w90" /><span className="sk-line w60" />
          <span className="sk-label">{t('plan.facts')}</span>
          <span className="sk-line w70" /><span className="sk-line w50" />
        </div>
        <div className="sk-col">
          <span className="sk-label">{t('plan.board')}</span>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="sk-shot" style={{ animationDelay: `${i * 120}ms` }}>
              <ShotSketch look={project.look} text="" n={i + 1} total={n} wide={isWide(project.size)} faint />
              <div className="sk-shot-lines"><span className="sk-line w40" /><span className="sk-line w80" /><span className="sk-line w60" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// What the AI does, step by step: done, now (with what and how long), next
export function StepList({ steps, row = false }: { steps: Step[]; row?: boolean }) {
  useTick(true)
  const active = steps.find(s => s.state === 'active' && s.detail)
  return (
    <div className={`steps-wrap${row ? ' row' : ''}`}>
      <ol className={`steps${row ? ' row' : ''}`}>
        {steps.map((s, i) => (
          <li key={i} className={s.state}>
            <span className="step-mark">{s.state === 'done' ? <Icon name="check" size={12} /> : s.state === 'active' ? <span className="spinner small" /> : i + 1}</span>
            <span className="step-text">
              <span>{s.label}</span>
              {!row && s.detail && <span className="small muted">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      {/* In a row, what the current step is doing goes under it */}
      {row && active && <p className="step-detail small"><span className="pulse" /> {active.detail}</p>}
    </div>
  )
}

// What the planning AI is doing now, in words, and for how long
export function PlanActivity({ job }: { job: Job }) {
  useTick(true)
  const now = agentNow(job)
  const elapsed = job.startedAt ? (Date.now() - job.startedAt) / 1000 : null
  return (
    <div className="plan-activity small">
      {now && <span className="job-now"><span className="pulse" /> <span className="ellipsis">{now}</span></span>}
      <span className="muted">{job.state === 'queued' ? t('queue.waiting') : elapsed != null ? t('act.elapsed', { time: formatSeconds(elapsed) }) : ''}</span>
    </div>
  )
}

// A shot's newest stills from its takes (any key)
const latestStills = (s: Project['shots'][number]) => [...s.takes].reverse().find(t => t.stills)?.stills ?? null
