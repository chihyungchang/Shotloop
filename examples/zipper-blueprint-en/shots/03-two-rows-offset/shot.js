// 03-two-rows-offset: Two rows, offset. Top view of the two rows facing each other; a pitch
// dimension draws on, the amber row shifts down half a pitch, dashed guides point each blue
// tooth at an amber gap, then the rows slide in and mesh. Shot-local time: t = 0 is the first frame.
import { toothShape, toothPoints, tag } from '../../world/parts.js'

const r1 = n => Math.round(n * 10) / 10
const CX = 330, U = 30, PITCH = 2 * U + 4, HALF = U + 2, N = 8, Y0 = 400
const TOP = 340, BOT = 944, TI = 2.4 * U - 4, TW = 60

// A stroke drawn on with p (pure markup)
const dash = p => p >= 1 ? '' : ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - Math.min(1, Math.max(0, p))).toFixed(4) + '"'

// A vertical dimension: extension lines from x0 to xd at y1 and y2, ticks, label beside it
function vdim(kit, x0, xd, y1, y2, label, p, color, side) {
  const { C, clamp, FONT } = kit
  if (p <= 0) return ''
  const e = clamp(p / 0.4), m = clamp((p - 0.3) / 0.5), lb = clamp((p - 0.7) / 0.3)
  let s = '<g stroke="' + color + '" stroke-width="1.6" fill="none">'
  s += '<path d="M' + r1(x0) + ',' + r1(y1) + 'L' + r1(xd + 8 * Math.sign(xd - x0)) + ',' + r1(y1) + '"' + dash(e) + '/>'
  s += '<path d="M' + r1(x0) + ',' + r1(y2) + 'L' + r1(xd + 8 * Math.sign(xd - x0)) + ',' + r1(y2) + '"' + dash(e) + '/>'
  s += '<path d="M' + r1(xd) + ',' + r1(y1) + 'L' + r1(xd) + ',' + r1(y1 + (y2 - y1) * m) + '" stroke-width="2"/>'
  for (const [yy, k] of [[y1, e], [y1 + (y2 - y1) * m, m]]) if (k > 0) s += '<path d="M' + r1(xd - 6) + ',' + r1(yy + 6) + 'L' + r1(xd + 6) + ',' + r1(yy - 6) + '" stroke-width="2"/>'
  s += '</g>'
  if (lb > 0) s += '<text x="' + r1(xd + side * 10) + '" y="' + r1((y1 + y2) / 2 + 6) + '" font-size="18" font-weight="700" fill="' + color + '" text-anchor="' + (side > 0 ? 'start' : 'end') +
    '" font-family="' + FONT.replace(/"/g, '') + '" opacity="' + lb.toFixed(3) + '" paint-order="stroke" stroke="#0b1532" stroke-width="5" stroke-linejoin="round">' + label + '</text>'
  return s
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, ease, rise, pop, FONT } = kit
  kit.frame({ kicker: 'How a zipper works', head: ['Two rows, offset', 'by *half a tooth*'], typed: clamp(0.3 + t / 0.5), progress: (start + t) / 32 })

  // Timeline: draw on, pitch dim, half-pitch shift, guides, slide in, lock
  const shift = HALF * ease(clamp((t - 1.3) / 0.8))
  const slide = ease(clamp((t - 2.75) / 1.05))
  const D = 110 * (1 - slide)
  const fadeDims = 1 - clamp((t - 2.7) / 0.3)
  const xL = CX - D, xR = CX + D
  const yB = i => Y0 + i * PITCH, yA = i => Y0 + i * PITCH + shift

  let s = ''
  // Centre line
  s += '<path d="M' + CX + ',' + (TOP - 14) + 'L' + CX + ',' + (BOT + 10) + '" stroke="' + C.muted + '" stroke-width="1.2" stroke-dasharray="18 6 3 6" opacity="' + (0.5 * rise(t, 0, 0.6)).toFixed(3) + '"/>'

  // Tapes (hatched fabric), the amber one moving with its row
  const draw = 0.3 + 0.7 * ease(clamp(t / 0.9))
  for (const sx of [-1, 1]) {
    const inner = (sx < 0 ? xL : xR) + sx * TI, outer = inner + sx * TW
    const x0 = Math.min(inner, outer), y0 = TOP, h = (BOT - TOP) * draw
    s += '<rect x="' + r1(x0) + '" y="' + r1(y0) + '" width="' + TW + '" height="' + r1(h) + '" fill="' + C.panel + '"/>'
    s += '<rect x="' + r1(x0) + '" y="' + r1(y0) + '" width="' + TW + '" height="' + r1(h) + '" fill="url(#zp-hatch-ink)"/>'
    for (const ex of [inner, outer]) s += '<path d="M' + r1(ex) + ',' + r1(y0) + 'L' + r1(ex) + ',' + r1(y0 + BOT - TOP) + '" stroke="' + C.text + '" stroke-width="2"' + dash(draw) + '/>'
  }

  // Teeth: blue left, amber right; they glow teal top to bottom once meshed
  for (let i = 0; i < N; i++) {
    const p = clamp((t + 0.2 - i * 0.06) / 0.5)
    const glow = rise(t, 3.7 + i * 0.06, 0.25) * (0.55 + 0.45 * Math.exp(-Math.max(0, t - 3.8 - i * 0.06) * 4))
    s += toothShape(kit, { x: xL, y: yB(i), size: U, side: 'left', p, glow })
    s += toothShape(kit, { x: xR, y: yA(i), size: U, side: 'right', p: clamp((t + 0.12 - i * 0.06) / 0.5), glow })
  }

  // Bump and hollow on the first blue tooth, then retracted
  const lab = clamp((t - 0.35) / 0.6) * (1 - clamp((t - 1.5) / 0.35))
  if (lab > 0) {
    const pt = toothPoints(kit, { x: xL, y: yB(0), size: U, side: 'left' })
    s += tag(kit, pt.bump.x, pt.bump.y, 'bump', { dx: 54, dy: -30, p: lab })
    s += tag(kit, pt.hollow.x, pt.hollow.y, 'hollow', { dx: 54, dy: 26, p: clamp(lab * 1.2 - 0.2) })
  }

  // One pitch between two blue teeth; then half a pitch from blue to amber
  const tipL = xL + 1.2 * U, tipR = xR - 1.2 * U
  if (fadeDims > 0) {
    s += '<g opacity="' + fadeDims.toFixed(3) + '">'
    s += vdim(kit, tipL + 4, tipL + 24, yB(2), yB(3), '1 pitch', clamp((t - 0.6) / 0.8), C.text, 1)
    const hp = clamp((t - 1.25) / 0.5)
    if (hp > 0) s += vdim(kit, tipR - 4, tipR - 24, yB(5), yA(5), '½ pitch', hp, C.hue.yellow, -1)
    s += '</g>'
  }

  // Dashed guides: each blue tooth points at a gap on the amber side
  for (let i = 0; i < N; i++) {
    const a = 2.0 + i * 0.07, g = clamp((t - a) / 0.35) * fadeDims
    if (g <= 0) continue
    const y = yB(i), x1 = tipL + 6, x2 = x1 + (xR - 6 - x1) * g
    const flash = 0.55 + 0.45 * Math.exp(-Math.max(0, t - a - 0.3) * 5)
    s += '<path d="M' + r1(x1) + ',' + y + 'L' + r1(x2) + ',' + y + '" stroke="' + C.hue.blue + '" stroke-width="2.4" stroke-dasharray="7 6" opacity="' + flash.toFixed(3) + '"/>'
    s += '<circle cx="' + r1(xR) + '" cy="' + y + '" r="' + r1(9 * pop(t, a + 0.25, 0.4)) + '" fill="none" stroke="' + C.hue.blue + '" stroke-width="2" opacity="' + flash.toFixed(3) + '"/>'
  }

  // Meshed: one callout on a locked pair
  const lt = clamp((t - 3.85) / 0.55)
  if (lt > 0) s += tag(kit, CX + 1.2 * U - 4, yA(4), 'interlocked', { dx: 96, dy: 28, p: lt, color: C.hue.teal })

  // Source line under the picture
  s += '<text x="40" y="986" font-size="15" fill="' + C.muted + '" font-family="' + FONT.replace(/"/g, '') + '" opacity="' + (0.85 * rise(t, 0.4, 0.6)).toFixed(3) +
    '">Source: Explain that Stuff, “How do zippers work?”</text>'

  kit.stage(s)
  // Zoom about the frame's centre so the picture keeps its place in the safe area
  kit.view({ x: 360, y: 640, s: 1 + 0.04 * ease(t / 4.5) })
}
