// 04-splits-line-up: the right key puts every split on the shear line.
// Push-in on the cutaway while the cyan line draws left to right and each
// split flashes as the line reaches it; a brief wrong-key beat (stack 3
// pokes above the line, red), then the right key returns and the line holds.
import { setLook, buildLock, LOCK, fitWidth } from '../../world/lock.js'

let kit, lock

// The line draws from D0 to D1; split i lands when it reaches its pin
const D0 = 0.5, D1 = 2.3
const LAND = LOCK.PIN_X.map(x => D0 + (D1 - D0) * (x + LOCK.L / 2) / LOCK.L)
// Wrong-key beat on stack 2: rise, swap keys, swap back, settle
const W0 = 2.65, WS = 2.9, WB = 3.5, W1 = 3.8
const STEP2 = (LOCK.RIGHT[2] - LOCK.WRONG[2]) * 0.0008

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  setLook(kit, { size: 0.05, bloom: 0.3 })
  lock = buildLock(kit)
}

const flash = (t, a) => kit.rise(t, a, 0.12) * (0.55 + 0.45 * Math.exp(-Math.max(0, t - a) * 4))

export default function render(t) {
  const { ease, rise, clamp, mix } = kit
  kit.begin(t)

  // Stack 2 under the wrong key: the pin climbs, then rests on the wrong ridge
  let key = 'right', lift2 = 0
  if (t >= W0 && t < WS) lift2 = STEP2 * ease((t - W0) / (WS - W0))
  else if (t >= WS && t < WB) key = 'wrong'
  else if (t >= WB && t < W1) lift2 = STEP2 * (1 - ease((t - WB) / (W1 - WB)))
  const bad = clamp(rise(t, W0, 0.25) - rise(t, WB, 0.3))
  const split = LAND.map(a => flash(t, a))
  // Stack 2's split goes dark off the line, and re-flashes when it lands back
  split[2] = t < W1 - 0.05 ? split[2] * (1 - bad) : flash(t, W1 - 0.05)
  lock.pose({
    key, keyX: 0, lift: [0, 0, lift2, 0, 0], split, flag: [0, 0, bad, 0, 0],
    shear: 1, shearDraw: clamp((t - D0) / (D1 - D0))
  })
  // The line and the split rings are the hero here: hotter and thicker than the world's default
  lock.mats.shear.emissiveIntensity = 4 + 2 * flash(t, D1)
  lock.shearLine.scale.y = 2
  lock.mats.splits.forEach((m, i) => { m.emissiveIntensity = 7 * Math.min(1, split[i]) })

  // Slow push-in from the whole cutaway to the five splits, held at the end
  // (ends with the lock 560 px wide, shifted left of the platforms' buttons)
  const p = ease((t - 0.2) / 3.7)
  const at0 = [-0.002, LOCK.CENTER[1], 0], at1 = [0.0017, LOCK.Y + 0.003, 0]
  const at = mix(at0, at1, p)
  const d = kit.lerp(fitWidth(0.07, 50), fitWidth(0.03, 50, 0.77), p)
  kit.look([at[0], at[1], d], at, 50)

  kit.caption({ head: 'Lined *up*', p: rise(t, 2.2, 0.5) })
  lock.pins.key.forEach(m => kit.keep(m, 'pins'))
  kit.keep(lock.shearLine, 'shear line')
  kit.frame()
}
