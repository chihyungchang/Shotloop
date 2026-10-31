import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type Job, type Project } from '../../api'
import { editMode, formatSeconds, shotView } from '../../model'
import type { useTheme } from '../../theme/theme'
import { Icon } from '../Icon'
import { ThemeToggle } from '../ThemeToggle'
import { AgentPanel } from './AgentPanel'
import { AssetsPanel } from './AssetsPanel'
import { ChangesDialog } from './ChangesDialog'
import { ExportDialog } from './export/ExportDialog'
import { FilmPreview } from './FilmPreview'
import { Filmstrip } from './Filmstrip'
import { QueuePanel } from './QueuePanel'
import { ShotNotes } from './ShotNotes'
import { Stage } from './Stage'
import { t } from '../../i18n'

type Drawer = 'queue' | 'assets' | null

// One project, full-window (open-design's Studio, for a film), with one
// main line: pick a shot in the filmstrip, watch it, tell the agent what
// is wrong, watch the whole film, export. The agent conversation is on
// the left, the shot on a dark stage in the middle with the filmstrip and
// the shot's notes under it, the queue in a drawer on the right, export
// in a dialog over it; Finder and theme sit in the "more" menu.
export function Studio({ project, jobs, refresh, close, theme, openSettings, openPlan, save, saving }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  close: () => void
  theme: ReturnType<typeof useTheme>
  openSettings: () => void
  openPlan: () => Promise<void> | void
  // A draft (an example opened): saving keeps it
  save?: () => void
  saving?: boolean
}) {
  const mode = editMode(project)
  const [selected, setSelected] = useState(project.shots[0]?.id ?? '')
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [film, setFilm] = useState<{ file: string; stale: string[] } | null>(null)
  // Asked for the whole film while shots were still out of date
  const [wantFilm, setWantFilm] = useState(false)
  const [filmError, setFilmError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

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
  const active = jobs.filter(j => j.state === 'running' || j.state === 'queued')
  const exporting = active.some(j => j.project === project.root && j.kind === 'export')

  // Render every shot whose frames are out of date, one at a time
  // The renders of this project under way: the queue shows them
  const renders = active.filter(j => j.project === project.root && j.kind === 'render')
  const toggle = (d: Drawer) => setDrawer(cur => (cur === d ? null : d))

  // The whole film. With shots out of date, first ask: update them and
  // then watch, or watch now (their last frames play)
  const [ask, setAsk] = useState(false)
  const waiting = pending.filter(s => !renders.some(j => j.shot === s.id))
  const playNow = async () => {
    setAsk(false)
    setFilmError(null)
    try {
      setFilm(await api.filmPreview(project.root, mode))
    } catch (e) {
      setFilmError(/not rendered/.test(String(e)) ? t('film.failed') : String(e))
    }
  }
  const updateThenPlay = () => {
    setAsk(false)
    setFilmError(null)
    setWantFilm(true)
    for (const s of waiting) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
  }
  // No shot has a clip yet (just built): the film is rendered for the first time
  const fresh = waiting.length > 0 && project.shots.every(s => s[mode].state === 'missing')
  const openFilm = () => (waiting.length ? setAsk(true) : playNow())
  const failed = pending.some(s => views.get(s.id)!.state === 'failed')
  useEffect(() => {
    if (!wantFilm) return
    if (!pending.length) {
      setWantFilm(false)
      playNow()
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
          <Title project={project} refresh={refresh} />
          <span className="muted small">
            {project.track.toUpperCase()} · {project.size.width > project.size.height ? '16:9' : '9:16'} · {formatSeconds(project.duration)} · {t('common.shots', { n: project.shots.length })}
          </span>
        </div>
        <PlanLink project={project} openPlan={openPlan} />
        <div className="spacer" />
        {save && (
          <span className="draft-save">
            <span className="tag warn" title={t('draft.note')}>{t('draft.tag')}</span>
            <button className="primary" onClick={save} disabled={saving} title={t('draft.note')}>
              {saving ? <span className="spinner small" /> : <Icon name="download" size={14} />} {t('draft.save')}
            </button>
          </span>
        )}
        {filmError && <span className="small error ellipsis" title={filmError}>{filmError}</span>}
        <button onClick={openFilm} disabled={wantFilm}>
          {wantFilm ? <span className="spinner small" /> : <Icon name="play" size={14} />} {t(wantFilm ? 'film.rendering' : 'film.watch')}
        </button>
        {project.track === '3d' && (
          <button className={drawer === 'assets' ? 'on' : ''} onClick={() => toggle('assets')}>
            <Icon name="cube" size={14} /> {t('studio.assets')}
          </button>
        )}
        <button className={drawer === 'queue' ? 'on' : ''} onClick={() => toggle('queue')}>
          <Icon name="queue" size={14} /> {t('studio.queue')}{active.length ? <span className="count">{active.length}</span> : null}
        </button>
        <button className="dark" onClick={() => setExportOpen(true)}>
          {exporting ? <span className="spinner small" /> : <Icon name="export" size={14} />} {t(exporting ? 'export.exporting' : 'studio.export')}
        </button>
        <MoreMenu open={menu} setOpen={setMenu}>
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
        <AgentPanel key={`agent-${shot.id}`} project={project} shot={shot} jobs={jobs} openSettings={openSettings} />
      ) : <aside className="agent" />}

      <section className="center">
        {shot && view
          ? <Stage key={`stage-${shot.id}`} project={project} shot={shot} view={view} mode={mode} refresh={refresh} />
          : <div className="stage empty">{t('studio.noShots')}</div>}
        <Filmstrip project={project} views={views} mode={mode} selected={selected} onSelect={setSelected} />
        {shot && <ShotNotes key={`notes-${shot.id}`} project={project} shot={shot} />}
      </section>

      {ask && (
        <ChangesDialog project={project} shots={waiting} mode={mode} close={() => setAsk(false)}
          failed={waiting.filter(s => views.get(s.id)!.state === 'failed').map(s => s.id)}
          title={t(fresh ? 'changes.titleFirst' : 'changes.titleWatch', { n: waiting.length })} note={t(fresh ? 'changes.noteFirst' : 'changes.noteWatch', { n: waiting.length })}
          actions={[
            // Nothing to watch yet: no "ignore", only render
            ...(fresh ? [] : [{ label: t('changes.watchNow'), onClick: playNow, disabled: waiting.some(s => s[mode].state === 'missing'), hint: t('changes.needFirst') }]),
            { label: t(fresh ? 'changes.renderWatch' : 'changes.updateWatch'), onClick: updateThenPlay, primary: true }
          ]} />
      )}
      {film && <FilmPreview project={project} file={film.file} close={() => setFilm(null)} />}
      {exportOpen && <ExportDialog project={project} jobs={jobs} refresh={refresh} openSettings={openSettings} close={() => setExportOpen(false)} />}

      {drawer && (
        <aside className="drawer">
          <div className="drawer-head">
            <strong>{t(drawer === 'queue' ? 'drawer.queue' : 'studio.assets')}</strong>
            <button className="icon-button" onClick={() => setDrawer(null)} aria-label={t('common.close')}><Icon name="x" /></button>
          </div>
          {drawer === 'queue' ? <QueuePanel project={project} jobs={jobs} /> : <AssetsPanel project={project} refresh={refresh} />}
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

// The project's name: click to rename, Enter or leaving the field saves,
// Esc cancels
export function Title({ project, refresh }: { project: Project; refresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(project.title)
  const save = async () => {
    setEditing(false)
    const title = value.trim()
    if (!title || title === project.title) return setValue(project.title)
    await api.setTitle(project.root, title).catch(() => setValue(project.title))
    refresh()
  }
  if (!editing) {
    return (
      <button className="title-button" onClick={() => { setValue(project.title); setEditing(true) }} title={t('studio.rename')}>
        <strong className="ellipsis">{project.title}</strong> <Icon name="edit" size={12} />
      </button>
    )
  }
  return (
    <input className="title-input" autoFocus value={value} onChange={e => setValue(e.target.value)} onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setValue(project.title)
          setEditing(false)
        }
      }} />
  )
}

// The way to the copy and storyboard; on an example it first makes the
// person's own copy of it (a draft project in their folder)
function PlanLink({ project, openPlan }: { project: Project; openPlan: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button className="ghost plan-link" disabled={busy} title={project.example ? t('example.note') : undefined} onClick={async () => {
        setBusy(true)
        try {
          await openPlan()
        } finally {
          setBusy(false)
        }
      }}>
        {busy ? <span className="spinner small" /> : <Icon name="edit" size={14} />} {t('plan.link')}
      </button>
    </>
  )
}
