import { useEffect, useState } from 'react'
import { api, fileUrl, relPath, type Mode, type Project, type Shot, type Take } from '../../api'
import { estimate, formatSeconds, shotTime, type ShotView } from '../../model'
import { VideoPlayer } from './VideoPlayer'
import { Icon } from '../Icon'
import type { Key } from '../../i18n/en'
import { formatDate, t } from '../../i18n'
import { stageName } from '../../model'

type Tab = 'preview' | 'stills' | 'code'

const STILLS: Key[] = ['stage.start', 'stage.middle', 'stage.end']

// The shot on a dark stage: its clip with captions and music, its three
// stills, or its code (docs/PRD.md §7.4); rendering is the studio's
// "Render changed", or the button here when the shot has no clip yet
export function Stage({ project, shot, view, mode, refresh }: {
  project: Project
  shot: Shot
  view: ShotView
  mode: Mode
  refresh: () => void
}) {
  const [tab, setTab] = useState<Tab>(view.clip ? 'preview' : 'stills')
  const [take, setTake] = useState<Take | null>(null)
  const stills = take?.stills ?? view.stills
  const busy = view.state === 'rendering' || view.state === 'queued'
  const clip = take ? take.preview ?? take.clip : view.clip
  const version = take?.take ?? view.take?.take
  const wide = project.size.width > project.size.height
  const takes = [...shot.takes].reverse()

  const render = (m: Mode, stillsOnly: boolean) =>
    api.enqueue({ kind: 'render', project: project.root, shot: shot.id, mode: m, stills: stillsOnly })

  return (
    <div className="stage-wrap">
      <div className="stage-bar">
        <div className="segmented">
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}><Icon name="play" size={13} /> {t('stage.preview')}</button>
          <button className={tab === 'stills' ? 'on' : ''} onClick={() => setTab('stills')}><Icon name="image" size={13} /> {t('stage.stills')}</button>
          <button className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}><Icon name="code" size={13} /> {t('stage.code')}</button>
        </div>
        <span className="stage-shot">
          <strong>{shot.id}</strong> <span className="muted small">{shotTime(shot)}</span>
        </span>
        <div className="spacer" />
        {tab !== 'code' && takes.length > 1 && (
          <select
            className="take-select"
            value={take?.take ?? ''}
            onChange={e => setTake(takes.find(t => t.take === Number(e.target.value)) ?? null)}
            aria-label={t('stage.takeAria')}
          >
            <option value="">{t(view.stale ? 'stage.latestStale' : 'stage.latest', { mode: t(`mode.${mode}`) })}</option>
            {takes.map(tk => (
              <option key={tk.take} value={tk.take}>
                {t('stage.take', { n: tk.take, mode: t(`mode.${tk.mode}`), kind: t(`kind.${tk.kind}`), time: formatDate(tk.at, { hour: '2-digit', minute: '2-digit' }) })}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={`stage${tab === 'code' ? ' code' : ''}`}>
        {view.state === 'failed' && shot.error && tab !== 'code' && (
          <pre className="stage-error">{t('stage.failed', { mode: t(`mode.${shot.error.mode}`), message: shot.error.message })}</pre>
        )}
        {tab === 'preview' && (clip
          ? <VideoPlayer key={clip} src={fileUrl(clip, version)} className={`shot${wide ? ' wide' : ''}`} />
          : <div className="stage-empty">
              <p>{t('stage.noClip', { mode: t(`mode.${mode}`) })}</p>
              <button onClick={() => render(mode, false)}>{t('stage.renderMode', { mode: t(`mode.${mode}`), time: formatSeconds(estimate(project, shot, mode)) })}</button>
            </div>)}
        {tab === 'stills' && (stills
          ? <div className={`stage-stills${wide ? ' wide' : ''}`}>
              {STILLS.map((name, i) => (
                <figure key={name}>
                  <img src={fileUrl(stills[i], version)} alt={t(name)} onClick={() => api.openPath(stills[i])} />
                  <figcaption>{view.stale && !take ? t('stage.staleTag', { name: t(name) }) : t(name)}</figcaption>
                </figure>
              ))}
            </div>
          : (
            // Where the three stills will be, with the way to get them
            <div className={`stage-stills placeholder${wide ? ' wide' : ''}${busy ? ' busy' : ''}`}>
              {STILLS.map(name => (
                <figure key={name}>
                  {/* A transparent image of the frame's shape, laid out like a still */}
                  <img className="still-ph" src={wide ? SPACER_WIDE : SPACER_TALL} alt="" />
                  {busy && <span className="shimmer sweep" />}
                  <figcaption>{t(name)}</figcaption>
                </figure>
              ))}
              <div className="still-ph-call">
                {busy
                  // While frames render, the progress bar below says it
                  ? !view.job?.progress && <p><span className="spinner small" /> {t(view.state === 'queued' ? 'stage.stillsQueued' : 'stage.stillsRendering')}</p>
                  : <>
                      <p>{t('stage.noStills')}</p>
                      <button onClick={() => render(mode, true)}>{t('stage.renderStills')}</button>
                    </>}
              </div>
            </div>
          ))}
        {tab === 'code' && <CodeTabs project={project} shot={shot} mode={mode} refresh={refresh} />}
        {view.job && view.state === 'rendering' && view.job.progress && (
          <div className="stage-progress">
            <span>{t('stage.rendering', { stage: stageName(view.job.progress.stage), done: view.job.progress.done, total: view.job.progress.total })}</span>
            <div className="bar"><i style={{ width: `${(view.job.progress.done / Math.max(1, view.job.progress.total)) * 100}%` }} /></div>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeTabs({ project, shot, mode, refresh }: { project: Project; shot: Shot; mode: Mode; refresh: () => void }) {
  const files = [relPath(project, shot.code), relPath(project, shot.notes)]
  const [file, setFile] = useState(files[0])
  return (
    <div className="code-pane">
      <div className="file-tabs">
        {files.map(f => (
          <button key={f} className={file === f ? 'on' : ''} onClick={() => setFile(f)}>{f.split('/').at(-1)}</button>
        ))}
      </div>
      <Editor
        key={file}
        project={project}
        file={file}
        version={`${shot.fixes.length}-${shot.draft.key}-${shot.final.key}`}
        onSaved={() => {
          // New code, new stills: the person sees the change right away
          if (file === files[0]) api.enqueue({ kind: 'render', project: project.root, shot: shot.id, mode, stills: true })
          refresh()
        }}
      />
    </div>
  )
}

// A plain text editor for the shot's files; saving changes the shot's
// cache key, so the shot shows as stale until it is rendered again
function Editor({ project, file, version, onSaved }: { project: Project; file: string; version: string; onSaved: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Changed on disk (the agent's fix) while the person was editing
  const [clash, setClash] = useState<string | null>(null)
  const dirty = text != null && text !== saved
  // Read again when the shot changes on disk, unless there are edits
  useEffect(() => {
    if (dirty) return
    api.readText(project.root, file).then(t => {
      setText(t)
      setSaved(t)
    }, e => setError(String(e)))
  }, [project.root, file, version])

  const save = async (force = false) => {
    if (text == null) return
    try {
      const disk = await api.readText(project.root, file)
      if (!force && disk !== saved) return setClash(disk)
      await api.writeText(project.root, file, text)
      setSaved(text)
      setClash(null)
      onSaved()
    } catch (e) {
      setError(String(e))
    }
  }
  if (error) return <p className="error">{error}</p>
  if (text == null) return <CodeSkeleton />
  return (
    <div className="editor">
      <textarea
        spellCheck={false}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            save()
          }
        }}
      />
      {clash != null && (
        <div className="editor-clash small">
          <span>{t('editor.clash')}</span>
          <button className="small ghost" onClick={() => { setText(clash); setSaved(clash); setClash(null) }}>{t('editor.reload')}</button>
          <button className="small" onClick={() => save(true)}>{t('editor.keepMine')}</button>
        </div>
      )}
      <div className="editor-bar">
        <span className="muted small">{file}</span>
        <button className="small" onClick={() => save()} disabled={!dirty}>{dirty ? t('editor.save') : t('common.saved')}</button>
      </div>
    </div>
  )
}

const spacer = (w: number, h: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"/>`)}`
const SPACER_TALL = spacer(9, 16)
const SPACER_WIDE = spacer(16, 9)

// Lines of code in outline while the file loads
function CodeSkeleton() {
  const widths = [38, 72, 64, 0, 55, 81, 47, 69, 0, 33, 76, 58, 42]
  return (
    <div className="editor code-skeleton" aria-busy>
      {widths.map((w, i) => (w ? <span key={i} className="sk-line" style={{ width: `${w}%`, marginLeft: i % 4 === 2 ? 24 : 0 }} /> : <span key={i} className="sk-gap" />))}
    </div>
  )
}
