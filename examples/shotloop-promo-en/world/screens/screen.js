// world/screens/screen.js: the product's screens: the depth layer, a picture through a camera (shot), the desktop and its windows, live parts, typed fields, a highlight (mark). Part of the screens kit (world/screens.js, which documents it and re-exports its pieces); the engine's, never edited here.
import { screenBox } from '../promo-layout.js'
import { HEAD, OUT, PERSPECTIVE, clamp, esc, fps, kit, load, margin, n, parts, rise, unit, url } from './base.js'
import { arrive, typing } from './motion.js'

// ---- The depth layer ----

export let layer = null
export let uid = 0
// This frame's depth layer: the parts given, the last frame's gone
export function depth(...html) {
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'depth'
    layer.style.cssText = `position:absolute;left:0;top:0;overflow:hidden;pointer-events:none;perspective:${PERSPECTIVE}px`
    document.getElementById('stage').before(layer)
    // What moves is moved as one picture (a layer of its own), smoothly
    // by fractions of a pixel: text moved slowly otherwise lands its
    // glyphs on whole pixels anew each frame and shakes
    const smooth = document.createElement('style')
    smooth.textContent = '#depth > *, #depth [data-kit] { will-change: transform }'
    document.head.appendChild(smooth)
  }
  const { W, H } = kit()
  layer.style.width = `${W}px`
  layer.style.height = `${H}px`
  uid = 0
  layer.innerHTML = html.join('')
  return layer
}


// Where a picture sits in a box for a view: its scale (page px per
// picture px, never past its own pixels) and its top-left
export function place(width, height, box, view) {
  const fit = Math.min(box.w / width, box.h / height)
  const s = Math.min(fit * view.zoom, Math.max(1 / OUT, fit))
  // Larger than the box: its centre kept in, so no edge shows
  const hold = (c, size, room) => (size * s <= room ? 0.5 : clamp(c, room / 2 / (size * s), 1 - room / 2 / (size * s)))
  const cx = hold(view.x, width, box.w), cy = hold(view.y, height, box.h)
  return { s, left: box.x + box.w / 2 - cx * width * s, top: box.y + box.h / 2 - cy * height * s }
}

// A motion blur for a layer panning vx, vy page px a second, from how far
// it travels while a shutter of half a frame is open: a Gaussian a third
// of that wide reads as that smear (a camera's is even along the move),
// capped so a quick pan still shows the screen; none under a pixel. Zooms
// get none: a radial smear reads as a lost focus
export function blur(vx, vy) {
  const per = 0.5 / fps()
  const bx = Math.abs(vx) * per, by = Math.abs(vy) * per
  if (Math.max(bx, by) * OUT < 1) return { css: '', svg: '' }
  const id = `mb${++uid}`
  return {
    css: `filter:url(#${id});`,
    svg: `<svg width="0" height="0" style="position:absolute"><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${n(Math.min(bx / 3, 6))} ${n(Math.min(by / 3, 6))}"/></filter></svg>`
  }
}

// Where the product sits by default: running off the frame's bottom and
// right (tall: from 30% down; wide: from 22% down and 7% in), so the band
// above stays clean ground for the words
export function stageBox() {
  const { W, H } = kit()
  const tall = H > W
  return tall ? { x: W * 0.06, y: H * 0.3, w: W * 1.2, h: H } : { x: W * 0.07, y: H * 0.22, w: W * 1.2, h: H }
}

// A picture seen through a camera, in box { x, y, w, h } (page px;
// stageBox() unless given, so the interface runs off the frame's edges).
//   view: { x, y, zoom } or a camera(t, keys)
//   frame: 'window' shows it as a window (a title bar with traffic
//     lights, a light shadow), the whole picture fitted in the box; the
//     camera then moves in on the window itself, its bar and edges
//     growing with it, as a real camera would, the box (and a margin for
//     the shadow) staying its view, so the words beside it stay clear.
//     Without one, the camera moves within the box and the picture fills
//     it.
//   tilt: { x, y } degrees a window arrives at, flat once p is 1
//   over: { file, opacity } a second picture of the same size on top, in
//     the same view (a state change: what stays holds still)
//   draw: HTML set on the picture in its own px (a highlight round a
//     control, a badge, typed words): it moves with the picture to the
//     pixel, where anything laid over the frame from outside would shake
//     as the camera moves. mark() draws a highlight
//   dim: 0–1 the picture dimmed and blurred, while the focus is elsewhere
//   p: brings it in
// Gives back { html, at(px, py) → frame px, scale, seen } so a cursor or
// a field lands on a point of the picture
export function shot(opts) {
  return opts.frame === 'window' ? windowShot(opts) : boxShot(opts)
}

// A picture, its next state over it, and what is drawn on it in its own
// px (draw): all in one layer, so the camera moves them together to the
// pixel
export const layers = (file, width, height, over, draw = '') => {
  const pic = (f, o) => `<div style="position:absolute;left:0;top:0;width:${width}px;height:${height}px;opacity:${n(o)};background:url(${url(f)}) 0 0/100% 100% no-repeat"></div>`
  return pic(file, 1) + (over ? pic(over.file, clamp(over.opacity)) : '') + draw
}
export const dimmed = (dim, u) => (dim > 0 ? `filter:brightness(${n(1 - 0.6 * clamp(dim))}) blur(${n(12 * u * clamp(dim))}px);` : '')
export const SHADOW = u => `0 0 0 1px rgba(255,255,255,.1),0 ${n(20 * u)}px ${n(60 * u)}px rgba(0,0,0,.18),0 ${n(2 * u)}px ${n(6 * u)}px rgba(0,0,0,.08)`

// The camera within a box the picture fills
export function boxShot({ file, width, height, box, view = { x: 0.5, y: 0.5, zoom: 1 }, tilt = { x: 0, y: 0 }, over = null, draw = '', dim = 0, p = 1 }) {
  const { W, H } = kit()
  const u = unit()
  box ??= stageBox()
  // The part of it in frame
  const x0 = Math.max(box.x, 0), y0 = Math.max(box.y, 0)
  const seen = { x: x0, y: y0, w: Math.min(box.x + box.w, W) - x0, h: Math.min(box.y + box.h, H) - y0 }
  const { s, left, top } = place(width, height, seen, view)
  const mb = blur((view.vx ?? 0) * width * s, (view.vy ?? 0) * height * s)
  const q = clamp(p)
  const settle = 1 - arrive(q * 1.4, 0)
  const tf = tilt.x || tilt.y ? `transform:translateY(${n(settle * 40 * u)}px) rotateX(${n((tilt.x ?? 0) * settle)}deg) rotateY(${n((tilt.y ?? 0) * settle)}deg);` : ''
  // Corners rounded where they show
  const r = 14 * u
  const inFrame = (x, y) => x > 0.5 && x < W - 0.5 && y > 0.5 && y < H - 0.5
  const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]].map(([x, y]) => (inFrame(x, y) ? `${n(r)}px` : '0')).join(' ')
  const html = mb.svg + `<div style="position:absolute;left:${n(box.x)}px;top:${n(box.y)}px;width:${n(box.w)}px;height:${n(box.h)}px;opacity:${n(clamp(q * 1.6))};${tf}overflow:hidden;` +
    (corners !== '0 0 0 0' ? `border-radius:${corners};box-shadow:${SHADOW(u)};` : '') + '">' +
    `<div style="position:absolute;left:0;top:0;width:${n(box.w)}px;height:${n(box.h)}px;overflow:hidden;${mb.css}${dimmed(dim, u)}">` +
    `<div style="position:absolute;left:0;top:0;transform:translate(${n(left - box.x)}px,${n(top - box.y)}px) scale(${s});transform-origin:0 0">${layers(file, width, height, over, draw)}</div></div></div>`
  return { html, at: (px, py) => ({ x: left + px * s, y: top + py * s }), scale: s, seen }
}

// The camera on a window: the window is the picture fitted in the box
// with its title bar; zoom z scales the whole window about the point the
// view is on, which drifts toward the box's centre as it closes in (so
// at z = 1 the window sits where it was placed)
export function windowShot({ file, width, height, box, view = { x: 0.5, y: 0.5, zoom: 1 }, tilt = { x: 0, y: 0 }, over = null, draw = '', dim = 0, p = 1 }) {
  const { W, H, C } = kit()
  const u = unit()
  const bar = 30 * u
  box ??= stageBox()
  const s0 = Math.min(box.w / width, (box.h - bar) / height)
  const ww = width * s0, wh = height * s0 + bar
  const wx = box.x + (box.w - ww) / 2, wy = box.y + (box.h - wh) / 2
  // Never closer than the picture's own pixels allow
  const z = clamp(view.zoom, 0.2, Math.max(1, 1 / OUT / s0))
  const f = { x: wx + view.x * ww, y: wy + bar + view.y * (wh - bar) }
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const k = 1 - 1 / z
  const T = { x: (1 - z) * f.x + k * (c.x - f.x), y: (1 - z) * f.y + k * (c.y - f.y) }
  const to = (x, y) => ({ x: T.x + z * x, y: T.y + z * y })
  const at = (px, py) => to(wx + px * s0, wy + bar + py * s0)
  const mb = blur((view.vx ?? 0) * ww * z, (view.vy ?? 0) * wh * z)
  const q = clamp(p)
  const settle = 1 - arrive(q * 1.4, 0)
  // Its view: the box and a margin for its shadow, within the frame; the
  // margin closes as the camera moves in, so a window never grows past
  // its box toward the words beside it
  const m = 28 * u * clamp(1 - (z - 1) * 4)
  const view0 = { x: Math.max(box.x - m, 0), y: Math.max(box.y - m, 0) }
  const view1 = { x: Math.min(box.x + box.w + m, W), y: Math.min(box.y + box.h + m, H) }
  const a = to(wx, wy), b = to(wx + ww, wy + wh)
  const x0 = Math.max(a.x, view0.x), y0 = Math.max(a.y + bar * z, view0.y)
  const seen = { x: x0, y: y0, w: Math.max(0, Math.min(b.x, view1.x) - x0), h: Math.max(0, Math.min(b.y, view1.y) - y0) }
  const chrome = `<div style="position:absolute;left:0;top:0;width:${n(ww)}px;height:${n(bar)}px;background:${C.panel ?? '#1e1f22'};display:flex;align-items:center;gap:${n(7 * u)}px;padding-left:${n(12 * u)}px;box-sizing:border-box">` +
    ['#ff5f57', '#febc2e', '#28c840'].map(col => `<i style="display:block;width:${n(10 * u)}px;height:${n(10 * u)}px;border-radius:50%;background:${col}"></i>`).join('') + '</div>'
  const html = mb.svg + `<div style="position:absolute;left:${n(view0.x)}px;top:${n(view0.y)}px;width:${n(view1.x - view0.x)}px;height:${n(view1.y - view0.y)}px;overflow:hidden">` +
    `<div style="position:absolute;left:${n(-view0.x)}px;top:${n(-view0.y)}px;transform:translate(${n(T.x)}px,${n(T.y)}px) scale(${n(z * 1000) / 1000});transform-origin:0 0">` +
    `<div style="position:absolute;left:${n(wx)}px;top:${n(wy)}px;width:${n(ww)}px;height:${n(wh)}px;opacity:${n(clamp(q * 1.6))};overflow:hidden;border-radius:${n(12 * u)}px;box-shadow:${SHADOW(u)};${mb.css}` +
    `transform:translateY(${n(settle * 40 * u)}px) rotateX(${n((tilt.x ?? 0) * settle)}deg) rotateY(${n((tilt.y ?? 0) * settle)}deg)">${chrome}` +
    `<div style="position:absolute;left:0;top:${n(bar)}px;width:${n(ww)}px;height:${n(wh - bar)}px;overflow:hidden;${dimmed(dim, u)}">` +
    `<div style="position:absolute;left:0;top:0;transform:scale(${s0});transform-origin:0 0">${layers(file, width, height, over, draw)}</div></div></div></div></div>`
  return { html, at, scale: s0 * z, seen }
}

// Something drawn on a shot's picture, cut to the part of it in frame
export const onShot = (under, html) => `<div style="position:absolute;left:${n(under.seen.x)}px;top:${n(under.seen.y)}px;width:${n(under.seen.w)}px;height:${n(under.seen.h)}px;overflow:hidden">` +
  `<div style="position:absolute;left:${n(-under.seen.x)}px;top:${n(-under.seen.y)}px">${html}</div></div>`

// ---- A desktop: windows on a simulated screen, with its own camera ----

// The Dock's apps, drawn here as plain, original icons in the manner of a
// Mac's (a folder, a browser, mail, a calendar, notes, music, settings, a
// terminal, and the trash past a divider): they read as a Mac's Dock and
// copy no one's marks. Each is SVG on a 100-unit square
export const squircle = fill => `<rect x="4" y="4" width="92" height="92" rx="22" fill="${fill}"/>`
export const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
export const DOCK_APPS = [
  `<defs>${grad('dkf', '#7fd0ff', '#1f8bff')}</defs>${squircle('url(#dkf)')}<path d="M22 34h20l6 6h30v34H22z" fill="#cfeaff"/><path d="M22 44h56v30H22z" fill="#fff" opacity=".95"/>`,
  `<defs>${grad('dkb', '#ffffff', '#e3e9f2')}${grad('dkg', '#58b5ff', '#1d6ee8')}</defs>${squircle('url(#dkb)')}<circle cx="50" cy="50" r="30" fill="url(#dkg)"/><g fill="none" stroke="#fff" stroke-width="3" opacity=".9"><ellipse cx="50" cy="50" rx="13" ry="30"/><path d="M20 50h60M24 36h52M24 64h52"/></g>`,
  `<defs>${grad('dkm', '#63c0ff', '#1b6fea')}</defs>${squircle('url(#dkm)')}<rect x="22" y="32" width="56" height="38" rx="5" fill="#fff"/><path d="M23 34l27 20 27-20" fill="none" stroke="#1b6fea" stroke-width="4" stroke-linejoin="round"/>`,
  `${squircle('#fff')}<path d="M4 26a22 22 0 0 1 22-22h48a22 22 0 0 1 22 22v8H4z" fill="#ff4a3d"/><text x="50" y="27" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#fff">NOV</text><text x="50" y="80" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="46" font-weight="300" fill="#1d1d1f">3</text>`,
  `<defs>${grad('dkn', '#fff8d0', '#ffe46a')}</defs>${squircle('url(#dkn)')}<path d="M4 26a22 22 0 0 1 22-22h48a22 22 0 0 1 22 22v6H4z" fill="#ffd23a"/><g stroke="#cbbf8f" stroke-width="2.5"><path d="M18 48h64M18 60h64M18 72h64M18 84h46"/></g>`,
  `<defs>${grad('dku', '#ff6f8b', '#f42c53')}</defs>${squircle('url(#dku)')}<path d="M40 30l28-6v34" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><ellipse cx="34" cy="68" rx="9" ry="7" fill="#fff"/><ellipse cx="62" cy="62" rx="9" ry="7" fill="#fff"/><path d="M43 66V30" stroke="#fff" stroke-width="5"/>`,
  `<defs>${grad('dks', '#b4bcc6', '#69727e')}</defs>${squircle('url(#dks)')}<circle cx="50" cy="50" r="22" fill="none" stroke="#3a3f47" stroke-width="10" stroke-dasharray="7 4.5"/><circle cx="50" cy="50" r="15" fill="#d9dde2"/><circle cx="50" cy="50" r="6" fill="#69727e"/>`,
  `<defs>${grad('dkt', '#3a3a3c', '#151517')}</defs>${squircle('url(#dkt)')}<path d="M26 38l12 10-12 10" fill="none" stroke="#e8e8e8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 62h22" stroke="#e8e8e8" stroke-width="5" stroke-linecap="round"/>`
]
export const DOCK_TRASH = `<path d="M30 30h40l-4 54H34z" fill="rgba(255,255,255,.55)" stroke="rgba(255,255,255,.9)" stroke-width="2"/><path d="M26 28h48" stroke="rgba(255,255,255,.9)" stroke-width="4" stroke-linecap="round"/><g stroke="rgba(120,130,150,.55)" stroke-width="2"><path d="M42 38v38M50 38v38M58 38v38"/></g>`

//
// A promo's camera moves on a desktop of its own, so a push-in, a click
// or a window dragged never moves anything else in the frame: a box (a
// layout() picture box) showing a Mac's screen, as a viewer knows one (a
// soft blue wallpaper drawn here, a menu bar, a Dock), and the product's
// windows on it (pictures with a title bar). The whole screen is in the
// camera, so moving in enlarges the bar and the Dock too.
// Its camera centres what it looks at: a click it follows lands in the
// middle of the box. Positions on it are desktop px: (0, 0) its top-left,
// box.w × box.h its size at zoom 1.

// Each window's place on the desktop: { x, y, w } in desktop px (its
// height follows the picture and its title bar)
export function desktopWindows(windows, u) {
  const bar = 26 * u
  return windows.map(win => {
    const s = win.w / win.width
    return { ...win, s, bar, h: win.height * s + bar }
  })
}

// A Mac's screen is 16:10: the desktop keeps it in any box it's given
// (screenBox, promo-layout.js); windows are placed in its px
// (screenBox(box).w wide)

// Where a point of a window's picture is on the desktop (desktop px),
// to aim the camera at: follow() takes these divided by the box's size
export function desktopPoint({ box: given, windows }, i, px, py) {
  const box = screenBox(given)
  const w = desktopWindows(windows, unit())[i]
  return { x: (w.x + px * w.s) / box.w, y: (w.y + w.bar + py * w.s) / box.h }
}

// The desktop: a 16:10 screen in box { x, y, w, h } (screenBox), its windows [{ file, width, height,
// x, y, w, title, p, over, draw }] (over and draw as shot()'s) (p brings a window in; x, y may change with t
// to drag it), seen by view { x, y, zoom } (a camera(t, keys) over desktop
// fractions; follow() and desktopPoint() aim it at clicks). The view's
// point is centred in the box; zoom never passes the pictures' pixels.
// app: the name in the menu bar; dock: the product's icon (a picture of
// the project), first in the Dock; apps: pictures of the project to stand
// in for the Dock's own icons (the person's, licensed to show), when given
// Gives back { html, at(i, px, py) → frame px, box (the screen's),
// window(i) } for the cursor and words; window(i) is what field() takes for that window
export function desktop({ box: given, windows, view = { x: 0.5, y: 0.5, zoom: 1 }, app = '', dock = '', apps = null, p = 1 }) {
  const box = screenBox(given)
  const u = unit()
  const wins = desktopWindows(windows, u)
  // Sharp: the window shown largest sets how close the camera may come
  const sharp = Math.min(...wins.map(w => 1 / OUT / w.s))
  const z = clamp(view.zoom, 0.5, Math.max(1, sharp))
  const cx = box.w / 2, cy = box.h / 2
  // The view held inside the screen, as a screen recording's is: a click
  // by its edge is followed without showing past it
  const vx = z > 1 ? clamp(view.x, 0.5 / z, 1 - 0.5 / z) : 0.5
  const vy = z > 1 ? clamp(view.y, 0.5 / z, 1 - 0.5 / z) : 0.5
  // Desktop px → box px: the view's point to the box's centre
  const tx = cx - vx * box.w * z, ty = cy - vy * box.h * z
  const at = (i, px, py) => {
    const w = wins[i]
    return { x: box.x + tx + (w.x + px * w.s) * z, y: box.y + ty + (w.y + w.bar + py * w.s) * z }
  }
  const mb = blur((view.vx ?? 0) * box.w * z, (view.vy ?? 0) * box.h * z)
  // The screen: a soft blue wallpaper (drawn, wider than the desktop so
  // no edge shows when the camera centres something near one), a menu
  // bar, a Dock
  const ui = `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`
  const wallpaper = `<div style="position:absolute;left:${n(-box.w)}px;top:${n(-box.h)}px;width:${n(box.w * 3)}px;height:${n(box.h * 3)}px;` +
    'background:radial-gradient(40% 35% at 38% 30%, #9fc4ff, transparent 70%),radial-gradient(35% 40% at 70% 70%, #b49cf2, transparent 70%),' +
    'radial-gradient(30% 30% at 55% 45%, #e9b6d8, transparent 70%),linear-gradient(160deg, #3a5fb8, #6b4fb0 55%, #2c3f86)"></div>'
  const bar = 22 * u
  const menu = `<div style="position:absolute;left:0;top:0;width:${n(box.w)}px;height:${n(bar)}px;background:rgba(246,246,248,.62);backdrop-filter:blur(14px);` +
    `display:flex;align-items:center;gap:${n(16 * u)}px;padding:0 ${n(14 * u)}px;box-sizing:border-box;font:400 ${n(10.5 * u)}px/1 ${ui};color:#1d1d1f">` +
    `<b style="font-weight:700">${esc(app)}</b>${['File', 'Edit', 'View', 'Window', 'Help'].map(m => `<span>${m}</span>`).join('')}` +
    `<span style="margin-left:auto">Mon 9:41</span></div>`
  const tile = 30 * u
  const svg = body => `<svg viewBox="0 0 100 100" width="${n(tile)}" height="${n(tile)}" style="display:block;flex:none;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.25))">${body}</svg>`
  const img = file => `<img src="${url(file)}" style="display:block;flex:none;width:${n(tile)}px;height:${n(tile)}px;border-radius:${n(tile * 0.23)}px;object-fit:cover">`
  const divider = `<i style="display:block;flex:none;width:1px;align-self:stretch;margin:${n(2 * u)}px ${n(1 * u)}px;background:rgba(255,255,255,.45)"></i>`
  // The Dock hides as the camera moves in (macOS's own auto-hide), so it
  // never covers what the camera came close to; at the whole screen it
  // shows
  const hide = clamp((z - 1.08) / 0.25)
  const dockHtml = `<div style="position:absolute;left:50%;bottom:${n(6 * u)}px;transform:translate(-50%,${n(hide * 60 * u)}px);opacity:${n(1 - hide)};display:flex;align-items:center;gap:${n(6 * u)}px;padding:${n(5 * u)}px ${n(7 * u)}px;` +
    `border-radius:${n(14 * u)}px;background:rgba(255,255,255,.28);backdrop-filter:blur(14px);box-shadow:0 0 0 1px rgba(255,255,255,.35)">` +
    (dock ? img(dock) : '') + (apps ? apps.map(img) : DOCK_APPS.map(svg)).join('') + divider + svg(DOCK_TRASH) + '</div>'
  const windowHtml = wins.map(w => {
    const q = clamp(w.p ?? 1)
    const rise = (1 - arrive(q * 1.4, 0)) * 30 * u
    const chrome = `<div style="position:absolute;left:0;top:0;width:${n(w.w)}px;height:${n(w.bar)}px;background:#ececec;border-bottom:1px solid rgba(0,0,0,.08);display:flex;align-items:center;gap:${n(6 * u)}px;padding-left:${n(10 * u)}px;box-sizing:border-box">` +
      ['#ff5f57', '#febc2e', '#28c840'].map(col => `<i style="display:block;width:${n(9 * u)}px;height:${n(9 * u)}px;border-radius:50%;background:${col}"></i>`).join('') +
      (w.title ? `<span style="position:absolute;left:0;right:0;text-align:center;font:500 ${n(10 * u)}px/1 ${HEAD()};color:#555">${esc(w.title)}</span>` : '') + '</div>'
    return `<div style="position:absolute;left:${n(w.x)}px;top:${n(w.y + rise)}px;width:${n(w.w)}px;height:${n(w.h)}px;opacity:${n(clamp(q * 1.6))};` +
      `border-radius:${n(10 * u)}px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 ${n(14 * u)}px ${n(36 * u)}px rgba(0,0,0,.22)">${chrome}` +
      `<div style="position:absolute;left:0;top:${n(w.bar)}px;width:${n(w.w)}px;height:${n(w.h - w.bar)}px;overflow:hidden">` +
      `<div style="position:absolute;left:0;top:0;transform:scale(${w.s});transform-origin:0 0">${layers(w.file, w.width, w.height, w.over, w.draw)}</div></div></div>`
  }).join('')
  const q = clamp(p)
  const html = mb.svg + `<div data-kit="desktop" style="position:absolute;left:${n(box.x)}px;top:${n(box.y)}px;width:${n(box.w)}px;height:${n(box.h)}px;overflow:hidden;border-radius:${n(12 * u)}px;` +
    `background:#2c3f86;box-shadow:${SHADOW(u)};opacity:${n(clamp(q * 1.6))};transform:translateY(${n((1 - arrive(q * 1.4, 0)) * 30 * u)}px)">` +
    `<div style="position:absolute;left:0;top:0;width:${n(box.w)}px;height:${n(box.h)}px;transform:translate(${n(tx)}px,${n(ty)}px) scale(${n(z * 1000) / 1000});transform-origin:0 0;${mb.css}">` +
    `${wallpaper}${windowHtml}${menu}${dockHtml}</div></div>`
  const { W, H } = kit()
  const x0 = Math.max(box.x, 0), y0 = Math.max(box.y, 0)
  const seen = { x: x0, y: y0, w: Math.min(box.x + box.w, W) - x0, h: Math.min(box.y + box.h, H) - y0 }
  return { html, at, box, zoom: z, window: i => ({ at: (px, py) => at(i, px, py), scale: wins[i].s * z, seen }) }
}

// A live part (load it first): its left edge at box.x, centred on box.y,
// box.w wide; sharp at any size, being HTML. tilt and p as a shot's
// window. Its fields keep a name (data-live="field-0", "field-1"… in
// document order), so a shot types into one after depth() draws it:
//   const layer = depth(...); fill(layer, 'field-0', typing(t, {...}))
export function livePart(name, { box, tilt = { x: 0, y: 0 }, p = 1, lifted = true }) {
  const part = parts.get(name)
  if (!part) throw new Error(`world/screens.js: load ${name} in setup first`)
  const u = unit()
  const k = box.w / part.width
  const h = part.height * k
  const q = clamp(p)
  const settle = 1 - arrive(q * 1.4, 0)
  const top = box.y - h / 2
  const html = `<div style="position:absolute;left:${n(box.x)}px;top:${n(top)}px;width:${n(box.w)}px;height:${n(h)}px;opacity:${n(clamp(q * 1.6))};` +
    `transform:translateY(${n(settle * 30 * u)}px) rotateX(${n((tilt.x ?? 0) * settle)}deg) rotateY(${n((tilt.y ?? 0) * settle)}deg);` +
    (lifted ? `box-shadow:0 ${n(18 * u)}px ${n(50 * u)}px rgba(0,0,0,.2);border-radius:${n((part.radius ?? 0) * k)}px;` : '') + '">' +
    `<div style="width:${part.width}px;height:${part.height}px;transform:scale(${n(k * 1000) / 1000});transform-origin:0 0">${part.html}</div></div>`
  return { html, at: (px, py) => ({ x: box.x + px * k, y: top + py * k }), scale: k }
}

// Text typed into a live part's field (by its data-live name) after
// depth() drew it, with a caret while typing
export function fill(layer, name, typed) {
  const el = layer.querySelector(`[data-live="${name}"]`)
  if (!el) return
  const caret = `<span style="display:inline-block;width:0.07em;height:1.1em;vertical-align:-0.2em;margin-left:1px;background:currentColor;opacity:${typed.caret ? 1 : 0}"></span>`
  if ('value' in el && el.tagName !== 'BUTTON') {
    el.value = typed.text
    el.setAttribute('placeholder', '')
  } else el.innerHTML = esc(typed.text) + caret
}


// Words typed into a field of a picture: a box over its region (picture
// px under a shot) in the field's own colours, the text left-aligned
export function field(t, under, { region, text, at = 0, cps = 40, color = '#111', background = '#fff', size }) {
  if (t < at) return ''
  const a = under.at(region.x, region.y), b = under.at(region.x + region.w, region.y + region.h)
  const h = b.y - a.y
  const typed = typing(t, { text, at, cps })
  const fs = size ?? h * 0.42
  return onShot(under, `<div style="position:absolute;left:${n(a.x)}px;top:${n(a.y)}px;width:${n(b.x - a.x)}px;height:${n(h)}px;background:${background};` +
    `display:flex;align-items:center;padding:0 ${n(h * 0.35)}px;box-sizing:border-box;font:500 ${n(fs)}px/1 ${kit().FONT};color:${color};white-space:nowrap;overflow:hidden">` +
    `${esc(typed.text)}<span style="display:inline-block;width:${n(Math.max(1.5, fs * 0.07))}px;height:${n(fs * 1.15)}px;margin-left:2px;background:${color};opacity:${typed.caret ? 1 : 0}"></span></div>`)
}


// A highlight round a control of a picture, for a shot's or a window's
// draw: region in picture px, hugging its edges; thin and quiet (taste:
// promo-one-focus): ink unless color gives the screen's own accent (a
// dark screen wants a light one); p fades it in. width: the line in
// picture px
export function mark({ region, p = 1, color = '#1d1d1f', width = 3, radius = 8 }) {
  const q = clamp(p)
  if (q <= 0) return ''
  const pad = width
  return `<div style="position:absolute;left:${n(region.x - pad)}px;top:${n(region.y - pad)}px;width:${n(region.w + 2 * pad)}px;height:${n(region.h + 2 * pad)}px;` +
    `border:${n(width)}px solid ${color};border-radius:${n(radius + pad)}px;box-sizing:border-box;opacity:${n(q)}"></div>`
}
