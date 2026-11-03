import { useEffect, useMemo, useState } from 'react'
import { api, isBroken, type AiStep, type ProjectSummary } from '../api'
import { formatDate, t } from '../i18n'
import type { Key } from '../i18n/en'
import { formatSeconds } from '../model'
import { listRecent } from '../recent'
import { ErrorText } from './ErrorDialog'
import { Icon } from './Icon'

// The AI's usage, project by project, as the agent records each step
// (agent/src/ledger.ts): what each task and step took in tokens, cost and
// time, so the costly steps show and can be made cheaper

interface Book { project: ProjectSummary; steps: AiStep[]; error: string | null }

// Every token a step moved: fresh input, cache reads and writes, output
const tokens = (s: AiStep) => s.input + s.cacheRead + s.cacheWrite + s.output
const sum = (steps: AiStep[], f: (s: AiStep) => number) => steps.reduce((n, s) => n + f(s), 0)
// A cost only when some step has one (a backend may report none)
const costOf = (steps: AiStep[]) => (steps.some(s => s.cost != null) ? sum(steps, s => s.cost ?? 0) : null)

const count = (n: number) => (n < 1000 ? String(Math.round(n)) : n < 1e6 ? `${(n / 1000).toFixed(n < 1e4 ? 1 : 0)}k` : `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M`)
const money = (c: number | null) => (c == null ? '–' : `$${c.toFixed(c < 1 ? 3 : 2)}`)
// Steps by a key, in the order the keys first appear
function groupBy(steps: AiStep[], key: (s: AiStep) => string): [string, AiStep[]][] {
  const out = new Map<string, AiStep[]>()
  for (const s of steps) out.set(key(s), [...(out.get(key(s)) ?? []), s])
  return [...out]
}
const kindName = (kind: string) => t(`usage.step.${kind}` as Key)
const stepName = (s: AiStep) => [kindName(s.step.kind), s.step.shot, s.step.name].filter(Boolean).join(' · ')

export function UsagePage({ open }: { open: (path: string) => void }) {
  const [books, setBooks] = useState<Book[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    listRecent().then(
      list => Promise.all(list.filter((p): p is ProjectSummary => !isBroken(p)).map(project =>
        api.projectUsage(project.root).then(
          steps => ({ project, steps, error: null }),
          e => ({ project, steps: [], error: String(e) })
        ))),
      e => {
        setError(String(e))
        return [] as Book[]
      }
    ).then(all => {
      const kept = all.filter(b => b.steps.length || b.error).sort((a, b) => sum(b.steps, tokens) - sum(a.steps, tokens))
      setBooks(kept)
      setSelected(kept[0]?.project.root ?? null)
    })
  }, [])

  const all = useMemo(() => books?.flatMap(b => b.steps) ?? [], [books])
  const book = books?.find(b => b.project.root === selected) ?? null

  return (
    <div className="usage-page">
      <h1>{t('usage.title')}</h1>
      <p className="muted small">{t('usage.note')}</p>
      <ErrorText error={error} as="div" className="error-box small" />
      {books === null && <p className="muted"><span className="spinner small" /></p>}
      {books?.length === 0 && <p className="usage-empty muted">{t('usage.empty')}</p>}
      {!!books?.length && (
        <>
          <Totals steps={all} />
          <table className="usage-table usage-projects">
            <thead>
              <tr>
                <th>{t('usage.project')}</th><th>{t('usage.runs')}</th><th>{t('usage.tokens')}</th>
                <th>{t('usage.cost')}</th><th>{t('usage.time')}</th><th>{t('usage.last')}</th>
              </tr>
            </thead>
            <tbody>
              {books.map(b => (
                <tr key={b.project.root} className={b.project.root === selected ? 'on' : ''} onClick={() => setSelected(b.project.root)}>
                  <td className="ellipsis" title={b.project.root}>{b.project.title}</td>
                  <td>{new Set(b.steps.map(s => s.run)).size}</td>
                  <td>{count(sum(b.steps, tokens))}</td>
                  <td>{money(costOf(b.steps))}</td>
                  <td>{formatSeconds(sum(b.steps, s => s.ms) / 1000)}</td>
                  <td>{b.error ? <span className="error">{b.error}</span> : b.steps.length ? formatDate(b.steps.at(-1)!.at, { dateStyle: 'medium', timeStyle: 'short' }) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {book && book.steps.length > 0 && <ProjectUsage book={book} open={open} />}
        </>
      )}
    </div>
  )
}

// The headline numbers of everything recorded
function Totals({ steps }: { steps: AiStep[] }) {
  const thinking = sum(steps, s => s.thinking)
  return (
    <div className="usage-totals">
      <div><span>{t('usage.tokens')}</span><strong>{count(sum(steps, tokens))}</strong></div>
      <div>
        <span>{t('usage.col.output')}</span><strong>{count(sum(steps, s => s.output))}</strong>
        {thinking > 0 && <small>{t('usage.thinking', { n: count(thinking) })}</small>}
      </div>
      <div><span>{t('usage.cost')}</span><strong>{money(costOf(steps))}</strong></div>
      <div><span>{t('usage.time')}</span><strong>{formatSeconds(sum(steps, s => s.ms) / 1000)}</strong></div>
    </div>
  )
}

// A project: its steps by kind (what one of each costs on average, the
// numbers to make smaller), then each run of a task, newest first
function ProjectUsage({ book, open }: { book: Book; open: (path: string) => void }) {
  const { steps, project } = book
  const total = sum(steps, tokens) || 1
  const kinds = groupBy(steps, s => s.step.kind).sort((a, b) => sum(b[1], tokens) - sum(a[1], tokens))
  const runs = groupBy(steps, s => s.run).reverse()
  return (
    <section className="usage-project">
      <div className="row between">
        <h2 className="ellipsis">{project.title}</h2>
        <button className="small" onClick={() => open(project.root)}>{t('usage.open')} <Icon name="arrow" size={12} /></button>
      </div>
      <h3>{t('usage.byStep')}</h3>
      <table className="usage-table">
        <thead>
          <tr>
            <th>{t('usage.col.step')}</th><th>{t('usage.col.count')}</th><th>{t('usage.col.avg')}</th>
            <th>{t('usage.col.avgOutput')}</th><th>{t('usage.col.avgTime')}</th><th className="usage-share">{t('usage.col.total')}</th>
          </tr>
        </thead>
        <tbody>
          {kinds.map(([kind, list]) => {
            const n = list.length
            const thinking = sum(list, s => s.thinking)
            return (
              <tr key={kind}>
                <td>{kindName(kind)}</td>
                <td>{n}</td>
                <td>{count(sum(list, tokens) / n)}</td>
                <td>{count(sum(list, s => s.output) / n)}{thinking > 0 && <small className="muted"> · {t('usage.thinking', { n: count(thinking / n) })}</small>}</td>
                <td>{formatSeconds(sum(list, s => s.ms) / 1000 / n)}</td>
                <td className="usage-share"><Share part={sum(list, tokens)} of={total} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <h3>{t('usage.history')}</h3>
      {runs.map(([run, list]) => <Run key={run} steps={list} />)}
    </section>
  )
}

// One run of a task: when, what it took, and every step of it
function Run({ steps }: { steps: AiStep[] }) {
  const most = Math.max(...steps.map(tokens), 1)
  return (
    <details className="usage-run" open>
      <summary>
        <strong>{kindName(steps[0].task)}</strong>
        <span className="muted">{formatDate(steps[0].run, { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span className="spacer" />
        <span>{count(sum(steps, tokens))}</span>
        <span className="muted">{money(costOf(steps))}</span>
        <span className="muted">{formatSeconds(sum(steps, s => s.ms) / 1000)}</span>
      </summary>
      <div className="usage-scroll">
        <table className="usage-table">
          <thead>
            <tr>
              <th>{t('usage.col.step')}</th><th>{t('usage.col.model')}</th><th>{t('usage.col.input')}</th><th>{t('usage.col.cacheRead')}</th>
              <th>{t('usage.col.cacheWrite')}</th><th>{t('usage.col.output')}</th><th>{t('usage.cost')}</th><th>{t('usage.time')}</th>
              <th>{t('usage.col.turns')}</th><th className="usage-share">{t('usage.tokens')}</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i} className={s.ok ? '' : 'failed'}>
                <td className="ellipsis" title={stepName(s)}>{stepName(s)}{!s.ok && <span className="tag danger">{t('usage.failed')}</span>}</td>
                <td className="muted ellipsis" title={`${s.backend}${s.effort ? ` · ${s.effort}` : ''}`}>{s.model ?? s.backend}{s.effort ? ` · ${s.effort}` : ''}</td>
                <td>{count(s.input)}</td>
                <td>{count(s.cacheRead)}</td>
                <td>{count(s.cacheWrite)}</td>
                <td>{count(s.output)}{s.thinking > 0 && <small className="muted"> · {t('usage.thinking', { n: count(s.thinking) })}</small>}</td>
                <td>{money(s.cost)}</td>
                <td>{formatSeconds(s.ms / 1000)}</td>
                <td>{s.turns || '–'}</td>
                <td className="usage-share"><Share part={tokens(s)} of={most} label={count(tokens(s))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// A bar of part of a whole, with its number
function Share({ part, of, label }: { part: number; of: number; label?: string }) {
  return (
    <span className="usage-bar">
      <i style={{ width: `${Math.max(1, (part / of) * 100)}%` }} />
      <b>{label ?? `${Math.round((part / of) * 100)}%`}</b>
    </span>
  )
}
