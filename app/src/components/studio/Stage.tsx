import { useEffect, useState } from 'react'
import { api, fileUrl, relPath, type Mode, type Project, type Shot, type Take } from '../../api'
import { estimate, formatSeconds, shotTime, type ShotView } from '../../model'
import { Icon } from '../Icon'

type Tab = 'preview' | 'stills' | 'code'
const STILLS = ['Start', 'Middle', 'End']

// The shot on a dark stage: its clip with captions and music, its three
// stills, or its code (docs/PRD.md §7.4), with the shot's render actions
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
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}><Icon name="play" size={13} /> Preview</button>
          <button className={tab === 'stills' ? 'on' : ''} onClick={() => setTab('stills')}><Icon name="image" size={13} /> Stills</button>
          <button className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}><Icon name="code" size={13} /> Code</button>
        </div>
        <span className="stage-shot">
          <strong>{shot.id}</strong> <span className="muted small">{shotTime(shot)}</span>
        </span>
        <div className="spacer" />
        {tab !== 'code' && (
          <select
            className="take-select"
            value={take?.take ?? ''}
            onChange={e => setTake(takes.find(t => t.take === Number(e.target.value)) ?? null)}
            aria-label="Take"
          >
            <option value="">Latest {mode}{view.stale ? ' (stale)' : ''}</option>
            {takes.map(t => (
              <option key={t.take} value={t.take}>
                Take {t.take} · {t.mode} {t.kind} · {new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </option>
            ))}
          </select>
        )}
        <button className="small" onClick={() => render('draft', true)} title={`~${formatSeconds(estimate(project, shot, 'draft', true))}`}>Stills</button>
        <button className="small" onClick={() => render('draft', false)} title={`~${formatSeconds(estimate(project, shot, 'draft'))}`}>Draft</button>
        <button className="small" onClick={() => render('final', false)} title={`~${formatSeconds(estimate(project, shot, 'final'))}`}>Final</button>
      </div>

      <div className={`stage${tab === 'code' ? ' code' : ''}`}>
        {view.state === 'failed' && shot.error && tab !== 'code' && (
          <pre className="stage-error">Render failed ({shot.error.mode}): {shot.error.message}</pre>
        )}
        {tab === 'preview' && (clip
          ? <video key={clip} className={wide ? 'wide' : ''} src={fileUrl(clip, version)} controls loop autoPlay muted playsInline />
          : <div className="stage-empty">
              <p>No {mode} clip of this shot yet.</p>
              <button onClick={() => render(mode, false)}>Render {mode} · ~{formatSeconds(estimate(project, shot, mode))}</button>
            </div>)}
        {tab === 'stills' && (stills
          ? <div className={`stage-stills${wide ? ' wide' : ''}`}>
              {STILLS.map((name, i) => (
                <figure key={name}>
                  <img src={fileUrl(stills[i], version)} alt={`${name} frame`} onClick={() => api.openPath(stills[i])} />
                  <figcaption>{name}{view.stale && !take ? ' · stale' : ''}</figcaption>
                </figure>
              ))}
            </div>
          : <div className="stage-empty">
              <p>No stills yet.</p>
              <button onClick={() => render('draft', true)}>Render stills</button>
            </div>)}
        {tab === 'code' && <CodeTabs project={project} shot={shot} refresh={refresh} />}
        {view.job && view.state === 'rendering' && view.job.progress && (
          <div className="stage-progress">
            <span>Rendering {view.job.progress.stage} {view.job.progress.done}/{view.job.progress.total}</span>
            <div className="bar"><i style={{ width: `${(view.job.progress.done / Math.max(1, view.job.progress.total)) * 100}%` }} /></div>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeTabs({ project, shot, refresh }: { project: Project; shot: Shot; refresh: () => void }) {
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
        onSaved={() => {
          // New code, new stills: the person sees the change right away
          if (file === files[0]) api.enqueue({ kind: 'render', project: project.root, shot: shot.id, mode: 'draft', stills: true })
          refresh()
        }}
      />
    </div>
  )
}

// A plain text editor for the shot's files; saving changes the shot's
// cache key, so the shot shows as stale until it is rendered again
function Editor({ project, file, onSaved }: { project: Project; file: string; onSaved: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.readText(project.root, file).then(t => {
      setText(t)
      setSaved(t)
    }, e => setError(String(e)))
  }, [project.root, file])

  const dirty = text != null && text !== saved
  const save = async () => {
    if (text == null) return
    await api.writeText(project.root, file, text)
    setSaved(text)
    onSaved()
  }
  if (error) return <p className="error">{error}</p>
  if (text == null) return <p className="muted">Loading…</p>
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
      <div className="editor-bar">
        <span className="muted small">{file}</span>
        <button className="small" onClick={save} disabled={!dirty}>{dirty ? 'Save · ⌘S' : 'Saved'}</button>
      </div>
    </div>
  )
}
