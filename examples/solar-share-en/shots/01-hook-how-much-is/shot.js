// 01-hook-how-much-is: Hook: how much is solar?
// A huge gold counter rolls 0.0% → 8.7% over a breathing sun; the world
// electricity bar fills its first 8.7% in gold; ≈ 1 unit in 11 lights up.
// Shot-local time: t = 0 is this shot's first frame.
import { worldBar, sunDisc, bolt, ENERGY } from '../../world/parts.js'

export default function render(t, { window, start }) {
  const k = window.kit
  const { C, clamp, ease, rise, stagger, hash } = k
  const F = k.FONT.replace(/"/g, '')
  const CX = 330

  // Counter rolls 0 → 8.7 over 0.3–1.9 s, then lands with a damped bounce
  const roll = ease(clamp((t - 0.3) / 1.6))
  const value = k.count(roll, 0, 8.7, 1)
  const q = clamp((t - 1.9) / 0.9)
  const bounce = t < 1.9 ? 0 : Math.exp(-5 * q) * Math.sin(3 * Math.PI * q)
  // The first frame already shows a big 0.0% on the sun and the empty bar
  const numIn = rise(t, -0.25, 0.4)
  const numScale = (0.88 + 0.12 * numIn) * (1 + 0.11 * bounce)
  const numY = 650 + k.float(t, 3, 3.2)

  // Background: gold specks drifting up
  let specks = ''
  for (let i = 0; i < 26; i++) {
    const sx = 30 + hash(i, 1) * 640
    const sy = 1020 - ((t * (14 + 22 * hash(i, 2)) + hash(i, 3) * 760) % 760)
    specks += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="' + (1.2 + 2 * hash(i, 4)).toFixed(1) +
      '" fill="' + ENERGY.solar + '" opacity="' + (0.12 + 0.22 * hash(i, 5)).toFixed(2) + '"/>'
  }

  // ≈ 1 unit in every 11: a row of bolts, the first one gold
  let units = ''
  const step = 580 / 11
  for (let i = 0; i < 11; i++) {
    const s = stagger(t, i, 1.45, 0.05, 0.3)
    if (s <= 0) continue
    const bx = 40 + step * (i + 0.5), by = 902 + (1 - s) * 14
    units += '<g opacity="' + s.toFixed(2) + '">' +
      (i === 0 ? '<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="22" fill="' + ENERGY.solar + '" opacity="' + (0.18 + 0.08 * Math.sin(t * 4)).toFixed(2) + '"/>' : '') +
      bolt(k, { x: bx, y: by, size: 30, color: i === 0 ? ENERGY.solar : C.muted, fill: i === 0 }) + '</g>'
  }
  const unitsLabel = rise(t, 2.2, 0.4)

  k.stage(
    '<defs><filter id="nshadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#060c22" flood-opacity="0.65"/></filter></defs>' +
    specks +
    sunDisc(k, { x: CX, y: 575, r: 158, t, p: rise(t, -0.3, 0.6), glow: 0.7 + 0.3 * roll }) +
    // Small label over the number
    '<text x="' + CX + '" y="430" text-anchor="middle" font-family="' + F + '" font-size="19" font-weight="700" letter-spacing="3" fill="' + ENERGY.solarHi +
      '" opacity="' + rise(t, -0.2, 0.4).toFixed(2) + '">SHARE OF WORLD ELECTRICITY · 2025</text>' +
    // The big counter
    '<g transform="translate(' + CX + ' ' + numY.toFixed(1) + ') scale(' + numScale.toFixed(4) + ')" opacity="' + numIn.toFixed(2) + '">' +
      '<text x="0" y="0" text-anchor="middle" font-family="' + F + '" font-weight="800" font-size="210" letter-spacing="-6" fill="' + ENERGY.solar +
      '" filter="url(#nshadow)" style="font-variant-numeric: tabular-nums">' + value + '<tspan font-size="120" dx="6">%</tspan></text></g>' +
    // The world electricity bar
    worldBar(k, { y: 790, solarP: roll, glow: 0.4 + 0.6 * rise(t, 1.9, 0.4), t, p: rise(t, -0.2, 0.5), titleP: rise(t, 0.1, 0.4),
      tag: 'SOLAR ' + value + '%', tagP: rise(t, 0.5, 0.3) }) +
    units +
    '<text x="40" y="962" font-family="' + F + '" font-size="21" font-weight="600" fill="' + C.muted + '" opacity="' + unitsLabel.toFixed(2) + '">' +
      '<tspan fill="' + ENERGY.solar + '" font-weight="800">≈ 1</tspan> unit in every <tspan fill="' + C.text + '" font-weight="800">11</tspan></text>' +
    // Source line
    '<g font-family="' + F + '" font-size="13" fill="' + C.muted + '" opacity="' + (0.75 * rise(t, 0.8, 0.4)).toFixed(2) + '">' +
      '<text x="40" y="996">Source: Ember, Global Electricity Review 2026</text>' +
      '<text x="40" y="1014">Solar = 8.7% of 2025 generation · arithmetic: 100 ÷ 8.7 ≈ 11.5, so ≈ 1 in 11</text></g>'
  )

  k.frame({
    kicker: 'How much comes from the Sun?',
    head: ["Solar's share of", 'world power: *8.7%*'],
    typed: rise(t, -0.15, 0.7),
    progress: (start + t) / 23.5
  })
}
