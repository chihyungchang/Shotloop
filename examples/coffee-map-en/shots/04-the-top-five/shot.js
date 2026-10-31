// 04-the-top-five: pull back to the belt, glide east, pins 2–5 drop as the camera passes.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, rankPins } from '../../world/parts.js'

// Pin drops (shot seconds) by rank 2..5, timed to the camera passing each country
const DROP = { 2: 3.35, 3: 0.7, 4: 3.8, 5: 2.6 }
const DROP_D = 0.8
const NAMES = { 1: 'Brazil', 2: 'Vietnam', 3: 'Colombia', 4: 'Indonesia', 5: 'Ethiopia' }

export default function render(t, { window, start }) {
  const kit = window.kit
  const { clamp, lerp, ease, rise, FONT } = kit

  // Camera: pull back from Brazil, then glide east across the belt
  const back = ease(t / 1.0)
  const glide = ease((t - 0.8) / 4.0)
  const view = {
    center: [lerp(-52, 86, glide), lerp(-12, 0, back)],
    zoom: lerp(2.6, 2.0, back),
    y: 700
  }

  const drop = [1, 2, 3, 4, 5].map(r => r === 1 ? 1 : clamp((t - DROP[r]) / DROP_D))
  const bright = {}
  drop.forEach((p, i) => { bright[NAMES[i + 1]] = i === 0 ? 1 : clamp((p - 0.3) / 0.5) })

  // Rings that wrap the antimeridian (Fiji) draw a line across the globe; drop them once
  if (window.GEO && !window.GEO.t5Wrapped) {
    for (const cn of window.GEO) cn.rings = cn.rings.filter(r => {
      let lo = 180, hi = -180
      for (const q of r) { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]) }
      return hi - lo < 180
    })
    window.GEO.t5Wrapped = true
  }

  const font = FONT.replace(/"/g, '')
  kit.stage(
    coffeeMap(kit, { view, tropics: 1, band: 1, labels: 1, grow: 1, bright }) +
    // Fade the far north so the headline reads on a calm ground
    '<defs><linearGradient id="t5-fade" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#101c44" stop-opacity="0.97"/><stop offset="0.75" stop-color="#0e1a40" stop-opacity="0.92"/>' +
    '<stop offset="1" stop-color="#0d1736" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="t5-foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080e24" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#080e24" stop-opacity="0.9"/></linearGradient></defs>' +
    '<rect x="0" y="0" width="720" height="560" fill="url(#t5-fade)"/>' +
    '<rect x="0" y="880" width="720" height="400" fill="url(#t5-foot)"/>' +
    rankPins(kit, { view, drop, notes: { 2: 'robusta' }, scale: 1.25 }) +
    // Source line, small, under the picture
    '<g font-family="' + font + '" font-size="15" fill="' + kit.C.muted + '" opacity="' + rise(t, 0.6, 0.6).toFixed(3) + '">' +
    '<text x="40" y="984">Source: USDA Foreign Agricultural Service,</text>' +
    '<text x="40" y="1004">Coffee: World Markets and Trade (2024)</text></g>'
  )

  kit.frame({
    kicker: 'The top five',
    head: ['Then *Vietnam*,', '*Colombia*,', '*Indonesia*,', '*Ethiopia*'],
    typed: rise(t, 0.15, 1.4),
    progress: (start + t) / 32.5
  })
}
