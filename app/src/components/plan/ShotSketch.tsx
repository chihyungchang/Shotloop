import { useLayoutEffect, useRef } from 'react'
import { lookById } from '../../looks'

// A shot before it has stills: a frame in the project's look (its
// background, text and accent) with the shot's number and on-screen
// text, and a dashed area where its picture will be, so a storyboard
// reads as frames rather than forms. 3D and
// looks-less projects get a neutral frame.
export function ShotSketch({ look, text, n, total, wide = false, faint = false }: {
  look: string | null | undefined
  text: string
  n: number
  total: number
  wide?: boolean
  faint?: boolean
}) {
  const l = lookById(look)
  const style = l
    ? { background: l.bg, color: l.text, '--sk-accent': l.accent, '--sk-accent2': l.accent2 } as React.CSSProperties
    : undefined
  return (
    <span className={`sketch${wide ? ' wide' : ''}${l ? '' : ' neutral'}${faint ? ' faint' : ''}`} style={style} aria-hidden>
      <i className="sketch-progress" style={{ width: `${(n / Math.max(1, total)) * 100}%` }} />
      {/* A placeholder (no text yet) doesn't know the shot count */}
      <span className="sketch-kicker">{String(n).padStart(2, '0')}{text.trim() ? ` / ${String(total).padStart(2, '0')}` : ''}</span>
      <span className="sketch-text">{text.trim() || '…'}</span>
      <span className="sketch-art" />
    </span>
  )
}

// A textarea that grows with its text, so nothing is cut off
export function AutoText({ value, onChange, className, placeholder, minRows = 1, ...rest }: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  minRows?: number
  'aria-label'?: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea ref={ref} rows={minRows} className={`autotext${className ? ` ${className}` : ''}`} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} {...rest} />
  )
}
