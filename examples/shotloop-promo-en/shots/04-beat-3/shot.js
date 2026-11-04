// 04-beat-3: 03 — The plan, before anything renders.
// Shot-local time: t = 0 is this shot's first frame.
import { load, depth, frame, chapter, headline, source, desktop, act, steps } from '../../world/screens.js'

const START = { file: "repo/pictures/01-plan.jpg", width: 2880, height: 1800 }
// Controls found in the picture with find_text (picture px)
const FRAME_FIELD = { x: 1251, y: 900, w: 1466, h: 46 }   // shot 2's Frame text, first line
const MAKE_BUTTON = { x: 2566, y: 94, w: 278, h: 60 }     // "Make the video", top right

export const setup = () => load("repo/pictures/01-plan.jpg", "repo/logo.png")

export default function render(t, { window }) {
  const f = frame()
  const w = f.desktop.w
  const windows = [{ ...START, x: w * 0.04, y: w * 0.035, w: w * 0.92, title: "Shotloop" }]
  const a = act(t, { box: f.desktop, windows, at: 0.35, zoom: 1.55, steps: [
    { click: FRAME_FIELD },
    { type: "a gold ruler draws from the Sun to Earth", cps: 26 },
    { click: MAKE_BUTTON },
  ] })
  const d = desktop({ box: f.desktop, windows: a.windows, view: a.view, app: "Shotloop", dock: "repo/logo.png" })

  // the small mono line under the three chips
  const lineP = Math.max(0, Math.min(1, (t + 0.1) / 0.45)) ** 0.6 // short ease-out, settled by t = 0
  const under = `<div style="position:absolute;left:${f.steps.x}px;top:${f.steps.y + f.steps.h + 14}px;`
    + `font:400 13px var(--brand-mono, ui-monospace, "SF Mono", Menlo, monospace);letter-spacing:.09em;text-transform:uppercase;color:#0a0a0a;`
    + `opacity:${(lineP * 0.62).toFixed(3)};transform:translateY(${((1 - lineP) * 8).toFixed(2)}px)">before anything renders</div>`

  depth(d.html,
    chapter(t, { number: 3, title: "The plan", name: "Shotloop", at: -0.8 }),
    headline(t, { lines: ["Plan first", "Edit anything"], x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size, at: -1.1 }),
    steps(t, { items: ["Copy", "Storyboard", "Sources"], x: f.steps.x, y: f.steps.y, at: -0.4, step: 0.09, width: f.steps.w }),
    under,
    source(t, { text: "Shotloop README, Product tour — Copy & storyboard: hook, script and sourced facts, all editable before anything renders", y: f.source.y }))
  window.kit.stage(a.cursor(d))
}
