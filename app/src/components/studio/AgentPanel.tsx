import { useEffect, useRef, useState } from 'react'
import { api, fileUrl, type FixRecord, type Job, type Project, type Shot } from '../../api'
import { Icon } from '../Icon'

// Plain-language fixes as a conversation with the agent, per shot
// (docs/PRD.md §7.5, §7.6): what the person said, what the agent changed,
// before/after stills and the checks, then the composer.
const SUGGESTIONS = [
  'The subject is too small to read',
  'Something is hidden behind a prop',
  'Keep the subject out of the caption zone',
  'Nothing moves in this shot'
]

export function AgentPanel({ project, shot, jobs }: { project: Project; shot: Shot; jobs: Job[] }) {
  const [request, setRequest] = useState('')
  const thread = useRef<HTMLDivElement>(null)
  const mine = jobs.filter(j => j.project === project.root && j.shot === shot.id && j.lane === 'agent')
  const active = mine.find(j => j.state === 'running' || j.state === 'queued') ?? null
  // Failures are not in the shot's fix records: show the latest one here
  const lastDone = shot.fixes.at(-1)?.at ? Date.parse(shot.fixes.at(-1)!.at!) : 0
  const failed = mine.filter(j => j.state === 'failed' && (j.finishedAt ?? 0) > lastDone).at(-1) ?? null

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [shot.fixes.length, active?.log.length, failed?.id])

  const send = (text = request) => {
    if (!text.trim() || active) return
    api.enqueue({ kind: 'fix', project: project.root, shot: shot.id, request: text.trim() })
    setRequest('')
  }
  const check = () => api.enqueue({ kind: 'check', project: project.root, shot: shot.id })

  return (
    <aside className="agent">
      <div className="agent-head">
        <span className="agent-avatar" aria-hidden><Icon name="spark" size={14} /></span>
        <div>
          <strong>Agent</strong>
          <span className="muted small"> · {shot.id}</span>
        </div>
        <div className="spacer" />
        <button className="small" onClick={check} disabled={!!active} title="Render stills, review them against the checklist, fix what it can">
          <Icon name="check" size={13} /> Run checks
        </button>
      </div>

      <div className="thread" ref={thread}>
        {shot.fixes.length === 0 && !active && !failed && (
          <div className="thread-empty">
            <p>Say what is wrong with this shot in plain words. The agent edits only this shot (or the world, and says so), renders stills and checks them before you look.</p>
          </div>
        )}
        {shot.fixes.map((f, i) => <Exchange key={i} fix={f} />)}
        {active && (
          <>
            <div className="bubble me">{active.kind === 'check' ? 'Run checks' : active.label.replace(/^Fix [^:]+: /, '')}</div>
            <div className="bubble agent working">
              <span className="status"><span className="spinner small" /> {active.state === 'queued' ? 'Queued' : 'Working'}</span>
              {active.log.slice(-5).map((l, i) => <div key={i} className="log-line">{l}</div>)}
            </div>
          </>
        )}
        {failed && !active && (
          <div className="bubble agent failed">
            <span className="status">Couldn’t finish</span>
            <div className="small">{failed.error}</div>
          </div>
        )}
      </div>

      {shot.fixes.length === 0 && !active && (
        <div className="suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} className="suggestion" onClick={() => setRequest(s)}>
              <Icon name="spark" size={12} /> {s}
            </button>
          ))}
        </div>
      )}

      <div className="agent-composer">
        <textarea
          value={request}
          rows={3}
          placeholder={`What’s wrong with ${shot.id}?`}
          onChange={e => setRequest(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="composer-bar">
          <span className="chip static"><Icon name="film" size={12} /> {shot.id}</span>
          <div className="spacer" />
          <button className="send" onClick={() => send()} disabled={!request.trim() || !!active} aria-label="Send to the agent">
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Exchange({ fix }: { fix: FixRecord }) {
  const own = fix.checks.find(c => c.shot === fix.shot)
  const failed = own?.results.filter(r => !r.pass) ?? []
  return (
    <>
      <div className="bubble me">
        {fix.task === 'fix' ? fix.request : 'Run checks'}
        {fix.at && <span className="time">{new Date(fix.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="bubble agent">
        <p>{fix.summary}</p>
        {fix.worldTouched && (
          <p className="world-note">
            Changed the world ({fix.touched.filter(f => !f.startsWith('shots/')).join(', ')}): all {fix.affectedShots.length} shots re-render.
          </p>
        )}
        {fix.touched.length > 0 && (
          <div className="files">{fix.touched.map(f => <code key={f}>{f}</code>)}</div>
        )}
        {fix.before && fix.after && (
          <div className="ba">
            {(['before', 'after'] as const).map(k => (
              <div key={k}>
                <span className="small muted">{k === 'before' ? 'Before' : 'After'}</span>
                <div className="ba-row">{fix[k]!.map(f => <img key={f} src={fileUrl(f)} alt={k} onClick={() => api.openPath(f)} />)}</div>
              </div>
            ))}
          </div>
        )}
        {own && (
          <span className={`check-pill ${failed.length ? 'bad' : 'ok'}`}>
            <Icon name={failed.length ? 'x' : 'check'} size={12} />
            {failed.length ? `${failed.length} check${failed.length > 1 ? 's' : ''} left: ${failed.map(r => r.rule).join(', ')}` : 'All checks pass'}
          </span>
        )}
      </div>
    </>
  )
}
