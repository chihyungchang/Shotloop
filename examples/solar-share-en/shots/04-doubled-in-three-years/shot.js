// 04-doubled-in-three-years: a cursor runs 2021 → 2024 and the 2021 solar block grows into two of itself.
// Shot-local time: t = 0 is this shot's first frame.
import { ENERGY, sunDisc, bolt } from '../../world/parts.js'

const AXIS_Y = 910, H1 = 230, BW = 96
const X0 = 110, X1 = 400 // 2021 and 2024 on the axis
const SWEEP_A = 0.6, SWEEP_D = 2.5, SNAP = SWEEP_A + SWEEP_D
const yearX = i => X0 + (X1 - X0) * i / 3
const f = n => Number(n).toFixed(1)

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, rise, pop, ease, hold, float, hash, drawOn } = kit
  const F = FONT.replace(/"/g, '')

  // Caption: typed in by 0.55 s, then still to the end
  kit.frame({ kicker: '04 / 06', head: ['Doubled in just', '*three years*'], typed: rise(t, -0.15, 0.6), progress: (start + t) / 23.5 })

  // Sweep progress and the copy's height (steady doubling: 2^p)
  const p = ease((t - SWEEP_A) / SWEEP_D)
  const cx = X0 + (X1 - X0) * p
  const hc = H1 * Math.pow(2, p)
  const snap = pop(t, SNAP, 0.35)
  const gap = 10 * snap
  const base = rise(t, 0.15, 0.5)
  const yr = 2021 + Math.round(p * 3)

  let s = '<defs><linearGradient id="d-gold" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="' + ENERGY.solarHi + '"/><stop offset="1" stop-color="' + ENERGY.solar + '"/></linearGradient>' +
    '<radialGradient id="d-floor" cx="0.5" cy="0.5"><stop offset="0" stop-color="' + ENERGY.solar + '" stop-opacity="0.16"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0"/></radialGradient></defs>'

  // Background: warm floor glow and faint level grid
  s += '<ellipse cx="300" cy="' + AXIS_Y + '" rx="320" ry="90" fill="url(#d-floor)"/>'
  for (let k = 1; k <= 2; k++) {
    s += '<line x1="40" x2="620" y1="' + (AXIS_Y - H1 * k) + '" y2="' + (AXIS_Y - H1 * k) + '" stroke="' + C.line + '" stroke-width="1" opacity="' + f(0.5 * base) + '"/>'
  }
  s += '<text x="40" y="378" font-family="' + F + '" font-size="18" font-weight="600" letter-spacing="2.4" fill="' + C.muted + '" opacity="' + f(rise(t, 0.3)) + '">WORLD SOLAR GENERATION</text>'

  // Axis with year ticks
  s += '<line id="axis" x1="50" y1="' + AXIS_Y + '" x2="470" y2="' + AXIS_Y + '" stroke="' + C.muted + '" stroke-width="2.5" stroke-linecap="round"/>'
  for (let i = 0; i < 4; i++) {
    const x = yearX(i), on = rise(t, -0.1 + i * 0.08, 0.4)
    const lit = i === 0 || p * 3 >= i - 0.02
    s += '<g opacity="' + f(on) + '" font-family="' + F + '">' +
      '<line x1="' + x + '" x2="' + x + '" y1="' + AXIS_Y + '" y2="' + (AXIS_Y + 10) + '" stroke="' + C.muted + '" stroke-width="2"/>' +
      '<text x="' + x + '" y="' + (AXIS_Y + 40) + '" text-anchor="middle" font-size="24" font-weight="800" fill="' + (lit ? C.text : C.muted) + '">' + (2021 + i) + '</text></g>'
  }

  // Ghost outlines left at 2022 and 2023 as the copy passes (illustrative path)
  for (let i = 1; i <= 2; i++) {
    const g = rise(p * 3, i, 0.4)
    if (g <= 0) continue
    const h = H1 * Math.pow(2, i / 3), x = yearX(i) - BW / 2 + 14
    s += '<rect x="' + x + '" y="' + f(AXIS_Y - h) + '" width="' + (BW - 28) + '" height="' + f(h) + '" rx="6" fill="' + ENERGY.solar + '" fill-opacity="0.08" stroke="' + ENERGY.solar + '" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="5 5" opacity="' + f(g) + '"/>'
  }

  // The 2021 level, drawn on behind the cursor
  s += '<line id="lvl" x1="' + (X0 + BW / 2) + '" y1="' + (AXIS_Y - H1) + '" x2="' + f(Math.max(X0 + BW / 2 + 1, cx - BW / 2)) + '" y2="' + (AXIS_Y - H1) + '" stroke="' + ENERGY.solar + '" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="6 6"/>'

  // The 2021 block
  const bl = pop(t, -0.15, 0.6)
  const h0 = H1 * bl
  s += '<rect x="' + (X0 - BW / 2) + '" y="' + f(AXIS_Y - h0) + '" width="' + BW + '" height="' + f(h0) + '" rx="8" fill="url(#d-gold)"/>'
  s += '<text x="' + X0 + '" y="' + (AXIS_Y - H1 / 2 + 9) + '" text-anchor="middle" font-family="' + F + '" font-size="24" font-weight="800" fill="#1a1530" opacity="' + f(rise(t, 0.4)) + '">2021</text>'

  // The copy: slides out with the cursor, grows, then splits into two halves
  if (t >= SWEEP_A) {
    const bx = cx - BW / 2
    if (snap <= 0) {
      s += '<rect x="' + f(bx) + '" y="' + f(AXIS_Y - hc) + '" width="' + BW + '" height="' + f(hc) + '" rx="8" fill="url(#d-gold)"/>'
      s += '<text x="' + f(cx) + '" y="' + f(AXIS_Y - hc / 2 + 10) + '" text-anchor="middle" font-family="' + F + '" font-size="28" font-weight="800" fill="#1a1530" style="font-variant-numeric: tabular-nums">×' + Math.pow(2, p).toFixed(1) + '</text>'
    } else {
      const flash = hold(t, SNAP, SNAP + 0.6, 0.25)
      s += '<rect x="' + f(bx) + '" y="' + (AXIS_Y - H1) + '" width="' + BW + '" height="' + H1 + '" rx="8" fill="url(#d-gold)"/>'
      s += '<rect x="' + f(bx) + '" y="' + f(AXIS_Y - 2 * H1 - gap) + '" width="' + BW + '" height="' + H1 + '" rx="8" fill="url(#d-gold)"/>'
      s += '<rect x="' + f(bx) + '" y="' + f(AXIS_Y - 2 * H1 - gap) + '" width="' + BW + '" height="' + H1 + '" rx="8" fill="#fff4d6" opacity="' + f(0.45 * flash) + '"/>'
      for (let k = 0; k < 2; k++) {
        const ty = AXIS_Y - H1 / 2 - k * (H1 + gap) + 9
        s += '<text x="' + f(cx) + '" y="' + f(ty) + '" text-anchor="middle" font-family="' + F + '" font-size="24" font-weight="800" fill="#1a1530" opacity="' + f(rise(t, SNAP + 0.1, 0.3)) + '">2021</text>'
      }
    }

    // Bolts rising off the growing copy
    for (let i = 0; i < 12; i++) {
      const life = 1.1, ph = hash(i, 4) * life
      const age = ((t - SWEEP_A + ph) % life) / life
      const on = clamp((t - SWEEP_A) / 0.3) * (1 - rise(t, SNAP + 0.2, 0.5))
      if (on <= 0) continue
      const topY = snap > 0 ? AXIS_Y - 2 * H1 - gap : AXIS_Y - hc
      const x = cx - BW / 2 + 10 + hash(i, 9) * (BW - 20) + Math.sin(age * 6 + i) * 4
      const y = topY - 8 - age * 70
      s += '<g opacity="' + f(on * Math.sin(age * Math.PI) * 0.9) + '">' + bolt(kit, { x, y, size: 14 + hash(i, 2) * 8 }) + '</g>'
    }
  }

  // Cursor: a line over the axis with a rolling year badge
  const cOn = rise(t, 0.35, 0.3) * (1 - rise(t, SNAP + 0.1, 0.4))
  if (cOn > 0) {
    s += '<g opacity="' + f(cOn) + '">' +
      '<line x1="' + f(cx) + '" x2="' + f(cx) + '" y1="430" y2="' + (AXIS_Y + 6) + '" stroke="' + C.text + '" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="3 5"/>' +
      '<rect x="' + f(cx - 44) + '" y="398" width="88" height="36" rx="18" fill="' + C.text + '"/>' +
      '<text x="' + f(cx) + '" y="424" text-anchor="middle" font-family="' + F + '" font-size="22" font-weight="800" fill="#0d1736" style="font-variant-numeric: tabular-nums">' + yr + '</text>' +
      '<circle cx="' + f(cx) + '" cy="' + AXIS_Y + '" r="7" fill="' + C.text + '"/></g>'
  }

  // The ×2: drops in beside the stack with a bounce, then floats
  const drop = pop(t, SNAP + 0.1, 0.55)
  if (drop > 0) {
    const mx = 540, my = AXIS_Y - H1 - 10
    s += sunDisc(kit, { x: mx, y: my - 30, r: 52, t, p: rise(t, SNAP + 0.1, 0.5), glow: 0.8, id: 'x2sun' })
    const dy = (1 - drop) * -140 + float(t, 3, 2.4)
    s += '<g transform="translate(0 ' + f(dy) + ')" opacity="' + f(clamp(drop * 1.5)) + '">' +
      '<text x="' + mx + '" y="' + my + '" text-anchor="middle" font-family="' + F + '" font-size="118" font-weight="800" fill="' + ENERGY.solar + '">×2</text>' +
      '<text x="' + mx + '" y="' + (my + 38) + '" text-anchor="middle" font-family="' + F + '" font-size="18" font-weight="600" letter-spacing="2" fill="' + C.muted + '">SINCE 2021</text></g>'
  }

  // Source line under the picture
  s += '<g font-family="' + F + '" font-size="15" fill="' + C.muted + '" opacity="' + f(0.85 * rise(t, 0.5)) + '">' +
    '<text x="40" y="988">Source: Ember, Global Electricity Review 2025</text>' +
    '<text x="40" y="1010">2022–23 outlines: illustrative steady path</text></g>'

  const q = kit.stage(s)
  drawOn(q('#axis'), rise(t, -0.2, 0.6))
}
