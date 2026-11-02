import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { Icon } from './Icon'

// The button playing now, stopped when another starts: one sound at a time
let playing: (() => void) | null = null

// Plays a sound and stops it; src is asked for its URL on the first play
// (a search result's sound is fetched then), errors go to onError
export function PlayButton({ src, onError }: { src: () => Promise<string>; onError: (e: string) => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const audio = useRef<HTMLAudioElement | null>(null)
  const stop = useRef(() => {
    audio.current?.pause()
    setState('idle')
  }).current
  // A row that leaves (a new search, a removed asset) stops its sound
  useEffect(() => () => {
    audio.current?.pause()
    if (playing === stop) playing = null
  }, [stop])

  const toggle = async () => {
    if (state === 'playing') {
      stop()
      playing = null
      return
    }
    playing?.()
    playing = stop
    setState('loading')
    try {
      if (!audio.current) {
        audio.current = new Audio(await src())
        audio.current.onended = () => setState('idle')
      }
      audio.current.currentTime = 0
      await audio.current.play()
      // Another sound may have started while this one was fetched
      if (playing === stop) setState('playing')
      else audio.current.pause()
    } catch (e) {
      setState('idle')
      onError(String(e))
    }
  }

  const label = t(state === 'playing' ? 'library.stop' : 'library.listen')
  return (
    <button className={`icon-button play-button${state === 'playing' ? ' on' : ''}`} onClick={toggle} disabled={state === 'loading'} title={label} aria-label={label}>
      {state === 'loading' ? <span className="spinner small" /> : <Icon name={state === 'playing' ? 'pause' : 'play'} size={13} />}
    </button>
  )
}
