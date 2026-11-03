import { useRef, useState } from 'react'
import { fileUrl, type ProjectSummary } from '../api'
import { t } from '../i18n'
import { formatSeconds, isWide } from '../model'
import { STYLES, styleName } from '../styles'
import { Icon } from './Icon'

// The examples as a gallery: a poster each (the picture first, the title
// small under it), explainers or product promos, the explainers filtered
// by visual style. Hovering one plays its opening shot without sound;
// "Use this style" sets the composer's style
export function ExampleGallery({ examples, open, pickStyle }: {
  examples: ProjectSummary[]
  open: (p: ProjectSummary) => void
  pickStyle: (style: string) => void
}) {
  const [promo, setPromo] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const ofKind = examples.filter(p => !!p.promo === promo)
  const styles = promo ? [] : STYLES.filter(s => ofKind.some(p => p.style === s.id))
  const shown = filter ? ofKind.filter(p => p.style === filter) : ofKind
  const showKind = (on: boolean) => {
    setPromo(on)
    setFilter(null)
  }
  return (
    <section className="examples gallery-section">
      <div className="gallery-head">
        <div className="gallery-title">
          <span className="section-label">{t('home.examples')} <span className="muted small examples-note">{t('example.note')}</span></span>
          <div className="gallery-kinds segmented" role="tablist" aria-label={t('home.aria.kind')}>
            {([false, true] as const).map(on => (
              <button key={String(on)} role="tab" aria-selected={promo === on} className={promo === on ? 'on' : ''} onClick={() => showKind(on)}>
                {t(on ? 'home.kind.promo' : 'home.kind.explainer')}
              </button>
            ))}
          </div>
        </div>
        {styles.length > 1 && <div className="gallery-filters" role="tablist" aria-label={t('style.label')}>
          <button role="tab" aria-selected={!filter} className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter(null)}>{t('gallery.all')}</button>
          {styles.map(s => (
            <button key={s.id} role="tab" aria-selected={filter === s.id} className={`chip${filter === s.id ? ' on' : ''}`} onClick={() => setFilter(s.id)}>
              {styleName(s.id)}
            </button>
          ))}
        </div>}
      </div>
      {shown.length
        ? (
          <div className={`gallery${promo ? ' wide' : ''}`}>
            {shown.map(p => <Poster key={p.root} p={p} open={() => open(p)} pickStyle={pickStyle} />)}
          </div>
        )
        : <p className="muted small gallery-empty">{t('gallery.none')}</p>}
    </section>
  )
}

function Poster({ p, open, pickStyle }: { p: ProjectSummary; open: () => void; pickStyle: (style: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const wide = isWide(p.size)
  // A promo's look is the product's own, not a style to pick
  const style = p.promo ? t('home.kind.promo') : p.style && styleName(p.style)
  const enter = () => {
    const v = video.current
    if (!v) return
    v.currentTime = 0
    // Refused (the poster left before it loaded): the poster stays, which is all hover promises
    v.play().then(() => setPlaying(true), () => setPlaying(false))
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
        {(style || p.voice) && (
          <span className="poster-tags">
            {style && <span className="poster-tag">{style}</span>}
            {p.voice && <span className="poster-tag" title={t('gallery.voiceHint')}><Icon name="mic" size={11} /> {t('gallery.voice')}</span>}
          </span>
        )}
        <span className="poster-time">{formatSeconds(p.duration)}</span>
      </button>
      {p.style && !p.promo && (
        <button className="poster-use" onClick={() => pickStyle(p.style!)}>
          <Icon name="spark" size={12} /> {t('gallery.pickStyle')}
        </button>
      )}
      </div>
      <span className="poster-title">{p.title}</span>
    </div>
  )
}
