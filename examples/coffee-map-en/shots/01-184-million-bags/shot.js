// 01-184-million-bags: the globe turns while coffee-bean pins pop up along the
// equator and a gold counter rolls to ≈184,000,000 bags (2025/26).
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, beanPin, mapAt } from '../../world/parts.js'

// Coffee-growing regions, one pin each, popped west to east
const SPOTS = [
  [-96.9, 19.3], [-88.2, 14.6], [-84, 10], [-72.5, 18.8], [-75.6, 5], [-67.5, 8.8], [-76, -10.5],
  [-63, -11], [-66, -17], [-45, -19.5], [-40.5, -13.5], [-5.6, 6.6], [11, 5.4], [15.5, -11.5],
  [24.5, -3], [31.8, 1.8], [37, -1.2], [38.6, 8.2], [34.2, -8.6], [44, 15], [47.4, -18.8],
  [76, 12.3], [104, -4], [107.8, 13], [145, -6]
].sort((a, b) => a[0] - b[0])

const TOTAL = 184000000

// An odometer: each digit rolls on as the one below it wraps
function odometer(kit, v, { x, y, size, color }) {
  const { C, clamp, FONT } = kit
  const font = FONT.replace(/"/g, '')
  const adv = size * 0.6, comma = size * 0.3
  let out = '', cx = x
  for (let k = 8; k >= 0; k--) {
    const q = v / Math.pow(10, k), base = Math.floor(q), rem = q - base
    const f = k === 0 ? rem : clamp((rem - 0.9) * 10)
    // digits not reached yet wait as dim zeros
    const on = k === 0 ? 1 : 0.22 + 0.78 * clamp((v / Math.pow(10, k) - 1) * 4 + 1)
    const d = base % 10, mid = cx + adv / 2
    if (on > 0) {
      const dy = -f * size
      out += '<g opacity="' + on.toFixed(3) + '">' +
        '<text x="' + mid + '" y="' + (y + dy) + '" text-anchor="middle">' + d + '</text>' +
        (f > 0 ? '<text x="' + mid + '" y="' + (y + dy + size) + '" text-anchor="middle">' + ((d + 1) % 10) + '</text>' : '') + '</g>'
    }
    cx += adv
    if (k === 6 || k === 3) {
      if (on > 0) out += '<text x="' + (cx + comma / 2) + '" y="' + y + '" text-anchor="middle" opacity="' + on.toFixed(3) + '">,</text>'
      cx += comma
    }
  }
  return '<defs><clipPath id="odo"><rect x="' + (x - 10) + '" y="' + (y - size * 0.86) + '" width="' + (cx - x + 20) + '" height="' + size * 1.08 + '"/></clipPath></defs>' +
    '<g clip-path="url(#odo)" font-size="' + size + '" font-weight="800" fill="' + color + '" font-family="' + font + '" style="font-variant-numeric: tabular-nums">' + out + '</g>'
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, rise, ease } = kit
  const font = FONT.replace(/"/g, '')

  kit.frame({ kicker: 'World coffee harvest', progress: (start + t) / 32.5 })

  // The globe turns from the Americas towards Africa, drawing a little closer
  const view = { center: [-84 + 16 * t, 6], zoom: 1, globe: 1, x: 330, y: 716, R: 250 + 12 * ease(t / 4) }
  let svg = coffeeMap(kit, { view, tropics: 0, band: 0, labels: 0, grow: 0 })

  // Bean pins pop up in a ripple along the equator
  SPOTS.forEach(([lon, lat], i) => {
    const a = 0.1 + i * 0.1
    const [x, y, vis] = mapAt(kit, view, lon, lat)
    svg += beanPin(kit, { x, y, p: rise(t, a, 0.45), t: t - a, vis, size: 0.95 })
  })

  // The counter rolls from 0 and lands on 184,000,000 with a bounce
  const roll = clamp((t - 0.1) / 1.0)
  const v = TOTAL * (1 - Math.pow(1 - roll, 3))
  const bounce = 1 + 0.07 * Math.sin(Math.PI * clamp((t - 1.1) / 0.32))
  const size = 84, cx = 330
  svg += '<g transform="translate(' + cx + ',250) scale(' + bounce.toFixed(4) + ') translate(' + -cx + ',-250)">' +
    '<text x="40" y="250" font-size="54" font-weight="800" fill="' + C.accent + '" font-family="' + font + '">≈</text>' +
    odometer(kit, v, { x: 88, y: 250, size, color: C.accent }) + '</g>'
  svg += '<text x="44" y="296" font-size="28" font-weight="600" fill="' + C.muted + '" opacity="' + rise(t, 0.2).toFixed(3) + '" font-family="' + font + '">60-kg bags / year</text>'

  // The question
  const q = rise(t, 0.55, 0.45)
  svg += '<text x="40" y="' + (382 + (1 - q) * 18).toFixed(1) + '" font-size="58" font-weight="800" fill="' + C.text + '" opacity="' + q.toFixed(3) +
    '" font-family="' + font + '">From <tspan fill="' + C.accent + '">where?</tspan></text>'

  // Source line
  svg += '<text x="40" y="1012" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font + '">Source: ICO Coffee Market Report, Aug 2026 (2025/26 estimate)</text>'

  kit.stage(svg)
}
