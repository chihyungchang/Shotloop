// 04-blue-from-everywhere: Blue from everywhere. The camera pulls back and tilts
// down from the molecule field to a small figure on a hill under the noon Sun;
// scattered blue streaks fly from every molecule to the figure's eye, and the
// dark sky fills blue patch by patch. The direct sunbeam stays white-yellow.
// Shot-local time: t = 0 is this shot's first frame.
import { airMolecules, scatter, figure, STRANDS } from '../../world/parts.js'

const BLUE = STRANDS[0].rgb
const FEET = [250, 880], FIG_H = 34
const EYE = [FEET[0], FEET[1] - FIG_H * 0.85]
const SUN = [520, 430]
const hillY = x => FEET[1] + Math.pow((x - FEET[0]) / 600, 2) * 140

export default function render(t, { window }) {
  const kit = window.kit
  const { c, clamp, lerp, ease, rise, hash, radial, halo, C } = kit

  // Pull back from inside the molecule field and tilt down to the hill
  const m = ease(clamp(t / 4.2))
  kit.stage(t, { camera: { x: lerp(390, 360, m), y: lerp(560, 640, m), zoom: lerp(1.38, 1, m) }, drift: t * 10 })

  // The sky filling blue in soft waves, top band to hill
  const fill = ease(clamp((t - 0.7) / 3.2))
  if (fill > 0) {
    c.save()
    c.globalCompositeOperation = 'lighter'
    const g = c.createLinearGradient(0, 120, 0, FEET[1])
    g.addColorStop(0, 'rgba(' + BLUE + ', ' + 0.1 * fill + ')')
    g.addColorStop(0.5, 'rgba(' + BLUE + ', ' + 0.26 * fill + ')')
    g.addColorStop(1, 'rgba(' + BLUE + ', ' + 0.4 * fill + ')')
    c.fillStyle = g
    c.fillRect(-400, -200, 1520, 1700)
    // A slow wave of brightness rolling across the sky
    const wy = lerp(1000, 200, ((t * 0.35) % 1))
    c.fillStyle = radial(360, wy, 0, 520, [[0, 'rgba(' + BLUE + ', ' + 0.12 * fill + ')'], [1, 'rgba(' + BLUE + ', 0)']])
    c.fillRect(-400, -200, 1520, 1700)
    c.restore()
  }

  // The noon Sun, high on the right
  kit.light(t, SUN[0], SUN[1], 34, { glow: 0.9 })

  // Far dust
  kit.depth(0.6, () => kit.particles(t, { n: 22, seed: 4, x: 0, y: 260, w: 720, h: 760, size: 1.3, color: C.rgb.cool, vx: 12, life: 4 }))

  // The air, as in shot 3
  const mols = airMolecules(kit, { t, x: 40, y: 380, w: 580, h: 420, n: 34, seed: 7 })

  // Sky patches: each molecule's patch glows once its first blue has arrived
  const PERIOD = 1.7, FLY = 0.75
  for (const mo of mols) {
    const ph = 0.15 + hash(mo.i, 3) * 1.9
    const lit = rise(t, ph + FLY, 0.9)
    if (lit > 0) halo(mo.wx, mo.wy, 95 + 40 * hash(mo.i, 5), BLUE, 0.16 * lit)
  }

  // The direct sunbeam: white-yellow, straight to the eye
  const dp = rise(t, 0.2, 1.2)
  const sx = EYE[0] - SUN[0], sy = EYE[1] - SUN[1], sl = Math.hypot(sx, sy)
  kit.trail([[SUN[0] + (sx / sl) * 30, SUN[1] + (sy / sl) * 30], EYE], dp, { color: C.rgb.light, width: 3 })

  // Blue streaks: each molecule scatters, then a blue photon flies to the eye
  for (const mo of mols) {
    const ph = 0.15 + hash(mo.i, 3) * 1.9
    for (let k = -1; k < 4; k++) {
      const t0 = ph + k * PERIOD
      if (t0 < 0.1) continue
      const u = t - t0
      if (u < 0 || u > FLY + 0.3) continue
      scatter(kit, { x: mo.wx, y: mo.wy, p: u / 0.6, n: 4, seed: mo.i * 10 + k, len: 50, rgb: BLUE, scale: 0.8 })
      if (u < FLY + 0.15) kit.beam(mo.wx, mo.wy, EYE[0], EYE[1], clamp(u / FLY), { color: BLUE, width: 2.2, tail: 0.3, guide: 0, head: 0.6 })
      if (u > FLY && u < FLY + 0.3) halo(EYE[0], EYE[1], 26, BLUE, 0.5 * (1 - (u - FLY) / 0.3))
    }
  }

  // The hill, its crest lit blue as the sky fills
  c.beginPath()
  c.moveTo(-300, hillY(-300))
  for (let x = -300; x <= 1020; x += 20) c.lineTo(x, hillY(x))
  c.lineTo(1020, 1700)
  c.lineTo(-300, 1700)
  c.closePath()
  c.fillStyle = radial(FEET[0], FEET[1], 0, 700, [[0, '#0b1830'], [1, '#02040b']])
  c.fill()
  c.strokeStyle = 'rgba(150, 200, 255, ' + (0.25 + 0.45 * fill) + ')'
  c.lineWidth = 2
  c.stroke()

  // The viewer, glowing a little as the blue lands on them
  halo(EYE[0], EYE[1], 60, BLUE, 0.25 * fill)
  figure(kit, { x: FEET[0], y: FEET[1], h: FIG_H, rim: '170, 210, 255', rimA: 0.6 + 0.3 * fill })

  // Near motes drifting past
  kit.depth(1.4, () => kit.particles(t, { n: 9, seed: 12, x: 0, y: 300, w: 720, h: 700, size: 2, color: C.rgb.light, vx: 20, vy: -5, life: 5 }))

  // Caption with the accent in scattered blue (orange means light that gets through)
  const blue = 'color:rgb(150, 195, 255);text-shadow:0 0 24px rgba(' + BLUE + ', 0.9)'
  kit.block({ y: 154, p: rise(t, 0.1, 0.6), cls: 'head', style: 'font-size:56px',
    html: 'Blue arrives from<br>every direction:<br><span style="' + blue + '">the sky</span>' })
  kit.source("Source: NASA SciJinks, 'Why Is the Sky Blue?' · illustration", rise(t, 1.2, 0.6))
}
