import { useEffect, useRef, useState } from 'react'
import { fileUrl } from '../../api'
import { t } from '../../i18n'
import type { Key } from '../../i18n/en'
import { Icon } from '../Icon'

const FRAMES: Key[] = ['stage.start', 'stage.middle', 'stage.end']

// Before and after an agent's change, one frame at a time: the two
// stills stacked, a divider to drag between them, the frame picked below.
// It opens large over the app; ←/→ change the frame there.
export function CompareStills({ before, after }: { before: string[]; after: string[] }) {
  const [frame, setFrame] = useState(1)
  const [large, setLarge] = useState(false)
  return (
    <>
      <Compare before={before} after={after} frame={frame} setFrame={setFrame} expand={() => setLarge(true)} />
      {large && (
        <div className="dialog-backdrop compare-large" onClick={() => setLarge(false)}>
          <div onClick={e => e.stopPropagation()}>
            <Compare before={before} after={after} frame={frame} setFrame={setFrame} close={() => setLarge(false)} />
          </div>
        </div>
      )}
    </>
  )
}

function Compare({ before, after, frame, setFrame, expand, close }: {
  before: string[]
  after: string[]
  frame: number
  setFrame: (i: number) => void
  expand?: () => void
  close?: () => void
}) {
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const n = Math.min(before.length, after.length)

  useEffect(() => {
    if (!close) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') setFrame(Math.max(0, frame - 1))
      if (e.key === 'ArrowRight') setFrame(Math.min(n - 1, frame + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, frame, n, setFrame])

  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect()
    if (r) setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)))
  }

  return (
    <div className={`compare${close ? ' large' : ''}`}>
      <div className="compare-view" ref={box}
        onPointerDown={e => {
          drag.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e.clientX)
        }}
        onPointerMove={e => drag.current && move(e.clientX)}
        onPointerUp={() => (drag.current = false)}>
        <img src={fileUrl(after[frame])} alt={t('agent.after')} draggable={false} />
        <img src={fileUrl(before[frame])} alt={t('agent.before')} draggable={false} className="compare-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span className="compare-line" style={{ left: `${pos}%` }}><i /></span>
        <span className="compare-tag left">{t('agent.before')}</span>
        <span className="compare-tag right">{t('agent.after')}</span>
      </div>
      <div className="compare-bar">
        <div className="seg-control small" role="radiogroup">
          {FRAMES.slice(0, n).map((k, i) => (
            <button key={k} role="radio" aria-checked={frame === i} className={frame === i ? 'on' : ''} onClick={() => setFrame(i)}>{t(k)}</button>
          ))}
        </div>
        {expand && <button className="icon-button" onClick={expand} title={t('compare.expand')} aria-label={t('compare.expand')}><Icon name="image" size={14} /></button>}
        {close && <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" size={14} /></button>}
      </div>
    </div>
  )
}
