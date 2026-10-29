import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { agentError } from '../../ai/errors'
import { api, fileUrl, type ExportResult, type Job, type Mode, type MusicInfo, type Project } from '../../api'
import { estimate, formatSeconds } from '../../model'
import type { Key } from '../../i18n/en'
import { t } from '../../i18n'
import { Icon } from '../Icon'
import { ChangesDialog } from './ChangesDialog'

const ASPECTS: { id: string; label: Key; note: Key }[] = [
  { id: '9:16', label: 'export.portrait', note: 'export.portraitFor' },
  { id: '16:9', label: 'export.landscape', note: 'export.landscapeFor' }
]
const PRESETS = ['calm', 'bright', 'groove', 'tech'] as const

type Prefs = { aspects?: string[] }
const LAST = 'shotloop.export.last'
const readPrefs = (key: string): Prefs | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

// Export (docs/PRD.md §7.9, §7.10): quality, aspects and music, then the
// film from cached shots (only the changed ones re-render); then the
// publish copy, per platform, a field at a time.
export function ExportPanel({ project, jobs, refresh, openSettings }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  openSettings: () => void
}) {
  // The last choices: this project's, else the last export's anywhere
  const prefsKey = `shotloop.export.${project.root}`
  const saved = readPrefs(prefsKey) ?? readPrefs(LAST)
  // Exports are final; the editor's previews are never exported
  const mode: Mode = 'final'
  const [aspects, setAspects] = useState<string[]>(saved?.aspects?.length ? saved.aspects : ['9:16'])
  useEffect(() => {
    try {
      const v = JSON.stringify({ aspects })
      localStorage.setItem(prefsKey, v)
      localStorage.setItem(LAST, v)
    } catch {
      // storage unavailable: the choice lasts while the panel is open
    }
  }, [prefsKey, aspects])
  const [latest, setLatest] = useState<ExportResult | null>(null)
  // How many renders the current export started with, for its progress
  const [batch, setBatch] = useState(0)

  const mine = jobs.filter(j => j.project === project.root)
  const exportJob = mine.filter(j => j.kind === 'export').at(-1)
  const exporting = !!exportJob && (exportJob.state === 'running' || exportJob.state === 'queued')
  const renders = mine.filter(j => j.kind === 'render' && (j.state === 'running' || j.state === 'queued'))
  const rendering = renders.find(j => j.state === 'running')

  useEffect(() => {
    api.readText(project.root, 'out/latest.json').then(t => setLatest(JSON.parse(t)), () => setLatest(null))
  }, [project, exportJob?.state])

  // Shots whose frames for this mode are out of date
  const pending = project.shots.filter(s => s[mode].state !== 'cached')
  const time = pending.reduce((t, s) => t + estimate(project, s, mode), 0)

  // Shots to render first: say which and why, then start
  const [ask, setAsk] = useState(false)
  const run = () => {
    setAsk(false)
    // One job per shot, so the queue shows them one at a time; the export
    // job then only joins the cached clips
    setBatch(pending.length)
    for (const s of pending) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
    api.enqueue({ kind: 'export', project: project.root, mode, aspects })
  }

  // Progress: the shots still to render, then the joining
  const done = Math.max(0, batch - renders.length)
  const step = renders.length
    ? t('export.stepRender', { done: Math.min(done + 1, batch), total: batch })
    : t('export.stepJoin')
  const fraction = renders.length
    ? (done + (rendering?.progress ? rendering.progress.done / Math.max(1, rendering.progress.total) : 0)) / Math.max(1, batch + 1)
    : (batch + (exportJob?.progress ? exportJob.progress.done / Math.max(1, exportJob.progress.total) : 0.3)) / Math.max(1, batch + 1)

  return (
    <div className="export">
      <fieldset disabled={exporting} className="export-options">
        {project.track === '3d' && (
          <section>
            <h3>{t('studio.quality')}</h3>
            <p className="hint">{t('export.final3d')}</p>
            <Samples project={project} refresh={refresh} />
          </section>
        )}

        <section>
          <h3>{t('export.aspects')}</h3>
          <div className="music-chips">
            {ASPECTS.map(a => {
              const on = aspects.includes(a.id)
              return (
                <button key={a.id} className={`provider-chip aspect-chip${on ? ' on' : ''}`} aria-pressed={on} title={t(a.note)}
                  onClick={() => setAspects(on ? aspects.filter(x => x !== a.id) : ['9:16', '16:9'].filter(x => x === a.id || aspects.includes(x)))}>
                  <span className={`aspect-glyph a${a.id.replace(':', '')}`} /> {t(a.label)} <span className="muted">{a.id}</span>
                  {on && <Icon name="check" size={12} />}
                </button>
              )
            })}
          </div>
        </section>

        <Music project={project} refresh={refresh} />
      </fieldset>

      {exporting
        ? (
          <div className="export-progress" role="status">
            <div className="row gap"><span className="spinner small" /> <strong>{t('export.exporting')}</strong></div>
            <span className="small muted">{step}</span>
            <div className="bar"><i style={{ width: `${Math.round(Math.min(0.98, fraction) * 100)}%` }} /></div>
            <span className="small muted">{t('export.keepWorking')}</span>
          </div>
        )
        : (
          <div className="export-go">
            <span className="small muted" title={pending.map(s => s.id).join(', ')}>
              {pending.length ? t('export.need', { n: pending.length, time: formatSeconds(time) }) : t('export.ready')}
            </span>
            <button className="primary wide" onClick={() => (pending.length ? setAsk(true) : run())} disabled={!aspects.length}>
              <Icon name="export" size={14} /> {t('export.button')}
            </button>
          </div>
        )}
      {ask && (
        <ChangesDialog project={project} shots={pending} mode={mode} close={() => setAsk(false)}
          title={t('changes.titleExport', { n: pending.length })} note={t(project.track === '3d' ? 'changes.noteExport3d' : 'changes.noteExport')}
          actions={[
            { label: t('plan.cancel'), onClick: () => setAsk(false) },
            { label: t('changes.export'), onClick: run, primary: true }
          ]} />
      )}
      {exportJob?.state === 'failed' && <pre className="error-box small">{exportJob.error}</pre>}

      {latest && !exporting && (
        <div className="latest">
          <h3>{t('export.latest')} <span className="muted small">{t(`mode.${latest.mode}`)} · {latest.at}</span></h3>
          <div className="latest-files">
            {latest.films.map(f => (
              <div key={f.file} className="latest-file">
                <span className={`aspect-shape small a${f.aspect.replace(':', '')}`} />
                <strong>{f.aspect}</strong>
                <span className="spacer" />
                <button className="small" onClick={() => api.openPath(f.file)}><Icon name="play" size={12} /> {t('export.open')}</button>
                <button className="small ghost" onClick={() => api.reveal(f.file)}>{t('export.show')}</button>
              </div>
            ))}
          </div>
          {latest.cover && (
            <img className="cover" src={fileUrl(latest.cover)} alt={t('export.cover')} onClick={() => api.openPath(latest.cover!)} />
          )}
        </div>
      )}

      <Publish project={project} jobs={mine} openSettings={openSettings} />
    </div>
  )
}

// The music bed: none, a preset or the person's file, its volume, and a
// listen button (the bed is made for the film's length, then played)
function Music({ project, refresh }: { project: Project; refresh: () => void }) {
  const [music, setMusic] = useState<MusicInfo | null>(null)
  const [playing, setPlaying] = useState<'loading' | 'on' | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    api.music(project.root).then(setMusic, () => setMusic(null))
    return () => audio.current?.pause()
  }, [project.root])

  const stop = () => {
    audio.current?.pause()
    setPlaying(null)
  }
  const listen = async () => {
    setPlaying('loading')
    try {
      const r = await api.music(project.root, { bed: true })
      if (!r.bed) return setPlaying(null)
      audio.current?.pause()
      const a = new Audio(fileUrl(r.bed))
      a.onended = () => setPlaying(null)
      audio.current = a
      await a.play()
      setPlaying('on')
    } catch {
      setPlaying(null)
    }
  }
  const change = async (c: Parameters<typeof api.music>[1]) => {
    const wasPlaying = playing === 'on'
    stop()
    setMusic(await api.music(project.root, c))
    refresh()
    // Picking another track while listening plays the new one
    if (wasPlaying && !c?.none) listen()
  }
  const chooseFile = async () => {
    const file = await pick({ title: t('music.dialog'), filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'aiff', 'flac'] }] })
    if (typeof file === 'string') change({ file })
  }

  return (
    <section>
      <div className="row between">
        <h3>{t('music.title')}</h3>
        {music && music.kind !== 'none' && (
          <button className="link listen" onClick={playing ? stop : listen}>
            {playing === 'loading' ? <span className="spinner small" /> : <Icon name={playing ? 'pause' : 'play'} size={11} />} {t(playing ? 'music.stop' : 'music.listen')}
          </button>
        )}
      </div>
      <div className="music-chips">
        <button className={`provider-chip${music?.kind === 'none' ? ' on' : ''}`} onClick={() => change({ none: true })}>{t('music.none')}</button>
        {PRESETS.map(p => (
          <button key={p} className={`provider-chip${music?.kind === 'preset' && music.preset === p ? ' on' : ''}`} onClick={() => change({ preset: p })}>
            {t(`music.${p}`)}
          </button>
        ))}
        {music?.kind === 'preset' && !PRESETS.includes(music.preset as (typeof PRESETS)[number]) && (
          <button className="provider-chip on">{t('music.custom')}</button>
        )}
        <button className={`provider-chip${music?.kind === 'file' ? ' on' : ''}`} onClick={chooseFile} title={music?.name}>
          <Icon name="folder" size={12} /> <span className="ellipsis">{music?.kind === 'file' ? music.name : t('music.file')}</span>
        </button>
      </div>
      {music && music.kind !== 'none' && (
        <label className="volume">
          <Icon name="volume" size={14} />
          <input type="range" min={0} max={1.5} step={0.05} defaultValue={music.gain} key={`${music.kind}-${music.preset ?? music.name}`}
            onPointerUp={e => change({ gain: Number(e.currentTarget.value) })}
            onKeyUp={e => change({ gain: Number(e.currentTarget.value) })} aria-label={t('music.volume')} />
        </label>
      )}
    </section>
  )
}

interface Post { id: string; name: string; title?: string; description?: string; tags?: string[]; pinned?: string; label?: string }

// The publish copy: per platform, its title, description, tags and
// pinned comment as fields, each with its own Copy; edits are saved
function Publish({ project, jobs, openSettings }: { project: Project; jobs: Job[]; openSettings: () => void }) {
  const job = jobs.filter(j => j.kind === 'publish').at(-1)
  const busy = job?.state === 'running' || job?.state === 'queued'
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [tab, setTab] = useState(0)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    api.readText(project.root, 'publish.json').then(
      text => setPosts(JSON.parse(text).platforms ?? null),
      () => setPosts(null)
    )
  }, [project.root, job?.state])
  const edit = (i: number, patch: Partial<Post>) => {
    if (!posts) return
    const next = posts.map((p, k) => (k === i ? { ...p, ...patch } : p))
    setPosts(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => api.writeText(project.root, 'publish.json', JSON.stringify({ platforms: next }, null, 2) + '\n'), 500)
  }
  const post = posts?.[Math.min(tab, (posts?.length ?? 1) - 1)]
  const i = posts && post ? posts.indexOf(post) : 0
  // YouTube takes tags as words; the others as hashtags in the caption
  const tagText = (p: Post) => (p.id === 'youtube' ? (p.tags ?? []).join(', ') : (p.tags ?? []).map(x => `#${x.replace(/^#/, '').replace(/\s+/g, '')}`).join(' '))
  const why = job?.state === 'failed' ? agentError(job.error) : null

  return (
    <section className="publish-section">
      <div className="row between">
        <h3>{t('export.publish')}</h3>
        <button className="small" onClick={() => api.enqueue({ kind: 'publish', project: project.root })} disabled={busy}>
          {busy ? <span className="spinner small" /> : <Icon name="spark" size={12} />} {t(busy ? 'export.writing' : posts ? 'export.rewrite' : 'export.write')}
        </button>
      </div>
      {!posts && !busy && <p className="hint">{t('export.publishNote')}</p>}
      {why && (
        <div className="error-box small">
          {why.text}
          {why.setup && <button className="small" onClick={openSettings}>{t('agent.openSettings')}</button>}
        </div>
      )}
      {posts && post && (
        <div className="publish-form">
          <div className="subtabs" role="tablist">
            {posts.map((p, k) => (
              <button key={p.id} role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={() => setTab(k)} title={p.name}>{p.name.replace(/^Instagram /, '').replace(/ Shorts$/, '')}</button>
            ))}
          </div>
          {post.title != null && post.title !== '' && <Field label={t('pub.title')} value={post.title} onChange={v => edit(i, { title: v })} />}
          <Field label={t('pub.description')} value={post.description ?? ''} rows={5} onChange={v => edit(i, { description: v })} />
          <Field label={t('pub.tags')} value={tagText(post)} copyOnly />
          {post.pinned ? <Field label={t('pub.pinned')} value={post.pinned} rows={2} onChange={v => edit(i, { pinned: v })} /> : null}
          {post.label && <p className="hint"><Icon name="info" size={12} /> {post.label}</p>}
        </div>
      )}
    </section>
  )
}

function Field({ label, value, rows = 1, onChange, copyOnly }: { label: string; value: string; rows?: number; onChange?: (v: string) => void; copyOnly?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="pub-field">
      <div className="row between">
        <span className="small muted">{label}</span>
        <button className="small ghost" onClick={() => {
          navigator.clipboard?.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}>
          <Icon name={copied ? 'check' : 'copy'} size={12} /> {t(copied ? 'export.copied' : 'export.copy')}
        </button>
      </div>
      {copyOnly
        ? <p className="pub-tags">{value}</p>
        : rows > 1
          ? <textarea rows={rows} value={value} onChange={e => onChange?.(e.target.value)} />
          : <input value={value} onChange={e => onChange?.(e.target.value)} />}
    </div>
  )
}

const SAMPLE_PRESETS = [
  { n: 16, label: 'samples.fast' },
  { n: 24, label: 'samples.standard' },
  { n: 64, label: 'samples.fine' }
] as const

// 3D final quality, for those who want it: EEVEE samples per frame. More
// cleans up glossy reflections and fast motion, at more time a frame
function Samples({ project, refresh }: { project: Project; refresh: () => void }) {
  const current = project.samples ?? 24
  const preset = SAMPLE_PRESETS.some(p => p.n === current)
  const [custom, setCustom] = useState(!preset)
  const [draft, setDraft] = useState(String(current))
  const set = async (change: { samples?: number; reset?: boolean }) => {
    await api.quality(project.root, change)
    refresh()
  }
  const commit = () => {
    const n = Math.round(Number(draft))
    if (n >= 4 && n <= 512 && n !== current) set({ samples: n })
    else setDraft(String(current))
  }
  return (
    <div className="samples">
      <div className="row between">
        <span className="small">{t('samples.title')}</span>
        <span className="small muted">{t('samples.perFrame', { s: (0.35 + 0.028 * current).toFixed(1) })}</span>
      </div>
      <div className="music-chips">
        {SAMPLE_PRESETS.map(p => (
          <button key={p.n} className={`provider-chip${!custom && current === p.n ? ' on' : ''}`}
            onClick={() => { setCustom(false); setDraft(String(p.n)); set(p.n === 24 ? { reset: true } : { samples: p.n }) }}>
            {t(p.label)} <span className="muted">{p.n}</span>
          </button>
        ))}
        {custom
          ? (
            <label className="provider-chip on samples-input">
              <input type="number" min={4} max={512} step={1} value={draft} autoFocus aria-label={t('samples.title')}
                onChange={e => setDraft(e.target.value)} onBlur={commit}
                onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
            </label>
          )
          : <button className="provider-chip" onClick={() => setCustom(true)}>{t('samples.custom')}</button>}
      </div>
    </div>
  )
}
