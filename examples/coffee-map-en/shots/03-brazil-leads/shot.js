// 03-brazil-leads: the camera flies from the world into South America; Brazil
// brightens, its rank-1 pin drops, a counter rolls to 'nearly 40%' and the
// world's coffee splits into Brazil's share and the rest.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, rankPins, mapAt } from '../../world/parts.js'

const SLATE = '#3a4764', INK = '#0b1533'

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, lerp, rise, pop, ease, float } = kit
  const font = FONT.replace(/"/g, '')

  kit.frame({
    kicker: 'The #1 grower',
    head: ['Brazil grows nearly', '*40%* of it'],
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
  const roll = clamp((t - 1.5) / 1.1), v = 40 * (1 - Math.pow(1 - roll, 3))
  const land = 1 + 0.08 * Math.sin(Math.PI * clamp((t - 2.6) / 0.3))
  const cIn = rise(t, 1.4, 0.4)
  svg += '<g opacity="' + cIn.toFixed(3) + '" font-family="' + font + '">' +
    '<text x="' + (cx + 4) + '" y="' + (cy - 70) + '" font-size="26" font-weight="700" fill="' + C.text + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">nearly</text>' +
    '<g transform="translate(' + cx + ',' + cy + ') scale(' + land.toFixed(4) + ')">' +
    '<text x="0" y="0" font-size="78" font-weight="800" fill="' + C.hue.green + '" stroke="' + INK + '" stroke-width="5" paint-order="stroke" style="font-variant-numeric: tabular-nums">' +
    Math.round(v) + '%</text></g>' +
    '<text x="' + (cx + 4) + '" y="' + (cy + 40) + '" font-size="24" font-weight="700" fill="' + C.text + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">of world</text>' +
    '<text x="' + (cx + 4) + '" y="' + (cy + 70) + '" font-size="24" font-weight="700" fill="' + C.text + '" stroke="' + INK + '" stroke-width="4" paint-order="stroke">production</text></g>'

  // Split bar: the world's coffee
  const bx = 40, bw = 580, by = 878, bh = 40, share = 0.39
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
    '<text x="' + bx + '" y="' + (by + bh + 32) + '" font-size="24" fill="' + C.hue.green + '">Brazil: nearly 40%</text>' +
    '<text x="' + (bx + bw) + '" y="' + (by + bh + 32) + '" font-size="24" fill="' + C.muted + '" text-anchor="end">Rest of the world</text></g>'

  // Source line
  svg += '<text x="40" y="992" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font + '">Source: USDA FAS, Coffee: World Markets and Trade (July 2026)</text>' +
    '<text x="40" y="1012" font-size="15" fill="' + C.muted + '" opacity="0.85" font-family="' + font + '">“Brazil accounts for nearly 40 percent of world production”</text>'

  kit.stage(svg)
}
