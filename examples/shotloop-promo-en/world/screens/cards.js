// world/screens/cards.js: the title and the end card, the logo and name as one mark. Part of the screens kit (world/screens.js, which documents it and re-exports its pieces); the engine's, never edited here.
import { cardBoxes } from '../promo-layout.js'
import { HEAD, RULE, esc, inkOf, kit, n, onAccent, page, pictures, rise, unit, url } from './base.js'

// The title and the end card share a lockup (promo-layout.js cardBoxes):
// the product's real logo (a picture of the project, repo/logo.png or
// site/logo.png) as tall as the name's capitals and centred on them, the
// name in the product's heavy face, the line under it. slide drifts the
// lockup left a little over the beat, so the card never sits still
export function card(t, { name, line, logo, at, color }) {
  const u = unit()
  const b = cardBoxes(page(), { logo: !!logo, name })
  const q = rise(t, at, 0.5)
  const slide = (t - at) * 6 * u
  const font = `900 ${n(b.big)}px ${HEAD()}`
  // The logo on the name's baseline (a flex row's baseline is an image's
  // foot), as tall as its capitals measured in the face itself: a web
  // font's own cap height can't be trusted to be in its file
  return `<div data-kit="card" style="position:absolute;left:${n(b.logo?.x ?? b.name.x)}px;top:${n(b.name.y - b.big * 0.2)}px;display:flex;align-items:baseline;gap:${n(b.big * 0.22)}px;font:${font};line-height:1;letter-spacing:-0.05em;white-space:nowrap;` +
    `transform:translate(${n(-slide)}px,${n((1 - q) * 40 * u)}px);opacity:${n(q)};color:${color}">` +
    (logo ? logoMark(logo, capHeight(font)) : '') +
    `<span>${esc(name)}</span></div>` +
    (line ? `<div style="position:absolute;left:${n(b.line.x)}px;top:${n(b.line.y - b.line.size)}px;font:800 ${n(b.line.size)}px/1.1 ${HEAD()};letter-spacing:-0.02em;color:${color};opacity:${n(rise(t, at + 0.3))}">${esc(line)}</div>` : '')
}

// A logo whose ink (not its clear margin) is h tall: the picture scaled
// and cropped to it, its foot the box's, so a flex row's baseline is the
// ink's foot. Load the logo first (load()), so its pixels can be read
export function logoMark(file, h) {
  const ink = inkOf(file)
  const img = pictures.get(file)
  const ratio = img ? img.naturalWidth / img.naturalHeight : 1
  const w = h * (ink.w / ink.h) * ratio
  const bw = w / ink.w, bh = h / ink.h
  return `<div style="flex:none;width:${n(w)}px;height:${n(h)}px;background:url(${url(file)}) ${n(-ink.x * bw)}px ${n(-ink.y * bh)}px/${n(bw)}px ${n(bh)}px no-repeat"></div>`
}

// How tall a face's capitals are set, in px: measured from an H drawn in
// it, the family resolved as the page resolves it
export const caps = new Map()
export function capHeight(font) {
  if (!caps.has(font)) {
    const probe = document.createElement('span')
    probe.style.font = font
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const g = document.createElement('canvas').getContext('2d')
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    probe.remove()
    caps.set(font, g.measureText('H').actualBoundingBoxAscent)
  }
  return caps.get(font)
}

// The film's title, the first thing seen (rule: promo-open-close): the
// lockup and the line on the film's own ground
export function titleCard(t, { name, line = '', logo = '', at = 0 }) {
  return card(t, { name, line, logo, at, color: kit().C.text })
}

// The end card: a field of the accent, the lockup, the line to remember
// under it, a meta row over a rule (what it costs and runs on, its
// address)
export function endCard(t, { name, line, meta = [], logo = '', at = 0 }) {
  const { W, H, C } = kit()
  const u = unit()
  const ink = onAccent()
  const b = cardBoxes(page())
  return `<div style="position:absolute;inset:0;width:${W}px;height:${H}px;background:${C.accent};color:${ink}">` + card(t, { name, line, logo, at, color: ink }) +
    `<div style="position:absolute;left:${n(b.meta.x)}px;top:${n(b.meta.y)}px;width:${n(b.meta.w)}px;display:flex;justify-content:space-between;padding-top:${n(14 * u)}px;border-top:${n(RULE())}px solid ${ink};box-sizing:border-box;` +
    `font:500 ${n(20 * u)}px/1.2 ${HEAD()};opacity:${n(rise(t, at + 0.55))}">${meta.map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`
}
