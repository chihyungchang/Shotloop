import type { Storyboard } from '../../api'
import { t } from '../../i18n'
import { Icon } from '../Icon'
import { AutoText } from './ShotSketch'

// The copy half of the plan: the idea, hook, body and facts with their
// sources, edited in place, and the box to ask the AI for a revision
export function CopyEditor({ sb, edit, request, setRequest, revise, again, planning }: {
  sb: Storyboard
  edit: (next: Storyboard) => void
  request: string
  setRequest: (r: string) => void
  revise: () => void
  // Plan again from the idea (after a yes)
  again: () => void
  planning: boolean
}) {
  const copy = (patch: Partial<Storyboard['copy']>) => edit({ ...sb, copy: { ...sb.copy, ...patch } })
  const fact = (i: number, patch: Partial<Storyboard['copy']['facts'][number]>) =>
    copy({ facts: sb.copy.facts.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
  return (
    <section className="plan-copy">
      <div className="plan-head">
        <h3>{t('plan.copy')}</h3>
      </div>
      {sb.copy.idea && <p className="plan-idea"><span className="muted small">{t('plan.idea')}</span>{sb.copy.idea}</p>}
      <label className="field">
        <span>{t('plan.hook')}</span>
        <AutoText className="hook-input" value={sb.copy.hook} onChange={v => copy({ hook: v })} />
      </label>
      <label className="field">
        <span>{t('plan.body')}</span>
        <AutoText minRows={4} value={sb.copy.body} onChange={v => copy({ body: v })} />
      </label>
      <div className="field">
        <span>{t('plan.facts')}</span>
        <ol className="facts">
          {sb.copy.facts.map((f, i) => (
            <li key={i} className="fact">
              <span className="fact-no">{i + 1}</span>
              <div className="fact-body">
                <AutoText value={f.text} placeholder={t('plan.factText')} aria-label={t('plan.factText')} onChange={v => fact(i, { text: v })} />
                <label className="fact-source">
                  <Icon name="link" size={12} />
                  <AutoText value={f.source} placeholder={t('plan.factSource')} aria-label={t('plan.factSource')} onChange={v => fact(i, { source: v })} />
                </label>
              </div>
              <button className="icon-button" aria-label={t('plan.remove')} title={t('plan.remove')} onClick={() => copy({ facts: sb.copy.facts.filter((_, k) => k !== i) })}><Icon name="x" size={13} /></button>
            </li>
          ))}
        </ol>
        <button className="ghost small add" onClick={() => copy({ facts: [...sb.copy.facts, { text: '', source: '' }] })}><Icon name="plus" size={13} /> {t('plan.addFact')}</button>
      </div>
      <div className="plan-ask">
        <textarea rows={2} value={request} placeholder={t('plan.askPlaceholder')} disabled={planning}
          onChange={e => setRequest(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) revise()
          }} />
        <div className="row between">
          <button className="ghost small" onClick={again} disabled={planning}><Icon name="refresh" size={13} /> {t('plan.again')}</button>
          <button className="send" onClick={revise} disabled={planning || !request.trim()} aria-label={t('plan.ask')}>
            {planning ? <span className="spinner small" /> : <Icon name="send" size={16} />}
          </button>
        </div>
        {!planning && <span className="small muted">{t('plan.askHint')}</span>}
      </div>
    </section>
  )
}
