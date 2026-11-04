// 03-beat-2: 02 — One sentence. Home: click the idea field, type the sentence, pick 16:9.
// Shot-local time: t = 0 is this shot's first frame.
import { load, depth, frame, chapter, headline, source, desktop, act } from '../../world/screens.js'

const START = { file: "repo/pictures/09-home.jpg", width: 2880, height: 1800 }

// Control regions in the picture's own px (find_text on repo/pictures/09-home.jpg)
const IDEA = { x: 872, y: 494, w: 1246, h: 60 }   // the idea field "— what is the video about?"
const CHIP_169 = { x: 1352, y: 724, w: 116, h: 52 } // the 16:9 chip

export const setup = () => load("repo/pictures/09-home.jpg", "repo/logo.png")

export default function render(t, { window }) {
  const f = frame()
  const w = f.desktop.w
  const windows = [{ ...START, x: w * 0.04, y: w * 0.02, w: w * 0.92, title: "Shotloop" }]

  // The action, as a person does it: click the field, type, pick the ratio
  const a = act(t, {
    box: f.desktop, windows, at: 0.25, zoom: 2.0,
    steps: [
      { click: IDEA },
      { type: "How long does sunlight take to reach Earth?", cps: 32 },
      { click: CHIP_169 },
    ],
  })

  const d = desktop({ box: f.desktop, windows: a.windows, view: a.view, app: "Shotloop", dock: "repo/logo.png" })
  depth(d.html,
    // The words are settled by the shot's first frame (they rise over the cut)
    chapter(t, { number: 2, title: "One sentence", name: "Shotloop", at: -0.5 }),
    headline(t, { lines: ["One sentence", "AI picks how"], x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size, at: -0.95 }),
    source(t, { text: "Shotloop README, Product tour — Home: one sentence; 2D or 3D, the length, the style and the theme can stay on Auto", y: f.source.y }))
  window.kit.stage(a.cursor(d))
}
