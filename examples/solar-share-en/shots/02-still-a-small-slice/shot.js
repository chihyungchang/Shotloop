// 02-still-a-small-slice: Still a small slice.
// The world electricity bar stands tall; its segments slide in from the top
// (coal first) with rolling percentages, coal gets outlined, the gold solar
// slice glows and copies of it stack up beside coal: ≈ 3.8 of them.
// Shot-local time: t = 0 is this shot's first frame.
import { worldBar, ENERGY } from '../../world/parts.js'

export default function render(t, { window, start }) {
  const k = window.kit
  const { C, clamp, ease, rise, pop, hash } = k
  const F = k.FONT.replace(/"/g, '')

  // The standing bar
  const BX = 250, BY = 350, L = 610, T = 120
  const coalTop = BY, coalBot = BY + 0.33 * L
  const solarH = 0.087 * L, solarMid = BY + L - solarH / 2

  // Background: gold specks drifting up
  let specks = ''
  for (let i = 0; i < 22; i++) {
    const sx = 30 + hash(i, 11) * 640
    const sy = 1020 - ((t * (12 + 20 * hash(i, 12)) + hash(i, 13) * 700) % 700)
    specks += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="' + (1.2 + 1.8 * hash(i, 14)).toFixed(1) +
      '" fill="' + ENERGY.solar + '" opacity="' + (0.08 + 0.16 * hash(i, 15)).toFixed(2) + '"/>'
  }

  // Timeline
  // Solar's slice is already there from shot 1; the rest splits in
  const solarP = ease(clamp((t + 0.5) / 0.6))
  const split = clamp((t - 0.1) / 2.3)
  const outlineP = ease(clamp((t - 2.4) / 0.6))
  const glow = rise(t, 2.7, 0.5)
  const linkP = ease(clamp((t - 2.85) / 0.5))

  // A gold path from the solar slice round to the stack beside coal
  const SX = 166, stackX = BX - 24 - T
  const link = '<path id="link" d="M ' + (BX - 8) + ' ' + solarMid.toFixed(1) + ' C ' + (SX + 10) + ' ' + solarMid.toFixed(1) + ' ' + SX + ' ' + (solarMid - 20).toFixed(1) +
    ' ' + SX + ' ' + (solarMid - 70).toFixed(1) + ' L ' + SX + ' ' + (coalBot + 112).toFixed(1) + '" fill="none" stroke="' + ENERGY.solar + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9" opacity="0.8"/>'

  // Copies of solar's slice stacking up to coal's height (33 ÷ 8.7 ≈ 3.79)
  const ratio = 33 / 8.7
  let stack = ''
  let filled = 0
  for (let j = 0; j < Math.ceil(ratio); j++) {
    const s = pop(t, 3.25 + j * 0.16, 0.4)
    if (s <= 0) continue
    const part = Math.min(1, ratio - j)
    filled += part * clamp(s)
    const h = solarH * part
    const y = coalBot - solarH * j - h
    const drop = (1 - clamp(s)) * 30
    stack += '<g opacity="' + clamp(s * 1.4).toFixed(2) + '" transform="translate(0 ' + drop.toFixed(1) + ')">' +
      '<rect x="' + (stackX + 1.5) + '" y="' + (y + 1.5).toFixed(1) + '" width="' + (T - 3) + '" height="' + (h - 3).toFixed(1) + '" rx="5" fill="' + ENERGY.solar +
      '" fill-opacity="0.5" stroke="' + ENERGY.solarHi + '" stroke-width="2"/></g>'
  }
  const times = rise(t, 3.2, 0.3)
  const timesVal = (filled || 0).toFixed(1)

  // Height marks tying the stack to the coal block
  const tick = rise(t, 3.9, 0.3)
  const marks = '<g opacity="' + (0.7 * tick).toFixed(2) + '" stroke="' + C.text + '" stroke-width="1.5" stroke-dasharray="4 5">' +
    '<line x1="' + stackX + '" y1="' + coalTop + '" x2="' + BX + '" y2="' + coalTop + '"/>' +
    '<line x1="' + stackX + '" y1="' + coalBot.toFixed(1) + '" x2="' + BX + '" y2="' + coalBot.toFixed(1) + '"/></g>'

  const label = '<g font-family="' + F + '" text-anchor="middle" opacity="' + times.toFixed(2) + '">' +
    '<text x="' + SX + '" y="' + (coalBot + 62).toFixed(1) + '" font-size="46" font-weight="800" fill="' + C.text + '" style="font-variant-numeric: tabular-nums">≈ ' + timesVal + '×</text>' +
    '<text x="' + SX + '" y="' + (coalBot + 90).toFixed(1) + '" font-size="17" font-weight="700" letter-spacing="2" fill="' + ENERGY.solar + '">SOLAR SLICES</text></g>'

  const q = k.stage(
    specks +
    worldBar(k, {
      x: BX, y: BY, length: L, thick: T, vertical: true,
      solarP, split, labels: true, outline: 'coal', outlineP, glow,
      t, p: rise(t, -0.3, 0.5), titleP: rise(t, -0.1, 0.4)
    }) +
    link +
    stack + marks + label +
    // Source line
    '<g font-family="' + F + '" font-size="13" fill="' + C.muted + '" opacity="' + (0.75 * rise(t, 0.6, 0.4)).toFixed(2) + '">' +
      '<text x="40" y="996">Source: Ember, Global Electricity Review 2026</text>' +
      '<text x="40" y="1014">Shares of 2025 generation · coal 33% ÷ solar 8.7% ≈ 3.8</text></g>'
  )
  // The dotted path draws on: dots up to the drawn length, then one long gap
  const path = q('#link')
  if (path) {
    const len = path.getTotalLength(), n = Math.floor((len * linkP) / 11)
    const dashes = Array(n).fill('2 9')
    if (n) dashes[n - 1] = '2 ' + (len + 20).toFixed(0)
    path.setAttribute('stroke-dasharray', n ? dashes.join(' ') : '0 ' + (len + 20).toFixed(0))
    if (!n) path.setAttribute('opacity', 0)
  }

  k.frame({
    kicker: 'Still a small slice',
    head: ['*Small* next to', "coal's 33%"],
    typed: rise(t, -0.15, 0.7),
    progress: (start + t) / 23.5
  })
}
