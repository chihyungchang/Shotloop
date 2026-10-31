import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { LOOKS, lookAbout, lookName, lookPreview } from '../looks'
import { lookFits, styleName } from '../styles'
import { Icon } from './Icon'
import { LookSwatch } from './LookSwatch'

// The look for a new 2D video: a chip that opens a grid of looks, each a
// frame it renders in the chosen style (the picture first, the name small
// under it, what it suits on hover); '' lets the AI pick. Looks a chosen
// style cannot draw with are greyed out
export function LookPicker({ value, onChange, style = '' }: { value: string; onChange: (id: string) => void; style?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }
  return (
    <div className="look-picker" ref={ref}>
      <button className={`chip-button${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title={t('look.label')}>
        {value && lookPreview(value, style) ? <img className="style-swatch" src={lookPreview(value, style)!} alt="" /> : value ? <LookSwatch id={value} /> : <Icon name="spark" size={13} />}
        <span>{value ? lookName(value) : t('look.label')}</span>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="menu tile-menu" role="menu">
          <Tile on={!value} name={t('look.autoName')} title={t('look.autoAbout')} onClick={() => pick('')}
            mosaic={LOOKS.filter(l => lookFits(style, l.id)).slice(0, 4).map(l => lookPreview(l.id, style))} />
          {LOOKS.map(l => {
            const fits = lookFits(style, l.id)
            return (
              <Tile key={l.id} on={value === l.id} name={lookName(l.id)} image={lookPreview(l.id, style)} disabled={!fits}
                title={fits ? lookAbout(l.id) : t('style.lookNo', { name: styleName(style) })} onClick={() => pick(l.id)} />
            )
          })}
        </div>
      )}
    </div>
  )
}

// One choice in a grid: its picture, a check when chosen, the name small
// under it. Auto (the AI picks) shows the choices it picks from, under an
// aurora with the AI's spark
export function Tile({ on, name, image, mosaic, title, disabled, onClick }: {
  on: boolean
  name: string
  image?: string | null
  mosaic?: (string | null)[]
  title?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button role="menuitemradio" aria-checked={on} className={`tile${on ? ' on' : ''}${mosaic ? ' ai' : ''}`} onClick={onClick} disabled={disabled} title={title}>
      <span className="tile-pic">
        {mosaic
          ? (
            <span className="tile-auto">
              <span className="tile-mosaic">{mosaic.slice(0, 4).map((m, i) => (m ? <img key={i} src={m} alt="" /> : <i key={i} />))}</span>
              <span className="tile-aurora" />
              <span className="tile-ai"><Icon name="spark" size={14} /> AI</span>
            </span>
          )
          : image ? <img src={image} alt="" /> : null}
        {on && <span className="tile-check"><Icon name="check" size={11} /></span>}
      </span>
      <span className="tile-name">{name}</span>
    </button>
  )
}
