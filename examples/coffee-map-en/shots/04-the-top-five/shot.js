// 04-the-top-five: pull back from Brazil to the whole belt; pins 2–5 drop as the voice names them.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, rankPins } from '../../world/parts.js'

// Where each name falls in the spoken line (share of its length), in rank order 2..5
const SAID = { 2: 0.12, 3: 0.5, 4: 0.67, 5: 0.84 }
const DROP_D = 0.8
const NAMES = { 1: 'Brazil', 2: 'Vietnam', 3: 'Colombia', 4: 'Ethiopia', 5: 'Indonesia' }

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { clamp, lerp, ease, rise, FONT } = kit

  // Camera: from shot 3's view of Brazil, pull back to the whole belt (Colombia
  // to Indonesia), then a slow push
  const back = ease(clamp(t / 1.0))
  const push = ease(clamp((t - 1) / 4))
  const view = {
    center: [lerp(-30, 18.5, back), lerp(-9, 2, back)],
    zoom: Math.exp(lerp(Math.log(3.12), Math.log(1.1), back)) * (1 + 0.035 * push),
    x: lerp(360, 263.5, back),
    y: lerp(600, 700, back)
  }

  // Each pin drops as its country is said
  const line = voice[0] || { at: 0.2, end: 4.7 }
  const DROP = r => line.at + (line.end - line.at) * SAID[r] - 0.25
  const drop = [1, 2, 3, 4, 5].map(r => r === 1 ? 1 : clamp((t - DROP(r)) / DROP_D))
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
  // The flat world doesn't wrap: past its east edge (lon 180) draw the next copy of it
  const east = (view.x ?? 360) + (180 - view.center[0]) * 2 * view.zoom
  const wrap = east < 720 ? coffeeMap(kit, { view: { ...view, center: [view.center[0] - 360, view.center[1]] }, tropics: 1, band: 1, labels: 0, grow: 1, bright }) : ''

  kit.stage(
    wrap + coffeeMap(kit, { view, tropics: 1, band: 1, labels: 1, grow: 1, bright }) +
    // Fade the far north so the headline reads on a calm ground
    '<defs><linearGradient id="t5-fade" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#101c44" stop-opacity="0.97"/><stop offset="0.75" stop-color="#0e1a40" stop-opacity="0.92"/>' +
    '<stop offset="1" stop-color="#0d1736" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="t5-foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080e24" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#080e24" stop-opacity="0.9"/></linearGradient></defs>' +
    '<rect x="0" y="0" width="720" height="560" fill="url(#t5-fade)"/>' +
    '<rect x="0" y="800" width="720" height="480" fill="url(#t5-foot)"/>' +
    rankPins(kit, { view, drop, notes: { 2: 'robusta' }, scale: 1.1 }) +
    // Source line, small, under the subtitle band
    '<text x="40" y="1023" font-family="' + font + '" font-size="14" fill="' + kit.C.muted + '" opacity="' + rise(t, 0.6, 0.6).toFixed(3) + '">' +
    'Source: USDA FAS, Coffee: World Markets and Trade (July 2026)</text>'
  )

  kit.frame({
    kicker: 'The top five',
    head: ['Then *Vietnam*,', '*Colombia*,', '*Ethiopia*,', '*Indonesia*'],
    typed: rise(t, 0.15, 1.4),
    progress: (start + t) / 36.6
  })
}
