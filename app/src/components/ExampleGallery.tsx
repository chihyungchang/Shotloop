import { useRef, useState } from 'react'
import { fileUrl, type ProjectSummary } from '../api'
import { t } from '../i18n'
import { formatSeconds, isWide } from '../model'
import { STYLES, styleName } from '../styles'
import { Icon } from './Icon'

// What an example is filed under: its visual style, and for 3D how it is
// drawn ("3D · Blender", "3D · WebGL")
const RENDERER_NAMES = { webgl: 'WebGL', blender: 'Blender' } as const
const kindOf = (p: ProjectSummary) => (p.style === '3d' && p.renderer !== 'page' ? `3d-${p.renderer}` : p.style)
function kindName(kind: string) {
  const [style, renderer] = kind.split('-') as [string, keyof typeof RENDERER_NAMES | undefined]
  return renderer ? `${styleName(style)} · ${RENDERER_NAMES[renderer]}` : styleName(style)
}

// The examples as a gallery: a tall poster each (the picture first, the
// title small under it), filtered by visual style. Hovering one plays its
// opening shot without sound; "Use this style" sets the composer's style
// (for 3D, and how it is drawn)
export function ExampleGallery({ examples, open, pickStyle }: {
  examples: ProjectSummary[]
  open: (p: ProjectSummary) => void
  pickStyle: (style: string, renderer?: ProjectSummary['renderer']) => void
}) {
  const [filter, setFilter] = useState<string | null>(null)
  // In the styles' order, 3D after the 2D ones
  const kinds = STYLES.flatMap(s => [...new Set(examples.filter(p => p.style === s.id).map(kindOf))]).filter((k): k is string => !!k)
  const shown = filter ? examples.filter(p => kindOf(p) === filter) : examples
  return (
    <section className="examples gallery-section">
      <div className="gallery-head">
        <span className="section-label">{t('home.examples')} <span className="muted small examples-note">{t('example.note')}</span></span>
        <div className="gallery-filters" role="tablist" aria-label={t('style.label')}>
          <button role="tab" aria-selected={!filter} className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter(null)}>{t('gallery.all')}</button>
          {kinds.map(k => (
            <button key={k} role="tab" aria-selected={filter === k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>
              {kindName(k)}
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

function Poster({ p, open, pickStyle }: { p: ProjectSummary; open: () => void; pickStyle: (style: string, renderer?: ProjectSummary['renderer']) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const wide = isWide(p.size)
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
        {(p.style || p.voice) && (
          <span className="poster-tags">
            {p.style && <span className="poster-tag">{kindName(kindOf(p)!)}</span>}
            {p.voice && <span className="poster-tag" title={t('gallery.voiceHint')}><Icon name="mic" size={11} /> {t('gallery.voice')}</span>}
          </span>
        )}
        <span className="poster-time">{formatSeconds(p.duration)}</span>
      </button>
      {p.style && (
        <button className="poster-use" onClick={() => pickStyle(p.style!, p.renderer)}>
          <Icon name="spark" size={12} /> {t('gallery.pickStyle')}
        </button>
      )}
      </div>
      <span className="poster-title">{p.title}</span>
    </div>
  )
}
