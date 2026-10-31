import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api, fileUrl, type ExportResult, type Job, type Mode, type Project } from '../../../api'
import { t } from '../../../i18n'
import type { Key } from '../../../i18n/en'
import { estimate, formatSeconds } from '../../../model'
import { Icon } from '../../Icon'
import { ChangesDialog } from '../ChangesDialog'
import { CoverEditor, coverSource, useCover } from './CoverEditor'
import { CopySummary, Music, Publish, Samples } from './parts'

const ASPECTS: { id: string; label: Key; note: Key }[] = [
  { id: '9:16', label: 'export.portrait', note: 'export.portraitFor' },
  { id: '16:9', label: 'export.landscape', note: 'export.landscapeFor' }
]

// What to export, ticked like CapCut's export dialog
type Parts = { video: boolean; cover: boolean; copy: boolean }
type Prefs = { aspects?: string[]; parts?: Parts }
const LAST = 'shotloop.export.last'
// Where exports go, for every project: a folder per export is made in it
const TO = 'shotloop.export.to'
const DEFAULT_TO = '~/Movies/Shotloop'
const readTo = () => {
  try {
    return localStorage.getItem(TO) || DEFAULT_TO
  } catch {
    return DEFAULT_TO
  }
}
const readPrefs = (key: string): Prefs | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

// Export (docs/PRD.md §7.9, §7.10), a dialog over the studio: the cover
// on the left (its editor a view of the same dialog), and on the right
// what to export: the video (aspects, music), the cover PNG and the
// publish copy. Exporting turns the dialog into the run: each part's
// progress, then the files and the copy per platform. It can close while
// the export runs; opened again, it shows the run.
export function ExportDialog({ project, jobs, refresh, openSettings, close }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  openSettings: () => void
  close: () => void
}) {
  const mine = jobs.filter(j => j.project === project.root)
  const exportJob = mine.filter(j => j.kind === 'export').at(-1)
  const exporting = !!exportJob && (exportJob.state === 'running' || exportJob.state === 'queued')
  const renders = mine.filter(j => j.kind === 'render' && (j.state === 'running' || j.state === 'queued'))
  const cover = useCover(project, mine)
  // Opened while an export runs, or after one finished in the background
  // this session: its run and files first
  const [view, setView] = useState<'setup' | 'cover' | 'copy' | 'run'>(exportJob && exportJob.state !== 'cancelled' ? 'run' : 'setup')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (view === 'cover' || view === 'copy') setView('setup')
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, close])

  // The last choices: this project's, else the last export's anywhere
  const prefsKey = `shotloop.export.${project.root}`
  const saved = readPrefs(prefsKey) ?? readPrefs(LAST)
  const [aspects, setAspects] = useState<string[]>(saved?.aspects?.length ? saved.aspects : ['9:16'])
  const [parts, setParts] = useState<Parts>(saved?.parts ?? { video: true, cover: true, copy: true })
  useEffect(() => {
    try {
      const v = JSON.stringify({ aspects, parts })
      localStorage.setItem(prefsKey, v)
      localStorage.setItem(LAST, v)
    } catch {
      // storage unavailable: the choices last while the dialog is open
    }
  }, [prefsKey, aspects, parts])

  // The work's name: the project's title, renamed here; the export's
  // folder and files are named after it
  const [name, setName] = useState(project.title)
  useEffect(() => setName(project.title), [project.title])
  const rename = async () => {
    const v = name.trim()
    if (!v || v === project.title) return setName(project.title)
    await api.setTitle(project.root, v).catch(() => setName(project.title))
    refresh()
  }

  const [to, setTo] = useState(readTo)
  const chooseTo = async () => {
    const dir = await pick({ directory: true, title: t('xd.toDialog') })
    if (typeof dir !== 'string') return
    setTo(dir)
    try {
      localStorage.setItem(TO, dir)
    } catch {
      // storage unavailable: the folder lasts while the dialog is open
    }
  }

  // Exports are final; the editor's previews are never exported
  const mode: Mode = 'final'
  const pending = project.shots.filter(s => s[mode].state !== 'cached')
  const time = pending.reduce((n, s) => n + estimate(project, s, mode), 0)

  // The publish copy already written: exporting keeps it
  const publishJob = mine.filter(j => j.kind === 'publish').at(-1)
  const [hasCopy, setHasCopy] = useState(false)
  useEffect(() => {
    api.readText(project.root, 'publish.json').then(() => setHasCopy(true), () => setHasCopy(false))
  }, [project.root, publishJob?.state])

  // What the run started with, for its rows (none: opened while exporting)
  const [started, setStarted] = useState<Parts | null>(null)
  const [batch, setBatch] = useState(0)
  const [ask, setAsk] = useState(false)
  const run = () => {
    setAsk(false)
    setStarted(parts)
    setView('run')
    // One job per shot, so the queue shows them one at a time; the export
    // job then joins the cached clips, renders the cover and delivers
    // everything into a new folder named after the work
    const shots = parts.video ? pending : []
    setBatch(shots.length)
    for (const s of shots) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
    api.enqueue({
      kind: 'export', project: project.root, mode, aspects,
      video: parts.video, cover: parts.cover, publish: parts.copy, to, name: name.trim() || project.title
    })
    // The copy, written alongside; one finished after the export is added
    // to its folder (Run)
    const writing = publishJob?.state === 'running' || publishJob?.state === 'queued'
    if (parts.copy && !hasCopy && !writing) api.enqueue({ kind: 'publish', project: project.root })
  }
  const go = () => (parts.video && pending.length ? setAsk(true) : run())

  const nothing = !parts.video && !parts.cover && !parts.copy
  const blocked = nothing || (parts.video && !aspects.length) || (parts.cover && cover.busy)
  const tick = (k: keyof Parts) => setParts(p => ({ ...p, [k]: !p[k] }))

  const title = view === 'cover' ? t('xd.editCover') : view === 'copy' ? t('xd.editCopy') : t('drawer.export')
  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className={`xd${view === 'cover' ? ' editing' : ''}`} role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="xd-head">
          {(view === 'cover' || view === 'copy') && (
            <button className="icon-button" onClick={() => setView('setup')} aria-label={t('studio.back')}><Icon name="back" size={16} /></button>
          )}
          <strong>{title}</strong>
          <span className="spacer" />
          <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" size={16} /></button>
        </div>

        {view === 'cover'
          ? <CoverEditor project={project} cover={cover} openSettings={openSettings} />
          : (
            <div className="xd-body">
              <div className="xd-left">
                <div className="xd-cover">
                  {cover.src && <img src={cover.src} alt={t('export.cover')} />}
                  {cover.busy && <span className="shimmer sweep" />}
                  <button className="small edit" onClick={() => setView('cover')}>
                    {cover.busy ? <span className="spinner small" /> : <Icon name="edit" size={12} />} {t(cover.busy ? 'cover.designing' : 'xd.editCover')}
                  </button>
                </div>
                <span className="xd-cover-note">{[coverSource(project), '1080×1920'].filter(Boolean).join(' · ')}</span>
              </div>
              {view === 'setup'
                ? (
                  <Setup project={project} jobs={mine} refresh={refresh} name={name} setName={setName} rename={rename} parts={parts} tick={tick} aspects={aspects} setAspects={setAspects}
                    to={to} chooseTo={chooseTo} editCopy={() => setView('copy')} openSettings={openSettings} />
                )
                : view === 'copy'
                  ? <div className="xd-right"><Publish project={project} jobs={mine} openSettings={openSettings} bare /></div>
                  : (
                    <Run project={project} jobs={mine} started={started} exportJob={exportJob} renders={renders} batch={batch} openSettings={openSettings} />
                  )}
            </div>
          )}

        <div className="xd-foot">
          {view === 'setup' && (
            <>
              <div className="meta">
                <span>{t('xd.duration', { time: formatSeconds(project.duration) })}</span>
                {parts.video && <span title={pending.map(s => s.id).join(', ')}>{pending.length ? t('export.need', { n: pending.length, time: formatSeconds(time) }) : t('export.ready')}</span>}
                {nothing && <span className="warn-note">{t('xd.nothing')}</span>}
                {!nothing && parts.cover && cover.busy && <span>{t('xd.coverBusy')}</span>}
              </div>
              <span className="spacer" />
              <button className="ghost" onClick={close}>{t('plan.cancel')}</button>
              <button className="primary" onClick={go} disabled={blocked}><Icon name="export" size={14} /> {t('xd.go')}</button>
            </>
          )}
          {(view === 'cover' || view === 'copy') && (
            <>
              <span className="spacer" />
              <button className="primary" onClick={() => setView('setup')}>{t('xd.done')}</button>
            </>
          )}
          {view === 'run' && (
            <>
              <span className="spacer" />
              {!exporting && <button className="ghost" onClick={() => setView('setup')}>{t('xd.backSetup')}</button>}
              <button className={exporting ? '' : 'primary'} onClick={close}>{t(exporting ? 'xd.background' : 'xd.done')}</button>
            </>
          )}
        </div>
      </div>

      {ask && (
        <ChangesDialog project={project} shots={pending} mode={mode} close={() => setAsk(false)}
          title={t('changes.titleExport', { n: pending.length })} note={t(project.track === '3d' ? 'changes.noteExport3d' : 'changes.noteExport')}
          actions={[
            { label: t('plan.cancel'), onClick: () => setAsk(false) },
            { label: t('changes.export'), onClick: run, primary: true }
          ]} />
      )}
    </div>
  )
}

// The settings: the name and where the files go, then each part to
// export with its own options
function Setup({ project, jobs, refresh, name, setName, rename, parts, tick, aspects, setAspects, to, chooseTo, editCopy, openSettings }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  name: string
  setName: (n: string) => void
  rename: () => void
  parts: Parts
  tick: (k: keyof Parts) => void
  aspects: string[]
  setAspects: (a: string[]) => void
  to: string
  chooseTo: () => void
  editCopy: () => void
  openSettings: () => void
}) {
  return (
    <div className="xd-right">
      <label className="xrow">
        <span className="xrow-label">{t('xd.name')}</span>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={rename} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
      </label>
      <div className="xrow top">
        <span className="xrow-label">{t('xd.to')}</span>
        <div className="path-col">
          <div className="path">
            <input value={to.replace(/^\/Users\/[^/]+/, '~')} readOnly title={to} aria-label={t('xd.to')} onClick={chooseTo} />
            <button className="small" onClick={chooseTo}><Icon name="folder" size={12} /> {t('xd.choose')}</button>
          </div>
          <span className="small muted">{t('xd.folderNote', { name: name.trim() || project.title })}</span>
        </div>
      </div>

      <Part on={parts.video} toggle={() => tick('video')} label={t('xd.video')} meta={t('xd.videoMeta', { fps: project.fps })}>
        <div className="xrow">
          <span className="xrow-label">{t('export.aspects')}</span>
          <div className="chips">
            {ASPECTS.map(a => {
              const on = aspects.includes(a.id)
              return (
                <button key={a.id} className={`provider-chip check-chip${on ? ' on' : ''}`} aria-pressed={on} title={t(a.note)}
                  onClick={() => setAspects(on ? aspects.filter(x => x !== a.id) : ['9:16', '16:9'].filter(x => x === a.id || aspects.includes(x)))}>
                  <Check on={on} /> {t(a.label)} <span className="muted">{a.id}</span>
                </button>
              )
            })}
          </div>
        </div>
        <Music project={project} refresh={refresh} />
        {project.track === '3d' && (
          <div className="xrow top">
            <span className="xrow-label">{t('studio.quality')}</span>
            <Samples project={project} refresh={refresh} />
          </div>
        )}
      </Part>
      <Part on={parts.cover} toggle={() => tick('cover')} label={t('export.cover')} meta={t('xd.coverMeta')} />
      <Part on={parts.copy} toggle={() => tick('copy')} label={t('export.publish')} meta={parts.copy ? '' : t('xd.copyMeta')}>
        <CopySummary project={project} jobs={jobs} edit={editCopy} openSettings={openSettings} />
      </Part>
    </div>
  )
}

function Check({ on }: { on: boolean }) {
  return <span className={`box${on ? ' on' : ''}`} aria-hidden>{on && <Icon name="check" size={10} />}</span>
}

// One part to export: a tick with its name, and its options under it
function Part({ on, toggle, label, meta, children }: { on: boolean; toggle: () => void; label: string; meta: string; children?: React.ReactNode }) {
  return (
    <section className={`xsec${on ? '' : ' off'}`}>
      <button className="xsec-head" role="checkbox" aria-checked={on} onClick={toggle}>
        <Check on={on} /> {label}
        <span className="spacer" />
        <small>{meta}</small>
      </button>
      {children && on && <div className="xsec-body">{children}</div>}
    </section>
  )
}

// The run: each part ticked, with its progress, then its files
function Run({ project, jobs, started, exportJob, renders, batch, openSettings }: {
  project: Project
  jobs: Job[]
  started: Parts | null
  exportJob: Job | undefined
  renders: Job[]
  batch: number
  openSettings: () => void
}) {
  const exporting = !!exportJob && (exportJob.state === 'running' || exportJob.state === 'queued')
  const [latest, setLatest] = useState<ExportResult | null>(null)
  useEffect(() => {
    api.readText(project.root, 'out/latest.json').then(text => setLatest(JSON.parse(text)), () => setLatest(null))
  }, [project.root, exportJob?.state])

  // Opened again while exporting: the video is what runs
  const video = started ? started.video : !!exportJob
  const showCover = started ? started.cover : !!latest?.cover

  // Progress: the shots still to render, then the joining
  const total = Math.max(batch, renders.length)
  const done = Math.max(0, total - renders.length)
  const rendering = renders.find(j => j.state === 'running')
  const step = renders.length
    ? t('export.stepRender', { done: Math.min(done + 1, total), total })
    : t('export.stepJoin')
  const fraction = renders.length
    ? (done + (rendering?.progress ? rendering.progress.done / Math.max(1, rendering.progress.total) : 0)) / Math.max(1, total + 1)
    : (total + (exportJob?.progress ? exportJob.progress.done / Math.max(1, exportJob.progress.total) : 0.3)) / Math.max(1, total + 1)
  const exported = exportJob?.state === 'done' ? latest : null
  const coverOut = exported?.cover ?? null
  const failed = exportJob?.state === 'failed'

  // The copy finished after the export: into the export's folder too
  const publishJob = jobs.filter(j => j.kind === 'publish').at(-1)
  const folder = exported?.folder
  useEffect(() => {
    if (!started?.copy || !folder || exported?.publish || publishJob?.state !== 'done') return
    api.deliverCopy(project.root, folder, project.title)
      .then(file => setLatest(l => (l ? { ...l, publish: file } : l)), () => {})
  }, [started?.copy, folder, exported?.publish, publishJob?.state])

  return (
    <div className="xd-right">
      {folder && (
        <div className="xrun-folder">
          <Icon name="folder" size={16} />
          <div className="xrun-folder-text">
            <strong className="ellipsis">{folder.split('/').pop()}</strong>
            <span className="small muted ellipsis" title={folder}>{folder.replace(/^\/Users\/[^/]+/, '~')}</span>
          </div>
          <button className="small" onClick={() => api.openPath(folder)}>{t('xd.openFolder')}</button>
        </div>
      )}
      {failed && <pre className="error-box small">{exportJob!.error}</pre>}
      {video && (
        <section className="xrun">
          <div className="xrun-head">
            <RunState state={exporting ? 'running' : exportJob?.state === 'failed' ? 'failed' : exportJob?.state === 'done' ? 'done' : 'running'} />
            <strong>{t('xd.video')}</strong>
            <span className="spacer" />
            {exporting && <span className="small muted">{step}</span>}
          </div>
          {exporting && (
            <>
              <div className="bar"><i style={{ width: `${Math.round(Math.min(0.98, fraction) * 100)}%` }} /></div>
              <span className="small muted">{t('export.keepWorking')}</span>
            </>
          )}
          {exported && (
            <div className="latest-files">
              {exported.films.map(f => (
                <div key={f.file} className="latest-file">
                  <span className={`aspect-shape small a${f.aspect.replace(':', '')}`} />
                  <strong>{f.aspect}</strong>
                  <span className="small muted ellipsis">{f.file.split('/').pop()}</span>
                  <span className="spacer" />
                  <button className="small" onClick={() => api.openPath(f.file)}><Icon name="play" size={12} /> {t('export.open')}</button>
                  <button className="small ghost" onClick={() => api.reveal(f.file)}>{t('export.show')}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {showCover && (
        <section className="xrun">
          <div className="xrun-head">
            <RunState state={failed ? 'failed' : coverOut ? 'done' : 'running'} />
            <strong>{t('export.cover')}</strong>
            <span className="spacer" />
            {coverOut && <button className="small ghost" onClick={() => api.reveal(coverOut)}>{t('export.show')}</button>}
          </div>
          {coverOut && (
            <button className="xrun-file" onClick={() => api.openPath(coverOut)}>
              <img src={fileUrl(coverOut)} alt="" /> <span className="small muted ellipsis">{coverOut.split('/').pop()}</span>
            </button>
          )}
        </section>
      )}
      {(started ? started.copy : true) && <Publish project={project} jobs={jobs} openSettings={openSettings} />}
    </div>
  )
}

function RunState({ state }: { state: 'running' | 'done' | 'failed' }) {
  if (state === 'running') return <span className="spinner small" />
  return <span className={`run-state ${state}`}><Icon name={state === 'done' ? 'check' : 'x'} size={11} /></span>
}
