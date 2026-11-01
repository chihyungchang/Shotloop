import { useLayoutEffect, useState, type RefObject } from 'react'
import type { PickedElement, PickMap } from '../../api'
import { Icon } from '../Icon'
import { t } from '../../i18n'

// The element picker (engine/shotloop/pick.mjs): the person points at a
// thing on one of the shot's three stills, and the fix they ask for is
// about it. The engine maps what is where on the stills once, as picking
// starts; every hover and click is answered from that map. The stage
// outlines the thing, the composer shows it.

// What was picked, and on which still (0 start, 1 middle, 2 end)
export interface Pick {
  element: PickedElement
  still: number
}

// The picker's state, kept by the studio for the selected shot
export interface PickerState {
  picking: boolean
  setPicking: (on: boolean) => void
  pick: Pick | null
  setPick: (pick: Pick | null) => void
}

// The outline around a point of an unnamed canvas drawing, a fraction of
// the frame's width on each side
const SPOT = 0.04

// The frame's rectangle inside a still laid out with object-fit: contain
// (the image's box may be wider or taller)
function frameRect(img: HTMLImageElement) {
  const r = img.getBoundingClientRect()
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return r
  const k = Math.min(r.width / w, r.height / h)
  return new DOMRect(r.left + (r.width - w * k) / 2, r.top + (r.height - h * k) / 2, w * k, h * k)
}

// The still a pointer is over, with the point in fractions of the frame;
// null off every still
export function framePoint(target: EventTarget, clientX: number, clientY: number) {
  const img = (target as Element).closest?.('img[data-still]') as HTMLImageElement | null
  if (!img) return null
  const r = frameRect(img)
  const x = (clientX - r.left) / r.width
  const y = (clientY - r.top) / r.height
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { still: Number(img.dataset.still), x, y }
}

// What the map has at the point of the still; null on the background
export function lookup(map: PickMap, still: number, x: number, y: number): Pick | null {
  const m = map.stills[still]
  const cell = m.cells[Math.min(m.rows - 1, Math.floor(y * m.rows)) * m.cols + Math.min(m.cols - 1, Math.floor(x * m.cols))]
  const target = m.targets[cell]
  if (!target) return null
  const spot = { w: 2 * SPOT, h: (2 * SPOT * map.size.width) / map.size.height }
  const box = target.box ?? { x: x - spot.w / 2, y: y - spot.h / 2, ...spot }
  const point = { x: Math.round(x * map.size.width), y: Math.round(y * map.size.height) }
  return { element: { ...target, box, point, t: m.t }, still }
}

// A box outlined on the still it belongs to: the picked element, or the
// one under the pointer (hover)
export function Highlight({ stage, pick, hover = false }: { stage: RefObject<HTMLDivElement | null>; pick: Pick; hover?: boolean }) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const host = stage.current
    const img = host?.querySelector<HTMLImageElement>(`img[data-still="${pick.still}"]`)
    if (!host || !img) return setBox(null)
    const place = () => {
      const r = frameRect(img)
      const h = host.getBoundingClientRect()
      const b = pick.element.box
      setBox({ left: r.left - h.left + b.x * r.width, top: r.top - h.top + b.y * r.height, width: b.w * r.width, height: b.h * r.height })
    }
    place()
    const seen = new ResizeObserver(place)
    seen.observe(host)
    img.addEventListener('load', place)
    return () => {
      seen.disconnect()
      img.removeEventListener('load', place)
    }
  }, [stage, pick])
  return box && <div className={`pick-box${hover ? ' hover' : ''}`} style={box} />
}

// A short name for the element: its name, else its text, else its tag;
// an unnamed canvas drawing by the point clicked (page CSS px)
const elementLabel = (el: PickedElement) =>
  el.name ?? (el.kind === 'three' ? t('pick.scene') : el.kind === 'canvas' ? `${t('pick.canvas')} (${el.point.x}, ${el.point.y})` : el.text ?? `<${el.tag}>`)

// The element as a chip, with a way to drop it when given
export function ElementChip({ element, onRemove }: { element: PickedElement; onRemove?: () => void }) {
  return (
    <span className="chip static picked" title={element.text ?? element.path}>
      <Icon name="pick" size={12} /> <span className="chip-text">{elementLabel(element)}</span>
      {onRemove && (
        <button className="chip-x" onClick={onRemove} aria-label={t('pick.remove')}>
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  )
}
