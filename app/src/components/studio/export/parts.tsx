import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { agentError } from '../../../ai/errors'
import { api, fileUrl, type Job, type MusicInfo, type Project } from '../../../api'
import { activityLine } from '../../../model'
import { t } from '../../../i18n'
import { Icon } from '../../Icon'

// The export dialog's parts that keep their own state: the music bed,
// 3D final quality and the publish copy

const PRESETS = ['calm', 'bright', 'groove', 'tech'] as const

// The music bed: none, a preset or the person's file, its volume, and a
// listen button (the bed is made for the film's length, then played)
export function Music({ project, refresh }: { project: Project; refresh: () => void }) {
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

  // One choice: none, a preset or a file (a segmented control); then the volume
  return (
    <>
      <div className="xrow">
        <span className="xrow-label">{t('music.title')}</span>
        <div className="chips">
          <div className="seg" role="radiogroup" aria-label={t('music.title')}>
            <button role="radio" aria-checked={music?.kind === 'none'} className={music?.kind === 'none' ? 'on' : ''} onClick={() => change({ none: true })}>{t('music.none')}</button>
            {PRESETS.map(p => {
              const on = music?.kind === 'preset' && music.preset === p
              return <button key={p} role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => !on && change({ preset: p })}>{t(`music.${p}`)}</button>
            })}
            {music?.kind === 'preset' && !PRESETS.includes(music.preset as (typeof PRESETS)[number]) && (
              <button role="radio" aria-checked className="on">{t('music.custom')}</button>
            )}
          </div>
          <button className={`small ${music?.kind === 'file' ? 'on' : 'ghost'} music-file`} onClick={chooseFile} title={music?.name}>
            <Icon name="folder" size={12} /> <span className="ellipsis">{music?.kind === 'file' ? music.name : t('music.file')}</span>
          </button>
        </div>
      </div>
      {music && music.kind !== 'none' && (
        <div className="xrow">
          <span className="xrow-label">{t('music.volume')}</span>
          <div className="vol">
            <input type="range" min={0} max={1.5} step={0.05} defaultValue={music.gain} key={`${music.kind}-${music.preset ?? music.name}`}
              onPointerUp={e => change({ gain: Number(e.currentTarget.value) })}
              onKeyUp={e => change({ gain: Number(e.currentTarget.value) })} aria-label={t('music.volume')} />
            <button className="link listen" onClick={playing ? stop : listen}>
              {playing === 'loading' ? <span className="spinner small" /> : <Icon name={playing ? 'pause' : 'play'} size={11} />} {t(playing ? 'music.stop' : 'music.listen')}
            </button>
            {/* A preset is a mood: each pick is composed anew; this asks for another */}
            {music.kind === 'preset' && PRESETS.includes(music.preset as (typeof PRESETS)[number]) && (
              <button className="link listen" onClick={() => change({ shuffle: true })} title={t('music.shuffleHint')}>
                <Icon name="refresh" size={11} /> {t('music.shuffle')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// The publish copy in the export settings: written or not, its
// platforms and how it starts, with the way to write it now or edit it
export function CopySummary({ project, jobs, edit, openSettings }: { project: Project; jobs: Job[]; edit: () => void; openSettings: () => void }) {
  const job = jobs.filter(j => j.kind === 'publish').at(-1)
  const busy = job?.state === 'running' || job?.state === 'queued'
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => {
    api.readText(project.root, 'publish.json').then(
      text => setPosts(JSON.parse(text).platforms ?? null),
      () => setPosts(null)
    )
  }, [project.root, job?.state])
  const why = job?.state === 'failed' ? agentError(job.error) : null
  const first = posts?.find(p => p.title || p.description)
  return (
    <div className="copy-sum">
      {busy
        ? <span className="small muted copy-status"><span className="spinner small" /> {job!.log.length ? activityLine(job!.log.at(-1)!) : t('export.writing')}</span>
        : posts
          ? (
            <button className="copy-card" onClick={edit}>
              <span className="chips">{posts.map(p => <span key={p.id} className="tag">{p.name}</span>)}</span>
              {first && <span className="copy-snippet">{first.title || first.description}</span>}
            </button>
          )
          : <p className="small muted">{t('export.publishNote')}</p>}
      {why && (
        <div className="error-box small">
          {why.text}
          {why.setup && <button className="small" onClick={openSettings}>{t('agent.openSettings')}</button>}
        </div>
      )}
      <div className="chips">
        {posts && <button className="small" onClick={edit} disabled={busy}><Icon name="edit" size={12} /> {t('xd.editCopy')}</button>}
        {!posts && (
          <button className="small" onClick={() => api.enqueue({ kind: 'publish', project: project.root })} disabled={busy}>
            {busy ? <span className="spinner small" /> : <Icon name="spark" size={12} />} {t(busy ? 'export.writing' : 'export.write')}
          </button>
        )}
      </div>
    </div>
  )
}

interface Post { id: string; name: string; title?: string; description?: string; tags?: string[]; pinned?: string; label?: string }

// The publish copy: per platform, its title, description, tags and
// pinned comment as fields, each with its own Copy; edits are saved
// bare: no heading of its own (the dialog's title names it)
export function Publish({ project, jobs, openSettings, bare }: { project: Project; jobs: Job[]; openSettings: () => void; bare?: boolean }) {
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
        {bare ? <span /> : <h3>{t('export.publish')}</h3>}
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
export function Samples({ project, refresh }: { project: Project; refresh: () => void }) {
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
