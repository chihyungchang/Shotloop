// 03-30-in-one-year: +30% in one year. Two gold bars, 2024 and 2025; the
// added slice fills with rising particles while +30% and +636 TWh roll.
// 2025 = 2,778 TWh, +636 TWh (Ember); 2024 = 2,778 − 636 = 2,142 TWh (arithmetic).
// Shot-local time: t = 0 is this shot's first frame.
import { ENERGY, sunDisc } from '../../world/parts.js'

const V23 = 2142, V24 = 2778, ADD = 636
const BASE = 900, SCALE = 440 / V24 // px per TWh
const B23 = { x: 80, w: 130 }, B24 = { x: 250, w: 130 }

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, lerp, count, hash, float, FONT, HEAD_FONT } = kit
  const F = FONT.replace(/"/g, ''), HF = HEAD_FONT.replace(/"/g, '')
  const fmt = n => Math.round(n).toLocaleString('en-US')

  // Timing
  const p23 = rise(t, -0.15, 0.9)
  const p24a = rise(t, 0.9, 0.7) // up to the 2023 level
  const p24b = pop(t, 1.5, 0.9) // past it, with a small overshoot
  const pNum = rise(t, 1.4, 1.5)
  const pAdd = rise(t, 1.8, 1.3)

  const h23 = V23 * SCALE * p23
  const v24 = V23 * p24a + ADD * p24b
  const h24 = v24 * SCALE
  const top23 = BASE - V23 * SCALE
  const top24 = BASE - h24
  const slice = Math.max(0, h24 - V23 * SCALE)

  let s = '<defs>' +
    '<linearGradient id="g23" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ENERGY.solar + '" stop-opacity="0.75"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0.45"/></linearGradient>' +
    '<linearGradient id="g24" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ENERGY.solar + '"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0.6"/></linearGradient>' +
    '<linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="' + ENERGY.solarHi + '"/></linearGradient>' +
    '<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '<clipPath id="col24"><rect x="' + B24.x + '" y="' + (top24 - 2) + '" width="' + B24.w + '" height="' + (h24 + 2) + '" rx="8"/></clipPath>' +
    '</defs>'

  // Small sun beside the big number
  s += sunDisc(kit, { x: 572, y: 196, r: 30, t, p: rise(t, -0.4, 0.8), glow: 0.6 + 0.4 * pNum, id: 'sun3' })

  // Big rolling +30%
  const sc = 1 + 0.06 * Math.sin(Math.PI * clamp((t - 2.7) / 0.5))
  s += '<g transform="translate(40 290) scale(' + sc.toFixed(3) + ')">' +
    '<text x="0" y="0" font-family="' + HF + '" font-size="156" font-weight="800" letter-spacing="-4" fill="' + ENERGY.solar + '" style="font-variant-numeric: tabular-nums">+' + count(pNum, 0, 30) + '%</text></g>'

  // Chart: faint gridlines every 500 TWh, axis label
  const chartIn = 1
  s += '<g opacity="' + chartIn.toFixed(3) + '">'
  for (let v = 500; v <= 2500; v += 500) {
    const y = BASE - v * SCALE
    s += '<line x1="60" y1="' + y + '" x2="600" y2="' + y + '" stroke="' + C.line + '" stroke-width="1" stroke-dasharray="2 6" opacity="0.7"/>'
  }
  s += '<text x="60" y="412" font-family="' + F + '" font-size="17" font-weight="600" letter-spacing="2.6" fill="' + C.muted + '">SOLAR GENERATION · TWh</text>'
  // Ground with its dots
  s += '<line x1="60" y1="' + BASE + '" x2="600" y2="' + BASE + '" stroke="' + C.muted + '" stroke-opacity="0.5" stroke-width="2"/>'
  for (let i = 0; i < 28; i++) {
    const gx = 70 + i * 19.5, near = Math.abs(gx - (B24.x + B24.w / 2)) < 90
    const tw = 0.25 + 0.2 * Math.sin(t * 4 + i * 0.9) + (near ? 0.35 * rise(t, 1.4, 0.5) : 0)
    s += '<circle cx="' + gx + '" cy="' + (BASE + 14) + '" r="2.6" fill="' + ENERGY.solar + '" opacity="' + clamp(tw).toFixed(3) + '"/>'
  }
  s += '</g>'

  // 2023 bar
  if (h23 > 0) {
    s += '<rect x="' + B23.x + '" y="' + (BASE - h23) + '" width="' + B23.w + '" height="' + h23 + '" rx="8" fill="url(#g23)"/>'
    s += '<rect x="' + B23.x + '" y="' + (BASE - h23) + '" width="' + B23.w * 0.25 + '" height="' + h23 + '" fill="#fff" opacity="0.06"/>'
    s += '<text x="' + (B23.x + B23.w / 2) + '" y="' + (BASE - h23 - 14) + '" text-anchor="middle" font-family="' + F + '" font-size="24" font-weight="800" fill="' + C.text + '" opacity="' + rise(t, 0.4, 0.4).toFixed(3) + '" style="font-variant-numeric: tabular-nums">≈' + fmt(V23 * p23) + '</text>'
  }

  // Previous level carried across to the 2025 bar
  const lvl = rise(t, 1.1, 0.5)
  if (lvl > 0) {
    s += '<line x1="' + (B23.x + B23.w) + '" y1="' + top23 + '" x2="' + lerp(B23.x + B23.w, B24.x + B24.w + 14, lvl) + '" y2="' + top23 + '" stroke="' + C.text + '" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="6 5"/>'
  }

  // 2025 bar, the new slice bright on top
  if (h24 > 0) {
    if (slice > 0) s += '<rect x="' + B24.x + '" y="' + top24 + '" width="' + B24.w + '" height="' + slice + '" rx="8" fill="' + ENERGY.solar + '" opacity="' + (0.55 * pAdd).toFixed(3) + '" filter="url(#blur)"/>'
    s += '<g clip-path="url(#col24)">'
    s += '<rect x="' + B24.x + '" y="' + top24 + '" width="' + B24.w + '" height="' + h24 + '" fill="url(#g24)"/>'
    if (slice > 0) s += '<rect x="' + B24.x + '" y="' + top24 + '" width="' + B24.w + '" height="' + slice + '" fill="url(#gNew)"/>'
    s += '<rect x="' + B24.x + '" y="' + top24 + '" width="' + B24.w * 0.25 + '" height="' + h24 + '" fill="#fff" opacity="0.08"/>'
    // Particles rising from the ground into the new slice
    const flow = rise(t, 1.3, 0.5)
    for (let i = 0; i < 46 && flow > 0; i++) {
      const per = 1.1 + hash(i, 1) * 0.6
      const ph = ((t * 1 + hash(i, 2) * per) % per) / per
      const px = B24.x + 12 + hash(i, 3) * (B24.w - 24) + Math.sin(t * 3 + i) * 4
      const targetY = top24 + 6 + hash(i, 4) * Math.max(4, slice - 12)
      const py = lerp(BASE + 12, targetY, ph)
      const inNew = py < top23
      const r = (inNew ? 4.6 : 2.6) * (0.8 + 0.4 * hash(i, 5))
      const op = flow * Math.min(1, ph * 5) * (1 - Math.pow(ph, 6))
      s += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + (inNew ? ENERGY.solar : '#fff4d6') + '" opacity="' + (op * (inNew ? 0.95 : 0.7)).toFixed(3) + '"/>'
    }
    s += '</g>'
    s += '<text x="' + (B24.x + B24.w / 2) + '" y="' + (top24 - 14) + '" text-anchor="middle" font-family="' + F + '" font-size="24" font-weight="800" fill="' + C.text + '" opacity="' + rise(t, 1.0, 0.4).toFixed(3) + '" style="font-variant-numeric: tabular-nums">' + fmt(v24) + '</text>'
  }

  // Bracket and rolling +636 TWh beside the slice
  if (pAdd > 0) {
    const bx = B24.x + B24.w + 22, y0 = BASE - V24 * SCALE, y1 = top23
    const fy = float(t, 3, 2.4)
    s += '<g opacity="' + pAdd.toFixed(3) + '">' +
      '<path d="M' + bx + ' ' + y0 + ' h10 V' + y1 + ' h-10" fill="none" stroke="' + ENERGY.solarHi + '" stroke-width="3" stroke-linecap="round"/>' +
      '<g transform="translate(' + (bx + 26) + ' ' + ((y0 + y1) / 2 + fy).toFixed(1) + ')">' +
      '<text x="0" y="8" font-family="' + HF + '" font-size="46" font-weight="800" fill="' + ENERGY.solarHi + '" style="font-variant-numeric: tabular-nums">+' + count(pAdd, 0, ADD) + '</text>' +
      '<text x="2" y="38" font-family="' + F + '" font-size="18" font-weight="700" letter-spacing="2" fill="' + C.muted + '">TWh ADDED</text></g></g>'
  }

  // Year labels
  s += '<g font-family="' + F + '" font-size="26" font-weight="800" text-anchor="middle">' +
    '<text x="' + (B23.x + B23.w / 2) + '" y="' + (BASE + 52) + '" fill="' + C.muted + '" >2024</text>' +
    '<text x="' + (B24.x + B24.w / 2) + '" y="' + (BASE + 52) + '" fill="' + ENERGY.solar + '" opacity="' + rise(t, 0.8, 0.4).toFixed(3) + '">2025</text></g>'

  // Source line
  s += '<text x="40" y="1004" font-family="' + F + '" font-size="15" fill="' + C.muted + '" opacity="' + (0.85 * rise(t, -0.2, 0.5)).toFixed(3) + '">Ember, Global Electricity Review 2026 · 2024 ≈ 2,778 − 636 TWh</text>'

  kit.stage(s)
  kit.frame({ kicker: '03 / 06', head: 'in a single year', typed: rise(t, -0.25, 0.7), top: 304, progress: (start + t) / 23.5 })
}
