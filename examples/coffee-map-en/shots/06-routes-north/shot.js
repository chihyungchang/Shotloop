// 06-routes-north: pull out from East Africa to the whole belt; coffee-orange
// arcs draw on from the five producers to the EU and the US, which light blue,
// while beans stream along every arc and the camera drifts north.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, tradeRoutes, beanPin, mapAt, TOP5, ROUTES } from '../../world/parts.js'

const INK = '#0b1533'

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, lerp, ease, rise } = kit
  const font = FONT.replace(/"/g, '')

  // Rings that wrap the antimeridian (Fiji) draw a line across the map; drop them once
  if (window.GEO && !window.GEO.t5Wrapped) {
    for (const cn of window.GEO) cn.rings = cn.rings.filter(r => {
      let lo = 180, hi = -180
      for (const q of r) { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]) }
      return hi - lo < 180
    })
    window.GEO.t5Wrapped = true
  }

  // Camera: pull out from Ethiopia (log zoom), then drift slowly north
  const out = ease(clamp(t / 1.8))
  const drift = clamp((t - 1.2) / 4.8)
  const zoom = Math.exp(lerp(Math.log(3), Math.log(1.3), out)) * (1 + 0.04 * drift)
  const view = { center: [lerp(39, 18, out), lerp(8.5, 10, out) + 8 * drift], zoom, globe: 0, x: 360, y: 625 }

  // Six arcs, one after another; importers light as the first arcs land
  const draw = ROUTES.map((_, i) => ease(clamp((t - 1.0 - i * 0.45) / 0.9)))
  const bright = { Brazil: 1, Vietnam: 1, Colombia: 1, Indonesia: 1, Ethiopia: 1 }

  // Tropic labels step aside once the American arcs cross them
  let svg = coffeeMap(kit, { view, tropics: 1, band: 1, labels: 1 - rise(t, 0.9, 0.5), grow: 1, bright })

  // The producers: bean pins pulsing at the start of the arcs
  TOP5.forEach((q, i) => {
    const [x, y, vis] = mapAt(kit, view, q.at[0], q.at[1])
    svg += beanPin(kit, { x, y, vis, p: rise(t, 0.6 + i * 0.1, 0.5), t: t + i * 0.3, size: 0.9 })
  })

  svg += tradeRoutes(kit, { view, draw, flow: t, importers: rise(t, 1.7, 0.9), labels: rise(t, 2.0, 0.5) })

  // Calm ground under the headline and the source line
  svg = '<defs><linearGradient id="r6-top" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#101c44" stop-opacity="0.97"/><stop offset="0.8" stop-color="#0e1a40" stop-opacity="0.9"/>' +
    '<stop offset="1" stop-color="#0d1736" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="r6-foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080e24" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#080e24" stop-opacity="0.9"/></linearGradient></defs>' +
    svg +
    '<rect x="0" y="0" width="720" height="420" fill="url(#r6-top)"/>' +
    '<rect x="0" y="880" width="720" height="380" fill="url(#r6-foot)"/>'

  // Legend: what the colors mean
  const lg = rise(t, 2.4, 0.5)
  svg += '<g font-family="' + font + '" font-size="19" font-weight="700" opacity="' + lg.toFixed(3) + '">' +
    '<rect x="40" y="924" width="18" height="18" rx="4" fill="' + C.hue.green + '"/>' +
    '<text x="66" y="940" fill="' + C.text + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">grows</text>' +
    '<rect x="150" y="924" width="18" height="18" rx="4" fill="' + C.hue.blue + '"/>' +
    '<text x="176" y="940" fill="' + C.text + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">biggest importers</text></g>'

  // Source line, small, under the picture
  svg += '<g font-family="' + font + '" font-size="15" fill="' + C.muted + '" opacity="' + (0.85 * rise(t, 0.6, 0.6)).toFixed(3) + '">' +
    '<text x="40" y="984">Source: USDA Foreign Agricultural Service,</text>' +
    '<text x="40" y="1004">Coffee: World Markets and Trade (2024) · routes illustrative</text></g>'

  kit.stage(svg)

  kit.frame({
    kicker: 'Where it goes',
    head: ['Most sails *north*', 'to Europe', 'and the US'],
    typed: rise(t, 0.1, 0.9),
    progress: (start + t) / 32.5
  })
}
