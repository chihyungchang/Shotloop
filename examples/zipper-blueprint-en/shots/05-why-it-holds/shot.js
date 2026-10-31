// 05-why-it-holds: Why it holds. The closed zipper column beside a cut-open strip of locked
// teeth, each nested in the next. Red pull arrows grow and tremble on both and run along the
// tapes to every tooth, while the teal locks pulse and nothing moves.
// Shot-local time: t = 0 is this shot's first frame.
import { zipperColumn, zipperGeom, toothShape } from '../../world/parts.js'

const Z = { x: 185, y: 380, h: 590, close: 1, trail: 0, id: 'hold' }
const ST = { x: 476, y0: 444, u: 22, n: 19 }   // the section strip: centre, first tooth, size, count
const r1 = n => Math.round(n * 10) / 10

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, ease, rise } = kit
  const F = kit.FONT.replace(/"/g, '')
  kit.frame({ kicker: 'Why it holds', head: ['Locked, each tooth', 'sits *nested*', 'in the next'], typed: clamp(0.3 + t / 0.6), progress: (start + t) / 32 })

  // Force rises, with a tremble once it is strong
  const f = ease(clamp((t - 0.9) / 2.8))
  const shake = f * Math.sin(t * 47) * 0.5 + f * Math.sin(t * 31 + 1) * 0.5
  const pulse = 0.55 + 0.3 * Math.sin(t * Math.PI * 2 / 1.2)
  const reach = ease(clamp((t - 1.2) / 1.9))     // how far the force has fanned out

  // The column, drawn on quickly, closed and pulled apart
  const z = { ...Z, draw: 0.65 + 0.35 * ease(clamp(t / 0.7)), sliderIn: clamp(0.35 + t / 0.5), glow: pulse * rise(t, 0.6, 0.6), force: 0.04 + 0.5 * f + 0.03 * shake }
  const g = zipperGeom(kit, z)
  let s = zipperColumn(kit, z)

  // Force reaching each locked tooth of the column, top to bottom
  const locked = g.teeth.filter(q => q.locked)
  const yA = locked[0].y, yB = locked[locked.length - 1].y
  for (const q of locked) {
    const a = clamp((reach * 1.15 - (q.y - yA) / (yB - yA)) / 0.15)
    if (a <= 0) continue
    const sx = q.side === 'right' ? 1 : -1, x0 = q.x + sx * 1.35 * g.u, len = (0.5 + 0.6 * f) * g.u + 0.6 * shake
    s += '<g opacity="' + a.toFixed(3) + '">' + kit.arrow(r1(x0), q.y, r1(x0 + sx * len), q.y, { color: C.hue.red, width: 2 }) + '</g>'
  }

  // Section mark on the column, with leaders to the strip
  const sec = locked.filter(q => q.i >= 5 && q.i <= 8)
  const by0 = sec[0].y - 16, by1 = sec[sec.length - 1].y + 16, bx0 = g.cx - 1.5 * g.u - 34, bx1 = g.cx + 1.5 * g.u + 34
  const fx0 = ST.x - 86, fx1 = ST.x + 86, fy0 = ST.y0 - 40, fy1 = ST.y0 + (ST.n - 1) * (ST.u + 2) + 36
  const lead = rise(t, 0.4, 0.7)
  s += '<g fill="none" stroke="' + C.muted + '" stroke-width="1.4" stroke-dasharray="5 5">' +
    '<rect x="' + r1(bx0) + '" y="' + r1(by0) + '" width="' + r1(bx1 - bx0) + '" height="' + r1(by1 - by0) + '" rx="6" opacity="' + lead.toFixed(3) + '"/>' +
    '<path d="M' + r1(bx1) + ',' + r1(by0) + 'L' + r1(bx1 + (fx0 - bx1) * lead) + ',' + r1(by0 + (fy0 - by0) * lead) +
    'M' + r1(bx1) + ',' + r1(by1) + 'L' + r1(bx1 + (fx0 - bx1) * lead) + ',' + r1(by1 + (fy1 - by1) * lead) + '"/></g>'
  // The strip's frame and title
  const fr = rise(t, 0.6, 0.7)
  s += '<rect x="' + fx0 + '" y="' + fy0 + '" width="' + (fx1 - fx0) + '" height="' + (fy1 - fy0) + '" rx="10" fill="#0d1838" fill-opacity="' + (0.85 * fr).toFixed(3) +
    '" stroke="' + C.text + '" stroke-width="2"' + (fr < 1 ? ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - fr).toFixed(3) + '"' : '') + '/>'
  s += '<text x="' + ST.x + '" y="' + (fy0 - 14) + '" text-anchor="middle" font-size="16" font-weight="600" letter-spacing="0.14em" fill="' + C.muted +
    '" font-family="' + F + '" opacity="' + fr.toFixed(3) + '">SECTION A</text>'

  // Strip tapes (hatched) and the locked teeth, cut open
  const tl = ST.x - 2.4 * ST.u, tr = ST.x + 2.4 * ST.u, tw = 20, ty0 = fy0 + 12, ty1 = fy1 - 12
  for (const x of [tl - tw, tr]) {
    s += '<rect x="' + r1(x) + '" y="' + ty0 + '" width="' + tw + '" height="' + (ty1 - ty0) + '" fill="url(#zp-hatch-ink)" stroke="' + C.text + '" stroke-width="1.8" opacity="' + fr.toFixed(3) + '"/>'
  }
  const ym = ST.y0 + (ST.n - 1) / 2 * (ST.u + 2)
  let small = ''
  for (let k = 0; k < ST.n; k++) {
    const side = k % 2 ? 'right' : 'left', y = ST.y0 + k * (ST.u + 2), sx = side === 'right' ? 1 : -1
    const d = Math.abs(k - (ST.n - 1) / 2)
    s += toothShape(kit, { x: ST.x, y, size: ST.u, side, p: kit.stagger(t, d, 0.7, 0.05, 0.5), hatch: 0.6, glow: pulse * rise(t, 1.0 + d * 0.03, 0.5) })
    // The force reaches this tooth: a small arrow on its neck
    const a = clamp((reach * ((ST.n + 1) / 2) - d) / 1.2)
    if (a > 0) {
      const x0 = ST.x + sx * 1.35 * ST.u, len = (0.55 + 0.4 * f) * ST.u + 0.6 * shake
      small += '<g opacity="' + a.toFixed(3) + '">' + kit.arrow(r1(x0), y, r1(x0 + sx * len), y, { color: C.hue.red, width: 2.6 }) + '</g>'
    }
  }
  s += small
  // The force running along each tape from the pull point
  if (reach > 0) {
    const ext = reach * (ym - ty0)
    for (const x of [tl - tw / 2, tr + tw / 2]) {
      s += '<path d="M' + x + ',' + r1(ym - ext) + 'L' + x + ',' + r1(ym + ext) + '" stroke="' + C.hue.red + '" stroke-width="4" stroke-linecap="round" opacity="0.85"/>'
    }
  }
  // The big pull on each tape, with its label
  if (f > 0) {
    const len = 8 + 22 * f + 2 * shake
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? tl - tw - 3 : tr + tw + 3, x1 = x0 + sx * len
      s += kit.arrow(r1(x0), ym, r1(x1), ym, { color: C.hue.red, width: 6 })
      s += '<text x="' + r1(x0 + sx * 34) + '" y="' + (ym - 26) + '" text-anchor="middle" font-size="19" paint-order="stroke" stroke="#0b1532" stroke-width="5" font-weight="700" fill="' + C.hue.red +
        '" font-family="' + F + '" opacity="' + clamp(f * 3).toFixed(3) + '">pull</text>'
    }
  }
  // What holds: the lock does not move
  const lk = clamp((t - 2.6) / 0.8)
  if (lk > 0) {
    const n = Math.ceil('locked, not moving'.length * lk)
    s += '<text x="' + ST.x + '" y="' + (fy1 + 28) + '" text-anchor="middle" font-size="18" font-weight="600" fill="' + C.hue.teal + '" font-family="' + F + '">' +
      'locked, not moving'.slice(0, n) + '<tspan fill-opacity="0">' + 'locked, not moving'.slice(n) + '</tspan></text>'
  }

  // Source, small under the picture
  s += '<text x="' + kit.PAD + '" y="1012" font-size="15" fill="' + C.muted + '" font-family="' + F +
    '" opacity="' + rise(t, 1.2, 0.6).toFixed(3) + '">Source: US Patent 1,219,881 (1917)</text>'

  kit.stage(s)
  // Slow push in on the pair
  // (x 360 and y 380 stay put, so nothing grows into the headline or off the right edge)
  const zs = 1 + 0.03 * ease(t / 5)
  kit.view({ x: 360, y: 380 + 260 / zs, s: zs })
}
