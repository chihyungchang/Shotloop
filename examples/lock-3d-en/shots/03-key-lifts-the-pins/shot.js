// 03-key-lifts-the-pins: the key slides in, its ridges lift each pin stack to its own height.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildLock, LOCK } from '../../world/lock.js'

let kit, lock

// Key travel and seat
const T0 = 0.3, DUR = 2.6, SEAT = T0 + DUR

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  // Pale steel and key bloom white under the default key: dimmer, darker
  setLook(kit, { size: 0.05, env: 0.3, key: 1.5, kick: 0.6, bloom: 0.04, exposure: 0.85 })
  lock = buildLock(kit)
}

function keyX(t) {
  let x = LOCK.KEY_OUT * (1 - kit.ease((t - T0) / DUR))
  // Recoil off the shoulder as it seats
  const r = (t - SEAT) / 0.25
  if (r > 0 && r < 1) x -= 0.0003 * Math.sin(Math.PI * r)
  return x
}

// Stacks overshoot and settle on the seat, left to right
function lift(t) {
  return LOCK.PIN_X.map((_, i) => {
    const s = t - SEAT - i * 0.03
    return s > 0 ? 0.00028 * Math.exp(-s * 7) * Math.sin(s * 24) : 0
  })
}

function pose(t) {
  lock.pose({ key: 'right', keyX: keyX(t), lift: lift(t), shear: 0.6 })
  // Ride in with the key from the key side, ending square on and closer
  const e = kit.ease((t - 0.1) / 3.1)
  const y = 0.0297
  kit.look(kit.mix([-0.045, y, 0.15], [0, y, 0.112], e), kit.mix([-0.01, y, 0], [0, y, 0], e), 50)
}

export default function render(t) {
  kit.begin(t)
  pose(t)
  kit.keep(lock.housing, 'pin stacks')
  kit.keep(lock.keys.right, 'key')
  kit.frame(dt => pose(t + dt))
}
