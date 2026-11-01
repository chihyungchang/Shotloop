import { useRef, useState } from 'react'
import { useDismiss } from '../hooks'
import { t } from '../i18n'
import { STYLES, styleAbout, styleName, styleStill } from '../styles'
import { Icon } from './Icon'
import { Tile, useMenuInView } from './LookPicker'

// The visual style for a new 2D video (engine/shotloop/data.mjs): a chip
// that opens a grid of styles, each a frame of the example that defines it
// (the picture first, what it suits on hover); '' lets the AI pick
export function StylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useMenuInView(menu, open)
  useDismiss(ref, open, () => setOpen(false))
  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }
  const still = value ? styleStill(value) : null
  return (
    <div className="look-picker" ref={ref}>
      <button className={`chip-button${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title={t('style.label')}>
        {still ? <img className="style-swatch" src={still} alt="" /> : <Icon name="spark" size={13} />}
        <span>{value ? styleName(value) : t('style.label')}</span>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="menu tile-menu style-menu" role="menu" ref={menu}>
          <Tile on={!value} name={t('style.autoName')} title={t('style.autoAbout')} onClick={() => pick('')} mosaic={STYLES.map(s => styleStill(s.id))} />
          {STYLES.filter(s => s.track === '2d').map(s => (
            <Tile key={s.id} on={value === s.id} name={styleName(s.id)} image={styleStill(s.id)} title={styleAbout(s.id)} onClick={() => pick(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
