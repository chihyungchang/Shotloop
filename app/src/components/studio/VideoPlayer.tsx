import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { Icon } from '../Icon'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// A quiet player instead of the system controls: click to play or pause;
// on hover, a thin bar fades in with play, a scrubber and the time (and
// sound, when the clip has it).
export function VideoPlayer({ src, className = '', autoPlay = true, loop = true, muted = true, sound = false }: {
  src: string
  className?: string
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  // Show a mute toggle (the film preview has music; shot clips don't)
  sound?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(autoPlay)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setMuted] = useState(muted)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const sync = () => {
      setTime(v.currentTime)
      setPlaying(!v.paused)
    }
    const meta = () => {
      setDuration(v.duration || 0)
      // Autoplay with sound may be refused: then it waits, paused, with
      // the big play button
      if (autoPlay) v.play().catch(() => setPlaying(false))
    }
    v.addEventListener('timeupdate', sync)
    v.addEventListener('play', sync)
    v.addEventListener('pause', sync)
    v.addEventListener('loadedmetadata', meta)
    return () => {
      v.removeEventListener('timeupdate', sync)
      v.removeEventListener('play', sync)
      v.removeEventListener('pause', sync)
      v.removeEventListener('loadedmetadata', meta)
    }
  }, [src])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }
  const seek = (x: number) => {
    const v = ref.current
    if (v && duration) v.currentTime = Math.min(duration, Math.max(0, x * duration))
  }

  return (
    <div className={`player ${className}`}>
      <video ref={ref} src={src} loop={loop} muted={isMuted} playsInline onClick={toggle} />
      {!playing && (
        <button className="player-big" onClick={toggle} aria-label={t('player.play')}>
          <Icon name="play" size={26} />
        </button>
      )}
      <div className="player-bar" onClick={e => e.stopPropagation()}>
        <button className="player-btn" onClick={toggle} aria-label={t(playing ? 'player.pause' : 'player.play')}>
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        <div
          className="player-track"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={time}
          onPointerDown={e => {
            const el = e.currentTarget
            el.setPointerCapture(e.pointerId)
            const at = (ev: { clientX: number }) => {
              const r = el.getBoundingClientRect()
              seek((ev.clientX - r.left) / r.width)
            }
            at(e)
            el.onpointermove = at
            el.onpointerup = () => {
              el.onpointermove = null
            }
          }}
        >
          <i style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
        </div>
        <span className="player-time">{clock(time)} / {clock(duration)}</span>
        {sound && (
          <button className="player-btn" onClick={() => setMuted(m => !m)} aria-label={t(isMuted ? 'player.unmute' : 'player.mute')}>
            <Icon name={isMuted ? 'muted' : 'volume'} size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
