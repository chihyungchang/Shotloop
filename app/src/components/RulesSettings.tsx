import { useCallback, useEffect, useState } from 'react'
import { open as pick } from '@tauri-apps/plugin-dialog'
import { api, fileUrl, type Rule, type RuleTool, type RuleTrack, type Rules } from '../api'
import { t } from '../i18n'
import type { Key } from '../i18n/en'
import { useErrorLine } from '../hooks'
import { ruleAbout, ruleName, toolAbout3d, toolStill } from '../rules'
import { Icon } from './Icon'

// Settings → Rules: what every video follows (engine/shotloop/rules.mjs),
// shown for 2D, 3D or both. Fixed rules can only be read; the house taste
// can be reworded, switched off and restored, and the person adds their
// own; the toolbox keeps its built-in tools and takes the person's own,
// each with a picture
export function RulesSettings() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [show, setShow] = useState<RuleTrack>('all')
  const shown = (track: RuleTrack) => show === 'all' || track === 'all' || track === show
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
          {rules.damaged && <p className="error small">{t('rules.damaged', { file: rules.damaged })}</p>}
          <TrackPicker value={show} onChange={setShow} />
          <h4><Icon name="lock" size={13} /> {t('rules.fixed')}</h4>
          <p className="hint">{t('rules.fixedNote')}</p>
          {rules.fixed.filter(r => shown(r.track)).map(r => <FixedRow key={r.id} r={r} />)}
          <h4>{t('rules.taste')}</h4>
          <p className="hint">{t('rules.tasteNote')}</p>
          {rules.taste.filter(r => shown(r.track)).map(r => <TasteRow key={r.id} r={r} run={run} />)}
          <AddRule run={run} track={show} />
          <h4>{t('rules.toolbox')}</h4>
          <p className="hint">{t('rules.toolboxNote')}</p>
          {TOOL_GROUPS.map(([group, label]) => {
            const tools = rules.tools.filter(tool => tool.group === group && (show === 'all' || tool.tracks.includes(show)))
            return tools.length > 0 && (
              <div key={group} className="tool-group">
                <h5>{t(label)}</h5>
                <div className="tool-grid">
                  {tools.map(tool => <ToolCard key={tool.id} tool={tool} show={show} run={run} />)}
                </div>
              </div>
            )
          })}
          <AddTool run={run} track={show} />
        </>
      )}
    </section>
  )
}

type Run = (p: Promise<Rules>) => Promise<boolean>

const TOOL_GROUPS: [RuleTool['group'], Key][] = [['story', 'rules.story'], ['science', 'rules.science'], ['camera', 'rules.camera'], ['mine', 'rules.yours']]

// 2D, 3D or both: what the page shows, and what a new rule or tool is for
function TrackPicker({ value, onChange, both = 'rules.showAll' }: { value: RuleTrack; onChange: (t: RuleTrack) => void; both?: Key }) {
  return (
    <div className="seg-control rule-tracks" role="radiogroup">
      {(['all', '2d', '3d'] as const).map(k => (
        <button key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {k === 'all' ? t(both) : k.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

const trackTag = (track: RuleTrack) => track !== 'all' && <span className="tag">{track.toUpperCase()}</span>

function FixedRow({ r }: { r: Rule }) {
  return (
    <div className="pref-row boxed rule-row">
      <div>
        <p className="rule-name">{ruleName(r.id, r.name)} {trackTag(r.track)}</p>
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
        {own ? <p>{r.rule} {trackTag(r.track)}</p> : <p className="rule-name">{ruleName(r.id, r.name)} {trackTag(r.track)}</p>}
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

// A new rule or tool is for the track the page shows, unless the person
// picks another
function useTrack(shown: RuleTrack) {
  const [track, setTrack] = useState(shown)
  useEffect(() => setTrack(shown), [shown])
  return [track, setTrack] as const
}

function AddRule({ run, track: shown }: { run: Run; track: RuleTrack }) {
  const [draft, setDraft] = useState('')
  const [track, setTrack] = useTrack(shown)
  const [adding, setAdding] = useState(false)
  const add = async () => {
    setAdding(true)
    if (await run(api.addRule(draft, track))) setDraft('')
    setAdding(false)
  }
  return (
    <div className="rule-add">
      <textarea rows={2} value={draft} placeholder={t('rules.placeholder')} onChange={e => setDraft(e.target.value)} />
      <div className="row">
        <TrackPicker value={track} onChange={setTrack} both="rules.trackBoth" />
        <button className="primary" onClick={add} disabled={!draft.trim() || adding}>
          {adding ? <span className="spinner small" /> : <Icon name="plus" size={13} />} {t('rules.add')}
        </button>
      </div>
    </div>
  )
}

function ToolCard({ tool, show, run }: { tool: RuleTool; show: RuleTrack; run: Run }) {
  const image = tool.builtIn ? toolStill(tool.id) : tool.image && fileUrl(tool.image)
  // How a 2D device is staged in 3D, when the page shows 3D
  const about = tool.builtIn ? (show === '3d' && toolAbout3d(tool.id)) || ruleAbout(tool.id) : tool.text
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
        <span className="tool-tracks">{tool.tracks.map(k => <span key={k} className="tag">{k.toUpperCase()}</span>)}</span>
        {about && <span className="tool-about">{about}</span>}
      </figcaption>
    </figure>
  )
}

function AddTool({ run, track: shown }: { run: Run; track: RuleTrack }) {
  const [name, setName] = useState('')
  const [track, setTrack] = useTrack(shown)
  const [text, setText] = useState('')
  const [file, setFile] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const choose = async () => {
    const f = await pick({ title: t('rules.toolImage'), filters: [{ name: t('filter.image'), extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })
    if (typeof f === 'string') setFile(f)
  }
  const add = async () => {
    setAdding(true)
    if (await run(api.addTool(name, text, file, track))) {
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
        <TrackPicker value={track} onChange={setTrack} both="rules.trackBoth" />
        <button onClick={choose}><Icon name="image" size={13} /> {t('rules.toolImage')}</button>
        <span className="muted small tool-file">{file ? file.split('/').pop() : t('rules.toolImageNone')}</span>
        <button className="primary" onClick={add} disabled={!name.trim() || adding}>
          {adding ? <span className="spinner small" /> : <Icon name="plus" size={13} />} {t('rules.add')}
        </button>
      </div>
    </div>
  )
}
