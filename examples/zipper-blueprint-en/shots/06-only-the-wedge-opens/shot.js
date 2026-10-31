// 06-only-the-wedge-opens: Slide it back to open. The cut-open slider of shot 4 glides down the
// closed column; locked teeth rise up its throat, the channel splits them one at a time: each tilts
// along the angle arc (with a small spring), its teal lock goes out, and it leaves up its arm.
// Shot-local time: t = 0 is this shot's first frame.
import { sliderCutaway, sliderGeom, toothShape, tag } from '../../world/parts.js'

const V = 58 // teeth flow through the slider, px/s

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, ease, rise } = kit
  kit.frame({ kicker: 'Opening it', head: ['Slide it back: it', '*separates* them'], typed: clamp(0.3 + t / 0.6), progress: (start + t) / 32 })

  // The slider glides down the frame
  const S = { x: 330, y: 590 + 110 * ease(t / 5), scale: 1 }
  const g = sliderGeom(kit, S)
  const half = g.u + 2 * g.s                       // one tooth to the next in the locked column
  const L = Math.hypot(150, 280) * g.s             // arm length, meeting point to entry
  const T = 240 * g.s                              // throat length
  const D = 1.1 * half                             // distance over which a tooth tilts open
  const tilt = g.arm('left', 1).angle
  // Spring: the tilt overshoots a little before settling on the arm's angle
  const spring = q => { q = clamp(q); return 1 + 2.7 * Math.pow(q - 1, 3) + 1.7 * Math.pow(q - 1, 2) }

  // Tooth k sits d past the meeting point (d < 0: already out on its arm)
  const d0 = 0.4 * half - V * t
  let teeth = '', tape = '', act = 0
  const kMin = Math.floor((-d0 - L - 90) / half), kMax = Math.ceil((T + 160 - d0) / half)
  for (let k = kMin; k <= kMax; k++) {
    const d = d0 + k * half, side = (k & 1) ? 'right' : 'left', sx = side === 'right' ? 1 : -1
    let pos, angle, glow = 0
    if (d < 0) {
      pos = g.arm(side, 1 + d / L)
      angle = pos.angle
    } else {
      pos = g.throat(d / T)
      angle = sx * tilt * spring(1 - d / D) * (d < D ? 1 : 0)
      // The lock glows while meshed and goes out as the channel parts it
      glow = 0.55 * Math.pow(clamp(d / D), 2)
    }
    // How much this tooth is being parted now (drives the arc and the wedge)
    act = Math.max(act, d >= 0 ? clamp(1 - d / D) : clamp(1 + d / (0.6 * half)))
    const op = clamp((pos.y - 330) / 50) * clamp((990 - pos.y) / 50) * (0.5 + 0.5 * rise(t, 0, 0.5))
    if (op <= 0) continue
    teeth += toothShape(kit, { x: pos.x, y: pos.y, size: g.u, side, angle, glow, opacity: op.toFixed(3) })
  }

  // The closed tapes below the slider (they stay put; the slider moves down them)
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? S.x - 2.4 * g.u - 3.4 * g.u : S.x + 2.4 * g.u - 4
    const y0 = g.exit.y - 30
    tape += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (3.4 * g.u + 4).toFixed(1) + '" height="' + Math.max(0, 1000 - y0).toFixed(1) +
      '" fill="url(#hatch)" opacity="0.35"/>' +
      '<line x1="' + (sx < 0 ? x0 : x0 + 3.4 * g.u + 4).toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + (sx < 0 ? x0 : x0 + 3.4 * g.u + 4).toFixed(1) +
      '" y2="1000" stroke="' + C.text + '" stroke-width="2" opacity="0.7"/>'
  }

  const p = 0.8 + 0.2 * ease(clamp(t / 0.5))
  let s = tape + teeth
  s += sliderCutaway(kit, { ...S, p, labels: clamp((t - 0.4) / 0.8), arc: act * rise(t, 0.6, 0.5), wedgeGlow: 0.35 + 0.65 * act, id: 'cut' })

  // Counter-arrow: the slider is pulled down, the teeth leave upward
  const ay = S.y, ao = rise(t, 0.8, 0.5)
  s += '<g opacity="' + ao.toFixed(3) + '">' +
    '<line x1="606" y1="' + (ay - 30).toFixed(1) + '" x2="606" y2="' + (ay + 200).toFixed(1) + '" stroke="' + C.muted + '" stroke-width="1.4" stroke-dasharray="4 6" stroke-dashoffset="' + (-t * 30).toFixed(1) + '"/>' +
    kit.arrow(606, ay - 10, 606, ay + 120 + 6 * Math.sin(t * 4), { color: C.text, width: 4 }) +
    kit.arrow(578, ay + 140, 578, ay + 20 - 6 * Math.sin(t * 4), { color: C.muted, width: 3 }) + '</g>'
  s += tag(kit, g.meet.x, g.meet.y, 'one tooth at a time', { dx: -110, dy: 175, p: clamp((t - 1.6) / 1.0), color: C.hue.teal, size: 19 })

  // Source, small under the picture
  s += '<text x="' + kit.PAD + '" y="1018" font-size="15" fill="' + C.muted + '" font-family="' + kit.FONT.replace(/"/g, '') +
    '" opacity="' + rise(t, 1.2, 0.6).toFixed(3) + '">Source: US Patent 1,219,881 (1917); Britannica</text>'

  kit.stage(s)
}
