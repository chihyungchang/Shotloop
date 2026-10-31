// 07-end-card: the map wraps back onto the globe, which turns slowly inside the
// orange trade routes, beans still flowing; the video's title settles above.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, tradeRoutes, beanPin, mapAt, TOP5, DEST } from '../../world/parts.js'

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, rise, ease, hold } = kit
  const font = FONT.replace(/"/g, '')

  // The caption types in fast and holds still to the end
  kit.frame({ head: ['Every cup,', 'a *long journey*'], typed: rise(t, 0.05, 0.4), top: 236, progress: (start + t) / 32.5 })

  // The globe turns east while the camera eases back to show it whole
  const view = { center: [-42 + 7 * t, 16], zoom: 1.1 - 0.1 * ease(t / 3), globe: 1, x: 330, y: 716, R: 238 }
  let svg = coffeeMap(kit, { view, tropics: 1, band: 1, labels: 0, grow: 1,
    bright: { Brazil: 1, Vietnam: 1, Colombia: 1, Indonesia: 1, Ethiopia: 1 } })

  // Shimmer: a soft orange glow breathing over the routes
  const shimmer = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 1.2)
  svg += '<g opacity="' + (0.75 + 0.25 * shimmer).toFixed(3) + '">' +
    tradeRoutes(kit, { view, draw: 1, flow: start + t, importers: 1, labels: 1 }) + '</g>'

  // The producers keep their pulsing bean pins
  TOP5.forEach((p, i) => {
    const [x, y, vis] = mapAt(kit, view, p.at[0], p.at[1])
    svg += beanPin(kit, { x, y, p: 1, t: t + i * 0.3, vis, size: 0.8 })
  })

  // Arrival rings at the importers, one after the other
  Object.values(DEST).forEach((at, i) => {
    const [x, y, vis] = mapAt(kit, view, at[0], at[1])
    const a = 1.4 + i * 0.5, r = rise(t, a, 0.9)
    if (r > 0 && vis > 0.5) svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (6 + 30 * r).toFixed(1) +
      '" fill="none" stroke="' + C.hue.blue + '" stroke-width="2.5" opacity="' + ((1 - r) * 0.9 * vis).toFixed(3) + '"/>'
  })

  // The title settles in above the caption
  const ti = rise(t, 0.5, 0.7), tl = ease(clamp((t - 0.5) / 0.9))
  svg += '<g opacity="' + ti.toFixed(3) + '" transform="translate(0,' + ((1 - tl) * 22).toFixed(1) + ')" font-family="' + font + '" font-weight="700" font-size="30" fill="' + C.muted + '">' +
    '<text x="40" y="150">Where does the world’s</text>' +
    '<text x="40" y="190"><tspan fill="' + C.text + '">coffee</tspan> come from</text>' +
    '<rect x="40" y="208" height="3" rx="1.5" width="' + (90 * tl).toFixed(1) + '" fill="' + C.accent + '"/></g>'

  // Source line
  svg += '<text x="40" y="1012" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font + '">Source: USDA FAS, Coffee: World Markets and Trade (2024)</text>'

  kit.stage(svg)
}
