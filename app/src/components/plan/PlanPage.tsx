import { useEffect, useRef, useState } from 'react'
import { api, type Job, type Project, type Storyboard as Plan, type VoiceInfo } from '../../api'
import { useAutosave } from '../../hooks'
import { t } from '../../i18n'
import { aspectOf, isActive, planSteps } from '../../model'
import { styleName } from '../../styles'
import { AgentAvatar } from '../AgentAvatar'
import { AgentError } from '../AgentError'
import { Icon } from '../Icon'
import { Title } from '../studio/Studio'
import { CopyEditor } from './CopyEditor'
import { BuildView, PlanActivity, PlanWait, StepList } from './Progress'
import { Storyboard } from './Storyboard'
import { ErrorText } from '../ErrorDialog'

const FILE = 'storyboard.json'

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
  const [sb, setSb] = useState<Plan | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [request, setRequest] = useState('')
  const [phase, setPhase] = useState<Phase>('plan')
  const [error, setError] = useState<string | null>(null)
  // A step that replaces work, waiting for a yes
  const [confirm, setConfirm] = useState<'again' | 'make' | null>(null)
  // The voice model to fetch before a voiced build, waiting for a choice
  const [voiceAsk, setVoiceAsk] = useState<NonNullable<VoiceInfo['model']> | null>(null)
  const [deriving, setDeriving] = useState(false)
  const autosave = useAutosave((next: Plan) => api.writeText(project.root, FILE, JSON.stringify(next, null, 2) + '\n'))

  const mine = jobs.filter(j => j.project === project.root)
  const planJob = mine.filter(j => j.kind === 'plan').at(-1)
  const buildJob = mine.filter(j => j.kind === 'build').at(-1)
  const planning = !!planJob && isActive(planJob)
  const building = !!buildJob && isActive(buildJob)
  // The speech model downloading for this project: a build waits for it
  const download = mine.find(j => j.kind === 'voiceModel' && isActive(j))
  const target = sb?.target ?? project.duration
  // Shots the AI has drawn: rebuilding them replaces finished work (a
  // starter card rendered is nothing to lose)
  const built = project.shots.some(s => !s.starter)

  // No storyboard.json yet reads as no plan; one that can't be parsed says so
  const load = () =>
    api.readText(project.root, FILE).then(
      text => {
        try {
          setSb(JSON.parse(text))
        } catch (e) {
          setError(String(e))
        }
        setLoaded(true)
      },
      () => {
        setSb(null)
        setLoaded(true)
      }
    )

  const enqueue = (spec: Parameters<typeof api.enqueue>[0]) =>
    api.enqueue(spec).then(() => true, e => {
      setError(String(e))
      return false
    })

  // First visit, no plan yet: a project with shots has its plan read back
  // from them; only a new one has the AI write it
  useEffect(() => {
    load()
  }, [project.root])
  const asked = useRef(false)
  useEffect(() => {
    if (!loaded || sb || planJob || deriving || asked.current) return
    asked.current = true
    setDeriving(true)
    // Not derivable (no shots, or the engine failed): the AI plans it
    api.deriveStoryboard(project.root)
      .then(v => !!v, () => false)
      .then(async derived => {
        if (derived) await load()
        else await enqueue({ kind: 'plan', project: project.root })
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
  const edit = (next: Plan) => {
    setSb(next)
    autosave.save(next)
  }

  const revise = async (text = request) => {
    if (planning) return
    if (await enqueue({ kind: 'plan', project: project.root, request: text.trim() || undefined })) setRequest('')
  }
  const chooseStyle = async (id: string) => {
    // The person's pick: the planner keeps it from now on
    try {
      await api.setStyle(project.root, id)
    } catch (e) {
      return setError(String(e))
    }
    revise(t('style.switchAsk', { name: styleName(id), id }))
  }
  // The storyboard into the project; the project as it now is (the lines
  // it speaks, the shots it has), or null when that failed
  const apply = async () => {
    setError(null)
    try {
      await autosave.flush()
      await api.applyStoryboard(project.root)
      // Read back: the plan now names each shot's id, which edits keep
      await load()
      refresh()
      return await api.status(project.root)
    } catch (e) {
      setError(String(e))
      return null
    }
  }
  // voice, when the voiced film's model isn't on this Mac: ask first, or
  // the person's answer (download it, the build waiting; or build without
  // the voice-over)
  const make = async (voice: 'ask' | 'download' | 'off' = 'ask') => {
    setConfirm(null)
    setVoiceAsk(null)
    const now = await apply()
    if (!now) return
    if (now.voiced) {
      const v = await api.voice(project.root).catch(e => {
        setError(String(e))
        return null
      })
      if (v?.model && !v.model.installed) {
        if (voice === 'ask') return setVoiceAsk(v.model)
        const ready = voice === 'off'
          ? await api.voice(project.root, { on: false }).then(() => true, e => {
            setError(String(e))
            return false
          })
          : await enqueue({ kind: 'voiceModel', model: v.model.id, project: project.root })
        if (!ready) return
      }
    }
    if (await enqueue({ kind: 'build', project: project.root })) setPhase('build')
  }
  const skip = async () => {
    const now = await apply()
    if (!now) return
    // Lines edited without a build: spoken and fitted as a queue job, with
    // its progress and any error (a build does this itself first); lines
    // timed already need nothing
    if (now.voiced) {
      const v = await api.voice(project.root).catch(e => {
        setError(String(e))
        return null
      })
      if (!v || (!v.fitted && !(await enqueue({ kind: 'voiceFit', project: project.root })))) return
    }
    toStudio()
  }

  const failed = phase === 'plan' ? planJob : buildJob

  return (
    <div className="plan">
      <header className="studio-top">
        <button className="icon-button" onClick={back} title={t('studio.back')} aria-label={t('studio.back')}><Icon name="back" /></button>
        <div className="studio-title">
          <Title project={project} refresh={refresh} />
          <span className="muted small">{project.track.toUpperCase()} · {aspectOf(project.size)} · {t('plan.target', { s: target })}</span>
        </div>
        <ol className="stepper">
          <li className={phase === 'plan' ? 'on' : 'done'}><span>1</span>{t('plan.step.plan')}</li>
          <li className={phase === 'build' ? 'on' : ''}><span>2</span>{t('plan.step.build')}</li>
          <li><span>3</span>{t('plan.step.edit')}</li>
        </ol>
        <div className="spacer" />
        <ErrorText error={autosave.status.state === 'failed' && t('common.notSaved', { error: autosave.status.error })} as="span" className="small error ellipsis" />
        {phase === 'plan' && (
          <>
            {/* Built: the editor is what comes next, building again is asked
                for (it replaces the shots); else making the video, the only
                way on (the editor would have nothing but starter cards) */}
            {built
              ? (
                <>
                  <button className="ghost" onClick={() => setConfirm('make')} disabled={!sb || planning || !sb.shots.length}>
                    <Icon name="refresh" size={14} /> {t('plan.remake')}
                  </button>
                  <button className="primary" onClick={skip} disabled={!sb || planning}>{t('plan.toEditor')} <Icon name="arrow" size={13} /></button>
                </>
              )
              : (
                <button className="primary" onClick={() => make()} disabled={!sb || planning || !sb.shots.length}>
                  <Icon name="spark" size={14} /> {t('plan.make')}
                </button>
              )}
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

      {voiceAsk && (
        <div className="plan-confirm" role="alertdialog">
          <Icon name="mic" size={16} />
          <span>{t('plan.voiceAsk', { name: voiceAsk.name, mb: Math.round(voiceAsk.bytes / 1e6) })}</span>
          <span className="spacer" />
          <button className="ghost small" onClick={() => setVoiceAsk(null)}>{t('plan.cancel')}</button>
          <button className="ghost small" onClick={() => make('off')}>{t('plan.voiceOff')}</button>
          <button className="primary small" onClick={() => make('download')}><Icon name="download" size={12} /> {t('plan.voiceDownload')}</button>
        </div>
      )}

      {error
        ? <ErrorText error={error} as="div" className="plan-error error-box" />
        : (
          <AgentError job={failed} openSettings={openSettings} className="plan-error error-box">
            <button className="small" onClick={() => (phase === 'plan' ? revise('') : make())}>{t('plan.retry')}</button>
          </AgentError>
        )}

      {phase === 'build'
        ? <BuildView project={project} plan={sb} job={buildJob ?? null} download={download} toStudio={toStudio} back={() => setPhase('plan')} />
        : !sb
          ? <PlanWait project={project} job={planning ? planJob! : null} reading={deriving || !loaded} stop={() => api.cancel(planJob!.id).catch(e => setError(String(e)))} />
          : (
            <div className={`plan-body${planning ? ' busy' : ''}`}>
              {planning && (
                <div className="plan-overlay" role="status">
                  <div className="plan-overlay-card">
                    <AgentAvatar large busy />
                    <strong>{t('plan.revising')}</strong>
                    <p className="muted small">{t('plan.revisingNote')}</p>
                    {planJob!.state === 'running' ? <StepList steps={planSteps(planJob!)} /> : <PlanActivity job={planJob!} />}
                    <button className="ghost small" onClick={() => api.cancel(planJob!.id).catch(e => setError(String(e)))}>{t('queue.stop')}</button>
                  </div>
                </div>
              )}
              <CopyEditor sb={sb} unsourced={planJob?.state === 'done' ? planJob.result?.unsourced ?? [] : []} edit={edit} request={request} setRequest={setRequest} revise={() => revise()} again={() => setConfirm('again')} planning={planning} />
              <Storyboard project={project} sb={sb} edit={edit} planning={planning} chooseStyle={chooseStyle} />
            </div>
          )}
    </div>
  )
}
