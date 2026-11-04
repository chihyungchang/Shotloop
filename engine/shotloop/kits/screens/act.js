// world/screens/act.js: an action on the product, done as a person does
// it, step by step (taste: promo-in-use): the pointer goes to a control
// and clicks it while the camera comes in, words are typed only into the
// field just clicked, and what the action brings shows as the window's
// next picture. Part of the screens kit (world/screens.js, which documents
// it and re-exports its pieces); the engine's, never edited here.
import { clamp, esc, kit, n, unit } from './base.js'
import { cursor } from './cursor.js'
import { SPRINGS, camera, typing } from './motion.js'
import { desktopPoint, desktopView, desktopWindows } from './screen.js'

// Seconds: the pointer's glide to a control, the pause after a click or
// the last word, a picture's crossfade into the next, the camera's glide
// (motion.js SPRINGS), how long it stays on a last click that shows nothing
const MOVE = 0.7, AFTER = 0.35, SHOW = 0.45, GLIDE = SPRINGS.glide.over, HOLD = 1.2

// One action on window i of a desktop (box and windows as desktop()
// takes them). steps, in order:
//   { click: region }          the pointer goes there and clicks
//   { type: 'words', cps }     typed into the field last clicked
//   { show: 'repo/pictures/…' } the window's next picture, what the
//                              click brought
//   { wait: s }                a held moment
// region: a control's box in the picture's px (find_text gives it). Gives
// back { view, windows, cursor(d), end }: pass view and windows to
// desktop(), then kit.stage(cursor(d)) with what desktop() returned;
// end is when the last step is done
export function act(t, { box, windows, window: i = 0, steps, at = 0, zoom = 1.6, base = { x: 0.5, y: 0.5, zoom: 1 }, color = '#111', background = '#fff' }) {
  let time = at, focus = null
  const timed = steps.map(s => {
    if (s.click) {
      const step = { kind: 'click', at: time + MOVE, region: s.click }
      focus = s.click
      time += MOVE + AFTER
      return step
    }
    if (s.type != null) {
      if (!focus) throw new Error('world/screens.js act(): type follows a click on the field it types into')
      const cps = s.cps ?? 14
      const step = { kind: 'type', at: time, text: String(s.type), into: focus, cps }
      time += step.text.length / cps + AFTER
      return step
    }
    if (s.show) {
      const step = { kind: 'show', at: time, file: s.show }
      time += SHOW + AFTER
      return step
    }
    time += s.wait ?? 0
    return { kind: 'wait' }
  })
  const win = windows[i]
  const centre = r => ({ px: r.x + r.w / 2, py: r.y + r.h / 2 })
  const clicks = timed.filter(s => s.kind === 'click').map(s => ({ at: s.at, ...centre(s.region) }))
  // The camera glides in to each click and pans from one click to the
  // next (a step back between them reads as a hitch), arriving as the
  // pointer clicks; it steps back to the whole window as the next picture
  // shows, so what the action brought is seen whole, or a moment after a
  // last click that shows nothing. It aims where the desktop can look (a
  // control by the screen's edge is seen from inside it), so no move is
  // cut short at an edge
  const wins = desktopWindows(windows, unit())
  const shows = timed.filter(s => s.kind === 'show')
  const last = clicks.at(-1)
  const keys = [
    { at: -Infinity, ...base },
    ...clicks.map(c => ({ at: Math.max(at, c.at - GLIDE), ...desktopView(wins, { ...desktopPoint({ box, windows }, i, c.px, c.py), zoom }), spring: 'glide' })),
    ...shows.map(s => ({ at: s.at, ...base, spring: 'glide' })),
    ...(last && !shows.some(s => s.at > last.at) ? [{ at: last.at + HOLD, ...base, spring: 'glide' }] : [])
  ].sort((x, y) => x.at - y.at)
  const view = camera(t, keys)

  // The window's picture now: the last one shown, crossfading into the next
  let file = win.file, over = null
  for (const s of shows) {
    const q = clamp((t - s.at) / SHOW)
    if (q >= 1) file = s.file
    else {
      if (q > 0) over = { file: s.file, opacity: q }
      break
    }
  }
  // Words typed, in the picture's own px, over the field's own hint, until
  // the next picture shows the screen as it became
  const draw = timed.filter(s => s.kind === 'type' && t >= s.at && !shows.some(w => w.at <= t && w.at > s.at)).map(s => {
    const r = s.into
    const typed = typing(t, { text: s.text, at: s.at, cps: s.cps })
    const fs = r.h * 0.6
    return `<div data-kit="typed" style="position:absolute;left:${n(r.x)}px;top:${n(r.y)}px;width:${n(r.w)}px;height:${n(r.h)}px;background:${background};display:flex;align-items:center;` +
      `box-sizing:border-box;padding:0 ${n(r.h * 0.2)}px;font:450 ${n(fs)}px/1 ${kit().FONT};color:${color};white-space:nowrap;overflow:hidden">${esc(typed.text)}` +
      `<span style="display:inline-block;width:${n(Math.max(2, fs * 0.07))}px;height:${n(fs * 1.15)}px;margin-left:2px;background:${color};opacity:${typed.caret ? 1 : 0}"></span></div>`
  }).join('')
  const now = { ...win, file, over, draw: (win.draw ?? '') + draw }

  // The pointer's keys on the picture: from beside the first control, a
  // hold before each glide, the click on the control's centre
  const path = []
  if (clicks.length) path.push({ at, px: clicks[0].px + 260, py: clicks[0].py + 180 })
  for (const c of clicks) {
    const last = path.at(-1)
    path.push({ at: c.at - MOVE, px: last.px, py: last.py }, { at: c.at, px: c.px, py: c.py })
  }
  return {
    view,
    end: time,
    windows: windows.map((w, k) => (k === i ? now : w)),
    // Drawn where the controls are in this frame, so the pointer stays on
    // its control as the camera moves
    cursor: d => cursor(t, { path: path.map(k => ({ at: k.at, ...d.at(i, k.px, k.py) })), clicks: clicks.map(c => c.at) })
  }
}
