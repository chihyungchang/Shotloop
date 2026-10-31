// 03-air-scatters-blue: Air scatters blue. The colour strands enter a field of
// air molecules; blue photons ricochet off them in a growing spray, red ones
// sail straight through, and the ≈5× counter rolls up and lands.
// Shot-local time: t = 0 is this shot's first frame.
import { sunBeam, airMolecules, scatter, STRANDS } from '../../world/parts.js'

const BLUE = STRANDS[0].rgb, RED = STRANDS[4].rgb
const SPLIT = [290, 625]
const N = 30 // photons of each colour (illustrative: 5 in 6 blue scatter, 1 in 6 red)
const SPEED = 420

export default function render(t, { window }) {
  const kit = window.kit
  const { clamp, ease, rise, lerp, hash, C } = kit
  const T = 5.5

  // Continue shot 2's framing, pushing slowly into the molecule field
  const m = ease(t / T)
  kit.stage(t, { camera: { x: lerp(384, 392, m), y: lerp(656, 676, m), zoom: lerp(1.08, 1.14, m) }, drift: 8 + t * 14 })

  kit.depth(0.6, () => kit.particles(t, { n: 24, seed: 3, x: 0, y: 320, w: 720, h: 760, size: 1.4, color: C.rgb.cool, vx: 16, life: 4 }))

  // The beam from shot 2, strands dimmed so the photons lead
  sunBeam(kit, {
    t, x0: 130, y0: 470, sunR: 44, sun: 1, splitX: SPLIT[0], splitY: SPLIT[1], x1: 598, y1: 680, gap: 104,
    p: 1, split: 1, strands: [1, 0.35, 0.35, 0.35, 1].map(a => lerp(1, a, ease(t / 1.2))), labels: 1, flow: 1
  })

  // Air
  const mols = airMolecules(kit, { t, x: 200, y: 440, w: 420, h: 460, n: 40, seed: 7, p: rise(t, 0, 0.8) * 0.999 + 0.001, labels: rise(t, 0.5, 0.5) })
  const targets = mols.filter(q => q.wx > 330 && q.wx < 590 && q.wy > 460 && q.wy < 860)

  // Photon k of a colour: launched faster and faster, so the blue spray thickens
  const launch = (k, ph) => 0.15 + 4.6 * Math.pow(k / N, 0.75) + ph * 0.07
  const photon = (k, rgb, hits, endY, ph) => {
    const t0 = launch(k, ph)
    if (t < t0) return
    let tx, ty
    if (hits) {
      const q = k < 2 && ph === 0 ? mols[k] : targets[Math.floor(hash(k, 3 + ph) * targets.length)]
      tx = q.wx; ty = q.wy
    } else {
      tx = 610; ty = endY + (hash(k, 9 + ph) - 0.5) * 36
    }
    const dur = Math.hypot(tx - SPLIT[0], ty - SPLIT[1]) / SPEED
    const p = (t - t0) / dur
    if (p < 1) kit.beam(SPLIT[0], SPLIT[1], tx, ty, p, { color: rgb, width: 2.6, tail: 0.3, guide: 0, head: 0.7 })
    else if (hits) scatter(kit, { x: tx, y: ty, p: (t - t0 - dur) / 0.9, n: 6, seed: k * 7 + ph, len: 80, rgb })
  }
  for (let k = 0; k < N; k++) {
    photon(k, BLUE, k % 6 !== 3, 472, 0) // blue: 5 in 6 scatter
    photon(k, RED, k % 6 === 5, 888, 1) // red: 1 in 6 scatters
  }

  kit.depth(1.4, () => kit.particles(t, { n: 10, seed: 9, x: 0, y: 380, w: 720, h: 640, size: 2.2, color: C.rgb.light, vx: 26, vy: -6, life: 5 }))

  // Caption: one line around the rolling counter
  const cp = rise(t, 0.1, 0.7)
  const roll = ease(clamp((t - 0.9) / 1.7))
  const v = 1 + 4 * roll
  const bump = Math.sin(Math.PI * clamp((t - 2.5) / 0.45))
  const dot = (rgb, r, g) => '<span style="display:inline-block;width:' + r + 'px;height:' + r + 'px;border-radius:50%;margin-left:16px;vertical-align:middle;' +
    'background:radial-gradient(circle at 35% 35%, #fff, rgb(' + rgb + ') 60%);box-shadow:0 0 ' + g + 'px ' + g / 3 + 'px rgba(' + rgb + ', 0.75)"></span>'
  const word = (rgb, s) => '<span style="color:rgb(' + rgb + ');text-shadow:0 0 22px rgba(' + rgb + ', 0.9)">' + s + '</span>'
  kit.block({ y: 126, p: cp, cls: 'head', style: 'font-size:58px', html: 'Air scatters ' + word('120, 175, 255', 'blue') + dot(BLUE, 20, 6 + v * 5) })
  kit.block({
    y: 196, w: 230, p: cp, cls: 'num',
    style: 'font-size:112px;line-height:1.05;color:rgb(190, 215, 255);text-shadow:0 0 ' + Math.round(26 + 30 * bump) + 'px rgba(' + BLUE + ', 0.95)',
    html: '<span style="display:inline-block;transform-origin:left 70%;transform:scale(' + (1 + 0.12 * bump).toFixed(3) + ')">≈' + Math.round(v) + '×</span>'
  })
  kit.block({ x: 262, y: 240, w: 358, p: clamp(cp * 1.2 - 0.2), cls: 'head', style: 'font-size:46px;white-space:nowrap', html: 'more than ' + word('255, 110, 110', 'red') + dot(RED, 14, 6) })

  // Source, two short lines above the safe bottom
  kit.block({
    y: 962, p: rise(t, 2.6, 0.6), dy: 8, cls: 'source',
    html: "Source: HyperPhysics (GSU): Rayleigh scattering ∝ 1/λ⁴;<br>blue ≈470 nm (HyperPhysics 'Color');<br>our arithmetic: (700 nm / 470 nm)⁴ ≈ 4.9 · photons illustrative"
  })
}
