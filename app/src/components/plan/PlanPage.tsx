import { useEffect, useRef, useState } from 'react'
import { agentError } from '../../ai/errors'
import { api, fileUrl, type Job, type Project, type Storyboard, type StoryShot } from '../../api'
import { t } from '../../i18n'
import { agentNow, buildStepList, buildSteps, formatSeconds, planSteps, type Step } from '../../model'
import { Icon } from '../Icon'
import { LookPreview } from '../LookPicker'
import { LOOKS, lookAbout, lookName } from '../../looks'
import { lookFits, STYLES, styleName } from '../../styles'
import { Title } from '../studio/Studio'
import { AutoText, ShotSketch } from './ShotSketch'

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
  const asked = useRef(false)
  useEffect(() => {
    if (!loaded || sb || planJob || deriving || asked.current) return
    asked.current = true
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
  const wide = project.size.width > project.size.height
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
        ? <BuildView project={project} plan={sb} job={buildJob ?? null} toStudio={toStudio} back={() => setPhase('plan')} />
        : !sb
          ? (
            <PlanWait project={project} job={planning ? planJob! : null} reading={deriving || !loaded} />
          )
          : (
            <div className={`plan-body${planning ? ' busy' : ''}`}>
              {planning && (
                <div className="plan-overlay" role="status">
                  <div className="plan-overlay-card">
                    <span className="agent-avatar large"><span className="spinner" /></span>
                    <strong>{t('plan.revising')}</strong>
                    <p className="muted small">{t('plan.revisingNote')}</p>
                    {planJob!.state === 'running' ? <StepList steps={planSteps(planJob!)} /> : <PlanActivity job={planJob!} />}
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
                  <AutoText className="hook-input" value={sb.copy.hook} onChange={v => edit({ ...sb, copy: { ...sb.copy, hook: v } })} />
                </label>
                <label className="field">
                  <span>{t('plan.body')}</span>
                  <AutoText minRows={4} value={sb.copy.body} onChange={v => edit({ ...sb, copy: { ...sb.copy, body: v } })} />
                </label>
                <div className="field">
                  <span>{t('plan.facts')}</span>
                  <ol className="facts">
                    {sb.copy.facts.map((f, i) => (
                      <li key={i} className="fact">
                        <span className="fact-no">{i + 1}</span>
                        <div className="fact-body">
                          <AutoText value={f.text} placeholder={t('plan.factText')} aria-label={t('plan.factText')}
                            onChange={v => edit({ ...sb, copy: { ...sb.copy, facts: sb.copy.facts.map((x, k) => (k === i ? { ...x, text: v } : x)) } })} />
                          <label className="fact-source">
                            <Icon name="link" size={12} />
                            <AutoText value={f.source} placeholder={t('plan.factSource')} aria-label={t('plan.factSource')}
                              onChange={v => edit({ ...sb, copy: { ...sb.copy, facts: sb.copy.facts.map((x, k) => (k === i ? { ...x, source: v } : x)) } })} />
                          </label>
                        </div>
                        <button className="icon-button" aria-label={t('plan.remove')} title={t('plan.remove')} onClick={() => edit({ ...sb, copy: { ...sb.copy, facts: sb.copy.facts.filter((_, k) => k !== i) } })}><Icon name="x" size={13} /></button>
                      </li>
                    ))}
                  </ol>
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
                {sb.style && (project.track === '2d' || project.trackAuto) && (
                  // The style the AI picked and why; another one re-plans the pictures for it
                  <div className="style-row">
                    <div className="look-row" role="radiogroup" aria-label={t('style.label')}>
                      <span className="small muted">{t('style.label')}</span>
                      {STYLES.filter(s => s.track === '2d' || project.trackAuto).map(s => {
                        const on = sb.style === s.id
                        return (
                          <button key={s.id} role="radio" aria-checked={on} className={`look-card style-card${on ? ' on' : ''}`} disabled={planning}
                            onClick={() => !on && revise(t('style.switchAsk', { name: styleName(s.id), id: s.id }))}>
                            {styleName(s.id)}{!on && s.id === sb.styleAlt && <span className="tag">{t('style.alt')}</span>}
                          </button>
                        )
                      })}
                    </div>
                    {sb.styleWhy && <p className="small muted style-why"><Icon name="spark" size={12} /> {sb.styleWhy}</p>}
                  </div>
                )}
                {project.track === '2d' && sb.style !== '3d' && (
                  <div className="look-row" role="radiogroup" aria-label={t('look.label')}>
                    <span className="small muted">{t('look.label')}</span>
                    {LOOKS.map(l => {
                      const fits = lookFits(sb.style, l.id)
                      return (
                        <button key={l.id} role="radio" aria-checked={sb.look === l.id} className={`look-card${sb.look === l.id ? ' on' : ''}`} disabled={!fits}
                          onClick={() => edit({ ...sb, look: l.id })} title={fits ? lookAbout(l.id) : t('style.lookNo', { name: styleName(sb.style ?? '') })}>
                          <LookPreview id={l.id} /> <span>{lookName(l.id)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="timeline" aria-hidden>
                  {sb.shots.map((s, i) => (
                    <i key={i} style={{ flex: Math.max(0.5, Number(s.duration) || 0), background: HUES[i % HUES.length] }} title={`${i + 1}. ${s.title}`}>
                      <b>{i + 1}</b><span>{t('unit.s', { n: Number(s.duration) || 0 })}</span>
                    </i>
                  ))}
                </div>
                <div className="shot-cards">
                  {sb.shots.map((s, i) => (
                    <div key={i} className="shot-card">
                      <ShotSketch look={project.track === '2d' ? sb.look : null} text={s.text || s.title} n={i + 1} total={sb.shots.length} wide={wide} />
                      <div className="shot-main">
                        <div className="shot-card-head">
                          <span className="shot-no" style={{ background: HUES[i % HUES.length] }}>{i + 1}</span>
                          <input className="shot-title" value={s.title} onChange={e => setShot(i, { title: e.target.value })} aria-label={t('plan.shotTitle')} />
                          <label className="duration" title={t('plan.sec')}>
                            <input type="number" min={1} max={30} step={0.5} value={s.duration} onChange={e => setShot(i, { duration: Number(e.target.value) })} />
                            <span className="muted small">{t('plan.sec')}</span>
                          </label>
                          <div className="shot-actions">
                            <button className="icon-button" disabled={i === 0} onClick={() => moveShot(i, -1)} aria-label={t('plan.up')} title={t('plan.up')}><Icon name="chevron" size={14} /></button>
                            <button className="icon-button down" disabled={i === sb.shots.length - 1} onClick={() => moveShot(i, 1)} aria-label={t('plan.down')} title={t('plan.down')}><Icon name="chevron" size={14} /></button>
                            <button className="icon-button" disabled={sb.shots.length < 2} onClick={() => edit({ ...sb, shots: sb.shots.filter((_, k) => k !== i) })} aria-label={t('plan.remove')} title={t('plan.remove')}><Icon name="x" size={14} /></button>
                          </div>
                        </div>
                        <label className="shot-field onscreen">
                          <span>{t('plan.text')}</span>
                          <AutoText value={s.text} onChange={v => setShot(i, { text: v })} />
                        </label>
                        <div className="shot-fields">
                          <label className="shot-field"><span>{t('plan.show')}</span><AutoText value={s.show} onChange={v => setShot(i, { show: v })} /></label>
                          <label className="shot-field"><span>{t('plan.motion')}</span><AutoText value={s.motion} onChange={v => setShot(i, { motion: v })} /></label>
                        </div>
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

// The build: what the AI is doing now, and each shot as its stills land.
// A build runs for minutes with long quiet turns, so the page always says
// what is happening and for how long
function BuildView({ project, plan, job, toStudio, back }: { project: Project; plan: Storyboard | null; job: Job | null; toStudio: () => void; back: () => void }) {
  const running = !!job && (job.state === 'queued' || job.state === 'running')
  useTicking(running)
  // The stills the editor shows: 3D previews, 2D finals
  const stills = (s: Project['shots'][number]) => (project.track === '3d' ? s.draft : s.final).stills
  const ready = project.shots.filter(s => stills(s)).length
  const steps = buildSteps(job)
  const elapsed = job?.startedAt ? ((job.finishedAt ?? Date.now()) - job.startedAt) / 1000 : null
  const wide = project.size.width > project.size.height
  const total = project.shots.length
  // Each shot's state: stills, in work (and how), code written, waiting
  const view = project.shots.map((s, i) => {
    const current = stills(s)
    const still = current ?? latestStills(s)
    const action = running ? steps.active.get(s.id) : undefined
    const written = steps.written.has(s.id) || steps.finished.has(s.id)
    const state = action ? t(action === 'stills' ? 'build.rendering' : action === 'check' ? 'build.checking' : 'build.writing')
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
          <i key={v.s.id} title={`${v.i + 1}. ${v.s.title ?? v.s.id}`} style={{ flex: Math.max(0.5, v.s.duration), '--hue': HUES[v.i % HUES.length] } as React.CSSProperties}
            className={v.current ? 'done' : v.action ? 'active' : v.written ? 'written' : ''} />
        ))}
      </div>
      {running && job!.state === 'queued' && <p className="muted small">{t('queue.waiting')}</p>}
      {running && job!.state === 'running' && <StepList steps={buildStepList(job!, project.shots, project.look ?? null)} row />}
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
              <span className="shot-no" style={{ background: HUES[v.i % HUES.length] }}>{v.i + 1}</span>
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
function PlanWait({ project, job, reading }: { project: Project; job: Job | null; reading: boolean }) {
  useTicking(!!job)
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
              <ShotSketch look={project.look} text="" n={i + 1} total={n} wide={project.size.width > project.size.height} faint />
              <div className="sk-shot-lines"><span className="sk-line w40" /><span className="sk-line w80" /><span className="sk-line w60" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// What the AI does, step by step: done, now (with what and how long), next
function StepList({ steps, row = false }: { steps: Step[]; row?: boolean }) {
  useTicking(true)
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
      {row && steps.find(s => s.state === 'active' && s.detail) && (
        <p className="step-detail small"><span className="pulse" /> {steps.find(s => s.state === 'active')!.detail}</p>
      )}
    </div>
  )
}

// A shot's newest stills from its takes (any key)
const latestStills = (s: Project['shots'][number]) => [...s.takes].reverse().find(t => t.stills)?.stills ?? null

// Re-renders every second while on, for elapsed times
function useTicking(on: boolean) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
}

// What the planning AI is doing now, in words, and for how long
function PlanActivity({ job }: { job: Job }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const now = agentNow(job)
  const elapsed = job.startedAt ? (Date.now() - job.startedAt) / 1000 : null
  return (
    <div className="plan-activity small">
      {now && <span className="job-now"><span className="pulse" /> <span className="ellipsis">{now}</span></span>}
      <span className="muted">{job.state === 'queued' ? t('queue.waiting') : elapsed != null ? t('act.elapsed', { time: formatSeconds(elapsed) }) : ''}</span>
    </div>
  )
}
