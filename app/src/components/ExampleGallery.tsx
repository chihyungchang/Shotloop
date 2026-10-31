import { useRef, useState } from 'react'
import { fileUrl, type ProjectSummary } from '../api'
import { t } from '../i18n'
import { formatSeconds } from '../model'
import { STYLES, styleName } from '../styles'
import { Icon } from './Icon'

// The examples as a gallery: a tall poster each (the picture first, the
// title small under it), filtered by visual style. Hovering one plays its
// opening shot without sound; "Use this style" sets the composer's style
export function ExampleGallery({ examples, open, pickStyle }: {
  examples: ProjectSummary[]
  open: (p: ProjectSummary) => void
  pickStyle: (style: string) => void
}) {
  const [filter, setFilter] = useState<string | null>(null)
  const styles = STYLES.filter(s => examples.some(p => p.style === s.id))
  const shown = filter ? examples.filter(p => p.style === filter) : examples
  return (
    <section className="examples gallery-section">
      <div className="gallery-head">
        <span className="section-label">{t('home.examples')} <span className="muted small examples-note">{t('example.note')}</span></span>
        <div className="gallery-filters" role="tablist" aria-label={t('style.label')}>
          <button role="tab" aria-selected={!filter} className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter(null)}>{t('gallery.all')}</button>
          {styles.map(s => (
            <button key={s.id} role="tab" aria-selected={filter === s.id} className={`chip${filter === s.id ? ' on' : ''}`} onClick={() => setFilter(s.id)}>
              {styleName(s.id)}
            </button>
          ))}
        </div>
      </div>
      <div className="gallery">
        {shown.map(p => <Poster key={p.root} p={p} open={() => open(p)} pickStyle={pickStyle} />)}
      </div>
    </section>
  )
}

function Poster({ p, open, pickStyle }: { p: ProjectSummary; open: () => void; pickStyle: (style: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const wide = p.size.width > p.size.height
  const enter = () => {
    const v = video.current
    if (!v) return
    v.currentTime = 0
    v.play().then(() => setPlaying(true), () => {})
  }
  const leave = () => {
    video.current?.pause()
    setPlaying(false)
  }
  return (
    <div className="poster-card" onMouseEnter={enter} onMouseLeave={leave}>
      <div className="poster-media">
      <button className={`poster-frame${wide ? ' wide' : ''}`} onClick={open} title={p.description || p.title}>
        {p.poster ? <img src={fileUrl(p.poster)} alt="" /> : <Icon name="film" size={24} />}
        {p.clip && <video ref={video} src={fileUrl(p.clip)} muted loop playsInline preload="none" className={playing ? 'on' : ''} />}
        {p.style && <span className="poster-tag">{styleName(p.style)}</span>}
        <span className="poster-time">{formatSeconds(p.duration)}</span>
      </button>
      {p.style && (
        <button className="poster-use" onClick={() => pickStyle(p.style!)}>
          <Icon name="spark" size={12} /> {t('gallery.pickStyle')}
        </button>
      )}
      </div>
      <span className="poster-title">{p.title}</span>
    </div>
  )
}
