// 06-end-card: End card. The world bar returns with its 8.7% gold sliver;
// a gold arrow '+30%' rises from the sliver and pushes it wider over a
// glowing sun while the title types in.
// Shot-local time: t = 0 is this shot's first frame.
import { worldBar, sunDisc, ENERGY } from '../../world/parts.js'

export default function render(t, { window, start }) {
  const k = window.kit
  const { C, clamp, ease, rise, hash } = k
  const F = k.FONT.replace(/"/g, '')
  const BX = 40, BY = 800, BL = 580

  // Sliver creeps wider (illustrative) under the arrow's push
  const push = ease(clamp((t - 1.0) / 2.0))
  const solar = 8.7 + 5 * push
  const edge = BX + (solar / 100) * BL
  const base = BX + 0.087 * BL

  // The arrow: from the sliver's edge, curving up to the label
  const arrowP = ease(clamp((t - 0.35) / 0.9))
  const hx = 268, hy = 492
  const path = 'M ' + edge.toFixed(1) + ' ' + (BY - 40) + ' C ' + edge.toFixed(1) + ' 630, ' + (hx - 120) + ' ' + (hy + 10) + ', ' + hx + ' ' + hy
  const headIn = rise(t, 1.15, 0.25)
  const ang = Math.atan2(hy - (hy + 10), hx - (hx - 120)) * 180 / Math.PI

  // '+30%' rolls up, then lands with a small bounce
  const roll = ease(clamp((t - 0.6) / 1.0))
  const q = clamp((t - 1.6) / 0.7)
  const bounce = t < 1.6 ? 0 : Math.exp(-5 * q) * Math.sin(3 * Math.PI * q)
  const numIn = rise(t, 0.5, 0.35)
  const numS = (0.9 + 0.1 * numIn) * (1 + 0.08 * bounce)

  // Background: gold specks drifting up
  let specks = ''
  for (let i = 0; i < 24; i++) {
    const sx = 30 + hash(i, 11) * 640
    const sy = 1000 - ((t * (16 + 22 * hash(i, 12)) + hash(i, 13) * 700) % 700)
    specks += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="' + (1.2 + 2 * hash(i, 14)).toFixed(1) +
      '" fill="' + ENERGY.solar + '" opacity="' + (0.1 + 0.2 * hash(i, 15)).toFixed(2) + '"/>'
  }

  // Small chevrons riding the bar ahead of the gold edge
  let chev = ''
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.9 + i / 3) % 1
    const cx = edge + 10 + ph * 46, o = Math.sin(ph * Math.PI) * rise(t, 1.0, 0.3)
    chev += '<path d="M ' + cx.toFixed(1) + ' ' + (BY + 8) + ' l 7 7 l -7 7" fill="none" stroke="' + ENERGY.solarHi +
      '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="' + (0.85 * o).toFixed(2) + '"/>'
  }

  const tagIn = rise(t, 0.3, 0.35)
  const illIn = rise(t, 1.5, 0.4)

  const q$ = k.stage(
    '<defs><filter id="ec-sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="9" flood-color="#060c22" flood-opacity="0.6"/></filter></defs>' +
    specks +
    sunDisc(k, { x: 420, y: 560, r: 130, t, p: rise(t, -0.3, 0.6), glow: 0.6 + 0.4 * push, id: 'ec-sun' }) +
    // Label over the number
    '<text x="420" y="472" text-anchor="middle" font-family="' + F + '" font-size="18" font-weight="700" letter-spacing="3" fill="' + ENERGY.solarHi +
      '" opacity="' + numIn.toFixed(2) + '">SOLAR OUTPUT · 2025</text>' +
    // The big growth number
    '<g transform="translate(420 ' + (600 + k.float(t, 3, 3)).toFixed(1) + ') scale(' + numS.toFixed(4) + ')" opacity="' + numIn.toFixed(2) + '">' +
      '<text x="0" y="0" text-anchor="middle" font-family="' + F + '" font-weight="800" font-size="118" letter-spacing="-3" fill="' + ENERGY.solar +
      '" filter="url(#ec-sh)" style="font-variant-numeric: tabular-nums">+' + k.count(roll, 0, 30) + '<tspan font-size="70">%</tspan></text></g>' +
    // The rising arrow
    '<path id="ec-arrow" d="' + path + '" fill="none" stroke="' + ENERGY.solar + '" stroke-width="7" stroke-linecap="round"/>' +
    '<g transform="translate(' + hx + ' ' + hy + ') rotate(' + ang.toFixed(1) + ')" opacity="' + headIn.toFixed(2) + '">' +
      '<polygon points="10,0 -14,-13 -14,13" fill="' + ENERGY.solar + '"/></g>' +
    // The world electricity bar, every source in, solar widening
    worldBar(k, { x: BX, y: BY, length: BL, solar, split: rise(t, -0.4, 1.4), labels: true, glow: 0.5 + 0.5 * push, t,
      p: rise(t, -0.3, 0.4), titleP: 1 }) +
    chev +
    // 2025 mark at 8.7%
    '<g opacity="' + tagIn.toFixed(2) + '" font-family="' + F + '">' +
      '<line x1="' + base.toFixed(1) + '" y1="' + (BY - 6) + '" x2="' + base.toFixed(1) + '" y2="' + (BY + 96) + '" stroke="' + C.text + '" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.6"/>' +
      '<text x="' + BX + '" y="' + (BY + 122) + '" font-size="21" font-weight="800" letter-spacing="1.5" fill="' + ENERGY.solar + '" style="font-variant-numeric: tabular-nums">SOLAR ' +
        k.count(rise(t, 0.2, 0.8), 0, 8.7, 1) + '% IN 2025</text>' +
      '<text x="' + BX + '" y="' + (BY + 148) + '" font-size="16" font-weight="600" fill="' + C.muted + '" opacity="' + illIn.toFixed(2) + '">Gold growing past the line: illustration of growth, not a forecast</text>' +
    '</g>' +
    // Source line
    '<g font-family="' + F + '" font-size="13" fill="' + C.muted + '" opacity="' + (0.75 * rise(t, 0.6, 0.4)).toFixed(2) + '">' +
      '<text x="40" y="996">Source: Ember, Global Electricity Review 2026</text>' +
      '<text x="40" y="1014">Solar 8.7% of 2025 generation; solar output grew 30% in 2025</text></g>'
  )
  k.drawOn(q$('#ec-arrow'), arrowP)

  k.frame({
    kicker: 'Solar, in one line',
    head: ['Small slice.', '*Biggest growth.*'],
    typed: rise(t, -0.1, 0.75),
    progress: (start + t) / 23.5
  })
}
