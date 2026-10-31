// 01-hook-the-zipper: Hook: the zipper. The zipper column traces itself on open in a V,
// the slider draws on and rides up, the teeth click shut behind it; a detail bubble shows
// two rows locked. Shot-local time: t = 0 is this shot's first frame.
import { zipperColumn, zipperGeom, toothShape, tag } from '../../world/parts.js'

const Z = { x: 330, y: 330, h: 680, id: 'hook' }
const r1 = n => Math.round(n * 10) / 10
const poly = pts => pts.map((q, i) => (i ? 'L' : 'M') + r1(q[0]) + ',' + r1(q[1])).join('')

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, ease, rise, pop } = kit
  kit.frame({ kicker: 'How a zipper works', head: ['Tiny teeth, no glue:', 'how does it *hold?*'], typed: clamp(0.35 + t / 0.5), progress: (start + t) / 32 })

  const draw = 0.25 + 0.75 * ease(clamp(t / 1.4))
  const sliderIn = clamp((t - 0.95) / 0.5)
  const close = ease(clamp((t - 1.45) / 2.1))
  const z = { ...Z, close, draw, sliderIn, glow: 0.4 * rise(t, 2.4, 1.2) }
  const g = zipperGeom(kit, z), g0 = zipperGeom(kit, { ...Z, close: 0 })

  let s = ''
  // Where the open V was, left behind as a dashed trace once the slider has passed
  const trace = 0.45 * clamp((t - 1.8) / 0.6)
  if (trace > 0) for (const side of ['left', 'right']) for (const edge of ['inner', 'outer']) {
    s += '<path d="' + poly(g0.tapes[side][edge]) + '" fill="none" stroke="' + C.muted + '" stroke-width="1.3" stroke-dasharray="7 6" opacity="' + trace.toFixed(3) + '"/>'
  }
  s += zipperColumn(kit, z)

  // Callouts that ride with their parts
  const tooth = g.teeth.find(q => q.id === 'L7')
  s += tag(kit, tooth.x - 8, tooth.y, 'teeth', { dx: -72, dy: -44, p: clamp((t - 1.2) / 0.55) })
  s += tag(kit, g.cx + g.sliderW / 2 - 4, g.sliderTop + 0.3 * g.sliderH, 'slider', { dx: 70, dy: -26, p: clamp((t - 1.25) / 0.6) })

  // Detail A: a closer look at the locked column, the two rows clicking together
  const bx = 518, by = 860, br = 72, d = rise(t, 2.45, 0.5)
  if (d > 0) {
    const u2 = 30, snap = pop(t, 2.75, 0.45), lock = clamp((t - 3.05) / 0.15)
    s += '<circle cx="' + g.cx + '" cy="' + by + '" r="26" fill="none" stroke="' + C.text + '" stroke-width="1.5" stroke-dasharray="4 4" opacity="' + d + '"/>'
    s += '<path d="M' + (g.cx + 26) + ',' + by + 'L' + r1(g.cx + 26 + (bx - br - g.cx - 26) * d) + ',' + by + '" stroke="' + C.text + '" stroke-width="1.5" stroke-dasharray="4 4"/>'
    s += '<clipPath id="detA"><circle cx="' + bx + '" cy="' + by + '" r="' + br + '"/></clipPath>'
    s += '<circle cx="' + bx + '" cy="' + by + '" r="' + br + '" fill="#0d1838" fill-opacity="' + (0.9 * d).toFixed(3) + '"/>'
    s += '<g clip-path="url(#detA)" opacity="' + clamp(d * 1.5 - 0.3).toFixed(3) + '">'
    for (let k = -2; k <= 2; k++) {
      const side = k % 2 ? 'right' : 'left', sx = side === 'right' ? 1 : -1
      s += toothShape(kit, { x: bx + sx * 34 * (1 - snap), y: by + k * (u2 + 2) - 10, size: u2, side, glow: lock * (0.55 + 0.45 * Math.exp(-(t - 3.05) * 4)) })
    }
    s += '</g>'
    s += '<circle cx="' + bx + '" cy="' + by + '" r="' + br + '" fill="none" stroke="' + C.text + '" stroke-width="2"' +
      (d < 1 ? ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - d).toFixed(3) + '"' : '') + '/>'
    s += '<text x="' + bx + '" y="' + (by + br + 28) + '" text-anchor="middle" font-size="16" font-weight="600" letter-spacing="0.14em" fill="' + C.muted +
      '" font-family="' + kit.FONT.replace(/"/g, '') + '" opacity="' + d + '">DETAIL A</text>'
  }

  kit.stage(s)
  // The camera eases in, keeping (330, 660) still
  const e = ease(t / 4), zs = 1 + 0.06 * e
  kit.view({ x: 330 + 30 / zs, y: 660 - 20 / zs, s: zs })
}
