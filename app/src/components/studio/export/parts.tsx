import { open as pick } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SAMPLES, MUSIC_MOODS } from '../../../../../engine/shotloop/data.mjs'
import { api, type Job, type MusicInfo, type Project, type VoiceInfo } from '../../../api'
import { useAudioPreview, useAutosave, useErrorLine } from '../../../hooks'
import { activityLine, isActive, secondsPerFrame3d } from '../../../model'
import { t } from '../../../i18n'
import type { Key } from '../../../i18n/en'
import { AgentError } from '../../AgentError'
import { Icon } from '../../Icon'
import { VoiceDownload } from '../../VoiceDownload'

// The export dialog's parts that keep their own state: the voice-over,
// the music bed, 3D final quality and the publish copy

// The voice-over: off or on, and which voice, with a sample to listen to.
// A new voice speaks every line again and the shots are fitted to it
// (the engine does that with the change), so it can take a moment. A
// model not on this Mac yet downloads first (a queue job with a bar), and
// the change waiting for it is made when it lands
export function Voice({ project, jobs, refresh }: { project: Project; jobs: Job[]; refresh: () => void }) {
  const [info, setInfo] = useState<VoiceInfo | null>(null)
  const [pending, setPending] = useState<Parameters<typeof api.voice>[1] | null>(null)
  const [busy, setBusy] = useState(false)
  const { error, setError, guard } = useErrorLine()
  useEffect(() => {
    guard(api.voice(project.root)).then(v => v && setInfo(v))
  }, [project.root, guard])
  const sample = useAudioPreview(useCallback(() => api.voice(project.root, { sample: true }).then(r => r.sample), [project.root]), setError)

  // current: the info to judge by (the fresh one when a download lands)
  const change = async (c: Parameters<typeof api.voice>[1], current = info) => {
    sample.stop()
    // Speaking needs the model: turning on or a new voice waits for it;
    // turning off never does
    if ((c?.on || c?.voice) && current?.model && !current.model.installed) {
      setPending(c)
      if ((await guard(api.enqueue({ kind: 'voiceModel', model: current.model.id }))) == null) setPending(null)
      return
    }
    setBusy(true)
    const next = await guard(api.voice(project.root, c))
    if (next) {
      setInfo(next)
      refresh()
    }
    setBusy(false)
  }

  const landed = async () => {
    const next = await guard(api.voice(project.root))
    if (!next) return
    setInfo(next)
    if (pending) {
      setPending(null)
      if (next.model?.installed) change(pending, next)
    }
  }

  if (!info) return error ? <p className="xrow-note">{error}</p> : null
  const missing = !!info.model && !info.model.installed
  return (
    <>
      <div className="xrow">
        <span className="xrow-label">{t('voice.title')}</span>
        <div className="chips">
          <div className="seg" role="radiogroup" aria-label={t('voice.title')}>
            <button role="radio" aria-checked={!info.on} className={!info.on ? 'on' : ''} disabled={busy} onClick={() => info.on && change({ on: false })}>{t('voice.off')}</button>
            <button role="radio" aria-checked={info.on} className={info.on ? 'on' : ''} disabled={busy || !info.available} onClick={() => !info.on && change({ on: true })}>{t('voice.on')}</button>
          </div>
          {busy && <span className="muted voice-busy"><span className="spinner small" /> {t('voice.fitting')}</span>}
        </div>
      </div>
      {!info.available && <p className="xrow-note">{t('voice.unavailable')}</p>}
      {/* The voice isn't on this Mac yet: shown when it is needed (on, or
          turning on), with its download */}
      {info.model && missing && (info.on || pending) && (
        <div className="xrow">
          <span className="xrow-label">{t('voiceDl.model')}</span>
          <VoiceDownload model={info.model} jobs={jobs} onDone={landed} />
        </div>
      )}
      {info.on && info.available && (
        <div className="xrow">
          <span className="xrow-label">{t('voice.voice')}</span>
          <div className="vol">
            <select value={info.voice ?? ''} disabled={busy || missing} aria-label={t('voice.voice')} onChange={e => change({ voice: e.currentTarget.value })}>
              {info.voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <Listen preview={sample} disabled={busy || missing} />
          </div>
        </div>
      )}
      {(error || (info.on && info.available && !info.lines)) && (
        <p className="xrow-note">{error ?? t('voice.noLines')}</p>
      )}
    </>
  )
}

function Listen({ preview, disabled }: { preview: ReturnType<typeof useAudioPreview>; disabled?: boolean }) {
  const { playing, toggle } = preview
  return (
    <button className="link listen" disabled={disabled} onClick={toggle}>
      {playing === 'loading' ? <span className="spinner small" /> : <Icon name={playing ? 'pause' : 'play'} size={11} />} {t(playing ? 'music.stop' : 'music.listen')}
    </button>
  )
}

// A mood the engine composes a bed in (data.mjs MUSIC_MOODS), in words
const isMood = (preset: string | undefined) => !!preset && MUSIC_MOODS.includes(preset)

// The music bed: none, a preset or the person's file, its volume, and a
// listen button (the bed is made for the film's length, then played)
export function Music({ project, refresh }: { project: Project; refresh: () => void }) {
  const [music, setMusic] = useState<MusicInfo | null>(null)
  const { error, setError, guard } = useErrorLine()
  useEffect(() => {
    guard(api.music(project.root)).then(m => m && setMusic(m))
  }, [project.root, guard])
  const bed = useAudioPreview(useCallback(() => api.music(project.root, { bed: true }).then(r => r.bed), [project.root]), setError)

  const change = async (c: Parameters<typeof api.music>[1]) => {
    const wasPlaying = bed.playing === 'on'
    bed.stop()
    const next = await guard(api.music(project.root, c))
    if (!next) return
    setMusic(next)
    refresh()
    // Picking another track while listening plays the new one
    if (wasPlaying && !c?.none) bed.play()
  }
  const chooseFile = async () => {
    const file = await pick({ title: t('music.dialog'), filters: [{ name: t('filter.audio'), extensions: ['mp3', 'wav', 'm4a', 'aac', 'aiff', 'flac'] }] })
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
            {MUSIC_MOODS.map(p => {
              const on = music?.kind === 'preset' && music.preset === p
              return <button key={p} role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => !on && change({ preset: p })}>{t(`music.${p}` as Key)}</button>
            })}
            {music?.kind === 'preset' && !isMood(music.preset) && (
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
            <Listen preview={bed} />
            {/* A preset is a mood: each pick is composed anew; this asks for another */}
            {music.kind === 'preset' && isMood(music.preset) && (
              <button className="link listen" onClick={() => change({ shuffle: true })} title={t('music.shuffleHint')}>
                <Icon name="refresh" size={11} /> {t('music.shuffle')}
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="xrow-note error">{error}</p>}
    </>
  )
}

interface Post { id: string; name: string; title?: string; description?: string; tags?: string[]; pinned?: string; label?: string }

// The publish copy (publish.json), read again whenever its job changes
// state; null while there is none
export function usePublishCopy(project: Project, job: Job | undefined) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => {
    api.readText(project.root, 'publish.json').then(text => JSON.parse(text).platforms ?? null).then(
      setPosts,
      // Not written yet (the usual case) or unreadable: no copy, and the
      // page offers to write it
      () => setPosts(null)
    )
  }, [project.root, job?.state])
  return [posts, setPosts] as const
}

// The publish copy's job (the latest), and the way to write it again
function usePublishJob(project: Project, jobs: Job[]) {
  const job = jobs.filter(j => j.kind === 'publish').at(-1)
  const { error, guard } = useErrorLine()
  const write = () => guard(api.enqueue({ kind: 'publish', project: project.root }))
  return { job, busy: !!job && isActive(job), error, write }
}

// The publish copy in the export settings: written or not, its
// platforms and how it starts, with the way to write it now or edit it
export function CopySummary({ project, jobs, edit, openSettings }: { project: Project; jobs: Job[]; edit: () => void; openSettings: () => void }) {
  const { job, busy, error, write } = usePublishJob(project, jobs)
  const [posts] = usePublishCopy(project, job)
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
      <AgentError job={job} openSettings={openSettings} />
      {error && <div className="error-box small">{error}</div>}
      <div className="chips">
        {posts && <button className="small" onClick={edit} disabled={busy}><Icon name="edit" size={12} /> {t('xd.editCopy')}</button>}
        {!posts && (
          <button className="small" onClick={write} disabled={busy}>
            {busy ? <span className="spinner small" /> : <Icon name="spark" size={12} />} {t(busy ? 'export.writing' : 'export.write')}
          </button>
        )}
      </div>
    </div>
  )
}

// A platform's tab: its short name (the post's name is the full one)
const PLATFORM_TABS: Record<string, Key> = { youtube: 'pub.tab.youtube', tiktok: 'pub.tab.tiktok', reels: 'pub.tab.reels' }

// The publish copy: per platform, its title, description, tags and
// pinned comment as fields, each with its own Copy; edits are saved
// bare: no heading of its own (the dialog's title names it)
export function Publish({ project, jobs, openSettings, bare }: { project: Project; jobs: Job[]; openSettings: () => void; bare?: boolean }) {
  const { job, busy, error, write } = usePublishJob(project, jobs)
  const [posts, setPosts] = usePublishCopy(project, job)
  const [tab, setTab] = useState(0)
  const autosave = useAutosave((next: Post[]) => api.writeText(project.root, 'publish.json', JSON.stringify({ platforms: next }, null, 2) + '\n'))
  const edit = (i: number, patch: Partial<Post>) => {
    if (!posts) return
    const next = posts.map((p, k) => (k === i ? { ...p, ...patch } : p))
    setPosts(next)
    autosave.save(next)
  }
  const post = posts?.[Math.min(tab, (posts?.length ?? 1) - 1)]
  const i = posts && post ? posts.indexOf(post) : 0
  // YouTube takes tags as words; the others as hashtags in the caption
  const tagText = (p: Post) => (p.id === 'youtube' ? (p.tags ?? []).join(', ') : (p.tags ?? []).map(x => `#${x.replace(/^#/, '').replace(/\s+/g, '')}`).join(' '))

  return (
    <section className="publish-section">
      <div className="row between">
        {bare ? <span /> : <h3>{t('export.publish')}</h3>}
        <button className="small" onClick={write} disabled={busy}>
          {busy ? <span className="spinner small" /> : <Icon name="spark" size={12} />} {t(busy ? 'export.writing' : posts ? 'export.rewrite' : 'export.write')}
        </button>
      </div>
      {!posts && !busy && <p className="hint">{t('export.publishNote')}</p>}
      <AgentError job={job} openSettings={openSettings} />
      {error && <div className="error-box small">{error}</div>}
      {autosave.status.state === 'failed' && <div className="error-box small">{t('common.notSaved', { error: autosave.status.error })}</div>}
      {posts && post && (
        <div className="publish-form">
          <div className="subtabs" role="tablist">
            {posts.map((p, k) => (
              <button key={p.id} role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={() => setTab(k)} title={p.name}>
                {PLATFORM_TABS[p.id] ? t(PLATFORM_TABS[p.id]) : p.name}
              </button>
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
  const [copied, setCopied] = useState<boolean | 'failed'>(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // The clipboard refused (no permission): the button says so, the text is there to select
      setCopied('failed')
    }
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="pub-field">
      <div className="row between">
        <span className="small muted">{label}</span>
        <button className="small ghost" onClick={copy}>
          <Icon name={copied === true ? 'check' : 'copy'} size={12} /> {t(copied === true ? 'export.copied' : copied === 'failed' ? 'export.copyFailed' : 'export.copy')}
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
  { n: DEFAULT_SAMPLES, label: 'samples.standard' },
  { n: 64, label: 'samples.fine' }
] as const

// 3D final quality, for those who want it: EEVEE samples per frame. More
// cleans up glossy reflections and fast motion, at more time a frame
export function Samples({ project, refresh }: { project: Project; refresh: () => void }) {
  const current = project.samples ?? DEFAULT_SAMPLES
  const preset = SAMPLE_PRESETS.some(p => p.n === current)
  const [custom, setCustom] = useState(!preset)
  const [draft, setDraft] = useState(String(current))
  const { error, guard } = useErrorLine()
  const set = async (change: { samples?: number; reset?: boolean }) => {
    const r = await guard(api.quality(project.root, change))
    if (!r) return setDraft(String(current))
    setDraft(String(r.samples))
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
        <span className="small muted">{t('samples.perFrame', { s: secondsPerFrame3d(current).toFixed(1) })}</span>
      </div>
      <div className="music-chips">
        {SAMPLE_PRESETS.map(p => (
          <button key={p.n} className={`provider-chip${!custom && current === p.n ? ' on' : ''}`}
            onClick={() => { setCustom(false); setDraft(String(p.n)); set(p.n === DEFAULT_SAMPLES ? { reset: true } : { samples: p.n }) }}>
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
      {error && <p className="small error">{error}</p>}
    </div>
  )
}
