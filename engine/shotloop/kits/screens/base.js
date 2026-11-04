// world/screens/base.js: the shared pieces: the kit and its page, sizes, the material a shot loads (pictures, live parts, fonts, the frames), each beat's frame and layout, colours and type helpers. Part of the screens kit (world/screens.js, which documents it and re-exports its pieces); the engine's, never edited here.
import { layoutBoxes } from '../promo-layout.js'

export const kit = () => window.kit
// The page as promo-layout.js takes it
export const page = () => ({ W: kit().W, H: kit().H, PAD: kit().PAD })
// Output pixels per page pixel: the final film is 1080×1920 (or 1920×1080)
// over the kit's 720×1280 page (engine/shotloop/project/project.mjs SIZES)
export const OUT = 1.5
export const PERSPECTIVE = 2000
export const n = v => Math.round(v * 100) / 100
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
// The kit's size unit: 1 on the 720-wide portrait page
export const unit = () => Math.min(kit().W, kit().H) / 720
export const fps = () => window.__shotloop?.ctx?.fps ?? 30

// A picture's or a part's address from its place in the project
export const url = file => new URL(`../../${file}`, import.meta.url).href

// ---- Material ----

export const parts = new Map()
// Pictures decoded, live parts read and the brand's fonts (site/fonts.css)
// loaded before the first frame: call it from setup
export let frames = null
export const framesRead = () => (frames ??= fetch(url('world/frames.json')).then(r => (r.ok ? r.json() : null)).catch(() => null).then(f => (frames = f)))
export const load = (...files) => Promise.all([framesRead(), ...files.map(async f => {
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
  pictures.set(f, img)
})])

// Pictures as load() decoded them, for what is measured from their pixels
export const pictures = new Map()
// Where a picture's ink is (its pixels that aren't clear), as fractions
// of it: an app's icon sits inside a clear margin of its own, which a
// lockup must not count as logo
export const inks = new Map()
export function inkOf(file) {
  if (inks.has(file)) return inks.get(file)
  const img = pictures.get(file)
  let ink = { x: 0, y: 0, w: 1, h: 1 }
  if (img) {
    const w = Math.min(img.naturalWidth, 512), h = Math.round(w * img.naturalHeight / img.naturalWidth)
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, w, h)
    const a = g.getImageData(0, 0, w, h).data
    let l = w, t = h, r = -1, b = -1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 24) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y) }
    }
    if (r >= l) ink = { x: l / w, y: t / h, w: (r - l + 1) / w, h: (b - t + 1) / h }
  }
  inks.set(file, ink)
  return ink
}


export const HEAD = () => `var(--brand-head, ${kit().HEAD_FONT})`
// The film's ground, as the page paints it (the look's background, tuned
// to the brand): what ink shows on, and the colour of words set on ink.
// A ground painted as a gradient has no one colour: the first colour of
// the gradient stands for it, and with none, whichever of near-black and
// white the ink doesn't look like (words set on ink must never vanish)
export const paper = () => {
  const style = getComputedStyle(document.body)
  const bg = style.backgroundColor
  if (/rgba?\(/.test(bg) && !/,\s*0\)$/.test(bg)) return bg
  const stop = style.backgroundImage.match(/rgba?\([^)]*\)/)?.[0]
  if (stop && !/,\s*0\)$/.test(stop)) return stop
  return lightness(kit().C.text) > 0.5 ? '#0b0d12' : '#ffffff'
}
// Words set on the accent: near-black on a light accent, white on a dark one
export const onAccent = () => (lightness(kit().C.accent) > 0.5 ? '#0a0a0a' : '#ffffff')
// How light a CSS colour is, 0 (black) to 1 (white), drawn to find out
export const lightness = color => {
  const g = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
  return (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255
}
export const MONO = () => `var(--brand-mono, ui-monospace, 'SF Mono', Menlo, monospace)`
export const RULE = () => Math.max(1.5, 2 * unit())
// Short rises, eased out, no bounce
export const rise = (t, at, d = 0.45) => 1 - (1 - clamp((t - at) / d)) ** 3
export const lin = (t, at, d) => clamp((t - at) / d)
// The page's edge margin, and where a chapter's content starts
export const margin = () => kit().PAD ?? 56 * unit()

// Where a beat's pieces go (promo-layout.js layoutBoxes, which says how):
//   layout('side' | 'below' | 'auto', { lines, size, bleed, aspect })
// gives back { kind, words: { x, y, width, size, under }, picture, source }
export const layout = (kind = 'side', opts = {}) => layoutBoxes(page(), kind, opts)

// This beat's frame as the plan set it (world/frames.json, written by the
// engine from the storyboard, the same boxes as the plan's wireframes):
// { beat, words, lines, steps, desktop | picture, source } or, for the
// title and the end card, { beat, card }. Use it rather than laying a
// beat out by hand, so every beat keeps the film's one desktop
export function frame() {
  const id = window.__shotloop?.ctx?.id
  const f = frames?.beats.find(b => b.id === id)
  if (!f) throw new Error(`world/screens.js: no frame for shot ${id} in world/frames.json (it is written when the plan is applied)`)
  return f
}
