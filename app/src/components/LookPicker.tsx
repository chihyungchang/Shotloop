import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { LOOKS, lookAbout, lookById, lookName } from '../looks'
import { Icon } from './Icon'
import { LookSwatch } from './LookSwatch'

// A look in miniature: its background, a headline in its text color with
// a word in the accent, and a bar of each accent
export function LookPreview({ id }: { id: string }) {
  const l = lookById(id)
  if (!l) return null
  return (
    <span className="look-preview" style={{ background: l.bg }} aria-hidden>
      <i style={{ background: l.text, width: '70%' }} />
      <i style={{ background: l.accent, width: '45%' }} />
      <b style={{ background: l.accent, height: '34%' }} />
      <b style={{ background: l.accent2, height: '58%' }} />
    </span>
  )
}

// The look for a new 2D video: a chip that opens a menu of looks with
// previews; '' lets the AI pick
export function LookPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
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
        {value ? <LookSwatch id={value} /> : <Icon name="spark" size={13} />}
        <span>{value ? lookName(value) : t('look.label')}</span>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="menu look-menu" role="menu">
          <button role="menuitemradio" aria-checked={!value} className={`look-option${!value ? ' on' : ''}`} onClick={() => pick('')}>
            <span className="look-preview auto"><Icon name="spark" size={16} /></span>
            <span className="look-words"><strong>{t('look.autoName')}</strong><span>{t('look.autoAbout')}</span></span>
            {!value && <Icon name="check" size={14} />}
          </button>
          {LOOKS.map(l => (
            <button key={l.id} role="menuitemradio" aria-checked={value === l.id} className={`look-option${value === l.id ? ' on' : ''}`} onClick={() => pick(l.id)}>
              <LookPreview id={l.id} />
              <span className="look-words"><strong>{lookName(l.id)}</strong><span>{lookAbout(l.id)}</span></span>
              {value === l.id && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
