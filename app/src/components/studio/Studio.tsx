import { useEffect, useMemo, useState } from 'react'
import { api, type Job, type Mode, type Project } from '../../api'
import { estimate, formatSeconds, shotView } from '../../model'
import type { useTheme } from '../../theme/theme'
import { Icon } from '../Icon'
import { ThemeToggle } from '../ThemeToggle'
import { AgentPanel } from './AgentPanel'
import { ExportPanel } from './ExportPanel'
import { Filmstrip } from './Filmstrip'
import { QueuePanel } from './QueuePanel'
import { ShotNotes } from './ShotNotes'
import { Stage } from './Stage'
import { t } from '../../i18n'

type Drawer = 'queue' | 'export' | null

// One project, full-window (open-design's Studio, for a film): the agent
// conversation on the left, the shot on a dark stage in the middle with
// the filmstrip and the shot's notes under it, queue and export in a
// drawer on the right.
export function Studio({ project, jobs, refresh, close, theme }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  close: () => void
  theme: ReturnType<typeof useTheme>
}) {
  const [mode, setMode] = useState<Mode>('draft')
  const [selected, setSelected] = useState(project.shots[0]?.id ?? '')
  const [drawer, setDrawer] = useState<Drawer>(null)

  // Keep the selection valid when shots are renamed or removed
  useEffect(() => {
    if (!project.shots.some(s => s.id === selected)) setSelected(project.shots[0]?.id ?? '')
  }, [project, selected])

  const views = useMemo(
    () => new Map(project.shots.map(s => [s.id, shotView(project, s, mode, jobs)])),
    [project, mode, jobs]
  )
  const shot = project.shots.find(s => s.id === selected)
  const view = shot ? views.get(shot.id)! : null
  const pending = project.shots.filter(s => ['stale', 'missing', 'failed'].includes(views.get(s.id)!.state))
  const pendingTime = pending.reduce((t, s) => t + estimate(project, s, mode), 0)
  const active = jobs.filter(j => j.state === 'running' || j.state === 'queued')

  // Render every shot whose frames are out of date, one at a time
  const renderPending = () => {
    for (const s of pending) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
    setDrawer('queue')
  }
  const toggle = (d: Drawer) => setDrawer(cur => (cur === d ? null : d))

  return (
    <div className={`studio${drawer ? ' with-drawer' : ''}`}>
      <header className="studio-top">
        <button className="icon-button" onClick={close} title={t('studio.back')} aria-label={t('studio.back')}>
          <Icon name="back" />
        </button>
        <div className="studio-title">
          <strong className="ellipsis">{project.title}</strong>
          <span className="muted small">
            {project.track.toUpperCase()} · {project.size.width > project.size.height ? '16:9' : '9:16'} · {formatSeconds(project.duration)} · {t('common.shots', { n: project.shots.length })}
          </span>
        </div>
        <div className="spacer" />
        <div className="segmented" role="radiogroup" aria-label={t('studio.modeAria')}>
          {(['draft', 'final'] as Mode[]).map(m => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {t(m === 'draft' ? 'mode.Draft' : 'mode.Final')}
            </button>
          ))}
        </div>
        <button onClick={renderPending} disabled={!pending.length} title={pending.map(s => s.id).join(', ')}>
          <Icon name="refresh" size={14} />
          {' '}{pending.length ? t('studio.renderChanged', { n: pending.length, time: formatSeconds(pendingTime) }) : t('studio.allCached')}
        </button>
        <button className={drawer === 'queue' ? 'on' : ''} onClick={() => toggle('queue')}>
          <Icon name="queue" size={14} /> {t('studio.queue')}{active.length ? <span className="count">{active.length}</span> : null}
        </button>
        <button className="dark" onClick={() => toggle('export')}>
          <Icon name="export" size={14} /> {t('studio.export')}
        </button>
        <button className="ghost small" onClick={() => api.reveal(project.root)} title={project.root}>{t('studio.finder')}</button>
        <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
      </header>

      {shot && view ? (
        <AgentPanel key={`agent-${shot.id}`} project={project} shot={shot} jobs={jobs} />
      ) : <aside className="agent" />}

      <section className="center">
        {shot && view
          ? <Stage key={`stage-${shot.id}`} project={project} shot={shot} view={view} mode={mode} refresh={refresh} />
          : <div className="stage empty">{t('studio.noShots')}</div>}
        <Filmstrip project={project} views={views} mode={mode} selected={selected} onSelect={setSelected} />
        {shot && <ShotNotes key={`notes-${shot.id}`} project={project} shot={shot} />}
      </section>

      {drawer && (
        <aside className="drawer">
          <div className="drawer-head">
            <strong>{t(drawer === 'queue' ? 'drawer.queue' : 'drawer.export')}</strong>
            <button className="icon-button" onClick={() => setDrawer(null)} aria-label={t('common.close')}><Icon name="x" /></button>
          </div>
          {drawer === 'queue' ? <QueuePanel project={project} jobs={jobs} /> : <ExportPanel project={project} jobs={jobs} />}
        </aside>
      )}
    </div>
  )
}
