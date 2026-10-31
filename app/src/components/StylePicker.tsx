import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { STYLES, styleAbout, styleById, styleName } from '../styles'
import { Icon } from './Icon'
import { Tile, useMenuInView } from './LookPicker'

// The visual style for a new 2D video (engine/shotloop/styles.mjs): a chip
// that opens a grid of styles, each a frame of the example that defines it
// (the picture first, what it suits on hover); '' lets the AI pick
export function StylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useMenuInView(menu, open)
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
  const current = styleById(value)
  return (
    <div className="look-picker" ref={ref}>
      <button className={`chip-button${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title={t('style.label')}>
        {current ? <img className="style-swatch" src={current.still} alt="" /> : <Icon name="spark" size={13} />}
        <span>{current ? styleName(current.id) : t('style.label')}</span>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="menu tile-menu style-menu" role="menu" ref={menu}>
          <Tile on={!value} name={t('style.autoName')} title={t('style.autoAbout')} onClick={() => pick('')} mosaic={STYLES.map(s => s.still)} />
          {STYLES.filter(s => s.track === '2d').map(s => (
            <Tile key={s.id} on={value === s.id} name={styleName(s.id)} image={s.still} title={styleAbout(s.id)} onClick={() => pick(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
