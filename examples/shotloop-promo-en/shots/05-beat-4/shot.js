// 05-beat-4: 04 — Fix one shot. The pointer clicks a plain-words suggestion in the
// Studio; the answer screen comes up with its Before / After card outlined.
// Shot-local time: t = 0 is this shot's first frame.
import { load, depth, frame, chapter, headline, source, desktop, desktopPoint, act, camera, drift, mark, wipe } from '../../world/screens.js'

const START = { file: 'repo/pictures/06-studio.jpg', width: 2880, height: 1800 }
const DUR = 4.8
const SHOW_AT = 2.5 // the answer screen is up from about here

export const setup = () => load('repo/pictures/06-studio.jpg', 'repo/pictures/03-agent.jpg', 'repo/logo.png')

// The Before / After card on the answer screen, in its picture px
const CARD = { x: 34, y: 1036, w: 584, h: 450 }

function cardDraw(p) {
  if (p <= 0) return ''
  const chipY = CARD.y - 46
  return mark({ region: CARD, p, color: '#1d1d1f', width: 3, radius: 10 }) +
    `<div style="position:absolute;left:${CARD.x}px;top:${chipY}px;opacity:${p.toFixed(3)};
      font:600 24px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;
      color:#1d1d1f;background:#e9e9e4;border:1px solid #c9c9c2;border-radius:6px;
      padding:9px 12px;white-space:nowrap">BEFORE / AFTER</div>`
}

export default function render(t, { window }) {
  const f = frame()
  const w = f.desktop.w
  const windows = [{ ...START, x: w * 0.04, y: w * 0.035, w: w * 0.92, title: 'Shotloop' }]

  // outline draws on in 0.3 s once the answer screen is up
  const outline = Math.max(0, Math.min(1, (t - (SHOW_AT + 0.45)) / 0.3))

  // start already close on the assistant column, so its plain-words lines read
  const cfg = { box: f.desktop, windows }
  // picture fractions: the suggestions in the assistant column, then the answer's card
  const sug = desktopPoint(cfg, 0, 0.08, 0.80)
  const card = desktopPoint(cfg, 0, 0.11, 0.70)
  const fr = (p) => ({ x: p.x / f.desktop.w, y: p.y / f.desktop.h })
  const a = act(t, {
    box: f.desktop, windows, at: 0.3, zoom: 2.1,
    steps: [
      { click: { x: 46, y: 1468, w: 380, h: 25 } }, // It's too still: add some motion
      { show: 'repo/pictures/03-agent.jpg' },
    ],
  })
  // the answer screen carries the outline and its chip
  const shown = a.windows.map((win) => (
    win.file && win.file.indexOf('03-agent') >= 0 ? { ...win, draw: (win.draw || '') + cardDraw(outline) } : win
  ))

  // the landed screen keeps pushing in slowly, so nothing sits frozen
  // camera: in on the suggestions, along to the answer's card, then a slow push
  const cam = camera(t, [
    { at: 0, ...fr(sug), zoom: 1.35 },
    { at: 0.3, ...fr(sug), zoom: 1.9 },
    { at: SHOW_AT, ...fr(card), zoom: 1.75 },
  ])
  const view = { ...cam, zoom: cam.zoom * drift(t, SHOW_AT + 0.4, 0.05, DUR - SHOW_AT) }
  const d = desktop({ box: f.desktop, windows: shown, view, app: 'Shotloop', dock: 'repo/logo.png' })

  depth(d.html,
    chapter(t, { number: 4, title: 'Fix one shot', name: 'Shotloop' }),
    headline(t, { lines: ["What's wrong?", 'Only that shot'], x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size }),
    source(t, { text: 'Shotloop 0.12.1 release notes: the assistant offers two to four ways to change the shot, then changes that shot and shows a before/after', y: f.source.y }),
    wipe(t, { duration: DUR, leave: false }))

  window.kit.stage(a.cursor(d))
}
