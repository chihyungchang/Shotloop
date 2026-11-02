// 05-the-cylinder-turns: the plug and key turn 90°, the cam drives the bolt back.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildLock, LOCK } from '../../world/lock.js'

let kit, lock
// Camera: aim between the plug and the bolt, one crane round to the key side
const AIM = [0.001, LOCK.Y - 0.002, 0.012]
const R = 0.26
const T_ANT = 0.45, T_TURN = 0.9, T_DONE = 3.55 // back-turn, turn start, bolt home

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  // Short fade: the floor's far edge melts into the dark, no horizon line
  setLook(kit, { size: 0.05, fade: 0.35 })
  lock = buildLock(kit)
}

// The plug's angle: a small back-turn, then 90° eased
function turnAt(t) {
  const back = -0.07 * Math.sin(Math.PI * kit.clamp((t - T_ANT) / (T_TURN + 0.25 - T_ANT)))
  return back * (t < T_TURN + 0.25 ? 1 : 0) + (Math.PI / 2) * kit.ease((t - T_TURN) / (T_DONE - T_TURN))
}

function pose(t) {
  const s = Math.max(0, t - T_DONE)
  // Overlapping settle: the bolt rocks a little after the cam stops
  const settle = t > T_DONE ? -0.0007 * Math.exp(-s * 7) * Math.sin(s * 16) : 0
  lock.pose({
    key: 'right', keyX: 0, turn: turnAt(t), bolt: settle, mech: true,
    shear: 1 - 0.5 * kit.rise(t, T_TURN, 1.2)
  })
  const p = kit.ease((t - 0.25) / 2.3)
  const from = kit.orbit(AIM, R, -40 * p, 0.012 + 0.06 * p)
  kit.look(from, AIM, 50)
}

export default function render(t) {
  kit.begin(t)
  pose(t)
  kit.caption({ head: '*Unlocked*', p: kit.rise(t, 2.75, 0.6) })
  kit.keep(lock.plug, 'plug')
  kit.keep(lock.bolt, 'bolt')
  kit.frame(dt => pose(t + dt))
}
