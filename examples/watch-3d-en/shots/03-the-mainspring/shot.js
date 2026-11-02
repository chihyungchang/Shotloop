// 03-the-mainspring: close on the barrel, lid cut away. The crown turns,
// the spring coils tight round the arbor and glows with stored energy.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildWatch, BPS } from '../../world/watch.js'

let kit, w, start = 0, GOLD

// Winding: a held beat, then the crown turns, then a hold on the wound coil
const WIND0 = 0.08, WIND1 = 1, W_A = 0.6, W_B = 3.4
// Camera: from above at a slight angle, one dolly in along the same line
const AIM = [-0.011, 0.0038, -0.003]
const TILT = 24 * Math.PI / 180, D0 = 0.15, D1 = 0.13, LENS = 85

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  start = ctx.start
  setLook(kit)
  w = buildWatch(kit)
  GOLD = new kit.THREE.Color('#ffb340')
  // Cut-away: no dial, hands, crystal or train above the barrel, no lid
  for (const n of ['dial', 'hands', 'crystal', 'train']) w.layers[n].visible = false
  w.parts.barrelLid.visible = false
  // The case middle and lugs in shade, so the barrel is the brightest thing
  // and the headline reads over them; the crown keeps its polish
  const shade = w.parts.case.children[0].material.clone()
  shade.color.set('#5b6069')
  shade.envMapIntensity = 0.45
  for (const c of w.parts.case.children) if (c !== w.parts.crown) c.material = shade
  // The crown's polish toned down, so its highlights stay below the glowing coil
  w.parts.crown.traverse(c => {
    if (!c.isMesh) return
    c.material = c.material.clone()
    c.material.envMap = kit.scene.environment
    c.material.envMapIntensity = 0.5
  })
  // The mainplate dimmed too, so the glowing coil outshines the gold around it
  const plate = w.parts.mainplate.material.clone()
  plate.color.set('#6e5a33')
  plate.envMapIntensity = 0.4
  w.parts.mainplate.material = plate
}

export default function render(t) {
  kit.begin(t)
  w.root.rotation.set(0, 0, 0)
  const p = kit.ease((t - W_A) / (W_B - W_A))
  const wind = kit.lerp(WIND0, WIND1, p)
  // Glow follows the coil, a beat behind
  const energy = kit.ease((t - W_A - 0.3) / (W_B - W_A + 0.2))
  w.pose({ beats: (start + t) * BPS, wind, energy })
  // A warmer, stronger gold in the coil than the world's default
  const sm = w.parts.spring.material
  // The steel warms to gold as it stores energy, so its reflections stop greying the glow
  sm.color.set('#c3c8cf').lerp(GOLD, Math.min(1, energy * 1.6))
  sm.emissive.set('#ff7a12')
  sm.emissiveIntensity = energy * 1.3
  kit.post({ bloom: kit.lerp(0.18, 0.24, energy) })

  const d = kit.lerp(D0, D1, kit.ease(t / 4.2))
  const from = [AIM[0], AIM[1] + d * Math.cos(TILT), AIM[2] + d * Math.sin(TILT)]
  kit.look(from, AIM, LENS)

  kit.caption({ head: ['Winding coils', 'the *mainspring*:', 'stored *energy*'], p: kit.rise(t, 0, 0.5) })
  kit.keep(w.parts.barrel, 'mainspring barrel')
  kit.keep(w.parts.crown, 'crown')
  kit.frame()
}
