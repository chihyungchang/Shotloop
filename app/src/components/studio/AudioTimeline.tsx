import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { api, type Job, type Project, type TimelineResult } from '../../api'
import { releaseTurn, takeTurn, useDismiss, useErrorLine } from '../../hooks'
import { t } from '../../i18n'
import type { Key } from '../../i18n/en'
import { formatSeconds, isActive } from '../../model'
import { Icon } from '../Icon'
import { Ambience, Effects, Level, Music, useMusic, useSound, useVoice, Voice } from './export/parts'
import { useMix } from './mix'
import { SoundDialog } from './SoundDialog'
import type { Follow } from './VideoPlayer'

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
function Wave({ peaks, top, gain }: { peaks: number[]; top: number; gain: number }) {
  const h = (p: number) => Math.max(1.5, Math.min(48, Math.sqrt((p * gain) / top) * 46))
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
// the filmstrip's time, the AI's pass over the whole film in the head
// (asked for in a dialog), and the mix played from wherever the person
// clicks, the picture going with it: the shot under the playhead selected
// and its clip playing along (onFollow). Each lane's head holds its
// volume and, under its name, its settings in a layer beside it, as an
// editor's track header does; an effect's mark switches it on or off
export function AudioTimeline({ project, jobs, refresh, selected, onSelect, onFollow }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  selected: string
  onSelect: (shot: string) => void
  onFollow: (follow: Follow | null) => void
}) {
  const [open, setOpen] = useState<Lane | null>(null)
  const pop = useRef<HTMLDivElement>(null)
  useDismiss(pop, open != null, () => setOpen(null))
  const [asking, setAsking] = useState(false)
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
  const music = useMusic(project, changed, stamp)
  const voice = useVoice(project, changed, stamp)
  // The tracks are read again after a change (only those that changed
  // are made again); the old ones stay drawn meanwhile
  useEffect(() => {
    guard(api.soundTimeline(project.root)).then(d => d && setData(d))
  }, [project.root, project.duration, stamp, guard])

  // Each lane's volume, in its head (one scale, so 100% sits alike); while
  // one is dragged, its value as it moves
  const m = music.music, fx = sound.sound, v = voice.info
  const levels: Record<Lane, { value: number; off: boolean; set: (g: number) => void }> = {
    voice: { value: v?.gain ?? 1, off: !project.voiced, set: voice.setGain },
    music: { value: m?.gain ?? 1, off: !m || m.kind === 'none', set: gain => music.change({ gain }) },
    ambience: { value: fx?.ambienceGain ?? 1, off: !fx?.ambience, set: g => sound.change({ ambienceGain: g }) },
    effects: { value: fx?.effectsGain ?? 1, off: !fx?.cues.length || fx.effects === false, set: g => sound.change({ effectsGain: g }) }
  }

  const [dragging, setDragging] = useState<Partial<Record<Lane, number>>>({})
  const gains = Object.fromEntries(LANES.map(l => [l.id, levels[l.id].off ? 0 : dragging[l.id] ?? levels[l.id].value])) as Record<Lane, number>
  const tracks = LANES.flatMap(l => {
    const file = data?.[l.id]?.file
    return file ? [[l.id, file] as [Lane, string]] : []
  })

  // Playback: the tracks mixed live from the playhead, the head following
  // them and the picture following the head
  const mix = useMix(gains)
  const [head, setHead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const shotAt = (at: number) => project.shots.find(s => at >= s.start && at < s.start + s.duration) ?? project.shots.at(-1)
  // The shot the picture shows, as last told: a new one only at a cut
  const showing = useRef<string | null>(null)
  const follow = (at: number, on: boolean) => {
    const shot = shotAt(at)
    if (!shot) return
    showing.current = shot.id
    onSelect(shot.id)
    onFollow({ at: at - shot.start, playing: on, since: performance.now() })
  }
  // Paused, the picture holds the frame the sound stopped on
  const stopRef = useRef(() => {})
  stopRef.current = () => {
    const at = mix.now()
    mix.stop()
    setPlaying(false)
    if (at != null) follow(at, false)
  }
  const stop = useRef(() => stopRef.current()).current
  useEffect(() => () => {
    releaseTurn(stop)
    onFollow(null)
  }, [stop])
  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function step() {
      const at = mix.now() ?? 0
      // The film's end: back to its start, the picture on its own again
      if (at >= project.duration) {
        mix.stop()
        setPlaying(false)
        setHead(0)
        onFollow(null)
        return
      }
      setHead(at)
      if (shotAt(at)?.id !== showing.current) follow(at, true)
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing, project])
  const play = async (from = head) => {
    if (!tracks.length) return
    takeTurn(stop)
    setHead(from)
    try {
      if (!(await mix.start(tracks, from))) return
      follow(from, true)
      setPlaying(true)
    } catch (e) {
      setError(String(e))
    }
  }
  // A track made again while playing: on from the same moment with it
  const files = tracks.map(([, f]) => f).join()
  useEffect(() => {
    const at = mix.now()
    if (playing && at != null) play(at)
  }, [files])
  // A shot picked in the filmstrip: the playhead goes to its start (and
  // the sound with it, when it plays)
  useEffect(() => {
    if (selected === showing.current) return
    const shot = project.shots.find(s => s.id === selected)
    if (!shot || (head >= shot.start && head < shot.start + shot.duration)) return
    showing.current = shot.id
    if (playing) return void play(shot.start)
    setHead(shot.start)
    // The clip plays on its own again, from its start
    onFollow(null)
  }, [selected])
  // A click on the lanes: listen from there, with its shot on the stage
  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    play(Math.max(0, Math.min(project.duration, ((e.clientX - box.left) / box.width) * project.duration)))
  }
  const pct = (s: number) => `${(s / project.duration) * 100}%`
  const top = Math.max(0.001, ...[data?.voice?.peaks, data?.music?.peaks, data?.ambience?.peaks, data?.effects.peaks].flatMap(p => p ?? []))

  const body: Record<Lane, ReactNode> = {
    voice: data?.voice
      ? <>
          <Wave peaks={data.voice.peaks} top={top} gain={gains.voice} />
          {/* Each sentence's words, as far as the next one starts */}
          {data.voice.lines.map((l, i, all) => (
            <span key={i} className="lane-word" style={{ left: pct(l.at), width: pct((all[i + 1]?.at ?? project.duration) - l.at) }} title={l.text}>{l.text}</span>
          ))}
        </>
      : <span className="lane-empty">{t('voice.off')}</span>,
    music: data?.music ? <Wave peaks={data.music.peaks} top={top} gain={gains.music} /> : <span className="lane-empty">{t('music.none')}</span>,
    ambience: data?.ambience
      ? <><Wave peaks={data.ambience.peaks} top={top} gain={gains.ambience} /><span className="lane-tag">{sound.ambienceName(sound.sound?.ambience)}</span></>
      : <span className="lane-empty">{t('sound.none')}</span>,
    effects: data?.effects.cues.length
      ? <>
          {data.effects.peaks && <Wave peaks={data.effects.peaks} top={top} gain={gains.effects} />}
          {data.effects.cues.map(c => (
            <button key={c.key} className={`lane-mark${c.on ? ' on' : ''}`} style={{ left: pct(c.at) }}
              title={`${formatSeconds(c.at)} · ${sound.fxName(c.sound)}`} aria-pressed={c.on}
              onPointerDown={e => e.stopPropagation()} onClick={() => sound.change({ cue: c.key, on: !c.on })} />
          ))}
        </>
      : <span className="lane-empty">{t('sound.noEffects')}</span>
  }
  const settings: Record<Lane, ReactNode> = {
    voice: <Voice project={project} jobs={jobs} refresh={changed} state={voice} />,
    music: <Music state={music} />,
    ambience: <Ambience state={sound} />,
    effects: <Effects state={sound} />
  }

  return (
    <section className="audio" aria-label={t('studio.sound')}>
      <div className="audio-head">
        <span className="lane-label"><strong>{t('studio.sound')}</strong> <span className="muted small">{t('audio.whole')}</span></span>
        <div className="audio-bar">
          <button className="icon-button play-button" onClick={() => (playing ? stop() : play())} disabled={!tracks.length}
            title={t(playing ? 'audio.pause' : 'audio.play')} aria-label={t(playing ? 'audio.pause' : 'audio.play')}>
            <Icon name={playing ? 'pause' : 'play'} size={13} />
          </button>
          <span className="mono small">{t('unit.s', { n: head.toFixed(1) })}</span>
          <span className="small muted ellipsis">{t('audio.hint')}</span>
          <span className="spacer" />
          <button className="small" onClick={() => setAsking(true)} disabled={making}>
            {making ? <span className="spinner small" /> : <Icon name="spark" size={12} />} {t(making ? 'sound.running' : 'audio.make')}
          </button>
        </div>
      </div>
      {error && <p className="small error audio-error">{error}</p>}
      {LANES.map(l => (
        <div key={l.id} className={`audio-lane lane-${l.id}${open === l.id ? ' on' : ''}`}>
          {/* The track's head: its name (its settings, in a layer beside it) and its volume */}
          <div className="lane-head" ref={open === l.id ? pop : undefined}>
            <button className="lane-name" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
              <i className="lane-dot" /> <span className="ellipsis">{t(l.label)}</span> <Icon name="chevron" size={10} />
            </button>
            <div className="lane-level">
              <Level value={levels[l.id].value} max={1.5} label={`${t(l.label)} · ${t('music.volume')}`} disabled={levels[l.id].off}
                live={v => setDragging(d => ({ ...d, [l.id]: v }))}
                set={async v => {
                  await levels[l.id].set(v)
                  setDragging(({ [l.id]: _, ...rest }) => rest)
                }} />
            </div>
            {open === l.id && (
              <div className="lane-pop" role="dialog" aria-label={t(l.label)}>
                <p className="lane-pop-title"><i className="lane-dot" /> {t(l.label)}</p>
                <p className="lane-about">{t(`audio.about.${l.id}` as Key)}</p>
                {settings[l.id]}
              </div>
            )}
          </div>
          <div className="lane-body" onPointerDown={seek}>
            {data ? body[l.id] : <span className="shimmer" />}
            <i className="playhead" style={{ left: pct(head) }} />
          </div>
        </div>
      ))}
      {asking && <SoundDialog project={project} sound={sound.sound} ambienceName={sound.ambienceName} close={() => setAsking(false)} />}
    </section>
  )
}
