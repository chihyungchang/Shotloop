import { useEffect, useRef, useState } from 'react'
import { api, type FixRecord, type Job, type Project, type Shot } from '../../api'
import { agentError } from '../../ai/errors'
import { Icon } from '../Icon'
import { CompareStills } from './CompareStills'
import type { Key } from '../../i18n/en'
import { formatDate, t } from '../../i18n'

// Plain-language fixes as a conversation with the agent, per shot
// (docs/PRD.md §7.5, §7.6): what the person said, what the agent changed,
// before/after stills and the checks, then the composer.
const SUGGESTIONS: Key[] = ['agent.s1', 'agent.s2', 'agent.s3', 'agent.s4']

export function AgentPanel({ project, shot, jobs, openSettings }: { project: Project; shot: Shot; jobs: Job[]; openSettings: () => void }) {
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
        <span className="agent-avatar" aria-hidden><Icon name="spark" size={15} /></span>
        <div className="agent-name">
          <strong>{t('agent.title')}</strong>
          <span className="muted small ellipsis">{t('agent.subtitle', { shot: shot.id })}</span>
        </div>
        <div className="spacer" />
        <button className="small" onClick={check} disabled={!!active} title={t('agent.runChecksHint')}>
          <Icon name="check" size={13} /> {t('agent.runChecks')}
        </button>
      </div>

      <div className="thread" ref={thread}>
        {shot.fixes.length === 0 && !active && !failed && (
          <div className="thread-empty">
            <p>{t('agent.empty')}</p>
          </div>
        )}
        {shot.fixes.map((f, i) => <Exchange key={i} fix={f} />)}
        {active && (
          <>
            <div className="bubble me">{active.kind === 'check' ? t('agent.runChecks') : active.label.replace(/^Fix [^:]+: /, '')}</div>
            <div className="bubble agent working">
              <span className="status"><span className="spinner small" /> {t(active.state === 'queued' ? 'agent.queued' : 'agent.working')}</span>
              {active.log.slice(-5).map((l, i) => <div key={i} className="log-line">{l}</div>)}
            </div>
          </>
        )}
        {failed && !active && (
          <div className="bubble agent failed">
            <span className="status">{t('agent.failed')}</span>
            <div className="small">{agentError(failed.error).text}</div>
            {agentError(failed.error).setup && <button className="small" onClick={openSettings}><Icon name="settings" size={13} /> {t('agent.openSettings')}</button>}
          </div>
        )}
      </div>

      {shot.fixes.length === 0 && !active && (
        <div className="suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} className="suggestion" onClick={() => setRequest(t(s))}>
              <Icon name="spark" size={12} /> {t(s)}
            </button>
          ))}
        </div>
      )}

      <div className="agent-composer">
        <textarea
          value={request}
          rows={3}
          placeholder={t('agent.placeholder', { shot: shot.id })}
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
          <button className="send" onClick={() => send()} disabled={!request.trim() || !!active} aria-label={t('agent.send')}>
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
        {fix.task === 'fix' ? fix.request : t('agent.runChecks')}
        {fix.at && <span className="time">{formatDate(fix.at, { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="bubble agent">
        <p>{fix.summary}</p>
        {fix.worldTouched && (
          <p className="world-note">
            {t('agent.worldChanged', { files: fix.touched.filter(f => !f.startsWith('shots/')).join(', '), n: fix.affectedShots.length })}
          </p>
        )}
        {fix.touched.length > 0 && (
          <div className="files">{fix.touched.map(f => <code key={f}>{f}</code>)}</div>
        )}
        {fix.before && fix.after && <CompareStills before={fix.before} after={fix.after} />}
        {own && (
          <span className={`check-pill ${failed.length ? 'bad' : 'ok'}`}>
            <Icon name={failed.length ? 'x' : 'check'} size={12} />
            {failed.length ? t('agent.left', { n: failed.length, rules: failed.map(r => r.rule).join(', ') }) : t('agent.allPass')}
          </span>
        )}
      </div>
    </>
  )
}
