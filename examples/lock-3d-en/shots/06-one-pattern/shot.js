// 06-one-pattern: crane up and back from the lock to the door edge; the door
// opens a crack, warm light spills through the pocket; the key ridge and the
// five pin heights glow as matching amber outlines.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildLock, buildDoor, LOCK } from '../../world/lock.js'

let kit, lock, door
const Y = 1 // the lock's axis in the door, 1 m up
const C0 = [LOCK.CENTER[0], Y + LOCK.CENTER[1] - LOCK.Y, LOCK.CENTER[2]]
const MOVE = 1.3 // crane ends here, then a held frame
const OPEN = 0.035 // radians: a crack (the edge moves about 2 cm)

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  const look = setLook(kit, { floor: false, fade: 4, size: 0.3, env: 0.4 })
  // Lift the studio to the lock so the key light's shadow covers it
  look.studio.position.y = Y
  const key = look.studio.children.find(o => o.isDirectionalLight)
  key.target.position.set(0, Y, 0)
  kit.scene.add(key.target)
  lock = buildLock(kit, { y: Y })
  door = buildDoor(kit, lock)
  // Cutaway: the jamb goes, so the lock reads whole and the crack shows the room
  door.jamb.visible = false
}

function pose(t) {
  // The key is back upright; the deadbolt stays thrown back, so the door opens
  const o = kit.ease((t - 0.3) / 1.2)
  door.pose({ open: OPEN * o, spill: 0.75 * kit.ease((t - 0.25) / 1.1) })
  lock.pose({ key: 'right', keyX: 0, turn: 0, bolt: -LOCK.THROW, mech: true, shear: 0.35, outline: 1 })
  lock.strike.visible = false
  // Crane up and pull back, eased out, then held
  const p = kit.rise(t, 0, MOVE)
  const az = kit.lerp(40, 55, p) * Math.PI / 180
  const r = kit.lerp(0.23, 0.36, p), h = kit.lerp(0.015, 0.14, p)
  const from = [C0[0] - r * Math.sin(az), C0[1] + h, C0[2] + r * Math.cos(az)]
  const c = lock.at('center')
  // Aim a little under the lock: it sits above the subtitle band
  kit.look(from, [c.x, c.y - 0.007, c.z], 50)
}

export default function render(t) {
  kit.begin(t)
  pose(t)
  kit.caption({ head: 'One exact *pattern*', p: kit.rise(t, 0.1, 0.5) })
  kit.keep(lock.root, 'lock')
  kit.frame(dt => pose(t + dt))
}
