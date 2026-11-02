import { useAudioPreview } from '../hooks'
import { t } from '../i18n'
import { Icon } from './Icon'

// A round button that plays a sound and stops it; file is asked for on
// the first play (a search result's sound is fetched then, a track made)
export function PlayButton({ file, onError, disabled }: { file: () => Promise<string | null | undefined>; onError: (e: string) => void; disabled?: boolean }) {
  const { playing, toggle } = useAudioPreview(file, onError)
  const label = t(playing === 'on' ? 'library.stop' : 'library.listen')
  return (
    <button className={`icon-button play-button${playing === 'on' ? ' on' : ''}`} onClick={toggle} disabled={disabled || playing === 'loading'} title={label} aria-label={label}>
      {playing === 'loading' ? <span className="spinner small" /> : <Icon name={playing === 'on' ? 'pause' : 'play'} size={13} />}
    </button>
  )
}
