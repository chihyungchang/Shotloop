import { useCallback, useEffect, useState } from 'react'
import { open as pick } from '@tauri-apps/plugin-dialog'
import { api, fileUrl, type Rule, type RuleTool, type Rules } from '../api'
import { t } from '../i18n'
import type { Key } from '../i18n/en'
import { useErrorLine } from '../hooks'
import { ruleAbout, ruleName, toolStill } from '../rules'
import { Icon } from './Icon'

// Settings → Rules: what every 2D video follows (engine/shotloop/rules.mjs).
// Fixed rules can only be read; the house taste can be reworded, switched
// off and restored, and the person adds their own; the toolbox keeps its
// built-in tools and takes the person's own, each with a picture
export function RulesSettings() {
  const [rules, setRules] = useState<Rules | null>(null)
  const { error, guard } = useErrorLine()
  // Every change answers with the rules as they now stand
  const run = useCallback(async (p: Promise<Rules>) => {
    const next = await guard(p)
    if (next) setRules(next)
    return !!next
  }, [guard])
  useEffect(() => { void run(api.rules()) }, [run])

  return (
    <section className="settings-block rules-settings">
      <h3>{t('settings.rules')}</h3>
      <p className="hint">{t('rules.intro')}</p>
      {error && <p className="error small">{error}</p>}
      {!rules ? <p className="muted">{t('common.loading')}</p> : (
        <>
          <h4><Icon name="lock" size={13} /> {t('rules.fixed')}</h4>
          <p className="hint">{t('rules.fixedNote')}</p>
          {rules.fixed.map(r => <FixedRow key={r.id} r={r} />)}
          <h4>{t('rules.taste')}</h4>
          <p className="hint">{t('rules.tasteNote')}</p>
          {rules.taste.map(r => <TasteRow key={r.id} r={r} run={run} />)}
          <AddRule run={run} />
          <h4>{t('rules.toolbox')}</h4>
          <p className="hint">{t('rules.toolboxNote')}</p>
          {TOOL_GROUPS.map(([group, label]) => {
            const tools = rules.tools.filter(tool => tool.group === group)
            return tools.length > 0 && (
              <div key={group} className="tool-group">
                <h5>{t(label)}</h5>
                <div className="tool-grid">
                  {tools.map(tool => <ToolCard key={tool.id} tool={tool} run={run} />)}
                </div>
              </div>
            )
          })}
          <AddTool run={run} />
        </>
      )}
    </section>
  )
}

type Run = (p: Promise<Rules>) => Promise<boolean>

const TOOL_GROUPS: [RuleTool['group'], Key][] = [['story', 'rules.story'], ['science', 'rules.science'], ['mine', 'rules.yours']]

function FixedRow({ r }: { r: Rule }) {
  return (
    <div className="pref-row boxed rule-row">
      <div>
        <p className="rule-name">{ruleName(r.id, r.name)}</p>
        <p className="hint">{ruleAbout(r.id)}</p>
      </div>
    </div>
  )
}

function TasteRow({ r, run }: { r: Rule; run: Run }) {
  const [draft, setDraft] = useState<string | null>(null)
  const own = !r.builtIn
  const save = async () => {
    if (draft != null && (await run(api.editRule(r.id, draft)))) setDraft(null)
  }
  return (
    <div className={`pref-row boxed rule-row${r.off ? ' off' : ''}`}>
      <div>
        {own ? <p>{r.rule}</p> : <p className="rule-name">{ruleName(r.id, r.name)}</p>}
        {!own && (r.edited ? <p className="hint rule-words">{r.rule}</p> : <p className="hint">{ruleAbout(r.id)}</p>)}
        {(own || r.edited || r.off) && (
          <p className="hint">
            {own && <span className="tag">{t('rules.yours')}</span>}
            {r.edited && <span className="tag on">{t('rules.edited')}</span>}
            {r.off && <span className="tag">{t('rules.off')}</span>}
          </p>
        )}
        {draft != null && (
          <div className="rule-edit">
            <label className="hint">{t('rules.aiReads')}</label>
            <textarea rows={4} value={draft} onChange={e => setDraft(e.target.value)} />
            <div className="row">
              <button className="primary" onClick={save} disabled={!draft.trim()}>{t('rules.save')}</button>
              <button onClick={() => setDraft(null)}>{t('rules.cancel')}</button>
            </div>
          </div>
        )}
      </div>
      <div className="rule-actions">
        {!r.off && draft == null && (
          <button className="icon-button" onClick={() => setDraft(r.rule ?? '')} title={t('rules.edit')} aria-label={t('rules.edit')}>
            <Icon name="edit" size={14} />
          </button>
        )}
        {!own && (r.edited || r.off) && (
          <button className="icon-button" onClick={() => run(api.resetRule(r.id))} title={t('rules.restore')} aria-label={t('rules.restore')}>
            <Icon name="refresh" size={14} />
          </button>
        )}
        {!r.off && (
          <button className="icon-button" onClick={() => run(api.removeRule(r.id))} title={t('rules.remove')} aria-label={t('rules.remove')}>
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function AddRule({ run }: { run: Run }) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const add = async () => {
    setAdding(true)
    if (await run(api.addRule(draft))) setDraft('')
    setAdding(false)
  }
  return (
    <div className="memory-add">
      <textarea rows={2} value={draft} placeholder={t('rules.placeholder')} onChange={e => setDraft(e.target.value)} />
      <button className="primary" onClick={add} disabled={!draft.trim() || adding}>
        {adding ? <span className="spinner small" /> : <Icon name="plus" size={13} />} {t('rules.add')}
      </button>
    </div>
  )
}

function ToolCard({ tool, run }: { tool: RuleTool; run: Run }) {
  const image = tool.builtIn ? toolStill(tool.id) : tool.image && fileUrl(tool.image)
  const about = tool.builtIn ? ruleAbout(tool.id) : tool.text
  return (
    <figure className="tool-card">
      <span className="tool-pic">
        {image ? <img src={image} alt="" /> : <Icon name="image" size={20} />}
        {!tool.builtIn && (
          <button className="icon-button tool-remove" onClick={() => run(api.removeTool(tool.id))} title={t('rules.remove')} aria-label={t('rules.remove')}>
            <Icon name="trash" size={13} />
          </button>
        )}
      </span>
      <figcaption>
        <span className="rule-name">{tool.builtIn ? ruleName(tool.id, tool.name) : tool.name}</span>
        {about && <span className="tool-about">{about}</span>}
      </figcaption>
    </figure>
  )
}

function AddTool({ run }: { run: Run }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const choose = async () => {
    const f = await pick({ title: t('rules.toolImage'), filters: [{ name: t('filter.image'), extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })
    if (typeof f === 'string') setFile(f)
  }
  const add = async () => {
    setAdding(true)
    if (await run(api.addTool(name, text, file))) {
      setName('')
      setText('')
      setFile(null)
    }
    setAdding(false)
  }
  return (
    <div className="tool-add">
      <h4>{t('rules.addTool')}</h4>
      <input value={name} placeholder={t('rules.toolName')} onChange={e => setName(e.target.value)} />
      <textarea rows={2} value={text} placeholder={t('rules.toolText')} onChange={e => setText(e.target.value)} />
      <div className="row">
        <button onClick={choose}><Icon name="image" size={13} /> {t('rules.toolImage')}</button>
        <span className="muted small tool-file">{file ? file.split('/').pop() : t('rules.toolImageNone')}</span>
        <button className="primary" onClick={add} disabled={!name.trim() || adding}>
          {adding ? <span className="spinner small" /> : <Icon name="plus" size={13} />} {t('rules.add')}
        </button>
      </div>
    </div>
  )
}
