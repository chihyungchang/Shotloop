// 04-three-quarters-of-new: the net rise in world electricity demand in 2025
// stands as four equal blocks; three fill gold in turn while a counter rolls
// to 75%: solar alone met three quarters of it (Ember, Global Electricity Review 2026).
// Shot-local time: t = 0 is this shot's first frame.
import { ENERGY, sunDisc, bolt } from '../../world/parts.js'

const AXIS_Y = 910, BH = 104, GAP = 10, BW = 150, CX = 190
const FILL = [0.7, 1.15, 1.6] // gold fills, bottom block first
const blockY = i => AXIS_Y - (i + 1) * BH - i * GAP
const f = n => Number(n).toFixed(1)

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, rise, pop, hold, float, hash, count } = kit
  const F = FONT.replace(/"/g, '')

  // Caption: typed in by 0.55 s, then still to the end
  kit.frame({ kicker: '04 / 06', head: ['Solar met *75%*', 'of new demand'], typed: rise(t, -0.15, 0.6), progress: (start + t) / 23.5 })

  let s = '<defs><linearGradient id="d-gold" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="' + ENERGY.solarHi + '"/><stop offset="1" stop-color="' + ENERGY.solar + '"/></linearGradient>' +
    '<radialGradient id="d-floor" cx="0.5" cy="0.5"><stop offset="0" stop-color="' + ENERGY.solar + '" stop-opacity="0.16"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0"/></radialGradient></defs>'

  // Background: warm floor glow, chart label, ground line
  s += '<ellipse cx="300" cy="' + AXIS_Y + '" rx="320" ry="90" fill="url(#d-floor)"/>'
  s += '<text x="40" y="378" font-family="' + F + '" font-size="18" font-weight="600" letter-spacing="2.4" fill="' + C.muted + '" opacity="' + f(rise(t, -0.2)) + '">NET RISE IN DEMAND · 2025</text>'
  s += '<line x1="50" y1="' + AXIS_Y + '" x2="620" y2="' + AXIS_Y + '" stroke="' + C.muted + '" stroke-opacity="0.5" stroke-width="2.5" stroke-linecap="round"/>'

  // Four equal blocks = the whole rise; the empty ones are set out from the first frame
  for (let i = 0; i < 4; i++) {
    const y = blockY(i), on = rise(t, -0.3 + i * 0.08, 0.4)
    s += '<rect x="' + (CX - BW / 2) + '" y="' + y + '" width="' + BW + '" height="' + BH + '" rx="8" fill="' + ENERGY.slate + '" stroke="' + C.muted + '" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="5 5" opacity="' + f(on) + '"/>'
    if (i === 3) {
      s += '<text x="' + CX + '" y="' + (y + BH / 2 + 7) + '" text-anchor="middle" font-family="' + F + '" font-size="20" font-weight="700" fill="' + C.muted + '" opacity="' + f(rise(t, 2.1, 0.4)) + '">the rest</text>'
      continue
    }
    const g = pop(t, FILL[i], 0.45)
    if (g <= 0) continue
    const flash = hold(t, FILL[i], FILL[i] + 0.4, 0.15)
    const drop = (1 - clamp(g)) * -40
    s += '<g transform="translate(0 ' + f(drop) + ')" opacity="' + f(clamp(g * 1.5)) + '">' +
      '<rect x="' + (CX - BW / 2) + '" y="' + y + '" width="' + BW + '" height="' + BH + '" rx="8" fill="url(#d-gold)"/>' +
      '<rect x="' + (CX - BW / 2) + '" y="' + y + '" width="' + BW + '" height="' + BH + '" rx="8" fill="#fff4d6" opacity="' + f(0.45 * flash) + '"/>' +
      '<text x="' + CX + '" y="' + (y + BH / 2 + 9) + '" text-anchor="middle" font-family="' + F + '" font-size="26" font-weight="800" fill="#1a1530">25%</text></g>'
  }

  // Bolts rising off the newest gold block while it fills
  const top = blockY(Math.min(2, Math.floor(clamp((t - FILL[0]) / 1.4) * 3)))
  const bOn = rise(t, FILL[0], 0.3) * (1 - rise(t, 2.2, 0.5))
  for (let i = 0; bOn > 0 && i < 10; i++) {
    const life = 1.0, age = ((t + hash(i, 4) * life) % life) / life
    const x = CX - BW / 2 + 14 + hash(i, 9) * (BW - 28) + Math.sin(age * 6 + i) * 4
    const y = top - 10 - age * 60
    s += '<g opacity="' + f(bOn * Math.sin(age * Math.PI) * 0.9) + '">' + bolt(kit, { x, y, size: 14 + hash(i, 2) * 8 }) + '</g>'
  }

  // Bracket along the three gold blocks
  const br = rise(t, 2.0, 0.4)
  if (br > 0) {
    const bx = CX + BW / 2 + 18, y0 = blockY(2), y1 = AXIS_Y
    s += '<path d="M' + bx + ' ' + y0 + ' h12 V' + f(y0 + (y1 - y0) * br) + ' h-12" fill="none" stroke="' + ENERGY.solarHi + '" stroke-width="3" stroke-linecap="round" opacity="' + f(br) + '"/>'
  }

  // The big 75%: rolls with the fills, lands with a bounce, then floats
  const mx = 480, my = 640
  const roll = clamp((t - FILL[0]) / (FILL[2] + 0.45 - FILL[0]))
  const q = clamp((t - 2.05) / 0.6)
  const bounce = t < 2.05 ? 0 : Math.exp(-5 * q) * Math.sin(3 * Math.PI * q)
  const numIn = rise(t, 0.5, 0.35)
  s += sunDisc(kit, { x: mx, y: my - 40, r: 96, t, p: rise(t, 0.3, 0.6), glow: 0.5 + 0.5 * roll, id: 'q-sun' })
  s += '<g transform="translate(' + mx + ' ' + f(my + float(t, 3, 2.4)) + ') scale(' + (1 + 0.08 * bounce).toFixed(4) + ')" opacity="' + f(numIn) + '">' +
    '<text x="0" y="0" text-anchor="middle" font-family="' + F + '" font-size="112" font-weight="800" letter-spacing="-3" fill="' + ENERGY.solar + '" style="font-variant-numeric: tabular-nums">' +
    count(roll, 0, 75) + '<tspan font-size="64">%</tspan></text></g>'
  s += '<text x="' + mx + '" y="' + (my + 44) + '" text-anchor="middle" font-family="' + F + '" font-size="18" font-weight="700" letter-spacing="2" fill="' + C.muted + '" opacity="' + f(rise(t, 1.0, 0.4)) + '">MET BY SOLAR ALONE</text>'

  // Source line under the picture
  s += '<g font-family="' + F + '" font-size="15" fill="' + C.muted + '" opacity="' + f(0.85 * rise(t, 0.5)) + '">' +
    '<text x="40" y="988">Source: Ember, Global Electricity Review 2026</text>' +
    '<text x="40" y="1010">“Solar power alone met 75% of the net increase in electricity demand”</text></g>'

  kit.stage(s)
}
