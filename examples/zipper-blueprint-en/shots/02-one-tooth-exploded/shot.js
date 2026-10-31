// 02-one-tooth-exploded: One tooth, exploded. The closed zipper from shot 01 steps aside, one
// blue tooth lifts out of the row and lands large in the centre, turns to a 3/4 view and is cut
// open; bump and hollow are labelled, its width dimensioned, and the next tooth's ghost glides
// in underneath. Shot-local time: t = 0 is this shot's first frame.
import { zipperColumn, zipperGeom, toothShape, tag } from '../../world/parts.js'

const r1 = n => Math.round(n * 10) / 10
const ID = 'L6'                      // the tooth that is lifted out
const TX = 424, TY = 650, TS = 66    // where it lands, and its size
const DEPTH = { x: 22, y: -16 }      // back face offset in the 3/4 view

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, lerp, ease, rise, FONT } = kit
  const font = FONT.replace(/"/g, '')
  kit.frame({ kicker: '02 · One tooth', head: ['Every tooth:', '*bump* above,', '*hollow* below'], typed: rise(t, 0, 0.7), progress: (start + t) / 32 })

  // The column, as shot 01 left it, steps aside to the left
  const cm = ease(clamp((t - 0.55) / 1.25))
  const z = { x: lerp(330, 146, cm), y: lerp(330, 390, cm), h: lerp(680, 560, cm), close: 1, glow: lerp(0.4, 0.22, cm),
    trail: 1 - clamp(t / 0.8), id: 'ex', skip: t > 0.15 ? [ID] : [] }
  const g = zipperGeom(kit, z)
  const slot = g.teeth.find(q => q.id === ID)

  let s = zipperColumn(kit, z)

  // The empty slot, left as a dashed outline
  if (t > 0.15) s += toothShape(kit, { x: slot.x, y: slot.y, size: g.u, side: 'left', ghost: true, p: rise(t, 0.3, 0.5) })

  // Lift out of the row (towards the viewer), then fly to the centre and grow
  const lift = rise(t, 0.15, 0.55), fly = ease(clamp((t - 0.75) / 1.15))
  const settle = clamp((t - 1.9) / 0.6)
  const bob = kit.float(t, 3, 3.2) * settle
  const x0 = slot.x + 10 * lift, y0 = slot.y - 14 * lift, s0 = g.u * (1 + 0.35 * lift)
  const x = lerp(x0, TX, fly), y = lerp(y0, TY, fly) - Math.sin(fly * Math.PI) * 70 + bob
  const size = lerp(s0, TS, fly)
  const angle = -14 * Math.sin(fly * Math.PI) + 6 * lift * (1 - fly)

  // Projection lines from the slot to the exploded tooth (blueprint style)
  const proj = 0.5 * rise(t, 1.5, 0.6)
  if (proj > 0) {
    const a = { x: slot.x - 2.4 * g.u, y: slot.y }, b = { x: slot.x + 1.2 * g.u, y: slot.y }
    s += '<path d="M' + r1(a.x) + ',' + r1(a.y - 0.5 * g.u) + 'L' + r1(x - 2.4 * TS) + ',' + r1(y - 0.28 * TS) + 'M' + r1(b.x) + ',' + r1(b.y + 0.5 * g.u) +
      'L' + r1(x + 1.2 * TS) + ',' + r1(y + 0.5 * TS) + '" stroke="' + C.muted + '" stroke-width="1.2" stroke-dasharray="3 6" opacity="' + proj.toFixed(3) + '"/>'
  }

  // 3/4 view: a back face and the edges that join it, growing as the tooth turns
  const turn = ease(clamp((t - 1.7) / 0.8))
  if (turn > 0) {
    const dx = DEPTH.x * turn * size / TS, dy = DEPTH.y * turn * size / TS
    s += toothShape(kit, { x: x + dx, y: y + dy, size, side: 'left', angle, fill: 0.4, opacity: 0.55 })
    const a = angle * Math.PI / 180
    const at = (lx, ly) => [x + lx * size * Math.cos(a) - ly * size * Math.sin(a), y + lx * size * Math.sin(a) + ly * size * Math.cos(a)]
    let d = ''
    for (const [lx, ly] of [[-2.4, -0.28], [-1.2, -0.5], [0, -0.7], [1.2, -0.5], [1.2, 0.5]]) {
      const p = at(lx, ly)
      d += 'M' + r1(p[0]) + ',' + r1(p[1]) + 'l' + r1(dx) + ',' + r1(dy)
    }
    s += '<path d="' + d + '" stroke="' + C.hue.blue + '" stroke-width="2" stroke-linecap="round" opacity="0.8"/>'
  }

  // The ghost of the next (amber) tooth glides in underneath: its bump into this hollow
  const gl = ease(clamp((t - 3.25) / 1.05))
  if (gl > 0) {
    s += toothShape(kit, { x: lerp(TX + 40, TX, gl), y: lerp(TY + 190, TY + TS + 2, gl) + bob, size: TS, side: 'right', ghost: true, p: clamp(gl * 1.6) })
  }

  // The front face, cut open: section hatching fills in
  s += toothShape(kit, { x, y, size, side: 'left', angle, hatch: rise(t, 2.0, 0.8) })

  // Callouts and the width dimension, once it has landed
  const bump = { x: x, y: y - 0.62 * TS }, hollow = { x: x, y: y + 0.38 * TS }
  s += tag(kit, bump.x, bump.y, 'bump', { dx: 100, dy: -34, p: clamp((t - 2.15) / 0.75), size: 26 })
  s += tag(kit, hollow.x, hollow.y, 'hollow', { dx: -56, dy: 128, p: clamp((t - 2.6) / 0.75), size: 26 })
  const dm = rise(t, 2.9, 0.6)
  if (dm > 0) {
    const half = 1.2 * TS * dm
    s += '<g opacity="' + clamp(dm * 1.5).toFixed(3) + '">' + kit.dim(x + half, y - 0.5 * TS, x - half, y - 0.5 * TS, 'width', { off: 58 }) + '</g>'
  }

  // A small sheet title under the drawing, and the source line
  const ti = rise(t, 2.3, 0.6)
  s += '<text x="' + TX + '" y="' + (TY + 230) + '" text-anchor="middle" font-size="16" font-weight="600" letter-spacing="0.16em" fill="' + C.muted +
    '" font-family="' + font + '" opacity="' + ti.toFixed(3) + '">ONE TOOTH · SECTION VIEW</text>'
  s += '<line x1="' + r1(TX - 120 * ti) + '" y1="' + (TY + 244) + '" x2="' + r1(TX + 120 * ti) + '" y2="' + (TY + 244) + '" stroke="' + C.muted + '" stroke-width="1.2" opacity="0.6"/>'
  s += '<text x="40" y="1010" font-size="15" fill="' + C.muted + '" font-family="' + font + '" opacity="' + (0.85 * rise(t, 0.4, 0.6)).toFixed(3) +
    '">Source: US Patent 1,219,881 (1917)</text>'

  kit.stage(s)
  // The camera eases out of shot 01's last framing to the whole frame
  const e = ease(clamp(t / 1.3)), zs = lerp(1.06, 1, e)
  kit.view({ x: lerp(330 + 30 / 1.06, 360, e), y: lerp(660 - 20 / 1.06, 640, e), s: zs })
}
