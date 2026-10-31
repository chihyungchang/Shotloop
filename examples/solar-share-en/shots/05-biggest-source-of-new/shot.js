// 05-biggest-source-of-new: four yearly bar races of generation growth; solar wins each, a #1 badge stamps, four badges glow.
// Shot-local time: t = 0 is this shot's first frame.
import { ENERGY, bolt } from '../../world/parts.js'

const X0 = 40, ROW0 = 492, ROW_H = 118, BAR_H = 22, BAR_GAP = 8
const BX = 560, BR = 34 // badge column
const RACE0 = 0.35, RACE_STEP = 0.75, RACE_D = 0.8
// Illustrative lengths (px): solar always longest
const ROWS = [
  { year: 2022, solar: 400, wind: 330, other: 255 },
  { year: 2023, solar: 420, wind: 345, other: 240 },
  { year: 2024, solar: 445, wind: 270, other: 300 },
  { year: 2025, solar: 460, wind: 300, other: 280 }
]
const END = RACE0 + 3 * RACE_STEP + RACE_D // last badge lands
const f = n => Number(n).toFixed(1)

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, rise, pop, ease, hold, float, hash } = kit
  const F = FONT.replace(/"/g, '')

  // Caption: typed in by 0.5 s, then still to the end
  kit.frame({ kicker: '05 / 06', head: ['*Biggest* growth of', 'any source,', '*4 years* running'], typed: rise(t, -0.1, 0.55), progress: (start + t) / 23.5 })

  const glowAll = rise(t, END + 0.35, 0.4)
  let s = '<defs><linearGradient id="r-gold" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="' + ENERGY.solar + '"/><stop offset="1" stop-color="' + ENERGY.solarHi + '"/></linearGradient>' +
    '<radialGradient id="r-halo"><stop offset="0" stop-color="' + ENERGY.solar + '" stop-opacity="0.55"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0"/></radialGradient>' +
    '<filter id="r-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter></defs>'

  // Background: faint vertical grid over the race lanes
  const grid = rise(t, 0, 0.5)
  for (let k = 0; k <= 4; k++) {
    const x = X0 + k * 110
    s += '<line x1="' + x + '" x2="' + x + '" y1="' + (ROW0 - 30) + '" y2="' + (ROW0 + 3 * ROW_H + 104) + '" stroke="' + C.line + '" stroke-width="1" stroke-dasharray="2 6" opacity="' + f(0.8 * grid) + '"/>'
  }

  // Chart label and legend
  s += '<g font-family="' + F + '" opacity="' + f(rise(t, -0.3, 0.5)) + '">' +
    '<text x="40" y="414" font-size="18" font-weight="600" letter-spacing="2.4" fill="' + C.muted + '">GROWTH IN GENERATION</text>'
  const legend = [['Solar', ENERGY.solar], ['Wind', ENERGY.clean], ['Others', ENERGY.other]]
  legend.forEach(([name, col], i) => {
    const lx = 40 + i * 120
    s += '<rect x="' + lx + '" y="432" width="14" height="14" rx="3" fill="' + col + '"/>' +
      '<text x="' + (lx + 22) + '" y="446" font-size="17" font-weight="600" fill="' + C.muted + '">' + name + '</text>'
  })
  s += '</g>'

  // Active-row highlight sliding from row to row
  const slide = k => ease((t - (RACE0 + k * RACE_STEP - 0.2)) / 0.2)
  const hy = ROW0 - 40 + ROW_H * (slide(1) + slide(2) + slide(3))
  const hOn = rise(t, RACE0 - 0.2, 0.3) * (1 - rise(t, END + 0.1, 0.4))
  s += '<rect x="30" y="' + f(hy) + '" width="590" height="' + (ROW_H - 4) + '" rx="16" fill="' + C.panel + '" opacity="' + f(hOn) + '"/>'

  // Gold thread joining the badges at the end
  const thread = rise(t, END + 0.1, 0.5)
  if (thread > 0) {
    const y1 = ROW0 + 50, y2 = ROW0 + 3 * ROW_H + 50
    s += '<line x1="' + BX + '" x2="' + BX + '" y1="' + y1 + '" y2="' + f(y1 + (y2 - y1) * thread) + '" stroke="' + ENERGY.solar + '" stroke-width="4" stroke-opacity="0.6" stroke-linecap="round"/>'
  }

  ROWS.forEach((row, i) => {
    const y = ROW0 + i * ROW_H
    const a = RACE0 + i * RACE_STEP
    const p = clamp((t - a) / RACE_D)
    // Empty lanes are set out from the first frame, before each race
    const on = 0.35 + 0.65 * rise(t, -0.25 + i * 0.12, 0.4)
    // Year label
    s += '<text x="' + X0 + '" y="' + y + '" font-family="' + F + '" font-size="26" font-weight="800" fill="' + (p >= 1 ? C.text : C.muted) + '" opacity="' + f(on) + '">' + row.year + '</text>'
    // Lanes: wind bolts out early, solar accelerates past it
    const lanes = [
      { len: row.solar * Math.pow(p, 1.5) * (1 + 0.04 * Math.sin(p * Math.PI)), col: 'url(#r-gold)' },
      { len: row.wind * (1 - Math.pow(1 - p, 2.6)), col: ENERGY.clean },
      { len: row.other * (1 - Math.pow(1 - p, 2)), col: ENERGY.other }
    ]
    lanes.forEach((ln, k) => {
      const by = y + 14 + k * (BAR_H + BAR_GAP)
      s += '<rect x="' + X0 + '" y="' + by + '" width="' + f(row.solar + 40) + '" height="' + BAR_H + '" rx="' + BAR_H / 2 + '" fill="' + ENERGY.slate + '" opacity="' + f(0.45 * on) + '"/>'
      if (ln.len > 1) {
        s += '<rect x="' + X0 + '" y="' + by + '" width="' + f(Math.max(BAR_H, ln.len)) + '" height="' + BAR_H + '" rx="' + BAR_H / 2 + '" fill="' + ln.col + '" opacity="' + f(on * (k ? 0.9 : 1)) + '"/>'
      }
    })
    // Solar's tip: glow, and bolts thrown off while racing
    const sLen = lanes[0].len, tipX = X0 + Math.max(BAR_H, sLen), tipY = y + 14 + BAR_H / 2
    const glow = Math.max(hold(t, a + 0.2, a + RACE_D + 0.4, 0.2) * 0.8, glowAll * 0.6)
    if (sLen > 4 && glow > 0) s += '<circle cx="' + f(tipX - 6) + '" cy="' + tipY + '" r="18" fill="url(#r-halo)" opacity="' + f(glow) + '"/>'
    if (p > 0 && p < 1) {
      for (let b = 0; b < 4; b++) {
        const life = 0.45, age = ((t - a + hash(i, b) * life) % life) / life
        const bx = Math.max(X0 + 14, tipX - 10 - age * 50), byy = tipY - 18 - age * 26 + hash(b, i) * 14
        s += '<g opacity="' + f(Math.sin(age * Math.PI) * 0.8) + '">' + bolt(kit, { x: bx, y: byy, size: 12 + hash(b, 3) * 6 }) + '</g>'
      }
    }
    // The #1 badge stamps in from big
    const st = pop(t, a + RACE_D - 0.05, 0.4)
    if (st > 0) {
      const sc = 1 + (1 - clamp(st)) * 0.9
      const by = y + 50 + float(t, 2, 2.2, i * 0.3) * glowAll
      const flash = hold(t, a + RACE_D, a + RACE_D + 0.45, 0.2)
      const halo = Math.max(flash, glowAll * (0.75 + 0.25 * Math.sin(t * 6)))
      s += '<g transform="translate(' + BX + ' ' + f(by) + ')">' +
        '<g transform="scale(' + f(sc) + ')" opacity="' + f(clamp(st * 1.6)) + '">' +
        '<circle r="' + (BR + 14) + '" fill="url(#r-halo)" opacity="' + f(halo) + '"/>' +
        '<circle r="' + BR + '" fill="url(#r-gold)" stroke="#fff4d6" stroke-width="2.5" stroke-opacity="0.8"/>' +
        '<circle r="' + (BR - 6) + '" fill="none" stroke="#1a1530" stroke-opacity="0.25" stroke-width="1.5"/>' +
        '<text y="10" text-anchor="middle" font-family="' + F + '" font-size="28" font-weight="800" fill="#1a1530">#1</text></g></g>'
    }
  })

  // '4 years running' tag beside the legend, over the badge column
  const tag = pop(t, END + 0.25, 0.45)
  if (tag > 0) {
    const ty = 439
    s += '<g transform="translate(' + BX + ' ' + ty + ') scale(' + f(0.7 + 0.3 * tag) + ')" opacity="' + f(clamp(tag * 1.5)) + '">' +
      '<rect x="-166" y="-22" width="222" height="44" rx="22" fill="' + ENERGY.solar + '" fill-opacity="0.14" stroke="' + ENERGY.solar + '" stroke-width="2"/>' +
      '<text x="-55" y="7" text-anchor="middle" font-family="' + F + '" font-size="18" font-weight="800" letter-spacing="1.6" fill="' + ENERGY.solar + '">4 YEARS RUNNING</text></g>'
  }

  // Source line under the picture
  s += '<g font-family="' + F + '" font-size="15" fill="' + C.muted + '" opacity="' + f(0.85 * rise(t, 0.5)) + '">' +
    '<text x="40" y="988">Source: Ember, Global Electricity Review 2026</text>' +
    '<text x="40" y="1010">Bar lengths illustrative; solar grew most each year</text></g>'

  kit.stage(s)
}
