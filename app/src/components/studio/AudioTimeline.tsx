import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { api, fileUrl, type Job, type Project, type TimelineResult } from '../../api'
import { releaseTurn, takeTurn, useErrorLine } from '../../hooks'
import { t } from '../../i18n'
import type { Key } from '../../i18n/en'
import { formatSeconds, isActive } from '../../model'
import { Icon } from '../Icon'
import { Ambience, Effects, Music, useSound, Voice } from './export/parts'

type Lane = 'voice' | 'music' | 'ambience' | 'effects'
const LANES: { id: Lane; label: Key }[] = [
  { id: 'voice', label: 'voice.title' },
  { id: 'music', label: 'music.title' },
  { id: 'ambience', label: 'sound.ambience' },
  { id: 'effects', label: 'sound.effects' }
]

// A track's loudness drawn as a mirrored waveform, on the scale all the
// lanes share (top: the loudest moment of any), compressed by a square
// root so a quiet ambience still shows while staying smaller than a voice
function Wave({ peaks, top }: { peaks: number[]; top: number }) {
  const h = (p: number) => Math.max(1.5, Math.sqrt(p / top) * 46)
  const d = peaks.map((p, i) => `${i === 0 ? 'M' : 'L'}${i},${50 - h(p)}`).join('')
    + peaks.map((_, i) => `L${peaks.length - 1 - i},${50 + h(peaks[peaks.length - 1 - i])}`).join('') + 'Z'
  return (
    <svg className="wave" viewBox={`0 0 ${Math.max(1, peaks.length - 1)} 100`} preserveAspectRatio="none" aria-hidden>
      <path d={d} />
    </svg>
  )
}

// The film's sound under its shots, as an editor shows it: a lane per
// track (voice, music as it plays under the voice, ambience, effects) on
// the filmstrip's time, the AI's pass over the whole film in the head, and
// the mix played from wherever the person clicks. A lane's name opens its
// settings; an effect's mark switches it on or off
export function AudioTimeline({ project, jobs, refresh, onSelect }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  onSelect: (shot: string) => void
}) {
  const [open, setOpen] = useState<Lane | null>(null)
  const [narrate, setNarrate] = useState(false)
  const [data, setData] = useState<TimelineResult | null>(null)
  const { error, setError, guard } = useErrorLine()
  // A finished sound pass or voice fit, or a change made here, redraws the
  // lanes and reads the settings again
  const [changes, setChanges] = useState(0)
  const changed = () => {
    setChanges(n => n + 1)
    refresh()
  }
  const ours = jobs.filter(j => (j.kind === 'sound' || j.kind === 'voiceFit') && j.project === project.root)
  const making = ours.some(j => j.kind === 'sound' && isActive(j))
  const stamp = ours.filter(j => !isActive(j)).length + changes
  const sound = useSound(project, changed, stamp)
  useEffect(() => {
    setData(null)
    guard(api.soundTimeline(project.root)).then(d => d && setData(d))
  }, [project.root, project.duration, stamp, guard])

  // Playback: the mix from the playhead, the head following it
  const audio = useRef<HTMLAudioElement | null>(null)
  const [head, setHead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const stop = useRef(() => {
    audio.current?.pause()
    setPlaying(false)
  }).current
  useEffect(() => () => {
    audio.current?.pause()
    releaseTurn(stop)
  }, [stop])
  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function follow() {
      if (audio.current) setHead(audio.current.currentTime)
      frame = requestAnimationFrame(follow)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing])
  // New sound, new mix: what was playing stops
  useEffect(() => {
    stop()
    audio.current = null
  }, [data?.mix, stop])
  const play = async (from = head) => {
    if (!data?.mix) return
    takeTurn(stop)
    if (!audio.current) {
      audio.current = new Audio(fileUrl(data.mix, stamp))
      audio.current.onended = () => {
        setPlaying(false)
        setHead(0)
      }
    }
    audio.current.currentTime = from
    try {
      await audio.current.play()
      setPlaying(true)
    } catch (e) {
      setError(String(e))
    }
  }
  // A click on the lanes: listen from there, with its shot on the stage
  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const at = Math.max(0, Math.min(project.duration, ((e.clientX - box.left) / box.width) * project.duration))
    setHead(at)
    const shot = project.shots.find(s => at >= s.start && at < s.start + s.duration)
    if (shot) onSelect(shot.id)
    play(at)
  }
  const pct = (s: number) => `${(s / project.duration) * 100}%`
  const top = Math.max(0.001, ...[data?.voice?.peaks, data?.music?.peaks, data?.ambience?.peaks, data?.effects.peaks].flatMap(p => p ?? []))

  const body: Record<Lane, ReactNode> = {
    voice: data?.voice
      ? <>
          <Wave peaks={data.voice.peaks} top={top} />
          {/* Each sentence's words, as far as the next one starts */}
          {data.voice.lines.map((l, i, all) => (
            <span key={i} className="lane-word" style={{ left: pct(l.at), width: pct((all[i + 1]?.at ?? project.duration) - l.at) }} title={l.text}>{l.text}</span>
          ))}
        </>
      : <span className="lane-empty">{t('voice.off')}</span>,
    music: data?.music ? <Wave peaks={data.music.peaks} top={top} /> : <span className="lane-empty">{t('music.none')}</span>,
    ambience: data?.ambience
      ? <><Wave peaks={data.ambience.peaks} top={top} /><span className="lane-name">{sound.ambienceName(sound.sound?.ambience)}</span></>
      : <span className="lane-empty">{t('sound.none')}</span>,
    effects: data?.effects.cues.length
      ? <>
          {data.effects.peaks && <Wave peaks={data.effects.peaks} top={top} />}
          {data.effects.cues.map(c => (
            <button key={c.key} className={`lane-mark${c.on ? ' on' : ''}`} style={{ left: pct(c.at) }}
              title={`${formatSeconds(c.at)} · ${sound.fxName(c.sound)}`} aria-pressed={c.on}
              onPointerDown={e => e.stopPropagation()} onClick={() => sound.change({ cue: c.key, on: !c.on })} />
          ))}
        </>
      : <span className="lane-empty">{t('sound.noEffects')}</span>
  }
  const settings: Record<Lane, ReactNode> = {
    voice: <Voice project={project} jobs={jobs} refresh={changed} />,
    music: <Music project={project} refresh={changed} />,
    ambience: <Ambience state={sound} />,
    effects: <Effects state={sound} />
  }

  return (
    <section className="audio" aria-label={t('studio.sound')}>
      <div className="audio-head">
        <span className="lane-label"><strong>{t('studio.sound')}</strong> <span className="muted small">{t('audio.whole')}</span></span>
        <div className="audio-bar">
          <button className="icon-button play-button" onClick={() => (playing ? stop() : play())} disabled={!data?.mix}
            title={t(playing ? 'audio.pause' : 'audio.play')} aria-label={t(playing ? 'audio.pause' : 'audio.play')}>
            <Icon name={playing ? 'pause' : 'play'} size={13} />
          </button>
          <span className="mono small">{t('unit.s', { n: head.toFixed(1) })}</span>
          <span className="small muted ellipsis">{t('audio.hint')}</span>
          <span className="spacer" />
          {!project.voiced && (
            <label className="check-inline" title={t('sound.narrateNote')}>
              <input type="checkbox" checked={narrate} onChange={e => setNarrate(e.target.checked)} disabled={making} /> {t('sound.narrate')}
            </label>
          )}
          <button className="small" onClick={() => guard(api.enqueue({ kind: 'sound', project: project.root, narrate: narrate || undefined }))} disabled={making}>
            {making ? <span className="spinner small" /> : <Icon name="spark" size={12} />} {t(making ? 'sound.running' : 'audio.make')}
          </button>
        </div>
      </div>
      {error && <p className="small error audio-error">{error}</p>}
      {LANES.map(l => (
        <div key={l.id} className={`audio-lane lane-${l.id}`}>
          <button className={`lane-label${open === l.id ? ' on' : ''}`} onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
            <i className="lane-dot" /> {t(l.label)} <Icon name="chevron" size={10} />
          </button>
          <div className="lane-body" onPointerDown={seek}>
            {data ? body[l.id] : <span className="shimmer" />}
            <i className="playhead" style={{ left: pct(head) }} />
          </div>
          {open === l.id && <div className="lane-settings">{settings[l.id]}</div>}
        </div>
      ))}
    </section>
  )
}
