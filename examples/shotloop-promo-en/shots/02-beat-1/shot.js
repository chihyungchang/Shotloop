// 02-beat-1: 01 — The problem. One shot is wrong, so all seven render again.
import { load, depth, frame, chapter, headline, source, row } from '../../world/screens.js'

export const setup = () => load()

const N = 7
const WRONG = 3           // tile 4, zero-based
const MARK_AT = 1.3       // the wrong shot is outlined
const SWEEP_AT = 2.0      // the re-render starts
const SWEEP_STEP = 0.22   // each tile begins a little after the last
const SWEEP_D = 1.25      // one tile's sweep
const SWEEP_END = SWEEP_AT + (N - 1) * SWEEP_STEP + SWEEP_D

const clamp01 = (x) => Math.max(0, Math.min(1, x))

export default function render(t, { window }) {
  const f = frame()

  // The row keeps the picture box; its chips sit just under it, clear of
  // the source line's band.
  const box = { x: f.picture.x, y: f.picture.y + 6, w: f.picture.w, h: 452 }

  // Each tile lands in a wave, tile 4 is marked wrong, then every one of
  // them dims and runs its sweep in turn.
  const state = (i) => {
    const p = clamp01((t - (SWEEP_AT + i * SWEEP_STEP)) / SWEEP_D)
    const marked = i === WRONG && t >= MARK_AT
    return {
      p: 1,
      kind: p > 0 ? 'render' : (marked ? 'wrong' : ''),
      chip: marked ? 'TOO STILL' : (p > 0 ? 'RENDERING' : ''),
      mark: marked ? clamp01((t - MARK_AT) / 0.35) : 0,
      sweep: p,
      dim: p > 0 ? 0.35 : 0,
    }
  }

  const tiles = Array.from({ length: N }, (_, i) => ({ label: `SHOT ${String(i + 1).padStart(2, '0')}` }))

  depth(
    chapter(t, { number: 1, title: 'The problem', name: 'Shotloop', at: -0.35 }),
    headline(t, {
      lines: ['One shot wrong', 'All 7 render'],
      x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size, at: -0.25, step: 0.08,
    }),
    tally(t, f),
    row(t, { tiles, box, at: -0.5, state, aspect: 9 / 16 }),
    source(t, {
      text: 'Shotloop, docs/PRD.md: feedback was nearly always about one shot, but each check rendered the whole film (~8 min draft, ~1 h final)',
      y: f.source.y, at: 0.45,
    }),
  )
  window.kit.stage('')
}

// The count under the headline: it rolls 0 → 7 as the sweeps run and
// turns red on the last one, with the cost the headline leaves out.
function tally(t, f) {
  const p = clamp01((t - SWEEP_AT) / (SWEEP_END - SWEEP_AT))
  const n = Math.round(p * N)
  const red = n >= N
  const o = clamp01((t - SWEEP_AT + 0.3) / 0.4)
  const y = f.words.under + 60
  const note = clamp01((t - SWEEP_AT - 0.5) / 0.5)
  return `<div style="position:absolute;left:${f.words.x}px;top:${y}px;width:${f.words.width}px;opacity:${o.toFixed(3)}">
    <div style="height:1px;background:rgba(10,10,10,.22)"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:14px;
      font:600 13px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;
      color:rgba(10,10,10,.55);text-transform:uppercase">
      <span>shots render again</span>
      <span style="font-size:46px;font-weight:700;letter-spacing:0;color:${red ? '#c0362c' : '#0a0a0a'}">${n} / ${N}</span>
    </div>
    <div style="margin-top:16px;font:500 13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
      letter-spacing:.06em;color:rgba(10,10,10,.5);opacity:${note.toFixed(3)}">whole film re-renders · ~8 min draft</div>
  </div>`
}
