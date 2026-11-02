// 01-hook-the-lock: the lock cutaway square on, the right key easing up to the keyway.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildLock, LOCK } from '../../world/lock.js'

let kit, lock

// Lock big on the right, the key's blade entering from the left edge
const AIM_X = -0.009
const AIM_Y = LOCK.CENTER[1] - 0.006 // aim below the lock: it sits above mid-frame
const D0 = 0.215, D1 = 0.19 // push-in distance (m)
const KEY0 = LOCK.KEY_OUT - 0.005

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  // Dimmer studio reflections: the steel stops washing grey-white, the warm rim and kick carry the brass
  setLook(kit, { size: 0.05, env: 0.3, kick: 1.4 })
  lock = buildLock(kit)
}

export default function render(t) {
  const { ease, clamp } = kit
  kit.begin(t)

  // Key eases toward the keyway and stops (anticipation of shot 03)
  const k = ease(clamp((t - 0.3) / 1.4))
  lock.pose({ key: 'right', keyX: KEY0 + (LOCK.KEY_OUT - KEY0) * k, shear: 0, shell: 0.12, wire: 0.3 })

  // One move: a slow push straight in, then hold
  const d = D0 + (D1 - D0) * ease(clamp(t / 2.1))
  kit.look([AIM_X, AIM_Y, d], [AIM_X, AIM_Y, 0], 50)

  kit.caption({ head: 'One key. *Why?*', y: 170, p: 1 })
  // The housing, not lock.root: root's bounds include the hidden bolt and strike
  kit.keep(lock.housing, 'lock')
  kit.keep(lock.keys.right, 'key')
  kit.frame()
}
