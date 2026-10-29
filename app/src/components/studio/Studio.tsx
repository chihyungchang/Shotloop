import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type Job, type Mode, type Project } from '../../api'
import { estimate, formatSeconds, shotView } from '../../model'
import type { useTheme } from '../../theme/theme'
import { Icon } from '../Icon'
import { ThemeToggle } from '../ThemeToggle'
import { AgentPanel } from './AgentPanel'
import { ExportPanel } from './ExportPanel'
import { FilmPreview } from './FilmPreview'
import { Filmstrip } from './Filmstrip'
import { QueuePanel } from './QueuePanel'
import { ShotNotes } from './ShotNotes'
import { Stage } from './Stage'
import { t } from '../../i18n'

type Drawer = 'queue' | 'export' | null

// One project, full-window (open-design's Studio, for a film), with one
// main line: pick a shot in the filmstrip, watch it, tell the agent what
// is wrong, watch the whole film, export. The agent conversation is on
// the left, the shot on a dark stage in the middle with the filmstrip and
// the shot's notes under it, queue and export in a drawer on the right;
// quality, Finder and theme sit in the "more" menu.
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
  const [film, setFilm] = useState<string | null>(null)
  // Asked for the whole film while shots were still out of date
  const [wantFilm, setWantFilm] = useState(false)
  const [filmError, setFilmError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

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

  // The whole film: render what is out of date first, then open it
  const openFilm = async () => {
    setFilmError(null)
    if (pending.length) {
      setWantFilm(true)
      for (const s of pending) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
      return
    }
    try {
      setFilm((await api.filmPreview(project.root, mode)).file)
    } catch (e) {
      setFilmError(String(e))
    }
  }
  const failed = pending.some(s => views.get(s.id)!.state === 'failed')
  useEffect(() => {
    if (!wantFilm) return
    if (!pending.length) {
      setWantFilm(false)
      openFilm()
    } else if (failed && !active.length) {
      setWantFilm(false)
      setFilmError(t('film.failed'))
    }
  }, [wantFilm, pending.length, failed, active.length])

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
        {filmError && <span className="small error ellipsis" title={filmError}>{filmError}</span>}
        {pending.length > 0
          ? (
            <button onClick={renderPending} title={pending.map(s => s.id).join(', ')}>
              <Icon name="refresh" size={14} /> {t('studio.renderChanged', { n: pending.length, time: formatSeconds(pendingTime) })}
            </button>
          )
          : <span className="small muted up-to-date"><Icon name="check" size={13} /> {t('studio.allCached')}</span>}
        <button onClick={openFilm} disabled={wantFilm}>
          {wantFilm ? <span className="spinner small" /> : <Icon name="play" size={14} />} {t(wantFilm ? 'film.rendering' : 'film.watch')}
        </button>
        <button className={drawer === 'queue' ? 'on' : ''} onClick={() => toggle('queue')}>
          <Icon name="queue" size={14} /> {t('studio.queue')}{active.length ? <span className="count">{active.length}</span> : null}
        </button>
        <button className="dark" onClick={() => toggle('export')}>
          <Icon name="export" size={14} /> {t('studio.export')}
        </button>
        <MoreMenu open={menu} setOpen={setMenu}>
          <div className="menu-row">
            <span>{t('studio.quality')}</span>
            <div className="segmented" role="radiogroup" aria-label={t('studio.modeAria')}>
              {(['draft', 'final'] as Mode[]).map(m => (
                <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                  {t(m === 'draft' ? 'mode.Draft' : 'mode.Final')}
                </button>
              ))}
            </div>
          </div>
          <div className="menu-row">
            <span>{t('theme.label')}</span>
            <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
          </div>
          <button className="menu-item" onClick={() => { setMenu(false); api.reveal(project.root) }}>
            <Icon name="folder" size={14} /> {t('studio.revealFinder')}
          </button>
        </MoreMenu>
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

      {film && <FilmPreview project={project} file={film} close={() => setFilm(null)} />}

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

// The studio's "more" menu: closes on a click outside or Esc
function MoreMenu({ open, setOpen, children }: { open: boolean; setOpen: (o: boolean) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open, setOpen])
  return (
    <div className="more" ref={ref}>
      <button className={`icon-button${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-label={t('studio.more')} aria-expanded={open}>
        <Icon name="more" size={18} />
      </button>
      {open && <div className="menu" role="menu">{children}</div>}
    </div>
  )
}
