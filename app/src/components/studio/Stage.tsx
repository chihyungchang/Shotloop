import { useEffect, useRef, useState, type KeyboardEvent as KeyEvent, type MouseEvent, type RefObject } from 'react'
import { api, fileUrl, relPath, type Mode, type PickMap, type Project, type Shot, type Take } from '../../api'
import { useErrorLine } from '../../hooks'
import { estimate, formatSeconds, shotTime, stageName, STILL_NAMES, type ShotView } from '../../model'
import { baseName } from '../../recent'
import { CodeArea, Markdown } from './code'
import { framePoint, Highlight, lookup, type Pick, type PickerState } from './Picker'
import { VideoPlayer, type Follow } from './VideoPlayer'
import { Icon } from '../Icon'
import { formatDate, t } from '../../i18n'
import { ErrorText } from '../ErrorDialog'

type Tab = 'preview' | 'stills' | 'code'

// The shot on a dark stage: its clip with captions and music, its three
// stills, or its code (docs/PRD.md §7.4); rendering is the studio's
// "Render changed", or the button here when the shot has no clip yet.
// While picking (on the latest stills), the thing under the pointer is
// outlined and a click picks it; picking goes on until Esc or another tab.
// While the film's sound plays (follow), the clip plays with it
export function Stage({ project, shot, view, mode, refresh, picker, follow }: {
  project: Project
  shot: Shot
  view: ShotView
  mode: Mode
  refresh: () => void
  picker: PickerState
  follow: Follow | null
}) {
  const [tab, setTab] = useState<Tab>(view.clip ? 'preview' : 'stills')
  const [take, setTake] = useState<Take | null>(null)
  const stills = take?.stills ?? view.stills
  const busy = view.state === 'rendering' || view.state === 'queued'
  const clip = take ? take.preview ?? take.clip : view.clip
  const version = take?.take ?? view.take?.take
  const takes = [...shot.takes].reverse()
  const { error, guard } = useErrorLine()
  const stage = useRef<HTMLDivElement>(null)
  // The clip, and the three stills side by side or one above another,
  // whichever shows them bigger on the stage as it is now
  const inner = useInnerSize(stage)
  const aspect = project.size.width / project.size.height
  const clipBox = inner && fitIn(inner.w, inner.h, aspect)
  const across = inner && fitIn((inner.w - 2 * STILL_GAP) / 3, inner.h - CAPTION, aspect)
  const down = inner && fitIn(inner.w, (inner.h - 2 * STILL_GAP) / 3 - CAPTION, aspect)
  const stacked = !!down && !!across && down.width > across.width
  const stillBox = stacked ? down : across
  const picking = picker.picking && tab === 'stills'
  // The pick map of the shot's code as it is now (its cache key), one
  // that could not be made (its key), the thing under the pointer, and a
  // click that found only the background. Stills of older code (stale)
  // aren't what the map describes: they are rendered again first
  const [map, setMap] = useState<{ key: string; map: PickMap } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [hover, setHover] = useState<Pick | null>(null)
  const [nothing, setNothing] = useState(false)
  const ready = !view.stale && map?.key === shot.final.key ? map.map : null
  const mapFailed = failed === shot.final.key
  // Picking shows the latest stills: the map is of the shot's code as it
  // is now
  useEffect(() => {
    if (!picker.picking) return
    setTab('stills')
    setTake(null)
  }, [picker.picking])
  // Leaving the stills ends picking
  const show = (next: Tab) => {
    setTab(next)
    if (next !== 'stills') picker.setPicking(false)
  }
  // The sound playing shows the picture it goes with
  useEffect(() => {
    if (follow?.playing && view.clip) show('preview')
  }, [follow])

  useEffect(() => {
    if (!picking) return
    const cancel = (e: KeyboardEvent) => e.key === 'Escape' && picker.setPicking(false)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('keydown', cancel)
      setHover(null)
      setNothing(false)
      // Picking again tries a failed map again
      setFailed(null)
    }
  }, [picking])

  // The map, made once per version of the shot's code while picking
  useEffect(() => {
    if (!picking || ready || view.stale || mapFailed) return
    const key = shot.final.key
    let left = false
    guard(api.pickMap(project.root, shot.id)).then(m => {
      if (left) return
      if (m) setMap({ key, map: m })
      else setFailed(key)
    })
    return () => void (left = true)
  }, [picking, shot.final.key, view.stale, mapFailed])

  const pickedAt = (e: MouseEvent) => {
    const at = picking && ready ? framePoint(e.target, e.clientX, e.clientY) : null
    return at && lookup(ready!, at.still, at.x, at.y)
  }
  const pickClick = (e: MouseEvent) => {
    if (!picking || !framePoint(e.target, e.clientX, e.clientY)) return
    // The click picks: it doesn't open the still
    e.preventDefault()
    e.stopPropagation()
    if (!ready) return
    const found = pickedAt(e)
    setNothing(!found)
    if (found) picker!.setPick(found)
  }

  const render = (m: Mode, stillsOnly: boolean) =>
    guard(api.enqueue({ kind: 'render', project: project.root, shot: shot.id, mode: m, stills: stillsOnly }))

  return (
    <div className="stage-wrap">
      <div className="stage-bar">
        <div className="segmented">
          <button className={tab === 'preview' ? 'on' : ''} onClick={() => show('preview')}><Icon name="play" size={13} /> {t('stage.preview')}</button>
          <button className={tab === 'stills' ? 'on' : ''} onClick={() => show('stills')}><Icon name="image" size={13} /> {t('stage.stills')}</button>
          <button className={tab === 'code' ? 'on' : ''} onClick={() => show('code')}><Icon name="code" size={13} /> {t('stage.code')}</button>
        </div>
        <span className="stage-shot">
          <strong>{shot.id}</strong> <span className="muted small">{shotTime(shot)}</span>
        </span>
        <div className="spacer" />
        {tab !== 'code' && takes.length > 1 && (
          <select
            className="take-select"
            value={take?.take ?? ''}
            onChange={e => {
              setTake(takes.find(t => t.take === Number(e.target.value)) ?? null)
              picker.setPicking(false)
            }}
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

      <div ref={stage} className={`stage${tab === 'code' ? ' code' : ''}${picking ? ' picking' : ''}`} onClickCapture={pickClick}
        onMouseMove={e => {
          if (!picking) return
          // A new outline only when the pointer reaches another thing
          const next = pickedAt(e)
          setHover(h => (h && next && h.still === next.still && JSON.stringify(h.element.box) === JSON.stringify(next.element.box) ? h : next))
        }} onMouseLeave={() => setHover(null)}>
        <ErrorText error={error} as="div" className="stage-error" />
        {view.state === 'failed' && shot.error && tab !== 'code' && (
          <ErrorText error={t('stage.failed', { mode: t(`mode.${shot.error.mode}`), message: shot.error.message })} as="div" className="stage-error" />
        )}
        {tab === 'preview' && (clip
          ? <VideoPlayer key={clip} src={fileUrl(clip, version)} className="shot" style={clipBox ?? undefined} follow={follow} />
          : <div className="stage-empty">
              <p>{t('stage.noClip', { mode: t(`mode.${mode}`) })}</p>
              <button onClick={() => render(mode, false)}>{t('stage.renderMode', { mode: t(`mode.${mode}`), time: formatSeconds(estimate(project, shot, mode)) })}</button>
            </div>)}
        {tab === 'stills' && (stills
          ? <div className={`stage-stills${stacked ? ' stacked' : ''}`}>
              {STILL_NAMES.map((name, i) => (
                <figure key={name}>
                  <img src={fileUrl(stills[i], version)} alt={t(name)} data-still={i} style={stillBox ?? undefined} onClick={() => guard(api.openPath(stills[i]))} />
                  <figcaption>{view.stale && !take ? t('stage.staleTag', { name: t(name) }) : t(name)}</figcaption>
                </figure>
              ))}
            </div>
          : (
            // Where the three stills will be, with the way to get them
            <div className={`stage-stills placeholder${stacked ? ' stacked' : ''}${busy ? ' busy' : ''}`}>
              {STILL_NAMES.map(name => (
                <figure key={name}>
                  {/* The frame's shape, where the still will be */}
                  <span className="still-ph" style={stillBox ?? undefined} />
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
        {tab === 'stills' && !take && picker.pick && <Highlight stage={stage} pick={picker.pick} />}
        {hover && <Highlight stage={stage} pick={hover} hover />}
        {picking && (
          <div className="stage-pick-note">
            {view.stale ? t('pick.stale') : mapFailed ? t('pick.failed')
              : !ready ? <><span className="spinner small" /> {t('pick.busy')}</> : t(nothing ? 'pick.nothing' : 'pick.hint')}
          </div>
        )}
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
          <button key={f} className={file === f ? 'on' : ''} onClick={() => setFile(f)}>
            <Icon name={f.endsWith('.md') ? 'book' : 'code'} size={13} /> {baseName(f)}
          </button>
        ))}
      </div>
      <Editor
        key={file}
        project={project}
        file={file}
        version={`${shot.fixes.length}-${shot.draft.key}-${shot.final.key}`}
        onSaved={async () => {
          refresh()
          // New code, new stills: the person sees the change right away
          if (file === files[0]) await api.enqueue({ kind: 'render', project: project.root, shot: shot.id, mode, stills: true })
        }}
      />
    </div>
  )
}

// The shot's files: the code coloured and editable in place, the notes
// laid out to read, edited as text on demand. Saving the code changes the
// shot's cache key, so the shot shows as stale until it is rendered again
function Editor({ project, file, version, onSaved }: { project: Project; file: string; version: string; onSaved: () => Promise<unknown> }) {
  const notes = file.endsWith('.md')
  const [editing, setEditing] = useState(!notes)
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
    setError(null)
    try {
      const disk = await api.readText(project.root, file)
      if (!force && disk !== saved) return setClash(disk)
      await api.writeText(project.root, file, text)
      setSaved(text)
      setClash(null)
      if (notes) setEditing(false)
      await onSaved()
    } catch (e) {
      setError(String(e))
    }
  }
  // Not read: nothing to edit. A failed save keeps the edits on screen
  if (error && text == null) return <ErrorText error={error} className="error" />
  if (text == null) return <CodeSkeleton />
  const saveKey = (e: KeyEvent<HTMLTextAreaElement>) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      save()
    }
  }
  return (
    <div className="editor">
      {!notes ? <CodeArea value={text} onChange={setText} onKeyDown={saveKey} />
        : editing ? <textarea className="notes-input" spellCheck={false} value={text} onChange={e => setText(e.target.value)} onKeyDown={saveKey} autoFocus />
          : <div className="notes-read"><Markdown source={text} /></div>}
      {clash != null && (
        <div className="editor-clash small">
          <span>{t('editor.clash')}</span>
          <button className="small ghost" onClick={() => { setText(clash); setSaved(clash); setClash(null) }}>{t('editor.reload')}</button>
          <button className="small" onClick={() => save(true)}>{t('editor.keepMine')}</button>
        </div>
      )}
      <div className="editor-bar">
        {error ? <ErrorText error={error} as="span" className="error small ellipsis" /> : <span className="muted small">{file}</span>}
        {notes && !editing
          ? <button className="small" onClick={() => setEditing(true)}><Icon name="edit" size={13} /> {t('editor.edit')}</button>
          : <div className="editor-actions">
              {notes && <button className="small ghost" onClick={() => { setText(saved); setEditing(false) }}>{t('editor.cancel')}</button>}
              <button className="small" onClick={() => save()} disabled={!dirty}>{dirty ? t('editor.save') : t('common.saved')}</button>
            </div>}
      </div>
    </div>
  )
}

// Between the three stills, and under each its caption (Studio.css)
const STILL_GAP = 14
const CAPTION = 22

// Lines of code in outline while the file loads
function CodeSkeleton() {
  const widths = [38, 72, 64, 0, 55, 81, 47, 69, 0, 33, 76, 58, 42]
  return (
    <div className="editor code-skeleton" aria-busy>
      {widths.map((w, i) => (w ? <span key={i} className="sk-line" style={{ width: `${w}%`, marginLeft: i % 4 === 2 ? 24 : 0 }} /> : <span key={i} className="sk-gap" />))}
    </div>
  )
}

// An element's inner size (inside its padding), measured again whenever
// it changes. The stage sizes its clip and stills from it: sized by a
// percentage alone, WebKit keeps the size a smaller stage first gave them
// and shows them squeezed or small once the stage grows
function useInnerSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      setSize(s => (s?.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref])
  return size
}

// The largest box of an aspect inside w × h
function fitIn(w: number, h: number, aspect: number) {
  const width = Math.max(0, Math.floor(Math.min(w, h * aspect)))
  return { width, height: Math.floor(width / aspect) }
}
