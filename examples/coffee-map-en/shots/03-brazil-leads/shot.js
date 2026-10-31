// 03-brazil-leads: the camera flies from the world into South America; Brazil
// brightens, its rank-1 pin drops, a counter rolls to ≈66 M bags and the
// world's coffee splits into Brazil's third and the rest.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, rankPins, mapAt } from '../../world/parts.js'

const SLATE = '#3a4764', INK = '#0b1533'

// One coffee sack, centred at (x, y)
function sack(x, y, s, fill, stroke, op) {
  return '<g transform="translate(' + x + ',' + y + ') scale(' + s.toFixed(3) + ')" opacity="' + op.toFixed(3) + '">' +
    '<path d="M-15,-14 C-19,-2 -20,10 -17,19 Q0,24 17,19 C20,10 19,-2 15,-14 Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"/>' +
    '<path d="M-15,-14 L-11,-22 L-4,-17 L0,-23 L4,-17 L11,-22 L15,-14" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<line x1="-14" y1="-13" x2="14" y2="-13" stroke="' + stroke + '" stroke-width="3"/></g>'
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, lerp, rise, pop, ease, float } = kit
  const font = FONT.replace(/"/g, '')

  kit.frame({
    kicker: 'The #1 grower',
    head: ['Brazil grows about', '*1 in 3* bags'],
    typed: rise(t, 0.05, 0.7),
    progress: (start + t) / 32.5
  })

  // Camera: from the flat world into Brazil (log zoom), then a slow drift closer
  const fly = ease(clamp(t / 1.7))
  const zoom = Math.exp(lerp(Math.log(1.5), Math.log(3), fly)) * (1 + 0.04 * clamp((t - 1.7) / 3.3))
  const view = { center: [lerp(0, -30, fly), lerp(5, -9, fly)], zoom, globe: 0, x: 360, y: 660 }

  // Brazil brightens, then breathes
  const lit = rise(t, 0.9, 0.6)
  const breathe = 0.5 + 0.5 * Math.sin((t - 1.5) * Math.PI * 2 / 1.4)
  let svg = coffeeMap(kit, { view, tropics: 1, band: 1, labels: 1, grow: 1, bright: { Brazil: lit } })

  // A pulsing glow on Brazil's outline
  const br = (window.GEO || []).find(c => c.name === 'Brazil')
  if (br && lit > 0) {
    const d = br.rings.map(r => 'M' + r.map(([lon, lat]) => { const q = mapAt(kit, view, lon, lat); return q[0].toFixed(1) + ',' + q[1].toFixed(1) }).join('L') + 'Z').join('')
    svg += '<path d="' + d + '" fill="' + C.hue.green + '" opacity="' + (lit * (0.08 + 0.14 * breathe)).toFixed(3) + '"/>' +
      '<path d="' + d + '" fill="none" stroke="' + C.hue.green + '" stroke-width="' + (3 + 5 * breathe).toFixed(1) + '" stroke-linejoin="round" opacity="' + (lit * (0.25 + 0.3 * breathe)).toFixed(3) + '"/>' +
      '<path d="' + d + '" fill="none" stroke="#d9ffe6" stroke-width="1.6" stroke-linejoin="round" opacity="' + (lit * 0.8).toFixed(3) + '"/>'
  }

  // Shade under the headline
  svg = '<defs><linearGradient id="b-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + INK + '" stop-opacity="0.9"/><stop offset="1" stop-color="' + INK + '" stop-opacity="0"/></linearGradient></defs>' +
    svg + '<rect x="0" y="0" width="720" height="400" fill="url(#b-top)"/>'

  // Rank pin 1
  svg += rankPins(kit, { view, drop: [rise(t, 1.2, 0.7), 0, 0, 0, 0], scale: 1.45 })

  // Counter column in the Atlantic, beside Brazil
  const cx = 404, cy = 560 + float(t, 3, 3.2)
  const roll = clamp((t - 1.5) / 1.1), v = 66 * (1 - Math.pow(1 - roll, 3))
  const land = 1 + 0.08 * Math.sin(Math.PI * clamp((t - 2.6) / 0.3))
  const cIn = rise(t, 1.4, 0.4)
  svg += '<g opacity="' + cIn.toFixed(3) + '" font-family="' + font + '">' +
    '<g transform="translate(' + cx + ',' + cy + ') scale(' + land.toFixed(4) + ')">' +
    '<text x="0" y="0" font-size="78" font-weight="800" fill="' + C.hue.green + '" stroke="' + INK + '" stroke-width="5" paint-order="stroke" style="font-variant-numeric: tabular-nums">' +
    '<tspan font-size="52">≈</tspan>' + Math.round(v) + 'M</text></g>' +
    '<text x="' + (cx + 4) + '" y="' + (cy + 40) + '" font-size="24" font-weight="700" fill="' + C.text + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">bags a year</text>' +
    '<text x="' + (cx + 4) + '" y="' + (cy + 70) + '" font-size="21" font-weight="600" fill="' + C.muted + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">of ≈' + Math.round(175 * (1 - Math.pow(1 - roll, 3))) + 'M worldwide</text></g>'

  // 1 in 3: three sacks, the first fills green
  for (let i = 0; i < 3; i++) {
    const p = pop(t, 2.3 + i * 0.15, 0.5), g = i === 0 ? rise(t, 2.9, 0.4) : 0
    const fill = i === 0 ? (g > 0.5 ? C.hue.green : 'rgba(255,255,255,0.08)') : 'rgba(255,255,255,0.08)'
    const sy = cy + 128 + (i === 0 ? -6 * g * (0.5 + 0.5 * breathe) : 0)
    svg += sack(cx + 22 + i * 58, sy, 1.15 * p, fill, i === 0 && g > 0.5 ? '#d9ffe6' : C.muted, clamp(p * 2))
  }

  // Split bar: the world's coffee
  const bx = 40, bw = 580, by = 878, bh = 40, share = 0.38
  const wipe = ease(clamp((t - 2.2) / 0.6)), fill = ease(clamp((t - 2.8) / 0.6)), sep = ease(clamp((t - 3.4) / 0.5))
  const gap = 14 * sep, wb = bw * share * fill
  svg += '<rect x="24" y="' + (by - 52) + '" width="612" height="146" rx="16" fill="' + INK + '" opacity="' + (0.72 * rise(t, 2.0, 0.4)).toFixed(3) + '"/>'
  svg += '<text x="' + bx + '" y="' + (by - 16) + '" font-size="21" font-weight="700" fill="' + C.muted + '" opacity="' + rise(t, 2.2).toFixed(3) + '" font-family="' + font + '" letter-spacing="1">THE WORLD\'S COFFEE</text>'
  if (wipe > 0) {
    svg += '<rect x="' + (bx + wb + gap) + '" y="' + by + '" width="' + Math.max(0, bw * wipe - wb - gap) + '" height="' + bh + '" rx="8" fill="' + SLATE + '"/>'
    if (fill > 0) svg += '<rect x="' + bx + '" y="' + by + '" width="' + Math.max(0, wb - gap / 2) + '" height="' + bh + '" rx="8" fill="' + C.hue.green + '"/>'
  }
  const lab = rise(t, 3.5, 0.4)
  svg += '<g opacity="' + lab.toFixed(3) + '" font-family="' + font + '" font-weight="700">' +
    '<text x="' + bx + '" y="' + (by + bh + 32) + '" font-size="24" fill="' + C.hue.green + '">Brazil ≈ 1/3</text>' +
    '<text x="' + (bx + bw) + '" y="' + (by + bh + 32) + '" font-size="24" fill="' + C.muted + '" text-anchor="end">Rest of the world</text></g>'

  // Source line
  svg += '<text x="40" y="992" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font + '">Source: USDA FAS, Coffee: World Markets and Trade (2024)</text>' +
    '<text x="40" y="1012" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font + '">≈66 of ≈175M bags a year ≈ 38% ≈ 1/3</text>'

  kit.stage(svg)
}
