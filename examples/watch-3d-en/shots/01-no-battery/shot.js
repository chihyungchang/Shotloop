// 01-no-battery: the watch floats in the dark, seconds hand sweeping, while
// the camera pushes in and arcs 20° round it. Hook line over the top.
import { setLook, buildWatch, HERO, BPS } from '../../world/watch.js'

let kit, w, start = 0

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  start = ctx.start || 0
  setLook(kit)
  w = buildWatch(kit)
  // Warm rim from behind, to glint along the case edge
  const warm = new kit.THREE.DirectionalLight('#ffb070', 3.2)
  warm.position.set(0.25, 0.12, -0.3)
  kit.scene.add(warm)
}

// Watch centre height and how far the aim sits above it (subject in the lower part)
const CY = 0, LENS = 70
const fovH = d => 2 * d * Math.tan(Math.atan(18 / LENS))

export default function render(t) {
  kit.begin(t)

  // Floating watch, turning slowly so the case flank and caseback edge come round
  const turn = kit.ease(t / 3.5)
  w.root.position.y = 0.0015 * Math.sin(t * 1.4)
  w.root.rotation.set(HERO.rot[0], HERO.rot[1] - 0.18 * turn, 0)
  w.pose({ beats: (start + t) * BPS, wind: 0.6 })

  // One move: push-in with a 20° arc, eased, held at the end
  const p = kit.ease(t / 3.1)
  const d = kit.lerp(0.34, 0.285, p)
  const deg = kit.lerp(12, -8, p)
  const at = [0, CY + fovH(d) * 0.1, 0]
  kit.look(kit.orbit(at, d, deg, 0.004), at, LENS)

  kit.caption({ head: ['No battery.', 'What keeps it *ticking?*'], y: 170, p: 1 })
  kit.keep(w.root, 'watch')
  kit.frame()
}
