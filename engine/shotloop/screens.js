// world/screens.js: a product promo's shots: the product explained with
// drawn pieces in its own visual system, and proved with its real screens.
// It is the engine's (engine/shotloop/screens.js), kept current in every
// promo's world before each command: never edit it here; a promo's own
// pieces go in world/*.js modules beside it. Shots import what they use:
//
//   import { load, depth, layout, source, chapter, headline, row, counter, steps, bubble, compare, wipe, endCard,
//     desktop, desktopPoint, shot, camera, follow, drift, cursor, typing, field, livePart, fill } from '../../world/screens.js'
//
// The craft it follows is the promo's taste (Settings → Rules, kind
// promo), after oliverz.dev's product films: the problem first, then the
// product's answer in the same picture; numbered chapters with big
// headlines; diagrams for the mechanism, screens as proof; short calm
// rises, wipes at the cuts, nothing frozen; the product's own ground,
// accent and fonts; screens always sharp.
//
// Material, named by its place in the project:
// - pictures: "images/…" (the person's), "repo/pictures/…" (the
//   repository's screenshots), "site/hero.png", "site/framed/…",
//   "site/parts/…" (the page's), with their size in pixels (the plan
//   lists them);
// - live parts: "site/live/NN-name.json", parts of the page kept as HTML,
//   sharp at any size, whose fields can be typed into (livePart, fill);
// - the page's fonts: "site/fonts.css" (--brand-head, --brand-mono, used
//   by the drawn pieces).
// Load what a shot shows once, in setup:
//
//   export const setup = () => load('site/fonts.css', 'repo/pictures/01-studio.jpg')
//
// Two layers, both drawn the same at any t:
// - depth(...html) sets the depth layer for this frame (call it every
//   frame), later parts over earlier ones: shot() and livePart() first,
//   then field(), the words (chapter, headline…) and wipe() last, so a
//   window the camera moves in on never covers the words. layout() gives
//   each beat's boxes with room between words, picture and source line:
//   place the pieces there rather than by hand.
//   It returns the layer, so a live part's field can be filled after.
// - kit.stage(svg) above it: cursor().
//
// The camera's moves (in to a click, along to the next, a window dragged)
// happen on a desktop(): a simulated screen in its own box, so nothing
// else in the frame moves, and what the camera follows sits in its middle.
// A shot sits in stageBox() unless given a box: the product running off
// the bottom and the right. Its camera: { x, y } the point of the picture
// at the box's centre (0–1 across and down it), zoom 1 the whole picture
// fitted in the box; camera() moves it through keys on a spring, follow()
// makes those keys from clicks, drift() keeps a landed screen pushing in.
// A view never goes closer than the picture's own pixels allow (it would
// blur), and a picture larger than its box never shows past its edges.

const kit = () => window.kit
// Output pixels per page pixel: the final film is 1080×1920 (or 1920×1080)
// over the kit's 720×1280 page (engine/shotloop/project.mjs SIZES)
const OUT = 1.5
const PERSPECTIVE = 2000
const n = v => Math.round(v * 100) / 100
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
// The kit's size unit: 1 on the 720-wide portrait page
const unit = () => Math.min(kit().W, kit().H) / 720
const fps = () => window.__shotloop?.ctx?.fps ?? 30

// A picture's or a part's address from its place in the project
export const url = file => new URL(`../${file}`, import.meta.url).href

// ---- Material ----

const parts = new Map()
// Pictures decoded, live parts read and the brand's fonts (site/fonts.css)
// loaded before the first frame: call it from setup
export const load = (...files) => Promise.all(files.map(async f => {
  if (/\.css$/i.test(f)) {
    const res = await fetch(url(f)).catch(() => null)
    if (!res?.ok) throw new Error(`world/screens.js: can't load ${f}`)
    const style = document.createElement('style')
    style.textContent = await res.text()
    document.head.appendChild(style)
    // Every face it names, loaded now: text drawn later must not wait
    await Promise.all([...style.sheet.cssRules].filter(r => r instanceof CSSFontFaceRule)
      .map(r => document.fonts.load(`${r.style.getPropertyValue('font-weight') || 400} 20px ${r.style.getPropertyValue('font-family')}`).catch(() => {})))
    await document.fonts.ready
    return
  }
  if (/\.json$/i.test(f)) {
    const res = await fetch(url(f)).catch(() => null)
    if (!res?.ok) throw new Error(`world/screens.js: can't load ${f}`)
    const part = await res.json()
    if (part.css && !document.querySelector(`style[data-part="${f}"]`)) {
      const style = document.createElement('style')
      style.dataset.part = f
      style.textContent = part.css
      document.head.appendChild(style)
    }
    parts.set(f, part)
    // Its fonts are used once so they load, and its images decoded
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;left:-99999px;top:0'
    probe.innerHTML = part.html
    document.body.appendChild(probe)
    await Promise.all([...probe.querySelectorAll('img')].map(i => i.decode().catch(() => {})))
    await document.fonts.ready
    probe.remove()
    return
  }
  const img = new Image()
  img.src = url(f)
  await img.decode().catch(() => { throw new Error(`world/screens.js: can't load ${f}`) })
}))

// ---- Springs: every move settles like a damped spring ----

// stiffness, damping, mass. focused: screen recorders' camera (settles in
// about half a second, no visible bounce), for anything read; whip: a quick
// travel between places; gentle: a slow arrival or return; pop: a small
// thing landing, with a touch of overshoot
export const SPRINGS = {
  focused: { stiffness: 200, damping: 40, mass: 2.25 },
  whip: { stiffness: 520, damping: 60, mass: 1.6 },
  gentle: { stiffness: 90, damping: 26, mass: 2.25 },
  pop: { stiffness: 380, damping: 22, mass: 1 }
}

// The spring's way from 0 to 1, t seconds after it was set off, and its speed
function step(t, spring) {
  if (t <= 0) return [0, 0]
  const { stiffness: k, damping: c, mass: m } = typeof spring === 'string' ? SPRINGS[spring] : spring
  const w0 = Math.sqrt(k / m)
  const z = c / (2 * Math.sqrt(k * m))
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z)
    const e = Math.exp(-z * w0 * t)
    return [1 - e * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)), e * (w0 * w0 / wd) * Math.sin(wd * t)]
  }
  if (z === 1) {
    const e = Math.exp(-w0 * t)
    return [1 - e * (1 + w0 * t), w0 * w0 * t * e]
  }
  const r = Math.sqrt(z * z - 1)
  const r1 = -w0 * (z - r), r2 = -w0 * (z + r)
  const e1 = Math.exp(r1 * t), e2 = Math.exp(r2 * t)
  return [1 + (r2 * e1 - r1 * e2) / (r1 - r2), (r1 * r2 * (e1 - e2)) / (r1 - r2)]
}

// 0 → 1 from `at`, on a spring (for anything that arrives)
export const arrive = (t, at = 0, spring = 'focused') => step(t - at, spring)[0]

// A value through keys [{ at, v, spring }]: from the first key's v, each
// later key sets the spring off toward its v at its time (the moves add
// up, so a move set off before the last one settled blends into it)
export function springTo(t, keys, spring = 'focused') {
  let v = keys[0].v, speed = 0
  for (let i = 1; i < keys.length; i++) {
    const [x, dx] = step(t - keys[i].at, keys[i].spring ?? spring)
    v += (keys[i].v - keys[i - 1].v) * x
    speed += (keys[i].v - keys[i - 1].v) * dx
  }
  return { v, speed }
}

// The camera through keys [{ at, x, y, zoom, spring }]: x and y move
// straight, zoom in log space (a push-in keeps one speed). Speeds come
// along for the motion blur
export function camera(t, keys, spring = 'focused') {
  const along = f => springTo(t, keys.map(k => ({ at: k.at, v: f(k), spring: k.spring })), spring)
  const x = along(k => k.x), y = along(k => k.y), z = along(k => Math.log(k.zoom))
  return { x: x.v, y: y.v, zoom: Math.exp(z.v), vx: x.speed, vy: y.speed, vz: z.speed }
}

// The camera keys of a screen recording's auto zoom, from clicks
// [{ at, x, y, zoom? }] (picture fractions): in to each click from `pre` s
// before it, held `post` s after; a click soon after another is panned to
// rather than zoomed out and back. base: the view between clicks
export function follow(clicks, { base = { x: 0.5, y: 0.5, zoom: 1 }, zoom = 1.6, pre = 0.3, post = 2.5, spring = 'focused' } = {}) {
  const keys = [{ at: 0, ...base }]
  clicks.forEach((c, i) => {
    keys.push({ at: c.at - pre, x: c.x, y: c.y, zoom: c.zoom ?? zoom, spring })
    const next = clicks[i + 1]
    if (!next || next.at - c.at > post + pre) keys.push({ at: c.at + post, ...base, spring: 'gentle' })
  })
  return keys
}

// A slow push while a result holds, so nothing stops dead: a zoom to
// multiply in, from `from` s on
export const drift = (t, from = 0, amount = 0.035, over = 4) => 1 + amount * clamp((t - from) / over)

// ---- The depth layer ----

let layer = null
let uid = 0
// This frame's depth layer: the parts given, the last frame's gone
export function depth(...html) {
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'depth'
    layer.style.cssText = `position:absolute;left:0;top:0;overflow:hidden;pointer-events:none;perspective:${PERSPECTIVE}px`
    document.getElementById('stage').before(layer)
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
function place(width, height, box, view) {
  const fit = Math.min(box.w / width, box.h / height)
  const s = Math.min(fit * view.zoom, Math.max(1 / OUT, fit))
  // Larger than the box: its centre kept in, so no edge shows
  const hold = (c, size, room) => (size * s <= room ? 0.5 : clamp(c, room / 2 / (size * s), 1 - room / 2 / (size * s)))
  const cx = hold(view.x, width, box.w), cy = hold(view.y, height, box.h)
  return { s, left: box.x + box.w / 2 - cx * width * s, top: box.y + box.h / 2 - cy * height * s }
}

// A motion blur for a layer panning vx, vy page px a second: how far it
// travels while a shutter of half a frame is open, as an SVG filter; none
// under a pixel. Zooms get none: a radial smear reads as a lost focus
function blur(vx, vy) {
  const per = 0.5 / fps()
  const bx = Math.abs(vx) * per, by = Math.abs(vy) * per
  if (Math.max(bx, by) * OUT < 1) return { css: '', svg: '' }
  const id = `mb${++uid}`
  return {
    css: `filter:url(#${id});`,
    svg: `<svg width="0" height="0" style="position:absolute"><filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${n(Math.min(bx, 16))} ${n(Math.min(by, 16))}"/></filter></svg>`
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
//   dim: 0–1 the picture dimmed and blurred, while the focus is elsewhere
//   p: brings it in
// Gives back { html, at(px, py) → frame px, scale, seen } so a cursor or
// a field lands on a point of the picture
export function shot(opts) {
  return opts.frame === 'window' ? windowShot(opts) : boxShot(opts)
}

const layers = (file, width, height, over) => {
  const pic = (f, o) => `<div style="position:absolute;left:0;top:0;width:${width}px;height:${height}px;opacity:${n(o)};background:url(${url(f)}) 0 0/100% 100% no-repeat"></div>`
  return pic(file, 1) + (over ? pic(over.file, clamp(over.opacity)) : '')
}
const dimmed = (dim, u) => (dim > 0 ? `filter:brightness(${n(1 - 0.6 * clamp(dim))}) blur(${n(12 * u * clamp(dim))}px);` : '')
const SHADOW = u => `0 0 0 1px rgba(255,255,255,.1),0 ${n(20 * u)}px ${n(60 * u)}px rgba(0,0,0,.18),0 ${n(2 * u)}px ${n(6 * u)}px rgba(0,0,0,.08)`

// The camera within a box the picture fills
function boxShot({ file, width, height, box, view = { x: 0.5, y: 0.5, zoom: 1 }, tilt = { x: 0, y: 0 }, over = null, dim = 0, p = 1 }) {
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
    `<div style="position:absolute;left:0;top:0;transform:translate(${n(left - box.x)}px,${n(top - box.y)}px) scale(${s});transform-origin:0 0">${layers(file, width, height, over)}</div></div></div>`
  return { html, at: (px, py) => ({ x: left + px * s, y: top + py * s }), scale: s, seen }
}

// The camera on a window: the window is the picture fitted in the box
// with its title bar; zoom z scales the whole window about the point the
// view is on, which drifts toward the box's centre as it closes in (so
// at z = 1 the window sits where it was placed)
function windowShot({ file, width, height, box, view = { x: 0.5, y: 0.5, zoom: 1 }, tilt = { x: 0, y: 0 }, over = null, dim = 0, p = 1 }) {
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
    `<div style="position:absolute;left:0;top:0;transform:scale(${s0});transform-origin:0 0">${layers(file, width, height, over)}</div></div></div></div></div>`
  return { html, at, scale: s0 * z, seen }
}

// Something drawn on a shot's picture, cut to the part of it in frame
const onShot = (under, html) => `<div style="position:absolute;left:${n(under.seen.x)}px;top:${n(under.seen.y)}px;width:${n(under.seen.w)}px;height:${n(under.seen.h)}px;overflow:hidden">` +
  `<div style="position:absolute;left:${n(-under.seen.x)}px;top:${n(-under.seen.y)}px">${html}</div></div>`

// ---- A desktop: windows on a simulated screen, with its own camera ----

// The Dock's apps, drawn here as plain, original icons in the manner of a
// Mac's (a folder, a browser, mail, a calendar, notes, music, settings, a
// terminal, and the trash past a divider): they read as a Mac's Dock and
// copy no one's marks. Each is SVG on a 100-unit square
const squircle = fill => `<rect x="4" y="4" width="92" height="92" rx="22" fill="${fill}"/>`
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
const DOCK_APPS = [
  `<defs>${grad('dkf', '#7fd0ff', '#1f8bff')}</defs>${squircle('url(#dkf)')}<path d="M22 34h20l6 6h30v34H22z" fill="#cfeaff"/><path d="M22 44h56v30H22z" fill="#fff" opacity=".95"/>`,
  `<defs>${grad('dkb', '#ffffff', '#e3e9f2')}${grad('dkg', '#58b5ff', '#1d6ee8')}</defs>${squircle('url(#dkb)')}<circle cx="50" cy="50" r="30" fill="url(#dkg)"/><g fill="none" stroke="#fff" stroke-width="3" opacity=".9"><ellipse cx="50" cy="50" rx="13" ry="30"/><path d="M20 50h60M24 36h52M24 64h52"/></g>`,
  `<defs>${grad('dkm', '#63c0ff', '#1b6fea')}</defs>${squircle('url(#dkm)')}<rect x="22" y="32" width="56" height="38" rx="5" fill="#fff"/><path d="M23 34l27 20 27-20" fill="none" stroke="#1b6fea" stroke-width="4" stroke-linejoin="round"/>`,
  `${squircle('#fff')}<path d="M4 26a22 22 0 0 1 22-22h48a22 22 0 0 1 22 22v8H4z" fill="#ff4a3d"/><text x="50" y="27" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#fff">NOV</text><text x="50" y="80" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="46" font-weight="300" fill="#1d1d1f">3</text>`,
  `<defs>${grad('dkn', '#fff8d0', '#ffe46a')}</defs>${squircle('url(#dkn)')}<path d="M4 26a22 22 0 0 1 22-22h48a22 22 0 0 1 22 22v6H4z" fill="#ffd23a"/><g stroke="#cbbf8f" stroke-width="2.5"><path d="M18 48h64M18 60h64M18 72h64M18 84h46"/></g>`,
  `<defs>${grad('dku', '#ff6f8b', '#f42c53')}</defs>${squircle('url(#dku)')}<path d="M40 30l28-6v34" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><ellipse cx="34" cy="68" rx="9" ry="7" fill="#fff"/><ellipse cx="62" cy="62" rx="9" ry="7" fill="#fff"/><path d="M43 66V30" stroke="#fff" stroke-width="5"/>`,
  `<defs>${grad('dks', '#b4bcc6', '#69727e')}</defs>${squircle('url(#dks)')}<circle cx="50" cy="50" r="22" fill="none" stroke="#3a3f47" stroke-width="10" stroke-dasharray="7 4.5"/><circle cx="50" cy="50" r="15" fill="#d9dde2"/><circle cx="50" cy="50" r="6" fill="#69727e"/>`,
  `<defs>${grad('dkt', '#3a3a3c', '#151517')}</defs>${squircle('url(#dkt)')}<path d="M26 38l12 10-12 10" fill="none" stroke="#e8e8e8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 62h22" stroke="#e8e8e8" stroke-width="5" stroke-linecap="round"/>`
]
const DOCK_TRASH = `<path d="M30 30h40l-4 54H34z" fill="rgba(255,255,255,.55)" stroke="rgba(255,255,255,.9)" stroke-width="2"/><path d="M26 28h48" stroke="rgba(255,255,255,.9)" stroke-width="4" stroke-linecap="round"/><g stroke="rgba(120,130,150,.55)" stroke-width="2"><path d="M42 38v38M50 38v38M58 38v38"/></g>`

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
function desktopWindows(windows, u) {
  const bar = 26 * u
  return windows.map(win => {
    const s = win.w / win.width
    return { ...win, s, bar, h: win.height * s + bar }
  })
}

// Where a point of a window's picture is on the desktop (desktop px),
// to aim the camera at: follow() takes these divided by the box's size
export function desktopPoint({ box, windows }, i, px, py) {
  const w = desktopWindows(windows, unit())[i]
  return { x: (w.x + px * w.s) / box.w, y: (w.y + w.bar + py * w.s) / box.h }
}

// The desktop in box { x, y, w, h }, its windows [{ file, width, height,
// x, y, w, title, p, over }] (p brings a window in; x, y may change with t
// to drag it), seen by view { x, y, zoom } (a camera(t, keys) over desktop
// fractions; follow() and desktopPoint() aim it at clicks). The view's
// point is centred in the box; zoom never passes the pictures' pixels.
// app: the name in the menu bar; dock: the product's icon (a picture of
// the project), first in the Dock; apps: pictures of the project to stand
// in for the Dock's own icons (the person's, licensed to show), when given
// Gives back { html, at(i, px, py) → frame px, window(i) } for the
// cursor and words; window(i) is what field() takes for that window
export function desktop({ box, windows, view = { x: 0.5, y: 0.5, zoom: 1 }, app = '', dock = '', apps = null, p = 1 }) {
  const { C } = kit()
  const u = unit()
  const wins = desktopWindows(windows, u)
  // Sharp: the window shown largest sets how close the camera may come
  const sharp = Math.min(...wins.map(w => 1 / OUT / w.s))
  const z = clamp(view.zoom, 0.5, Math.max(1, sharp))
  const cx = box.w / 2, cy = box.h / 2
  // Desktop px → box px: the view's point to the box's centre
  const tx = cx - view.x * box.w * z, ty = cy - view.y * box.h * z
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
  const dockHtml = `<div style="position:absolute;left:50%;bottom:${n(6 * u)}px;transform:translateX(-50%);display:flex;align-items:center;gap:${n(6 * u)}px;padding:${n(5 * u)}px ${n(7 * u)}px;` +
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
      `<div style="position:absolute;left:0;top:0;transform:scale(${w.s});transform-origin:0 0">${layers(w.file, w.width, w.height, w.over)}</div></div></div>`
  }).join('')
  const q = clamp(p)
  const html = mb.svg + `<div style="position:absolute;left:${n(box.x)}px;top:${n(box.y)}px;width:${n(box.w)}px;height:${n(box.h)}px;overflow:hidden;border-radius:${n(12 * u)}px;` +
    `background:#2c3f86;box-shadow:${SHADOW(u)};opacity:${n(clamp(q * 1.6))};transform:translateY(${n((1 - arrive(q * 1.4, 0)) * 30 * u)}px)">` +
    `<div style="position:absolute;left:0;top:0;width:${n(box.w)}px;height:${n(box.h)}px;transform:translate(${n(tx)}px,${n(ty)}px) scale(${n(z * 1000) / 1000});transform-origin:0 0;${mb.css}">` +
    `${wallpaper}${windowHtml}${menu}${dockHtml}</div></div>`
  const { W, H } = kit()
  const x0 = Math.max(box.x, 0), y0 = Math.max(box.y, 0)
  const seen = { x: x0, y: y0, w: Math.min(box.x + box.w, W) - x0, h: Math.min(box.y + box.h, H) - y0 }
  return { html, at, zoom: z, window: i => ({ at: (px, py) => at(i, px, py), scale: wins[i].s * z, seen }) }
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

// ---- Words ----

// Text typed key by key from `at`, cps characters a second, a caret
// blinking while it types and a moment after: { text, caret, done }
export function typing(t, { text, at = 0, cps = 40 }) {
  const chars = [...String(text)]
  const shown = clamp(Math.floor((t - at) * cps), 0, chars.length)
  const end = at + chars.length / cps
  const caret = t >= at && t < end + 1.2 && (shown < chars.length || Math.floor((t - end) / 0.53) % 2 === 0)
  return { text: chars.slice(0, shown).join(''), caret, done: shown === chars.length }
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

// ---- The pointer, on the stage above ----

// A pointer through keys [{ at, x, y }] (frame px), moving on a gentle arc
// with a minimum-jerk ease and leaning into its move; it presses at each
// time in clicks (0.8× for 0.13 s) and lets a soft ring go; it hides 2 s
// after its last move or click and is back 0.25 s before the next. size:
// its height, about 1/18 of the frame's shorter side
export function cursor(t, { path, clicks = [], p = 1, size }) {
  const { W, H, C } = kit()
  size ??= Math.min(W, H) / 18
  if (p <= 0 || !path.length) return ''
  const i = path.findIndex(k => k.at > t)
  let x, y, vx = 0
  if (i === 0 || path.length === 1) ({ x, y } = path[0])
  else if (i < 0) ({ x, y } = path.at(-1))
  else {
    const a = path[i - 1], b = path[i]
    const d = (b.at - a.at) || 1
    const u = clamp((t - a.at) / d)
    const e = u * u * u * (10 - 15 * u + 6 * u * u)
    // A hand's path bows a little to the side
    const bow = Math.sin(Math.PI * e) * 0.12
    x = a.x + (b.x - a.x) * e - (b.y - a.y) * bow
    y = a.y + (b.y - a.y) * e + (b.x - a.x) * bow
    vx = (b.x - a.x) * 30 * u * u * (1 - u) * (1 - u) / d
  }
  const events = [...path.map(k => k.at), ...clicks].sort((a, b) => a - b)
  const last = events.filter(e => e <= t).at(-1) ?? -Infinity
  const next = events.find(e => e > t) ?? Infinity
  const shown = Math.max(1 - clamp((t - last - 2) / 0.4), clamp(1 - (next - t) / 0.25))
  let press = 0, rings = ''
  for (const c of clicks) {
    const d = t - c
    if (Math.abs(d) < 0.13) press = Math.max(press, 1 - Math.abs(d) / 0.13)
    if (d >= 0 && d < 0.6) {
      const q = d / 0.6
      rings += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(size * (0.25 + 0.9 * (1 - (1 - q) ** 3)))}" fill="none" stroke="${C.accent}" stroke-width="${n(size / 10)}" opacity="${n(0.7 * (1 - q))}"/>`
    }
  }
  const o = clamp(p) * clamp(shown)
  if (o <= 0) return rings
  const k = (size / 24) * (1 - 0.2 * press)
  const lean = clamp(vx / (W * 2), -1, 1) * 8
  return rings + `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(lean)}) scale(${n(k)})" opacity="${n(o)}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">` +
    '<path d="M0 0L0 19.5L4.7 15.2L8 22.6L11.6 21L8.4 13.8L14.6 13.4Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></g>'
}

// ---- Explaining: drawn pieces in the product's own system ----
//
// A promo shows the product itself and draws only what no screen of it
// can show (taste: promo-explain): these pieces draw in the film's colours (kit.C: ground,
// ink, muted, the one accent) and the product's own fonts once
// site/fonts.css is loaded (--brand-head, --brand-mono), an editorial
// system after oliverz.dev's product films: numbered chapters over a rule,
// big heavy headlines rising line by line, square corners and 2 px rules.

const HEAD = () => `var(--brand-head, ${kit().HEAD_FONT})`
// The film's ground, as the page paints it (the look's background, tuned
// to the brand): what ink shows on, and the colour of words set on ink.
// A ground painted as a gradient has no one colour: the first colour of
// the gradient stands for it, and with none, whichever of near-black and
// white the ink doesn't look like (words set on ink must never vanish)
const paper = () => {
  const style = getComputedStyle(document.body)
  const bg = style.backgroundColor
  if (/rgba?\(/.test(bg) && !/,\s*0\)$/.test(bg)) return bg
  const stop = style.backgroundImage.match(/rgba?\([^)]*\)/)?.[0]
  if (stop && !/,\s*0\)$/.test(stop)) return stop
  return lightness(kit().C.text) > 0.5 ? '#0b0d12' : '#ffffff'
}
// Words set on the accent: near-black on a light accent, white on a dark one
const onAccent = () => (lightness(kit().C.accent) > 0.5 ? '#0a0a0a' : '#ffffff')
// How light a CSS colour is, 0 (black) to 1 (white), drawn to find out
const lightness = color => {
  const g = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
  return (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255
}
const MONO = () => `var(--brand-mono, ui-monospace, 'SF Mono', Menlo, monospace)`
const RULE = () => Math.max(1.5, 2 * unit())
// Short rises, eased out, no bounce
const rise = (t, at, d = 0.45) => 1 - (1 - clamp((t - at) / d)) ** 3
const lin = (t, at, d) => clamp((t - at) / d)
// The page's edge margin, and where a chapter's content starts
const margin = () => kit().PAD ?? 56 * unit()

// Where a beat's pieces go, with room between them (taste: promo-space):
//   layout('side')  the words in a left column, the picture right of them
//   layout('below') the words across the top, the picture under them
// lines: the headline's lines. Gives back { words: { x, y, width, size,
// under }, picture: { x, y, w, h } (pass as a shot's box), source: { y } }
// in page px (under: where steps or a bubble go below the headline, clear
// of its last line)
// px: the words start under the chapter's rule, a gap of at least 5% of
// the frame's height parts words from picture, and a band at the bottom
// is kept for the source line. bleed: the picture runs off the right and
// the bottom edges instead of stopping at the margin
export function layout(kind = 'side', { lines = 2, size, bleed = false } = {}) {
  const { W, H } = kit()
  const u = unit(), m = margin()
  const fs = size ?? Math.min(W, H) * (kind === 'side' ? 0.07 : 0.083)
  const gap = Math.max(40 * u, H * 0.05)
  const top = 104 * u
  const sourceBand = 44 * u
  const bottom = H - m * 0.6 - sourceBand
  const textH = lines * fs * 1.06
  const under = y => y + textH + Math.max(36 * u, fs * 0.7)
  if (kind === 'side') {
    const width = W * 0.27
    const x = m + width + gap
    return {
      words: { x: m, y: top + 46 * u, width, size: fs, under: under(top + 46 * u) },
      picture: { x, y: top, w: bleed ? W - x + 40 * u : W - m - x, h: bleed ? H - top + 40 * u : bottom - gap * 0.5 - top },
      source: { y: H - m * 0.6 - sourceBand * 0.55 }
    }
  }
  const y = top + textH + gap
  return {
    words: { x: m, y: top, width: W - 2 * m, size: fs, under: under(top) },
    picture: { x: m, y, w: bleed ? W - m + 40 * u : W - 2 * m, h: bleed ? H - y + 40 * u : bottom - gap * 0.5 - y },
    source: { y: H - m * 0.6 - sourceBand * 0.55 }
  }
}

// A source line in its own band at the bottom: small mono, muted
export function source(t, { text, y, at = 0 }) {
  const { W, H, C } = kit()
  const u = unit(), m = margin()
  return `<div style="position:absolute;left:${n(m)}px;top:${n(y ?? H - 40 * u)}px;width:${n(W - 2 * m)}px;font:400 ${n(12 * u)}px/1.3 ${MONO()};color:${C.muted};` +
    `opacity:${n(rise(t, at, 0.4) * 0.85)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(text)}</div>`
}

// A chapter's label over a rule: "01 — The problem" at the left, the
// product's name at the right, both in mono capitals
export function chapter(t, { number, title, name = '', at = 0, color }) {
  const { W, C } = kit()
  const u = unit(), m = margin()
  const q = rise(t, at, 0.4)
  const ink = color ?? C.text
  return `<div style="position:absolute;left:${n(m)}px;top:${n(40 * u)}px;width:${n(W - 2 * m)}px;display:flex;justify-content:space-between;` +
    `padding-bottom:${n(12 * u)}px;border-bottom:${n(RULE())}px solid ${ink};clip-path:inset(0 ${n((1 - q) * 100)}% 0 0);` +
    `font:500 ${n(15 * u)}px/1 ${MONO()};letter-spacing:.08em;text-transform:uppercase;color:${ink}">` +
    `<span>${String(number).padStart(2, '0')} — ${esc(title)}</span><span>${esc(name)}</span></div>`
}

// A headline of one or two lines, each rising out of its own mask; the
// second muted (the turn of the sentence). size: its height, about 8% of
// the frame's shorter side
export function headline(t, { lines, x, y, at = 0, size, width, color, step = 0.4 }) {
  const { W, H, C } = kit()
  const fs = size ?? Math.min(W, H) * 0.083
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean)
  const html = list.map((line, i) => {
    const q = rise(t, at + i * step, 0.5)
    return `<span style="display:block;overflow:hidden;padding-bottom:.08em"><span style="display:block;transform:translateY(${n((1 - q) * 110)}%);color:${i ? C.muted : color ?? C.text}">` +
      `${esc(line).replace(/\*(.+?)\*/g, `<span style="color:${C.accent}">$1</span>`)}</span></span>`
  }).join('')
  return `<div style="position:absolute;left:${n(x ?? margin())}px;top:${n(y)}px;${width ? `width:${n(width)}px;` : `width:${n(W - 2 * margin())}px;`}` +
    `font:900 ${n(fs)}px/0.98 ${HEAD()};letter-spacing:-0.035em">${html}</div>`
}

// A row of tiles (frames, cards, pages) with a state each: the diagram of
// what happens to many things at once, before and after (the old way: all
// render again; the product's: one does). tiles: [{ file, label? }];
// state(i) → { chip, kind: 'wrong'|'accent'|'muted', dim 0–1, sweep 0–1,
// mark: true } at this t. box: { x, y, w, h } for the row
export function row(t, { tiles, box, at = 0, gap, state = () => ({}) }) {
  const { C } = kit()
  const u = unit()
  const g = gap ?? 16 * u
  const w = (box.w - g * (tiles.length - 1)) / tiles.length
  const red = '#e5484d'
  return tiles.map((tile, i) => {
    const q = rise(t, at + i * 0.08, 0.35)
    const s = state(i) ?? {}
    const outline = s.mark ? `${n(4 * u)}px solid ${s.kind === 'wrong' ? red : C.accent}` : `${n(RULE())}px solid ${C.text}`
    const chip = s.chip
      ? `<span style="position:absolute;left:50%;bottom:${n(-34 * u)}px;transform:translateX(-50%);white-space:nowrap;font:500 ${n(12 * u)}px/1 ${MONO()};letter-spacing:.06em;padding:${n(5 * u)}px ${n(8 * u)}px;` +
        (s.kind === 'wrong' ? `background:${red};color:#fff` : s.kind === 'accent' ? `background:${C.accent};color:${onAccent()}` : `border:1px solid ${C.muted};color:${C.muted}`) +
        `;opacity:${n(s.chipIn ?? 1)}">${esc(s.chip)}</span>`
      : ''
    return `<div style="position:absolute;left:${n(box.x + i * (w + g))}px;top:${n(box.y)}px;width:${n(w)}px;height:${n(box.h)}px;outline:${outline};background:${C.text};` +
      `opacity:${n(q)};transform:translateY(${n((1 - q) * 30 * u)}px)">` +
      (tile.file ? `<div style="position:absolute;inset:0;background:url(${url(tile.file)}) center/cover no-repeat"></div>` : '') +
      `<div style="position:absolute;inset:0;background:${paper()};opacity:${n(s.dim ?? 0)}"></div>` +
      `<div style="position:absolute;left:0;bottom:0;height:${n(8 * u)}px;width:${n((s.sweep ?? 0) * 100)}%;background:${C.accent}"></div>` +
      `<span style="position:absolute;top:${n(6 * u)}px;left:${n(6 * u)}px;font:500 ${n(12 * u)}px/1 ${MONO()};color:#fff;background:rgba(0,0,0,.55);padding:1px ${n(5 * u)}px">${esc(tile.label ?? String(i + 1).padStart(2, '0'))}</span>` +
      chip + '</div>'
  }).join('')
}

// A count in a footer over a rule: a label at the left, the number at the
// right in mono ("7 / 7"), in the accent or a warning colour when it says so
export function counter(t, { label, value, at = 0, tone = '' }) {
  const { W, C } = kit()
  const u = unit(), m = margin()
  const q = rise(t, at, 0.4)
  const color = tone === 'wrong' ? '#e5484d' : tone === 'accent' ? C.accent : C.text
  return `<div style="position:absolute;left:${n(m)}px;bottom:${n(44 * u)}px;width:${n(W - 2 * m)}px;display:flex;justify-content:space-between;align-items:baseline;` +
    `padding-top:${n(12 * u)}px;border-top:${n(RULE())}px solid ${C.text};opacity:${n(q)};color:${C.text}">` +
    `<span style="font:500 ${n(14 * u)}px/1 ${MONO()};letter-spacing:.08em;text-transform:uppercase">${esc(label)}</span>` +
    `<span style="font:500 ${n(28 * u)}px/1 ${MONO()};color:${color}">${esc(value)}</span></div>`
}

// Steps that light one after another (Generate → Render → Check → Fix):
// bordered mono chips in a column (or a row), the lit ones in the accent
export function steps(t, { items, x, y, at = 0, step = 0.5, across = false, width }) {
  const { C } = kit()
  const u = unit()
  return `<div style="position:absolute;left:${n(x)}px;top:${n(y)}px;display:flex;flex-direction:${across ? 'row' : 'column'};align-items:flex-start;gap:${n(16 * u)}px;${width ? `width:${n(width)}px;` : ''}">` +
    items.map((item, i) => {
      const q = rise(t, at + i * 0.08, 0.35)
      const lit = t >= at + 0.4 + i * step
      return `<span style="display:flex;align-items:center;gap:${n(12 * u)}px;padding:${n(12 * u)}px ${n(18 * u)}px;border:${n(RULE())}px solid ${C.text};` +
        `background:${lit ? C.accent : 'transparent'};opacity:${n(q)};transform:translateX(${n((1 - q) * -20 * u)}px);font:500 ${n(20 * u)}px/1 ${MONO()};letter-spacing:.04em;color:${lit ? onAccent() : C.text}">` +
        `<b style="font-weight:500;font-size:${n(14 * u)}px;color:${lit ? onAccent() : C.muted}">${String(i + 1).padStart(2, '0')}</b>${esc(item)}</span>`
    }).join('') + '</div>'
}

// A request typed into a dark bubble, its sender above it in the accent
// ("YOU · SHOT 01"): what a person asks the product for, in their words
export function bubble(t, { who, text, x, y, w, at = 0, cps = 22 }) {
  const { C } = kit()
  const u = unit()
  const q = rise(t, at, 0.4)
  const typed = typing(t, { text, at: at + 0.4, cps })
  return `<div style="position:absolute;left:${n(x)}px;top:${n(y)}px;width:${n(w)}px;min-height:${n(110 * u)}px;padding:${n(22 * u)}px ${n(24 * u)}px;background:${C.text};color:${paper()};` +
    `opacity:${n(q)};transform:translateY(${n((1 - q) * 20 * u)}px);font:700 ${n(26 * u)}px/1.3 ${HEAD()};box-sizing:border-box">` +
    `<span style="display:block;margin-bottom:${n(10 * u)}px;font:500 ${n(13 * u)}px/1 ${MONO()};letter-spacing:.08em;color:${C.accent}">${esc(who)}</span>` +
    `${esc(typed.text)}<span style="display:inline-block;width:.5em;height:1em;vertical-align:-.12em;background:${paper()};opacity:${typed.caret ? 1 : 0}"></span></div>`
}

// Before and after in one box: the after uncovered by a divider in the
// accent sweeping from left to right from `at` over `d` seconds, each side
// tagged. before, after: { file } (pictures of the same size)
export function compare(t, { before, after, box, at = 0, d = 1.2, labels = ['BEFORE', 'AFTER'] }) {
  const { C } = kit()
  const u = unit()
  const q = rise(t, at - 0.5, 0.45)
  const split = 100 - 50 * (1 - (1 - lin(t, at, d)) ** 2)
  const tag = (text, side) => `<span style="position:absolute;top:${n(12 * u)}px;${side}:${n(12 * u)}px;font:500 ${n(13 * u)}px/1 ${MONO()};letter-spacing:.08em;padding:${n(5 * u)}px ${n(8 * u)}px;background:${C.text};color:${paper()}">${esc(text)}</span>`
  return `<div style="position:absolute;left:${n(box.x)}px;top:${n(box.y)}px;width:${n(box.w)}px;height:${n(box.h)}px;outline:${n(RULE())}px solid ${C.text};overflow:hidden;background:${C.text};opacity:${n(q)}">` +
    `<div style="position:absolute;inset:0;background:url(${url(before.file)}) center/cover no-repeat"></div>` +
    `<div style="position:absolute;inset:0;background:url(${url(after.file)}) center/cover no-repeat;clip-path:inset(0 0 0 ${n(split)}%)"></div>` +
    `<div style="position:absolute;top:0;bottom:0;left:${n(split)}%;width:${n(3 * u)}px;margin-left:${n(-1.5 * u)}px;background:${C.accent}"></div>` +
    tag(labels[0], 'left') + (split < 99 ? tag(labels[1], 'right') : '') + '</div>'
}

// The cut between two shots: an ink panel crossing the frame in 0.36 s,
// half at the end of a shot and half at the start of the next. Give the
// shot's length; draw it last. The film's first shot doesn't enter by
// one (enter: false), nor its last leave by one (leave: false)
export function wipe(t, { duration, color, half = 0.18, enter = true, leave = true }) {
  const { W, H, C } = kit()
  let p = null
  if (enter && t < half) p = 0.5 + t / (2 * half)
  else if (leave && t > duration - half) p = (t - (duration - half)) / (2 * half)
  if (p === null) return ''
  return `<div style="position:absolute;top:0;left:${n((1 - p * 2) * W)}px;width:${n(W)}px;height:${n(H)}px;background:${color ?? C.text}"></div>`
}

// The end card: a field of the accent, the product's name huge at the
// bottom left, the line to remember under it, a meta row over a rule
// (what it costs and runs on, its address)
export function endCard(t, { name, line, meta = [], at = 0 }) {
  const { W, H, C } = kit()
  const u = unit(), m = margin()
  const ink = onAccent()
  const big = Math.min(W * 0.155, H * 0.28)
  const slide = (t - at) * 6 * u
  return `<div style="position:absolute;inset:0;width:${W}px;height:${H}px;background:${C.accent};color:${ink}">` +
    `<div style="position:absolute;left:${n(m - 12 * u - slide)}px;bottom:${n(H * 0.28)}px;font:900 ${n(big)}px/.78 ${HEAD()};letter-spacing:-0.05em;white-space:nowrap;` +
    `transform:translateY(${n((1 - rise(t, at, 0.5)) * 40 * u)}px);opacity:${n(rise(t, at, 0.5))}">${esc(name)}</div>` +
    `<div style="position:absolute;left:${n(m)}px;bottom:${n(H * 0.17)}px;font:800 ${n(38 * u)}px/1.1 ${HEAD()};letter-spacing:-0.02em;opacity:${n(rise(t, at + 0.3))}">${esc(line)}</div>` +
    `<div style="position:absolute;left:${n(m)}px;right:${n(m)}px;bottom:${n(48 * u)}px;display:flex;justify-content:space-between;padding-top:${n(14 * u)}px;border-top:${n(RULE())}px solid ${ink};` +
    `font:500 ${n(20 * u)}px/1.2 ${HEAD()};opacity:${n(rise(t, at + 0.55))}">${meta.map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`
}
