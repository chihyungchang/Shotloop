import { useEffect, useRef, useState } from 'react'
import { agentError } from '../../ai/errors'
import { api, fileUrl, type Job, type Project, type Storyboard, type StoryShot } from '../../api'
import { t } from '../../i18n'
import { activityLine, formatSeconds } from '../../model'
import { Icon } from '../Icon'
import { Title } from '../studio/Studio'

const FILE = 'storyboard.json'
const round1 = (x: number) => Math.round(x * 10) / 10
// One hue per shot on the timeline, from the logo's aurora
const HUES = ['#2dd4bf', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#5eead4', '#7dd3fc', '#c4b5fd']

type Phase = 'plan' | 'build'

// Planning a new video, on one page: the copy on the left, the storyboard
// on the right, both written by the AI from the idea and edited in place
// (saved as you type). "Make the video" applies the storyboard and has the
// AI build every shot, with its progress here, then opens the studio.
export function PlanPage({ project, jobs, refresh, back, toStudio, openSettings }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  back: () => void
  toStudio: () => void
  openSettings: () => void
}) {
  const [sb, setSb] = useState<Storyboard | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [request, setRequest] = useState('')
  const [phase, setPhase] = useState<Phase>('plan')
  const [error, setError] = useState<string | null>(null)
  // A step that replaces work, waiting for a yes
  const [confirm, setConfirm] = useState<'again' | 'make' | null>(null)
  const [deriving, setDeriving] = useState(false)
  const saveTimer = useRef<number | null>(null)

  const mine = jobs.filter(j => j.project === project.root)
  const planJob = mine.filter(j => j.kind === 'plan').at(-1)
  const buildJob = mine.filter(j => j.kind === 'build').at(-1)
  const planning = !!planJob && (planJob.state === 'queued' || planJob.state === 'running')
  const building = !!buildJob && (buildJob.state === 'queued' || buildJob.state === 'running')
  const target = sb?.target ?? project.duration
  // Shots with frames already: rebuilding them replaces finished work
  const built = project.shots.some(s => s.draft.state === 'cached' || s.final.state === 'cached')

  const load = () =>
    api.readText(project.root, FILE).then(
      text => {
        setSb(JSON.parse(text))
        setLoaded(true)
      },
      () => {
        setSb(null)
        setLoaded(true)
      }
    )

  // First visit, no plan yet: a project with shots has its plan read back
  // from them; only a new one has the AI write it
  useEffect(() => {
    load().then(() => undefined)
  }, [project.root])
  useEffect(() => {
    if (!loaded || sb || planJob || deriving) return
    setDeriving(true)
    api.deriveStoryboard(project.root)
      .then(async v => {
        if (v) await load()
        else await api.enqueue({ kind: 'plan', project: project.root })
      })
      .catch(() => {
        api.enqueue({ kind: 'plan', project: project.root })
      })
      .finally(() => setDeriving(false))
  }, [loaded, sb, planJob])
  // A plan job finished: read what it wrote
  useEffect(() => {
    if (planJob?.state === 'done') load()
  }, [planJob?.state])
  // A build running or just done: show it; done opens the studio
  useEffect(() => {
    if (building) setPhase('build')
    if (buildJob?.state === 'done' && phase === 'build') {
      refresh()
      toStudio()
    }
  }, [building, buildJob?.state])

  // Edits save themselves, a moment after the last keystroke
  const edit = (next: Storyboard) => {
    setSb(next)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => api.writeText(project.root, FILE, JSON.stringify(next, null, 2) + '\n'), 500)
  }
  const flush = async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    if (sb) await api.writeText(project.root, FILE, JSON.stringify(sb, null, 2) + '\n')
  }
  const setShot = (i: number, patch: Partial<StoryShot>) => sb && edit({ ...sb, shots: sb.shots.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  const moveShot = (i: number, d: number) => {
    if (!sb) return
    const shots = [...sb.shots]
    const [s] = shots.splice(i, 1)
    shots.splice(i + d, 0, s)
    edit({ ...sb, shots })
  }

  const revise = (text = request) => {
    if (planning) return
    api.enqueue({ kind: 'plan', project: project.root, request: text.trim() || undefined })
    setRequest('')
  }
  const apply = async () => {
    setError(null)
    await flush()
    try {
      await api.applyStoryboard(project.root)
      refresh()
      return true
    } catch (e) {
      setError(String(e))
      return false
    }
  }
  const make = async () => {
    setConfirm(null)
    if (await apply()) {
      api.enqueue({ kind: 'build', project: project.root })
      setPhase('build')
    }
  }
  const skip = async () => {
    if (await apply()) toStudio()
  }

  const total = round1(sb?.shots.reduce((t, s) => t + (Number(s.duration) || 0), 0) ?? 0)
  const failed = (phase === 'plan' ? planJob : buildJob)?.state === 'failed' ? (phase === 'plan' ? planJob : buildJob) : null
  const why = failed && agentError(failed.error)

  return (
    <div className="plan">
      <header className="studio-top">
        <button className="icon-button" onClick={back} title={t('studio.back')} aria-label={t('studio.back')}><Icon name="back" /></button>
        <div className="studio-title">
          <Title project={project} refresh={refresh} />
          <span className="muted small">{project.track.toUpperCase()} · {project.size.width > project.size.height ? '16:9' : '9:16'} · {t('plan.target', { s: target })}</span>
        </div>
        <ol className="stepper">
          <li className={phase === 'plan' ? 'on' : 'done'}><span>1</span>{t('plan.step.plan')}</li>
          <li className={phase === 'build' ? 'on' : ''}><span>2</span>{t('plan.step.build')}</li>
          <li><span>3</span>{t('plan.step.edit')}</li>
        </ol>
        <div className="spacer" />
        {phase === 'plan' && (
          <>
            <button className="ghost" onClick={skip} disabled={!sb || planning}>{t('plan.skip')}</button>
            <button className="primary" onClick={() => (built ? setConfirm('make') : make())} disabled={!sb || planning || !sb.shots.length}>
              <Icon name="spark" size={14} /> {t('plan.make')}
            </button>
          </>
        )}
      </header>

      {confirm && (
        <div className="plan-confirm" role="alertdialog">
          <Icon name="info" size={16} />
          <span>{t(confirm === 'make' ? 'plan.makeAsk' : 'plan.againAsk')}</span>
          <span className="spacer" />
          <button className="ghost small" onClick={() => setConfirm(null)}>{t('plan.cancel')}</button>
          <button className="primary small" onClick={() => {
            if (confirm === 'make') make()
            else {
              setConfirm(null)
              revise('')
            }
          }}>{t('plan.confirm')}</button>
        </div>
      )}

      {(error || why) && (
        <div className="plan-error error-box">
          {error ?? why!.text}
          {why?.setup && <button className="small" onClick={openSettings}>{t('agent.openSettings')}</button>}
          {!why?.setup && failed && <button className="small" onClick={() => (phase === 'plan' ? revise('') : make())}>{t('plan.retry')}</button>}
        </div>
      )}

      {phase === 'build'
        ? <BuildView project={project} job={buildJob ?? null} toStudio={toStudio} back={() => setPhase('plan')} />
        : !sb
          ? (
            <div className="plan-wait">
              <span className="agent-avatar large"><Icon name="spark" size={22} /></span>
              <strong>{t(deriving || !loaded ? 'plan.reading' : planning ? 'plan.writing' : 'plan.none')}</strong>
              {!deriving && loaded && <p className="muted">{t('plan.writingNote')}</p>}
              {planning && <PlanActivity job={planJob!} />}
            </div>
          )
          : (
            <div className={`plan-body${planning ? ' busy' : ''}`}>
              {planning && (
                <div className="plan-overlay" role="status">
                  <div className="plan-overlay-card">
                    <span className="agent-avatar large"><span className="spinner" /></span>
                    <strong>{t('plan.revising')}</strong>
                    <p className="muted small">{t('plan.revisingNote')}</p>
                    <PlanActivity job={planJob!} />
                    <button className="ghost small" onClick={() => api.cancel(planJob!.id)}>{t('queue.stop')}</button>
                  </div>
                </div>
              )}
              <section className="plan-copy">
                <div className="plan-head">
                  <h3>{t('plan.copy')}</h3>
                </div>
                {sb.copy.idea && <p className="plan-idea"><span className="muted small">{t('plan.idea')}</span>{sb.copy.idea}</p>}
                <label className="field">
                  <span>{t('plan.hook')}</span>
                  <textarea rows={2} value={sb.copy.hook} onChange={e => edit({ ...sb, copy: { ...sb.copy, hook: e.target.value } })} />
                </label>
                <label className="field">
                  <span>{t('plan.body')}</span>
                  <textarea rows={9} value={sb.copy.body} onChange={e => edit({ ...sb, copy: { ...sb.copy, body: e.target.value } })} />
                </label>
                <div className="field">
                  <span>{t('plan.facts')}</span>
                  {sb.copy.facts.map((f, i) => (
                    <div key={i} className="fact">
                      <input value={f.text} placeholder={t('plan.factText')} onChange={e => edit({ ...sb, copy: { ...sb.copy, facts: sb.copy.facts.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) } })} />
                      <input className="source" value={f.source} placeholder={t('plan.factSource')} onChange={e => edit({ ...sb, copy: { ...sb.copy, facts: sb.copy.facts.map((x, k) => (k === i ? { ...x, source: e.target.value } : x)) } })} />
                      <button className="icon-button" aria-label={t('plan.remove')} onClick={() => edit({ ...sb, copy: { ...sb.copy, facts: sb.copy.facts.filter((_, k) => k !== i) } })}><Icon name="x" size={14} /></button>
                    </div>
                  ))}
                  <button className="ghost small add" onClick={() => edit({ ...sb, copy: { ...sb.copy, facts: [...sb.copy.facts, { text: '', source: '' }] } })}><Icon name="plus" size={13} /> {t('plan.addFact')}</button>
                </div>
                <div className="plan-ask">
                  <textarea rows={2} value={request} placeholder={t('plan.askPlaceholder')} disabled={planning}
                    onChange={e => setRequest(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) revise()
                    }} />
                  <div className="row between">
                    <button className="ghost small" onClick={() => setConfirm('again')} disabled={planning}><Icon name="refresh" size={13} /> {t('plan.again')}</button>
                    <button className="send" onClick={() => revise()} disabled={planning || !request.trim()} aria-label={t('plan.ask')}>
                      {planning ? <span className="spinner small" /> : <Icon name="send" size={16} />}
                    </button>
                  </div>
                  {!planning && <span className="small muted">{t('plan.askHint')}</span>}
                </div>
              </section>

              <section className="plan-board">
                <div className="plan-head">
                  <h3>{t('plan.board')}</h3>
                  <span className={`small ${Math.abs(total - target) > 0.5 ? 'warn-note' : 'muted'}`}>{t('plan.total', { n: sb.shots.length, s: total, target })}</span>
                </div>
                <div className="timeline" aria-hidden>
                  {sb.shots.map((s, i) => (
                    <i key={i} style={{ flex: Math.max(0.5, Number(s.duration) || 0), background: HUES[i % HUES.length] }} title={`${i + 1}. ${s.title}`}>{i + 1}</i>
                  ))}
                </div>
                <div className="shot-cards">
                  {sb.shots.map((s, i) => (
                    <div key={i} className="shot-card">
                      <div className="shot-card-head">
                        <span className="shot-no" style={{ background: HUES[i % HUES.length] }}>{i + 1}</span>
                        <input className="shot-title" value={s.title} onChange={e => setShot(i, { title: e.target.value })} aria-label={t('plan.shotTitle')} />
                        <label className="duration">
                          <input type="number" min={1} max={30} step={0.5} value={s.duration} onChange={e => setShot(i, { duration: Number(e.target.value) })} />
                          <span className="muted small">{t('plan.sec')}</span>
                        </label>
                        <div className="shot-actions">
                          <button className="icon-button" disabled={i === 0} onClick={() => moveShot(i, -1)} aria-label={t('plan.up')}><Icon name="chevron" size={14} /></button>
                          <button className="icon-button down" disabled={i === sb.shots.length - 1} onClick={() => moveShot(i, 1)} aria-label={t('plan.down')}><Icon name="chevron" size={14} /></button>
                          <button className="icon-button" disabled={sb.shots.length < 2} onClick={() => edit({ ...sb, shots: sb.shots.filter((_, k) => k !== i) })} aria-label={t('plan.remove')}><Icon name="x" size={14} /></button>
                        </div>
                      </div>
                      <div className="shot-fields">
                        <label><span>{t('plan.show')}</span><textarea rows={2} value={s.show} onChange={e => setShot(i, { show: e.target.value })} /></label>
                        <label><span>{t('plan.text')}</span><input value={s.text} onChange={e => setShot(i, { text: e.target.value })} /></label>
                        <label><span>{t('plan.motion')}</span><input value={s.motion} onChange={e => setShot(i, { motion: e.target.value })} /></label>
                      </div>
                    </div>
                  ))}
                  <button className="add-shot" onClick={() => edit({ ...sb, shots: [...sb.shots, { title: t('plan.newShot'), duration: 4, show: '', text: '', motion: '' }] })}>
                    <Icon name="plus" size={14} /> {t('plan.addShot')}
                  </button>
                </div>
              </section>
            </div>
          )}
    </div>
  )
}

// The build: what the AI is doing now, and each shot as its stills land
function BuildView({ project, job, toStudio, back }: { project: Project; job: Job | null; toStudio: () => void; back: () => void }) {
  const running = !!job && (job.state === 'queued' || job.state === 'running')
  const ready = project.shots.filter(s => s.draft.stills).length
  return (
    <div className="build">
      <div className="build-head">
        <span className="agent-avatar large">{running ? <span className="spinner" /> : <Icon name="check" size={20} />}</span>
        <div>
          <strong>{t(running ? 'plan.building' : job?.state === 'failed' ? 'plan.buildFailed' : 'plan.built')}</strong>
          <p className="muted small">{t('plan.buildNote', { done: ready, total: project.shots.length })}</p>
        </div>
        <div className="spacer" />
        {!running && <button className="ghost" onClick={back}>{t('plan.backToPlan')}</button>}
        <button className={running ? '' : 'primary'} onClick={toStudio}>{t(running ? 'plan.openNow' : 'plan.openStudio')} <Icon name="arrow" size={13} /></button>
      </div>
      {job?.log.length ? <div className="build-log">{job.log.slice(-4).map((l, i) => <code key={i}>{l}</code>)}</div> : null}
      <div className="build-grid">
        {project.shots.map((s, i) => (
          <figure key={s.id} className={`build-shot${s.draft.stills ? ' ready' : ''}`}>
            <div className={`build-frame${project.size.width > project.size.height ? ' wide' : ''}`}>
              {s.draft.stills ? <img src={fileUrl(s.draft.stills[1])} alt="" /> : <span className="shimmer" />}
            </div>
            <figcaption><span className="shot-no" style={{ background: HUES[i % HUES.length] }}>{i + 1}</span> <span className="ellipsis">{s.title}</span></figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

// What the planning AI is doing now, in words, and for how long
function PlanActivity({ job }: { job: Job }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const now = job.log.at(-1)
  const elapsed = job.startedAt ? (Date.now() - job.startedAt) / 1000 : null
  return (
    <div className="plan-activity small">
      {now && <span className="job-now"><span className="pulse" /> <span className="ellipsis">{activityLine(now)}</span></span>}
      <span className="muted">{job.state === 'queued' ? t('queue.waiting') : elapsed != null ? t('act.elapsed', { time: formatSeconds(elapsed) }) : ''}</span>
    </div>
  )
}
