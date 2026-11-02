import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { api, type Job, type PreviewResult, type Project } from '../../api'
import { useDismiss, useErrorLine } from '../../hooks'
import { aspectOf, EDIT_MODE, formatSeconds, isActive, shotView } from '../../model'
import type { useTheme } from '../../theme/theme'
import { Icon } from '../Icon'
import { ThemeToggle } from '../ThemeToggle'
import { AgentPanel } from './AgentPanel'
import { AssetsPanel } from './AssetsPanel'
import { ChangesDialog } from './ChangesDialog'
import { ExportDialog } from './export/ExportDialog'
import { FilmPreview } from './FilmPreview'
import type { Pick, PickerState } from './Picker'
import { Filmstrip } from './Filmstrip'
import { QueuePanel } from './QueuePanel'
import { ShotNotes } from './ShotNotes'
import { Stage } from './Stage'
import { t } from '../../i18n'
import { readStored, writeStored } from '../../storage'

type Drawer = 'queue' | 'assets' | null

// The agent panel's width, dragged by its edge and kept on this Mac; the
// stylesheet also caps it by the window (.studio, --agent-w)
const AGENT_WIDTH = 'shotloop.agentWidth'
const AGENT_MIN = 280
const AGENT_MAX = 560
const clampWidth = (w: number) => Math.round(Math.min(AGENT_MAX, Math.max(AGENT_MIN, w)))

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
  openPlan: () => void
  // A draft (an example opened): saving keeps it
  save?: () => void
  saving?: boolean
}) {
  const mode = EDIT_MODE
  const [selected, setSelected] = useState(project.shots[0]?.id ?? '')
  // null: the stylesheet's default for the window's size
  const [agentWidth, setAgentWidth] = useState<number | null>(() => Number(readStored(AGENT_WIDTH)) || null)
  const keepWidth = (w: number | null) => {
    setAgentWidth(w)
    writeStored(AGENT_WIDTH, w == null ? null : String(w))
  }
  // The element picker, for the selected shot: picking now, and what was
  // picked for the next fix
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState<Pick | null>(null)
  const picker: PickerState = { picking, setPicking, pick, setPick }
  useEffect(() => {
    setPicking(false)
    setPick(null)
  }, [selected])
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [film, setFilm] = useState<PreviewResult | null>(null)
  // Asked for the whole film while shots were still out of date
  const [wantFilm, setWantFilm] = useState(false)
  const { error: filmError, setError: setFilmError, guard } = useErrorLine()
  // Joining the film (with its voice-over and subtitles) is a queue job of
  // its own lane: the button shows it running and can stop it
  const [previewId, setPreviewId] = useState<number | null>(null)
  const previewJob = jobs.find(j => j.id === previewId) ?? null
  const joining = !!previewJob && isActive(previewJob)
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
  const active = jobs.filter(isActive)
  const exporting = active.some(j => j.project === project.root && j.kind === 'export')

  // The renders of this project under way: the queue shows them
  const renders = active.filter(j => j.project === project.root && j.kind === 'render')
  const toggle = (d: Drawer) => setDrawer(cur => (cur === d ? null : d))

  // The whole film. With shots out of date, first ask: update them and
  // then watch, or watch now (their last frames play)
  const [ask, setAsk] = useState(false)
  const waiting = pending.filter(s => !renders.some(j => j.shot === s.id))
  const playNow = async () => {
    setAsk(false)
    const id = await guard(api.enqueue({ kind: 'preview', project: project.root, mode }))
    if (id != null) setPreviewId(id)
  }
  // The preview job's end: the film to watch, or why not
  useEffect(() => {
    if (!previewJob || isActive(previewJob)) return
    setPreviewId(null)
    if (previewJob.state === 'done') setFilm(previewJob.result)
    if (previewJob.state === 'failed') setFilmError(/not rendered/.test(previewJob.error ?? '') ? t('film.failed') : previewJob.error)
  }, [previewJob?.state])
  const updateThenPlay = async () => {
    setAsk(false)
    setWantFilm(true)
    const queued = await guard(Promise.all(waiting.map(s => api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false }))))
    if (!queued) setWantFilm(false)
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
    <div className={`studio${drawer ? ' with-drawer' : ''}`}
      style={agentWidth ? ({ '--agent-w': `${agentWidth}px` } as CSSProperties) : undefined}>
      <header className="studio-top">
        <button className="icon-button" onClick={close} title={t('studio.back')} aria-label={t('studio.back')}>
          <Icon name="back" />
        </button>
        <div className="studio-title">
          <Title project={project} refresh={refresh} />
          <span className="muted small">
            {project.track.toUpperCase()} · {aspectOf(project.size)} · {formatSeconds(project.duration)} · {t('common.shots', { n: project.shots.length })}
          </span>
        </div>
        <button className="ghost plan-link" onClick={openPlan}><Icon name="edit" size={14} /> {t('plan.link')}</button>
        <div className="spacer" />
        {save && (
          <span className="draft-save">
            <span className="tag warn" title={t('draft.note')}>{t('draft.tag')}</span>
            <button onClick={save} disabled={saving} title={t('draft.note')}>
              {saving ? <span className="spinner small" /> : <Icon name="download" size={14} />} {t('draft.save')}
            </button>
          </span>
        )}
        {filmError && <span className="small error ellipsis" title={filmError}>{filmError}</span>}
        <button className="ghost" onClick={openFilm} disabled={wantFilm || joining}>
          {wantFilm || joining ? <span className="spinner small" /> : <Icon name="play" size={14} />} {t(wantFilm ? 'film.rendering' : joining ? 'film.joining' : 'film.watch')}
        </button>
        {joining && (
          <button className="icon-button" onClick={() => guard(api.cancel(previewJob!.id))} title={t('queue.stop')} aria-label={t('queue.stop')}>
            <Icon name="x" size={14} />
          </button>
        )}
        {project.track === '3d' && (
          <button className={drawer === 'assets' ? 'ghost on' : 'ghost'} onClick={() => toggle('assets')}>
            <Icon name="cube" size={14} /> {t('studio.assets')}
          </button>
        )}
        <button className={drawer === 'queue' ? 'ghost on' : 'ghost'} onClick={() => toggle('queue')}>
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
          <button className="menu-item" onClick={() => { setMenu(false); guard(api.reveal(project.root)) }}>
            <Icon name="folder" size={14} /> {t('studio.revealFinder')}
          </button>
        </MoreMenu>
      </header>

      {shot && view ? (
        <AgentPanel key={`agent-${shot.id}`} project={project} shot={shot} jobs={jobs} openSettings={openSettings}
          picker={picker} />
      ) : <aside className="agent" />}
      <AgentResizer keep={keepWidth} />

      <section className="center">
        {shot && view
          ? <Stage key={`stage-${shot.id}`} project={project} shot={shot} view={view} mode={mode} refresh={refresh}
              picker={picker} />
          : <div className="stage empty">{t('studio.noShots')}</div>}
        <Filmstrip project={project} views={views} mode={mode} selected={selected} onSelect={setSelected} />
        {shot && <ShotNotes key={`notes-${shot.id}`} project={project} shot={shot} editPlan={openPlan}
          busy={active.some(j => j.project === project.root && j.shot === shot.id)} />}
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
  useDismiss(ref, open, () => setOpen(false))
  return (
    <div className="more" ref={ref}>
      <button className={`icon-button${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-label={t('studio.more')} aria-expanded={open}>
        <Icon name="more" size={18} />
      </button>
      {open && <div className="menu" role="menu">{children}</div>}
    </div>
  )
}

// Renames the project; the failure (the old name kept) goes to `failed`
export async function rename(project: Project, title: string, refresh: () => void, failed: (e: string) => void) {
  try {
    await api.setTitle(project.root, title)
    refresh()
  } catch (e) {
    failed(String(e))
  }
}

// The project's name: click to rename, Enter or leaving the field saves,
// Esc cancels
export function Title({ project, refresh }: { project: Project; refresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(project.title)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setEditing(false)
    const title = value.trim()
    if (!title || title === project.title) return setValue(project.title)
    setError(null)
    await rename(project, title, refresh, e => {
      setValue(project.title)
      setError(e)
    })
  }
  if (!editing) {
    return (
      <button className="title-button" onClick={() => { setValue(project.title); setEditing(true) }} title={error ?? t('studio.rename')}>
        <strong className="ellipsis">{project.title}</strong> <Icon name={error ? 'info' : 'edit'} size={12} />
        {error && <span className="small error ellipsis">{t('studio.renameFailed')}</span>}
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

// The agent panel's right edge: drag to resize, arrow keys in steps,
// double-click for the default width
function AgentResizer({ keep }: { keep: (w: number | null) => void }) {
  const panel = (el: HTMLElement) => el.parentElement!.querySelector<HTMLElement>(':scope > .agent')!
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget
    const from = panel(handle).getBoundingClientRect().width - e.clientX
    handle.setPointerCapture(e.pointerId)
    document.body.classList.add('resizing')
    let width: number | null = null
    handle.onpointermove = ev => {
      width = clampWidth(from + ev.clientX)
      handle.parentElement!.style.setProperty('--agent-w', `${width}px`)
    }
    // Released anywhere (even outside the window), the capture ends
    handle.onlostpointercapture = () => {
      handle.onpointermove = null
      handle.onlostpointercapture = null
      document.body.classList.remove('resizing')
      // A click without a drag leaves the width as it was
      if (width != null) keep(width)
    }
  }
  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0
    if (!by) return
    e.preventDefault()
    keep(clampWidth(panel(e.currentTarget).getBoundingClientRect().width + by))
  }
  return (
    <div className="agent-resize" role="separator" aria-orientation="vertical" aria-label={t('studio.resizeAgent')} tabIndex={0}
      onPointerDown={drag} onKeyDown={step} onDoubleClick={() => keep(null)} />
  )
}
