// 02-pins-block-the-gap: springs push the pin stacks down across the shear
// line; the plug tries to turn, jams on the blue drivers and springs back.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildLock, LOCK, PAL, tag } from '../../world/lock.js'

let kit, lock, THREE
// Lift that puts each stack's split on the shear line (the "open" start)
let OPEN = []
const DROP = [0.6, 0.82, 1.04, 1.26, 1.48] // each stack's release, left to right
const AIM = [-0.0042, LOCK.CENTER[1], 0], DIST = 0.146, MM = 50

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  THREE = kit.THREE
  setLook(kit)
  lock = buildLock(kit)
  lock.pose({ key: null })
  // split heights at rest, in lock-local metres
  OPEN = lock.state.split.map(s => LOCK.SHEAR_Y - s)
}

// A quick push toward the pins and back: 0 → 1 → 0 over [a, a + d]
const bump = (t, a, d) => {
  const p = kit.clamp((t - a) / d)
  return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * Math.pow(p, 0.7))
}

export default function render(t) {
  const { ease, rise, pop, clamp } = kit
  kit.begin(t)

  // Stacks: a small wind-up (springs squeeze), then dropped across the gap
  const lift = OPEN.map((L, i) => {
    const w = rise(t, DROP[i] - 0.3, 0.25)
    return L * (1 + 0.1 * w) * (1 - pop(t, DROP[i], 0.45))
  })
  // The plug tries twice, harder the second time, and jams
  const hit1 = bump(t, 4.1, 0.3), hit2 = bump(t, 4.65, 0.45)
  const hit = Math.max(hit1 * 0.6, hit2)
  const xray = ease((t - 0.2) / 1.3)
  lock.pose({
    key: null, lift,
    turn: 0.035 * hit1 + 0.06 * hit2,
    housing: 1 - 0.84 * xray, wire: xray,
    shear: rise(t, 2.1, 0.5) * (1 + 0.5 * hit), shearDraw: ease((t - 2.1) / 0.8)
  })
  // The blue drivers flare red where they block
  lock.mats.driver.emissive.set(PAL.wrong)
  lock.mats.driver.emissiveIntensity = 0.9 * hit

  // Camera: a 20° hero orbit from the key side to square on, held
  const deg = -20 * (1 - ease(t / 3.8))
  kit.look(kit.orbit(AIM, DIST, deg, 0.004 * (1 - ease(t / 3.8))), AIM, MM)

  // Label pinned to the gap, off the lock to the left, with a short leader
  const p = rise(t, 2.5, 0.5)
  const s = kit.screen(lock.at('shearLeft'))
  if (s) {
    tag(kit, lock.at('shearLeft'), 'Shear line', PAL.shear, { dx: -104, dy: 22, p })
    kit.block({ x: s[0] - 22, y: s[1] - 1, w: 18 * p, p, html: '', style: 'height:2px;background:' + PAL.shear + ';box-shadow:0 0 8px ' + PAL.shear })
  }
  kit.keep(lock.housing, 'lock')
  kit.frame()
}
