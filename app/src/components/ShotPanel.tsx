import { useEffect, useState } from 'react'
import { api, fileUrl, relPath, type Job, type Mode, type Project, type Shot, type Take } from '../api'
import { estimate, formatSeconds, shotTime, type ShotView } from '../model'

const STILL_NAMES = ['Start', 'Middle', 'End']

// One shot (docs/PRD.md §7.4–7.6): stills at start, middle and end; the
// clip with captions and music; plain-language fixes with before/after;
// checks; the shot's code and notes; its takes.
export function ShotPanel({ project, shot, view, mode, jobs, refresh }: {
  project: Project
  shot: Shot
  view: ShotView
  mode: Mode
  jobs: Job[]
  refresh: () => void
}) {
  const [take, setTake] = useState<Take | null>(null)
  const shown = take ?? null
  const stills = shown?.stills ?? view.stills
  const clip = shown ? shown.preview ?? shown.clip : view.clip
  const version = shown?.take ?? view.take?.take

  const agentJob = jobs.find(j => j.project === project.root && j.shot === shot.id && j.lane === 'agent'
    && (j.state === 'running' || j.state === 'queued'))
  const render = (m: Mode, stillsOnly: boolean) =>
    api.enqueue({ kind: 'render', project: project.root, shot: shot.id, mode: m, stills: stillsOnly })

  return (
    <div className="shot-panel">
      <div className="shot-head">
        <div>
          <h2>{shot.id}</h2>
          <span className="muted small">{shot.title ? `${shot.title} · ` : ''}{shotTime(shot)} · {shot.duration} s</span>
        </div>
        <div className="row gap wrap">
          <button onClick={() => render('draft', true)} title={`~${formatSeconds(estimate(project, shot, 'draft', true))}`}>Stills</button>
          <button onClick={() => render('draft', false)} title={`~${formatSeconds(estimate(project, shot, 'draft'))}`}>Render draft</button>
          <button onClick={() => render('final', false)} title={`~${formatSeconds(estimate(project, shot, 'final'))}`}>Render final</button>
          <button
            onClick={() => api.enqueue({ kind: 'check', project: project.root, shot: shot.id })}
            disabled={!!agentJob}
            title="The agent renders stills, reviews them against the checklist and fixes what it can"
          >
            Run checks
          </button>
        </div>
      </div>

      {shot.error && view.state === 'failed' && (
        <pre className="error-box">Render failed ({shot.error.mode}): {shot.error.message}</pre>
      )}

      <section className="review">
        <div className="stills">
          {STILL_NAMES.map((name, i) => (
            <figure key={name}>
              {stills?.[i]
                ? <img src={fileUrl(stills[i], version)} alt={`${name} frame`} onClick={() => api.openPath(stills[i])} />
                : <div className="empty-still">No stills yet</div>}
              <figcaption>{name}{view.stale && !shown ? ' · stale' : ''}</figcaption>
            </figure>
          ))}
        </div>
        <div className="clip">
          {clip ? (
            <video key={clip} src={fileUrl(clip, version)} controls loop playsInline />
          ) : (
            <div className="empty-still">No {mode} clip yet</div>
          )}
          <span className="muted small">
            {shown ? `Take ${shown.take} · ${shown.mode} · ${new Date(shown.at).toLocaleString()}` : view.take ? `Latest take ${view.take.take} (${mode})` : `No ${mode} take`}
            {shown && <button className="link" onClick={() => setTake(null)}> · back to latest</button>}
          </span>
        </div>
      </section>

      <FixBox project={project} shot={shot} job={agentJob ?? null} />
      <Checks shot={shot} />
      <Tabs project={project} shot={shot} refresh={refresh} onTake={setTake} current={shown} />
    </div>
  )
}

function FixBox({ project, shot, job }: { project: Project; shot: Shot; job: Job | null }) {
  const [request, setRequest] = useState('')
  const fix = shot.fix
  const submit = () => {
    if (!request.trim()) return
    api.enqueue({ kind: 'fix', project: project.root, shot: shot.id, request: request.trim() })
    setRequest('')
  }
  return (
    <section className="panel fix">
      <h3>What's wrong?</h3>
      <div className="row gap">
        <textarea
          value={request}
          rows={2}
          placeholder="Say it in plain words, e.g. “the cable is hidden behind the building”"
          onChange={e => setRequest(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <button className="primary" onClick={submit} disabled={!request.trim() || !!job}>Fix</button>
      </div>
      {job && (
        <div className="agent-log">
          <strong>{job.state === 'queued' ? 'Queued' : 'Working'}: {job.label}</strong>
          {job.log.slice(-6).map((l, i) => <div key={i} className="muted small">{l}</div>)}
        </div>
      )}
      {fix && !job && (
        <div className="last-fix">
          <p>
            <strong>{fix.task === 'fix' ? `“${fix.request}”` : 'Check'}</strong> — {fix.summary}
          </p>
          {fix.worldTouched && (
            <p className="warn-box">
              The world changed ({fix.touched.filter(f => !f.startsWith('shots/')).join(', ')}): all {fix.affectedShots.length} shots will re-render.
            </p>
          )}
          {fix.touched.length > 0 && <p className="muted small">Changed: {fix.touched.join(', ')}</p>}
          {fix.before && fix.after && (
            <div className="before-after">
              {(['before', 'after'] as const).map(k => (
                <div key={k}>
                  <span className="small muted">{k === 'before' ? 'Before' : 'After'}</span>
                  <div className="row">
                    {fix[k]!.map(f => <img key={f} src={fileUrl(f)} alt={k} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Checks({ shot }: { shot: Shot }) {
  if (!shot.checks) return null
  const failed = shot.checks.results.filter(r => !r.pass)
  return (
    <section className="panel">
      <h3>
        Checks {failed.length ? <span className="badge bad">{failed.length} failed</span> : <span className="badge ok">all passed</span>}
        <span className="muted small"> · {new Date(shot.checks.at).toLocaleString()}</span>
      </h3>
      <p className="small">{shot.checks.summary}</p>
      <ul className="checks">
        {shot.checks.results.map(r => (
          <li key={r.rule} className={r.pass ? 'pass' : 'fail'}>
            <span className="dot" /> <code>{r.rule}</code> {r.note}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Tabs({ project, shot, refresh, onTake, current }: {
  project: Project
  shot: Shot
  refresh: () => void
  onTake: (t: Take | null) => void
  current: Take | null
}) {
  const [tab, setTab] = useState<'code' | 'notes' | 'takes'>('code')
  return (
    <section className="panel tabs">
      <div className="segmented">
        <button className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>{relPath(project, shot.code).split('/').at(-1)}</button>
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>notes.md</button>
        <button className={tab === 'takes' ? 'on' : ''} onClick={() => setTab('takes')}>Takes ({shot.takes.length})</button>
      </div>
      {tab === 'code' && <Editor project={project} file={relPath(project, shot.code)} onSaved={refresh} />}
      {tab === 'notes' && <Editor project={project} file={relPath(project, shot.notes)} onSaved={refresh} />}
      {tab === 'takes' && (
        <table className="takes">
          <thead>
            <tr><th>Take</th><th>Mode</th><th>Kind</th><th>When</th><th>Time</th><th /></tr>
          </thead>
          <tbody>
            {[...shot.takes].reverse().map(t => (
              <tr key={t.take} className={current?.take === t.take ? 'on' : ''}>
                <td>{t.take}</td>
                <td>{t.mode}</td>
                <td>{t.kind}</td>
                <td>{new Date(t.at).toLocaleString()}</td>
                <td>{formatSeconds(t.seconds)}</td>
                <td><button className="link" onClick={() => onTake(t)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// A plain text editor for the shot's files; saving changes the shot's
// cache key, so the shot shows as stale until it is rendered again
function Editor({ project, file, onSaved }: { project: Project; file: string; onSaved: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(null)
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
      <div className="row gap">
        <button onClick={save} disabled={!dirty}>{dirty ? 'Save (⌘S)' : 'Saved'}</button>
        <span className="muted small">{file}</span>
      </div>
    </div>
  )
}
