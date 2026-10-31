// 06-red-gets-through: Red gets through. The camera pushes along the long
// sunset path; the colour strands run through the air, blue, green and yellow
// peel off and fade (draining stock) while orange and red reach the figure,
// the sky blooms orange-red and the Sun deepens to a red disc.
// Shot-local time: t = 0 is this shot's first frame.
import { sunBeam, airMolecules, scatter, earthSection, earthGeometry, STRANDS } from '../../world/parts.js'

const DUR = 4.5
const AIR = '79, 209, 197'
// Beats
const DRAW_A = 0.25, DRAW_D = 2.1 // strands travel from the split to the eye
const PEEL = [0.85, 1.35, 1.85] // blue, green, yellow peel off
const PEEL_D = 0.75
const ARRIVE = DRAW_A + DRAW_D + 0.1

export default function render(t, { window }) {
  const kit = window.kit
  const { c, clamp, lerp, ease, rise, halo, C } = kit

  // Camera: from shot 5's framing, pushing in along the sunset path
  const m = ease(clamp(t / DUR))
  kit.stage(t, { camera: { x: lerp(440, 524, m), y: lerp(792, 858, m), zoom: lerp(1.25, 1.72, m) }, drift: t * 8 })

  const g0 = earthGeometry({ sun: 1 })
  const [ox, oy] = g0.center, Rs = g0.R + g0.shell
  const eye = g0.eye
  // Capped so the red strands still read against the warm air
  const dusk = 0.6 * ease(clamp((t - ARRIVE + 0.3) / 1.4))
  const warm = lerp(0.7, 1, ease(clamp((t - 1.2) / 2.6)))

  // The sky warming to sunset behind everything
  kit.depth(0.7, () => {
    halo(g0.sunsetSun[0] + 40, g0.sunsetSun[1] + 20, 420, '255, 120, 60', 0.22 + 0.2 * dusk)
    halo(eye[0] + 80, eye[1] - 120, 520, '255, 80, 50', 0.22 * dusk)
  })

  earthSection(kit, { t, sun: 1, warm, sunR: 30, dusk, sunGlow: 1 })

  // Air in the shell: teal motes drifting
  c.save()
  c.beginPath()
  c.arc(ox, oy, Rs, 0, 6.283)
  c.arc(ox, oy, g0.R, 0, 6.283, true)
  c.clip()
  kit.particles(t, { n: 60, seed: 21, x: -100, y: 760, w: 920, h: 240, size: 1.3, color: AIR, vx: 14, vy: 0, life: 4 })
  c.restore()

  const mols = airMolecules(kit, { t, x: 385, y: 772, w: 250, h: 110, n: 24, seed: 11, far: 0.7, near: 1.2, scale: 0.8 })

  // The strands: from just in front of the Sun to the eye, red ending at eye level
  const d = Math.hypot(eye[0] - g0.sunsetSun[0], eye[1] - g0.sunsetSun[1])
  const ux = (eye[0] - g0.sunsetSun[0]) / d, uy = (eye[1] - g0.sunsetSun[1]) / d
  const splitX = g0.sunsetSun[0] + ux * 62, splitY = g0.sunsetSun[1] + uy * 62
  const gap = 12
  const split = STRANDS.map((s, i) => clamp((t - DRAW_A - i * 0.04) / DRAW_D))
  const peel = STRANDS.map((s, i) => (i < 3 ? clamp((t - PEEL[i]) / PEEL_D) : 0))
  sunBeam(kit, { t, x0: g0.sunsetSun[0], y0: g0.sunsetSun[1], sunR: 30, sun: 0, splitX, splitY,
    x1: eye[0] + 8, y1: eye[1] - gap * 2 + 2, gap, p: 1, split, peel, labels: 0, flow: 0.6, scale: 0.7 })

  // The Sun's hot core deepening to a red disc on the horizon
  const red = ease(clamp((t - 1.6) / 2.2))
  const sr = 30 * (1 + 0.25 * warm), [sx, sy] = g0.sunsetSun
  kit.disc(sx, sy, sr, kit.radial(sx - sr * 0.15, sy - sr * 0.15, 0, sr, [[0, 'rgba(255, 150, 90, ' + 0.75 * red + ')'], [0.6, 'rgba(240, 70, 40, ' + 0.85 * red + ')'], [1, 'rgba(190, 30, 30, ' + 0.9 * red + ')']]))

  // Blue (then green, yellow) photons ricocheting off molecules as they peel
  const hits = mols.filter(q => q.wx > 400 && q.wx < 600 && q.wy > 790 && q.wy < 880)
  const events = [
    [0.55, 0], [0.75, 0], [0.95, 0], [1.15, 0], [1.35, 0], [1.6, 0], [1.85, 0], [2.15, 0],
    [1.25, 1], [1.55, 1], [1.95, 1], [1.8, 2], [2.25, 2]
  ]
  if (hits.length) {
    events.forEach(([a, s], k) => {
      const q = hits[(k * 3) % hits.length]
      scatter(kit, { x: q.wx, y: q.wy, p: (t - a) / 0.75, n: 5, seed: 40 + k, len: 80, rgb: STRANDS[s].rgb, angle: -Math.PI / 2, spread: Math.PI * 1.6, scale: 0.8 })
    })
  }

  // Orange and red arrive at the eye: a soft warm flash
  const flash = rise(t, ARRIVE - 0.15, 0.2) - rise(t, ARRIVE + 0.1, 1.0)
  halo(eye[0], eye[1], 60, STRANDS[4].rgb, 0.8 * flash)
  halo(eye[0], eye[1], 26, '255, 220, 190', 0.6 * flash)

  // Warm dust drifting along the path once the red gets through
  c.save()
  c.beginPath()
  c.arc(ox, oy, Rs, 0, 6.283)
  c.clip()
  kit.particles(t, { n: 22, seed: 33, x: 360, y: 820, w: 280, h: 60, size: 1.2, color: '255, 120, 70', vx: -50, vy: 6, life: 2.5 })
  c.restore()

  // Near dust
  kit.depth(1.4, () => kit.particles(t, { n: 10, seed: 15, x: 0, y: 380, w: 720, h: 600, size: 1.8, color: C.rgb.light, vx: 18, vy: -4, life: 5 }))

  kit.caption({ head: ['Blue scatters away;', '*red* gets through'], size: 58, p: rise(t, 0.1, 0.6) })
  kit.source("Source: NASA Space Place, 'Why Is the Sky Blue?' · not to scale", rise(t, 0.6, 0.6))
}
