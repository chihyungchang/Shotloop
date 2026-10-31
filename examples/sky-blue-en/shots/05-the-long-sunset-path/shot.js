// 05-the-long-sunset-path: The long sunset path. A short noon path drops
// straight through the air shell ('1×'); the Sun glides to the right horizon
// and a long path threads through the shell while a counter rolls to '≈38×'.
// Shot-local time: t = 0 is this shot's first frame.
import { earthSection, earthGeometry } from '../../world/parts.js'

const DUR = 5.5
const AIR = '79, 209, 197'
const NOON = '200, 245, 255', WARM = '255, 175, 100'
// Beats
const NOON_A = 0.25, NOON_D = 0.75
const SUN_A = 1.15, SUN_D = 1.5
const SET_A = 2.35, SET_D = 2.2

export default function render(t, { window }) {
  const kit = window.kit
  const { c, clamp, lerp, ease, rise, pop, halo, C } = kit

  // Camera: framed on the noon column, then drifting right along the long path
  const m = ease(clamp(t / DUR))
  kit.stage(t, { camera: { x: lerp(370, 452, m), y: lerp(690, 742, m), zoom: lerp(1.1, 1.25, m) }, drift: t * 8 })

  const sun = ease(clamp((t - SUN_A) / SUN_D))
  const noon = ease(clamp((t - NOON_A) / NOON_D))
  const sunset = clamp((t - SET_A) / SET_D) // linear: light travels at constant speed
  const g0 = earthGeometry({})
  const [ox, oy] = g0.center, Rs = g0.R + g0.shell

  // A warm glow gathering at the right horizon as the Sun sinks
  kit.depth(0.7, () => halo(g0.sunsetSun[0] + 40, g0.sunsetSun[1] + 20, 420, '255, 120, 60', 0.22 * sun))

  const g = earthSection(kit, { t, sun, warm: 0.7 * sun, noon, sunset, sunGlow: 1 })

  // Air in the shell: faint teal motes drifting along the curve
  c.save()
  c.beginPath()
  c.arc(ox, oy, Rs, 0, 6.283)
  c.arc(ox, oy, g0.R, 0, 6.283, true)
  c.clip()
  kit.particles(t, { n: 70, seed: 21, x: -100, y: 760, w: 920, h: 240, size: 1.3, color: AIR, vx: 14, vy: 0, life: 4 })
  c.restore()

  // The stretch through the air, glowing thick: what the counters measure
  const thick = (a, b, p, rgb) => {
    if (p <= 0) return
    const e = [lerp(a[0], b[0], p), lerp(a[1], b[1], p)]
    for (const [w, al] of [[22, 0.12], [10, 0.28]]) {
      c.save()
      c.globalCompositeOperation = 'lighter'
      c.lineCap = 'round'
      c.strokeStyle = 'rgba(' + rgb + ', ' + al + ')'
      c.lineWidth = w
      c.beginPath()
      c.moveTo(a[0], a[1])
      c.lineTo(e[0], e[1])
      c.stroke()
      c.restore()
    }
  }
  thick(g.top, [g.eye[0], g.eye[1] - 4], clamp((t - NOON_A - NOON_D * 0.6) / 0.4), NOON)
  thick(g.sunsetEntry, [g.eye[0], g.eye[1] - 4], sunset, WARM)

  // Photons running down the finished paths
  const pulses = (from, to, a, color, period, n) => {
    for (let i = 0; i < n; i++) {
      const q = ((t - a) / period + i / n) % 1
      if (t > a) kit.beam(from[0], from[1], to[0], to[1], q, { color, width: 2, tail: 0.18, guide: 0, head: 0.5 })
    }
  }
  const eye = [g.eye[0], g.eye[1] - 4]
  pulses([g.noonSun[0], g.noonSun[1] + 30], eye, NOON_A + NOON_D, NOON, 1.1, 2)
  pulses(g.sunsetSun, eye, SET_A + SET_D, WARM, 1.6, 3)

  // The eye flashes as each path arrives
  halo(eye[0], eye[1], 50, NOON, 0.6 * (rise(t, NOON_A + NOON_D - 0.1, 0.15) - rise(t, NOON_A + NOON_D + 0.1, 0.6)))
  halo(eye[0], eye[1], 70, WARM, 0.7 * (rise(t, SET_A + SET_D - 0.1, 0.15) - rise(t, SET_A + SET_D + 0.1, 0.8)))

  // Near dust
  kit.depth(1.4, () => kit.particles(t, { n: 10, seed: 15, x: 0, y: 380, w: 720, h: 600, size: 1.8, color: C.rgb.light, vx: 18, vy: -4, life: 5 }))

  // '1×' beside the short noon path, inside the shell
  const one = rise(t, NOON_A + NOON_D - 0.15, 0.5)
  const [nx, ny] = kit.screen(g.eye[0] - 24, g.top[1] + 22)
  kit.block({ x: nx - 160, y: ny - 34, w: 160, p: one, dy: 10, cls: 'num',
    style: 'text-align:right;font-size:46px;color:rgb(' + NOON + ');text-shadow:0 0 18px rgba(' + AIR + ', 0.9)', html: '1×' })
  kit.block({ x: nx - 160, y: ny + 18, w: 160, p: one, dy: 10,
    style: 'text-align:right;font:600 20px/1 ' + kit.FONT + ';letter-spacing:0.18em;color:' + C.muted, html: 'NOON' })

  // '≈38×' riding above the long path, rolling with it and bouncing on arrival
  const shown = Math.round(lerp(1, 38, ease(sunset)))
  const land = SET_A + SET_D
  const bounce = t < land ? 1 : pop(t, land, 0.5)
  const size = Math.round(78 * (t < land ? 1 : 0.88 + 0.12 * bounce))
  const mid = [lerp(g.sunsetSun[0], g.eye[0], 0.45), lerp(g.sunsetSun[1], g.eye[1], 0.45)]
  const [cx, cy] = kit.screen(mid[0], mid[1] - 64)
  const cp = rise(t, SET_A + 0.1, 0.5)
  kit.block({ x: cx - 140, y: cy - 60, w: 280, p: cp, dy: 14, cls: 'num',
    style: 'text-align:center;font-size:' + size + 'px;line-height:1;color:' + C.accent + ';text-shadow:0 0 28px rgba(' + C.rgb.accent + ', 0.9)',
    html: '≈' + shown + '×' })
  kit.block({ x: cx - 140, y: cy + 26, w: 280, p: cp, dy: 10,
    style: 'text-align:center;font:600 20px/1 ' + kit.FONT + ';letter-spacing:0.18em;color:' + C.muted, html: 'SUNSET' })
  // A flash on the long path as the count lands
  halo(mid[0], mid[1], 160, C.rgb.accent, 0.45 * (rise(t, land - 0.05, 0.1) - rise(t, land + 0.05, 0.8)))

  kit.caption({ head: ['At sunset, light', 'crosses *≈38×*', 'more air'], size: 56, p: rise(t, -0.25, 0.6) })
  kit.source("Air mass: Kasten & Young (1989), Applied Optics; via Wikipedia 'Air mass (astronomy)' · paths not to scale", rise(t, 1.0, 0.6))
}
