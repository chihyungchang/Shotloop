// 04-inside-the-slider: Inside the slider. The slider is cut open into its Y-channel; blue teeth
// stream down the left arm, amber down the right, tilt at the meeting point (the angle arc opens
// and closes for each one), drop flat into the throat and lock with a teal pulse as they exit.
// Shot-local time: t = 0 is this shot's first frame.
import { sliderCutaway, sliderGeom, toothShape } from '../../world/parts.js'

const S = { x: 330, y: 630, scale: 1.1 }
const V = 74 // flow speed along the path, px/s

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, ease, rise } = kit
  kit.frame({ kicker: 'Inside the slider', head: ['The slider *nests*', 'tooth into tooth'], typed: clamp(0.3 + t / 0.6), progress: (start + t) / 32 })

  const g = sliderGeom(kit, S)
  const half = g.u + 2 * g.s                       // one tooth to the next in the locked column
  const L = Math.hypot(150, 280) * g.s             // arm length, entry to meeting point
  const T = 240 * g.s                              // throat length, meeting point to exit
  const D = 0.9 * half                             // distance over which a tooth tilts flat
  const p = 0.3 + 0.7 * ease(clamp(t / 1.1))       // the cutaway traces on
  const flow = 0.35 + 0.65 * rise(t, 0, 0.8)       // teeth fade in as the slider draws

  // Each tooth k sits at path distance d past the meeting point (negative: still on its arm)
  const d0 = V * t + 0.35 * half
  let teeth = '', marks = ''
  const kMin = Math.floor((d0 - T - 120) / half), kMax = Math.ceil((d0 + L + 90) / half)
  for (let k = kMin; k <= kMax; k++) {
    const d = d0 - k * half, side = (k & 1) ? 'right' : 'left'
    let pos, angle, glow = 0
    if (d < 0) {
      pos = g.arm(side, 1 + d / L)
      angle = pos.angle
    } else {
      pos = g.throat(d / T)
      const tilt = g.arm(side, 1).angle
      angle = tilt * (1 - ease(clamp(d / D)))
      // Lock: a teal pulse when it lies flat, a soft glow after
      if (d >= D) glow = 0.32 + 0.68 * Math.exp(-(d - D) / (1.4 * half))
    }
    // Tilt marker on the tooth turning flat: a wedge of arc from level to its axis
    const m = clamp((d + 0.5 * half) / (0.3 * half)) * clamp((D - d) / (0.25 * half))
    if (m > 0 && Math.abs(angle) > 0.5) {
      const sx = side === 'right' ? -1 : 1, R = 2.8 * g.u, a = angle * Math.PI / 180
      const ex = pos.x + sx * R * Math.cos(a), ey = pos.y + sx * R * Math.sin(a)
      marks += '<g opacity="' + m.toFixed(3) + '" fill="none" stroke-linecap="round">' +
        '<path d="M' + pos.x + ',' + pos.y + 'l' + sx * (R + 10) + ',0" stroke="' + C.muted + '" stroke-width="1.4" stroke-dasharray="4 4"/>' +
        '<path d="M' + pos.x + ',' + pos.y + 'L' + ex.toFixed(1) + ',' + ey.toFixed(1) + '" stroke="' + C.text + '" stroke-width="1.6"/>' +
        '<path d="M' + (pos.x + sx * R).toFixed(1) + ',' + pos.y + 'A' + R + ',' + R + ' 0 0 ' + ((sx * angle) < 0 ? 0 : 1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1) +
        '" stroke="' + C.text + '" stroke-width="2.4"/></g>'
    }
    // Fade near the headline above and the safe edge below
    const op = clamp((pos.y - 330) / 50) * clamp((990 - pos.y) / 50) * flow
    if (op <= 0) continue
    teeth += toothShape(kit, { x: pos.x, y: pos.y, size: g.u, side, angle, glow, opacity: op.toFixed(3) })
  }

  // The angle arc opens as each tooth reaches the meeting point, closes as it lies flat
  const ph = ((d0 + D * 0.5) / half) % 1
  const arc = clamp(p * 2 - 1) * Math.sin(Math.PI * ph)

  let s = teeth
  s += sliderCutaway(kit, { ...S, p, labels: clamp((t - 0.9) / 0.9), arc, id: 'cut' })
  s += marks

  // Source, small under the picture
  s += '<text x="' + kit.PAD + '" y="1012" font-size="15" fill="' + C.muted + '" font-family="' + kit.FONT.replace(/"/g, '') +
    '" opacity="' + rise(t, 1.2, 0.6).toFixed(3) + '">Source: US Patent 1,219,881 (1917); Britannica</text>'

  kit.stage(s)
  // Slow push in towards the meeting point
  const zs = 1 + 0.05 * ease(t / 5.5)
  kit.view({ x: 330 + 30 / zs, y: 640 + (g.meet.y - 640) * (1 - 1 / zs), s: zs })
}
