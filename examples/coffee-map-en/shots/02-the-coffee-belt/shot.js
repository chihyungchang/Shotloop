// 02-the-coffee-belt: the globe from shot 1 unrolls into the flat map, the tropic
// lines draw on, the belt glows gold and the growers light green west to east
// while a counter ticks to 70+.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, mapAt } from '../../world/parts.js'

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, lerp, ease, rise, pop } = kit
  const font = FONT.replace(/"/g, '')

  kit.frame({
    kicker: 'The coffee belt',
    head: 'Grown in *70+* countries between the tropics',
    typed: rise(t, 0.1, 0.6),
    progress: (start + t) / 32.5
  })

  // The globe (where shot 1 left it) unrolls into the flat map, then a slow push in
  const u = ease(clamp(t / 1.4))
  const zoom = 1.2 + 0.05 * ease(clamp((t - 2) / 3))
  const view = {
    center: [lerp(-20, 22, u), lerp(6, 0, u)],
    zoom,
    globe: 1 - u,
    x: lerp(330, 340, u),
    y: lerp(716, 668, u),
    R: 262 / zoom
  }

  const tropics = ease(clamp((t - 1.0) / 1.2))
  const band = rise(t, 1.8, 0.8)
  const grow = clamp((t - 2.4) / 2.0)
  let svg = coffeeMap(kit, { view, tropics, band, labels: tropics, grow, bright: {} })

  // Counter beside the band, in the Indian Ocean
  const cp = rise(t, 2.3, 0.4)
  if (cp > 0) {
    const [bx, by] = mapAt(kit, view, 82, -23.44)
    const [cx, cy] = mapAt(kit, view, 82, -41)
    const n = Math.round(70 * grow), plus = pop(t, 4.4, 0.4)
    const land = 1 + 0.12 * Math.sin(Math.PI * clamp((t - 4.4) / 0.3))
    svg += '<g opacity="' + cp.toFixed(3) + '">' +
      '<line x1="' + bx.toFixed(1) + '" y1="' + by.toFixed(1) + '" x2="' + bx.toFixed(1) + '" y2="' + (cy - 46).toFixed(1) +
      '" stroke="' + C.hue.green + '" stroke-width="2" stroke-dasharray="3 4"/>' +
      '<g transform="translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') scale(' + land.toFixed(4) + ')">' +
      '<text x="0" y="0" text-anchor="middle" font-size="52" font-weight="800" fill="' + C.hue.green + '" stroke="#0b1533" stroke-width="5" paint-order="stroke"' +
      ' font-family="' + font + '" style="font-variant-numeric: tabular-nums">' + n +
      '<tspan opacity="' + clamp(plus).toFixed(3) + '">+</tspan></text>' +
      '<text x="0" y="24" text-anchor="middle" font-size="18" font-weight="600" fill="' + C.text + '" stroke="#0b1533" stroke-width="4" paint-order="stroke"' +
      ' font-family="' + font + '">countries</text></g></g>'
  }

  // Legend under the map
  const legend = [[C.hue.green, 1, 'Where coffee grows'], [C.hue.yellow, 0.35, 'Coffee belt']]
  legend.forEach(([color, op, label], i) => {
    const p = rise(t, i ? 1.9 : 2.5, 0.4)
    const x = 44 + i * 280, y = 936 + (1 - p) * 10
    svg += '<g opacity="' + p.toFixed(3) + '"><rect x="' + x + '" y="' + (y - 16) + '" width="22" height="18" rx="4" fill="' + color + '" opacity="' + op + '"' +
      (i ? ' stroke="' + C.hue.yellow + '" stroke-dasharray="4 3"' : '') + '/>' +
      '<text x="' + (x + 32) + '" y="' + y + '" font-size="20" font-weight="600" fill="' + C.text + '" font-family="' + font + '">' + label + '</text></g>'
  })

  // Source line
  svg += '<text x="40" y="1008" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font +
    '">Source: National Coffee Association USA, ‘Where Coffee Grows’</text>'

  kit.stage(svg)
}
