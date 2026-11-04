// 06-end: 05 — Export. The pointer presses Export, the dialog comes up,
// the aspect is picked, and the footer chips name what Export writes.
// Shot-local time: t = 0 is this shot's first frame.
import { load, depth, frame, chapter, headline, source, desktop, act, steps, mark, wipe } from '../../world/screens.js'

const DUR = 4.5
const START = { file: "repo/pictures/05-hero.jpg", width: 2880, height: 1800 }
// Controls, found in the pictures (picture px)
const EXPORT = { x: 2620, y: 108, w: 125, h: 29 }
const ASPECT = { x: 1653, y: 828, w: 238, h: 33 }
const PUBLISH = { x: 1205, y: 1262, w: 180, h: 40 }

export const setup = () => load("repo/pictures/05-hero.jpg", "repo/pictures/08-export.jpg", "repo/logo.png")

export default function render(t, { window }) {
  const f = frame()
  const w = f.desktop.w
  const windows = [{ ...START, x: w * 0.04, y: w * 0.035, w: w * 0.92, title: "Shotloop" }]
  const a = act(t, { box: f.desktop, windows, at: 0.3, zoom: 1.3, steps: [
    { click: EXPORT },
    { show: "repo/pictures/08-export.jpg" },
    { click: ASPECT },
  ] })
  // A thin outline round the result to notice, on the screen's own picture
  const outline = t > 3.1 ? mark({ region: PUBLISH, p: Math.min(1, (t - 3.1) / 0.4) }) : ''
  const shown = a.windows.map((win, i) => i === 0 ? { ...win, draw: (win.draw || '') + outline } : win)
  const d = desktop({ box: f.desktop, windows: shown, view: a.view, app: "Shotloop", dock: "repo/logo.png" })
  depth(d.html,
    // Settled before t = 0: the first frame is already a finished design
    chapter(t, { number: 6, title: "Export", name: "Shotloop", at: -0.9 }),
    headline(t, { lines: ["Export once", "Cover, posts"], x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size, at: -0.9 }),
    steps(t, { items: ["VOICE-OVER", "SUBTITLES", "MUSIC", "COVER", "POSTS"], x: f.words.x, y: f.words.under + 24, at: 1.2, step: 0.09, width: f.words.width }),
    source(t, { text: "Shotloop README: Export joins the shots, lays the voice-over with its subtitles and the music under them, designs a cover and writes the post for each platform", y: f.source.y }),
    // No wipe half of our own: the stills stay clean, the neighbours cut
    wipe(t, { duration: DUR, enter: false, leave: false }))
  window.kit.stage(a.cursor(d))
}
