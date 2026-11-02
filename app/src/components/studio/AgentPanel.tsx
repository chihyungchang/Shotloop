import { useEffect, useRef, useState } from 'react'
import { api, type FixRecord, type Job, type PickedElement, type Project, type Shot } from '../../api'
import { useErrorLine } from '../../hooks'
import { isActive } from '../../model'
import { AgentError } from '../AgentError'
import { Icon } from '../Icon'
import { RuleRef } from '../RuleRef'
import { Markdown } from './code'
import { CompareStills } from './CompareStills'
import { ElementChip, type PickerState } from './Picker'
import type { Key } from '../../i18n/en'
import { formatDate, t } from '../../i18n'

// Plain-language fixes as a conversation with the agent, per shot
// (docs/PRD.md §7.5, §7.6): what the person said, the ways the agent
// offers to make it (nothing is edited until one is picked, or the
// person says their own), what it changed, before/after stills and the
// checks, then the composer, where an element picked in the frame
// (Picker.tsx) says what the request is about.
const SUGGESTIONS: Key[] = ['agent.s1', 'agent.s2', 'agent.s3', 'agent.s4']

export function AgentPanel({ project, shot, jobs, openSettings, openRule, picker }: {
  project: Project
  shot: Shot
  jobs: Job[]
  openSettings: () => void
  openRule: (id: string) => void
  picker: PickerState
}) {
  const [request, setRequest] = useState('')
  const thread = useRef<HTMLDivElement>(null)
  const mine = jobs.filter(j => j.project === project.root && j.shot === shot.id && j.lane === 'agent')
  const active = mine.find(isActive) ?? null
  const { error, guard } = useErrorLine()
  // Failures are not in the shot's fix records: show the latest one here
  const lastDone = shot.fixes.at(-1)?.at ? Date.parse(shot.fixes.at(-1)!.at) : 0
  const failed = mine.filter(j => j.state === 'failed' && (j.finishedAt ?? 0) > lastDone).at(-1) ?? null

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [shot.fixes.length, active?.log.length, failed?.id])

  const ask = async (kind: 'propose' | 'fix', text: string, element?: PickedElement | null) => {
    if (!text.trim() || active) return false
    return (await guard(api.enqueue({ kind, project: project.root, shot: shot.id, request: text.trim(), ...(element ? { element } : {}) }))) != null
  }
  // A request first gets ways to make it; kept in the box when it could
  // not be queued, to send again
  const send = async (text = request) => {
    if (!(await ask('propose', text, picker.pick?.element))) return
    setRequest('')
    picker.setPick(null)
    picker.setPicking(false)
  }
  // The way the person picked (or their own) is the fix, with the request
  // and the element it answers
  const choose = (proposal: FixRecord) => (how: string) => ask('fix', `${proposal.request}\n→ ${how}`, proposal.element)
  const check = () => guard(api.enqueue({ kind: 'check', project: project.root, shot: shot.id }))

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
        {/* The last reply can be acted on: a proposal's ways picked, a
            check's failures fixed in one click (a check only reports) */}
        {shot.fixes.map((f, i, all) => {
          const last = i === all.length - 1 && !active
          return <Exchange key={i} fix={f} openRule={openRule} fixFound={last ? text => ask('fix', text) : undefined} choose={last ? choose(f) : undefined} />
        })}
        {active && (
          <>
            <div className="bubble me">
              {active.kind === 'check' ? t('agent.runChecks') : active.request}
              {active.element && <ElementChip element={active.element} />}
            </div>
            <div className="bubble agent working">
              <span className="status"><span className="spinner small" /> {t(active.state === 'queued' ? 'agent.queued' : active.kind === 'propose' ? 'agent.proposing' : 'agent.working')}</span>
              {active.log.slice(-5).map((l, i) => <div key={i} className="log-line">{l}</div>)}
            </div>
          </>
        )}
        {!active && <AgentError job={failed} openSettings={openSettings} className="bubble agent failed" title={t('agent.failed')} />}
        {error && <div className="bubble agent failed"><div className="small">{error}</div></div>}
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
          {picker.pick && <ElementChip element={picker.pick.element} onRemove={() => picker.setPick(null)} />}
          <div className="spacer" />
          <button className={`chip-toggle${picker.picking ? ' on' : ''}`} onClick={() => picker.setPicking(!picker.picking)}
            aria-pressed={picker.picking} aria-label={t('pick.start')} title={t('pick.start')}>
            <Icon name="pick" size={16} />
          </button>
          <button className="send" onClick={() => send()} disabled={!request.trim() || !!active} aria-label={t('agent.send')}>
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Exchange({ fix, openRule, fixFound, choose }: {
  fix: FixRecord
  openRule: (id: string) => void
  fixFound?: (request: string) => void
  // A proposal's way picked (or the person's own), while it is the last reply
  choose?: (how: string) => void
}) {
  const own = fix.checks.find(c => c.shot === fix.shot)
  const failed = own?.results.filter(r => !r.pass) ?? []
  const found = failed.map(r => `- ${r.rule}${r.note ? `: ${r.note}` : ''}`).join('\n')
  return (
    <>
      <div className="bubble me">
        {fix.task === 'check' ? t('agent.runChecks') : fix.request}
        {fix.element && <ElementChip element={fix.element} />}
        {fix.at && <span className="time">{formatDate(fix.at, { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="bubble agent">
        {/* The reply as the AI wrote it: bold, lists and code in Markdown */}
        <Markdown source={fix.summary} />
        {fix.task === 'propose' && !!fix.options?.length && <Options options={fix.options} choose={choose} />}
        {fix.worldTouched && (
          <p className="world-note">
            {t('agent.worldChanged', { files: fix.touched.filter(f => !f.startsWith('shots/')).join(', '), n: fix.affectedShots.length })}
          </p>
        )}
        {fix.touched.length > 0 && (
          <div className="files">{fix.touched.map(f => <code key={f}>{f}</code>)}</div>
        )}
        {/* Before and after only for a fix: a check changes nothing */}
        {fix.task === 'fix' && fix.before && fix.after && <CompareStills before={fix.before} after={fix.after} />}
        {own && !failed.length && (
          <span className="check-pill ok"><Icon name="check" size={12} /> {t('agent.allPass')}</span>
        )}
        {/* What failed, each with the rule it answers to, and the way to
            fix it after a check */}
        {failed.length > 0 && (
          <div className="check-card">
            <span className="check-card-head"><Icon name="x" size={12} /> {t('agent.left', { n: failed.length })}</span>
            {failed.map(r => <RuleRef key={r.rule} id={r.rule} open={openRule} />)}
            {fix.task === 'check' && fixFound && (
              <button className="small fix-found" onClick={() => fixFound(t('agent.fixFoundAsk', { list: found }))}>
                <Icon name="spark" size={12} /> {t('agent.fixFound')}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// A proposal's ways to make the change, the AI's pick first, and the
// person's own: one click (or a line) and that is the fix. An older
// proposal's ways are only shown
function Options({ options, choose }: { options: NonNullable<FixRecord['options']>; choose?: (how: string) => void }) {
  const [own, setOwn] = useState('')
  return (
    <div className="options">
      {options.map((o, i) => (
        <button key={i} className="option" disabled={!choose} onClick={() => choose?.(`${o.title}: ${o.plan}`)}>
          <span className="option-title">{o.title}{i === 0 && <span className="tag">{t('agent.optionPick')}</span>}</span>
          <span className="option-plan">{o.plan}</span>
        </button>
      ))}
      {choose && (
        <form className="option-own" onSubmit={e => {
          e.preventDefault()
          if (own.trim()) choose(own.trim())
        }}>
          <input value={own} onChange={e => setOwn(e.target.value)} placeholder={t('agent.otherWay')} aria-label={t('agent.otherWay')} />
          <button className="small" disabled={!own.trim()}>{t('agent.useThis')}</button>
        </form>
      )}
    </div>
  )
}
