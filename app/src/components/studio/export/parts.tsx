import { open as pick } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { MUSIC_MOODS } from '../../../../../engine/shotloop/data.mjs'
import { api, type Job, type MusicInfo, type Project, type SoundChange, type SoundInfo, type VoiceInfo } from '../../../api'
import { useAudioPreview, useAutosave, useCopy, useErrorLine } from '../../../hooks'
import { activityLine, isActive } from '../../../model'
import { t } from '../../../i18n'
import type { Key } from '../../../i18n/en'
import { AgentError } from '../../AgentError'
import { Icon } from '../../Icon'
import { VoiceDownload } from '../../VoiceDownload'
import { ErrorText } from '../../ErrorDialog'
import { SubtitleLooks } from '../../SubtitleLooks'

// The sound's parts that keep their own state (the voice-over, the music
// bed, the ambience and effects: the studio's sound lanes) and the export
// dialog's (its sound in one line, the publish copy)

// The voice-over's settings, read through the engine (its lane's volume
// and its settings share them)
export function useVoice(project: Project, refresh: () => void, stamp = 0) {
  const [info, setInfo] = useState<VoiceInfo | null>(null)
  const { error, guard } = useErrorLine()
  useEffect(() => {
    guard(api.voice(project.root)).then(v => v && setInfo(v))
  }, [project.root, stamp, guard])
  const setGain = async (gain: number) => {
    const next = await guard(api.voice(project.root, { gain }))
    if (!next) return
    setInfo(next)
    refresh()
  }
  return { info, setInfo, error, setGain }
}
type VoiceState = ReturnType<typeof useVoice>

// The voice-over: off or on, which voice (with a sample to listen to) and
// the subtitles' look.
// Turning it on or a new voice speaks the lines and fits the shots to
// them: a queue job (voiceFit), its progress shown beside the switch; off
// and on again with nothing changed keeps the last fit (fitted). A
// model not on this Mac yet downloads first (a queue job with a bar), and
// the change waiting for it is made when it lands
export function Voice({ project, jobs, refresh, state }: { project: Project; jobs: Job[]; refresh: () => void; state: VoiceState }) {
  const { info, setInfo } = state
  const [pending, setPending] = useState<Parameters<typeof api.voice>[1] | null>(null)
  const [busy, setBusy] = useState(false)
  const { error: failed, setError, guard } = useErrorLine()
  const error = failed ?? state.error
  const sample = useAudioPreview(useCallback(() => api.voice(project.root, { sample: true }).then(r => r.sample), [project.root]), setError)
  const fitting = jobs.find(j => j.kind === 'voiceFit' && j.project === project.root && isActive(j))

  // current: the info to judge by (the fresh one when a download lands)
  const change = async (c: Parameters<typeof api.voice>[1], current = info) => {
    sample.stop()
    // Speaking needs the model: turning on or a new voice waits for it;
    // turning off never does
    if ((c?.on || c?.voice) && current?.model && !current.model.installed) {
      setPending(c)
      if ((await guard(api.enqueue({ kind: 'voiceModel', model: current.model.id, project: project.root }))) == null) setPending(null)
      return
    }
    setBusy(true)
    const next = await guard(api.voice(project.root, c))
    if (next) {
      setInfo(next)
      refresh()
      if (next.on && next.lines && !next.fitted && (c?.on || c?.voice)) await guard(api.enqueue({ kind: 'voiceFit', project: project.root }))
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

  // The model's download finished somewhere else (the queue, the film's
  // or the plan's prompt): read the settings again, so none is offered
  const downloaded = jobs.find(j => j.kind === 'voiceModel' && j.model === info?.model?.id && j.state === 'done')
  useEffect(() => {
    if (downloaded && info?.model && !info.model.installed) landed()
  }, [downloaded?.id])

  if (!info) return error ? <p className="xrow-note">{error}</p> : null
  const missing = !!info.model && !info.model.installed
  return (
    <>
      <div className="xrow">
        <span className="xrow-label">{t('audio.switch')}</span>
        <div className="chips">
          <div className="seg" role="radiogroup" aria-label={t('voice.title')}>
            <button role="radio" aria-checked={!info.on} className={!info.on ? 'on' : ''} disabled={busy || !!fitting} onClick={() => info.on && change({ on: false })}>{t('voice.off')}</button>
            <button role="radio" aria-checked={info.on} className={info.on ? 'on' : ''} disabled={busy || !!fitting || !info.available} onClick={() => !info.on && change({ on: true })}>{t('voice.on')}</button>
          </div>
          {(busy || fitting) && (
            <span className="muted voice-busy">
              <span className="spinner small" /> {t('voice.fitting')}{fitting?.progress?.total ? ` ${fitting.progress.done}/${fitting.progress.total}` : ''}
              {/* Nothing said yet: the model is loading (a minute or two the first time) */}
              {fitting?.state === 'running' && !fitting.progress?.done && ` · ${t('voice.starting')}`}
            </span>
          )}
        </div>
      </div>
      {!info.available && <p className="xrow-note">{t('voice.unavailable')}</p>}
      {/* The voice isn't on this Mac yet: shown when it is needed (on, or
          turning on), with its download */}
      {info.model && missing && (info.on || pending) && (
        <div className="xrow">
          <span className="xrow-label">{t('voiceDl.model')}</span>
          <VoiceDownload model={info.model} project={project.root} jobs={jobs} onDone={landed} />
        </div>
      )}
      {info.on && info.available && (
        <div className="xrow">
          <span className="xrow-label">{t('voice.voice')}</span>
          <div className="vol">
            <select value={info.voice ?? ''} disabled={busy || !!fitting || missing} aria-label={t('voice.voice')} onChange={e => change({ voice: e.currentTarget.value })}>
              {info.voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <Listen preview={sample} disabled={busy || missing} />
          </div>
        </div>
      )}
      {info.on && info.available && (
        <div className="xrow top">
          <span className="xrow-label">{t('subs.look')}</span>
          <SubtitleLooks value={info.subtitles} lang={info.lang} disabled={busy} pick={subtitles => change({ subtitles })} />
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

// The music bed's settings, read and changed through the engine; stamp:
// read again when it changes
export function useMusic(project: Project, refresh: () => void, stamp = 0) {
  const [music, setMusic] = useState<MusicInfo | null>(null)
  const { error, guard } = useErrorLine()
  useEffect(() => {
    guard(api.music(project.root)).then(m => m && setMusic(m))
  }, [project.root, stamp, guard])
  const change = async (c: Parameters<typeof api.music>[1]) => {
    const next = await guard(api.music(project.root, c))
    if (!next) return
    setMusic(next)
    refresh()
  }
  return { music, change, error }
}
type MusicState = ReturnType<typeof useMusic>

// The music bed: none, a preset or the person's file (its volume is in
// its lane's head)
export function Music({ state }: { state: MusicState }) {
  const { music, change, error } = state
  const chooseFile = async () => {
    const file = await pick({ title: t('music.dialog'), filters: [{ name: t('filter.audio'), extensions: ['mp3', 'wav', 'm4a', 'aac', 'aiff', 'flac'] }] })
    if (typeof file === 'string') change({ file })
  }

  return (
    <>
      <div className="xrow">
        <span className="xrow-label">{t('audio.pick')}</span>
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
          {/* A preset is a mood: each pick is composed anew; this asks for another */}
          {music?.kind === 'preset' && isMood(music.preset) && (
            <button className="link listen" onClick={() => change({ shuffle: true })} title={t('music.shuffleHint')}>
              <Icon name="refresh" size={11} /> {t('music.shuffle')}
            </button>
          )}
        </div>
      </div>
      <ErrorText error={error} className="xrow-note error" />
    </>
  )
}

// A track's volume, its value in per cent beside it: live hears it while
// it is dragged, set keeps it when let go; a track with nothing in it has
// none
export function Level({ value, max, set, live, label, disabled }: {
  value: number
  max: number
  set: (v: number) => void
  live: (v: number) => void
  label: string
  disabled?: boolean
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => v !== value && set(v)
  return (
    <>
      <input type="range" min={0} max={max} step={0.05} value={v} disabled={disabled} aria-label={label}
        style={{ '--fill': `${(v / max) * 100}%` } as CSSProperties}
        onChange={e => {
          setV(Number(e.currentTarget.value))
          live(Number(e.currentTarget.value))
        }} onPointerUp={commit} onKeyUp={commit} />
      <span className="mono level-value">{disabled ? '–' : `${Math.round(v * 100)}%`}</span>
    </>
  )
}

// The film's sound in one line, for the export: it is made and changed in
// the studio's sound lanes, which `open` goes back to
export function SoundSummary({ project, open }: { project: Project; open: () => void }) {
  const { sound, error, ambienceName } = useSound(project, () => {})
  const { music } = useMusic(project, () => {})
  const musicName = !music || music.kind === 'none' ? t('music.none')
    : music.kind === 'file' ? music.name ?? '' : isMood(music.preset) ? t(`music.${music.preset}` as Key) : t('music.custom')
  const ambience = ambienceName(sound?.ambience)
  const effects = sound?.cues.length ? t('sound.count', { on: sound.cues.filter(c => c.on).length, n: sound.cues.length }) : t('sound.none')
  return (
    <div className="xrow">
      <span className="xrow-label">{t('studio.sound')}</span>
      <div className="chips">
        <span className="small muted">
          {error ?? `${t('voice.title')} ${t(project.voiced ? 'voice.on' : 'voice.off')} · ${t('music.title')} ${musicName} · ${t('sound.ambience')} ${ambience} · ${t('sound.effects')} ${effects}`}
        </span>
        <button className="link" onClick={open}>{t('sound.adjust')} <Icon name="arrow" size={11} /></button>
      </div>
    </div>
  )
}

// The film's ambience and effects settings (engine/shotloop/sound/sound.mjs),
// read and changed through the engine; stamp: read again when it changes
export function useSound(project: Project, refresh: () => void, stamp = 0) {
  const [sound, setSound] = useState<SoundInfo | null>(null)
  const { error, guard } = useErrorLine()
  useEffect(() => {
    guard(api.sound(project.root)).then(s => s && setSound(s))
  }, [project.root, stamp, guard])
  const change = async (c: SoundChange) => {
    const next = await guard(api.sound(project.root, c))
    if (!next) return
    setSound(next)
    refresh()
  }
  // A synth sound by its word, one from the asset library by its name
  const named = new Map(sound?.library.map(a => [a.id, a.name]) ?? [])
  const fxName = (k: string) => named.get(k) ?? t(`sound.fx.${k}` as Key)
  const ambienceName = (a: string | null | undefined) => (!a ? t('sound.none') : named.get(a) ?? t(`sound.amb.${a}` as Key))
  return { sound, change, error, fxName, ambienceName }
}
type SoundState = ReturnType<typeof useSound>

// The ambience: none, a synth one or a sound from the project's assets
// (its level is in its lane's head)
export function Ambience({ state }: { state: SoundState }) {
  const { sound, change, ambienceName } = state
  if (!sound) return null
  return (
    <>
      <div className="xrow">
        <span className="xrow-label">{t('audio.pick')}</span>
        <div className="seg" role="radiogroup" aria-label={t('sound.ambience')}>
          {['', ...sound.ambiences, ...sound.library.map(a => a.id)].map(a => {
            const on = (sound.ambience ?? '') === a
            const lib = sound.library.some(l => l.id === a)
            return <button key={a || 'none'} role="radio" aria-checked={on} className={`${on ? 'on' : ''}${lib ? ' ellipsis lib' : ''}`} title={ambienceName(a)} onClick={() => !on && change({ ambience: a || 'none' })}>{ambienceName(a)}</button>
          })}
        </div>
      </div>
    </>
  )
}

// The effects: on or off, and every effect of a kind at once (one effect
// is switched on the timeline; their level is in their lane's head)
export function Effects({ state }: { state: SoundState }) {
  const { sound, change, fxName } = state
  if (!sound) return null
  const effects = sound.effects !== false
  const kindOff = (k: string) => !!sound.off?.includes(`kind:${k}`)
  const kinds = [...new Set(sound.cues.map(c => c.sound))]
  return (
    <>
      <div className="xrow">
        <span className="xrow-label">{t('audio.switch')}</span>
        <div className="chips">
          <input type="checkbox" className="switch" checked={effects} onChange={e => change({ effects: e.target.checked })} aria-label={t('sound.effects')} />
          {sound.cues.length
            ? <span className="small muted">{t('sound.count', { on: sound.cues.filter(c => c.on).length, n: sound.cues.length })}</span>
            : <span className="muted small">{t('sound.noEffects')}</span>}
        </div>
      </div>
      {effects && kinds.length > 0 && (
        <div className="xrow">
          <span className="xrow-label">{t('audio.byKind')}</span>
          <div className="chips">
            {kinds.map(k => (
              <button key={k} className={`chip${kindOff(k) ? '' : ' on'}`} aria-pressed={!kindOff(k)} onClick={() => change({ kind: k, on: kindOff(k) })}>
                {fxName(k)} <span className="muted">{sound.cues.filter(c => c.sound === k).length}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
      <ErrorText error={error} as="div" className="error-box small" />
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
      <ErrorText error={error} as="div" className="error-box small" />
      <ErrorText error={autosave.status.state === 'failed' && t('common.notSaved', { error: autosave.status.error })} as="div" className="error-box small" />
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
  const { copied, copy } = useCopy()
  return (
    <div className="pub-field">
      <div className="row between">
        <span className="small muted">{label}</span>
        <button className="small ghost" onClick={() => copy(value)}>
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
