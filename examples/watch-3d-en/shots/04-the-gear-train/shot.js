// 04-the-gear-train: the barrel drives centre, third and fourth wheel; a gold
// pulse runs along the chain and ends in the hands. Dial off, mainplate dimmed:
// the brass train is the hero, seen from above.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildWatch, BPS, PAL } from '../../world/watch.js'

let kit, w, start, curve, comet, halo, glowSets, springMat, springBase, HOT, ARR
const SPEED = 60 // time ×60, said on screen
// Camera: an arc round the movement's axis at a fixed height, so the plate and the
// hands' sweep keep the same outline in frame while the train turns under the camera
const ELEV = 50 * Math.PI / 180, DIST = 0.17
const AZ0 = -18 * Math.PI / 180, AZ1 = 18 * Math.PI / 180
const AIM_Y = 0.0141, AIM_R = 0.0015 // aim above the axis (puts the movement in the lower band), nudged right

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  start = ctx.start
  setLook(kit)
  kit.post({ bloom: 0.2 }) // a light halo on the pulse and the lit wheels
  w = buildWatch(kit)
  const { THREE } = kit
  HOT = new THREE.Color(PAL.energy)
  // Emissive a deeper orange than the energy gold: under AgX a bright gold
  // emissive washes out to beige, a deep orange stays a hot glow
  const EMBER = '#ff6a10'
  // Cut-away: no case, crystal, dial, balance or escapement (they would alias at ×60)
  for (const n of ['case', 'caseback', 'crystal', 'dial', 'balance', 'escapement']) w.layers[n].visible = false
  // Open barrel: the wound spring shows, still glowing from the last shot
  w.parts.barrelLid.visible = false
  // Mainplate dimmed to a dark ground so the brass wheels stand out
  const plate = w.parts.mainplate.material.clone()
  plate.color.multiplyScalar(0.3)
  plate.roughness = 0.45
  plate.envMap = kit.scene.environment
  plate.envMapIntensity = 0.35
  w.parts.mainplate.material = plate

  // Own materials per wheel so each can glow on its own
  const own = g => {
    const mats = []
    g.traverse(o => {
      if (!o.isMesh || o === w.parts.spring) return
      o.material = o.material.clone()
      o.material.emissive = new THREE.Color(EMBER)
      o.material.userData.base = o.material.color.clone()
      mats.push(o.material)
    })
    return mats
  }
  glowSets = {
    barrel: own(w.parts.barrel), centre: own(w.parts.centreWheel), third: own(w.parts.thirdWheel),
    fourth: own(w.parts.fourthWheel), hands: own(w.layers.hands)
  }
  springMat = w.parts.spring.material.clone()
  springMat.emissive = new THREE.Color(EMBER)
  springBase = springMat.color.clone()
  w.parts.spring.material = springMat

  // Pulse path (local mm → world m, the watch at the origin unturned): over each
  // wheel, clear of arbors and pinions, then up to the hands
  const v = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(0.001)
  const pts = [
    v(-6.3, 5.3, 1.8), v(-4.2, 6.0, 1.6), // barrel, over its teeth
    v(0.8, 6.4, 1.6), v(2.84, 6.3, 3.48), // centre wheel, its mesh with the third pinion
    v(4.0, 6.0, 4.6), v(6.2, 6.0, 3.2), // third wheel, its mesh with the fourth pinion
    v(8.0, 5.3, 3.6), // fourth wheel
    v(5.5, 8.6, 0.8), v(0, 9.1, 0) // up to the hands
  ]
  curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  // Arc-length position of each stop
  const near = p => { let best = 0, bd = 1e9; for (let i = 0; i <= 400; i++) { const d = curve.getPointAt(i / 400).distanceTo(p); if (d < bd) { bd = d; best = i / 400 } } return best }
  ARR = { barrel: 0, centre: near(pts[2]), third: near(pts[4]), fourth: near(pts[6]), hands: 1 }

  // Comet: a hot head and a fading tail
  comet = []
  for (let i = 0; i < 16; i++) {
    const m = kit.glow(i === 0 ? '#ff8a24' : EMBER, i === 0 ? 2.6 : 1.6)
    m.transparent = i > 0
    const s = kit.ball(0.0007 * (1 - i / 18), m)
    s.castShadow = s.receiveShadow = false
    kit.scene.add(s)
    comet.push(s)
  }
  // Halo round the head: nested additive shells, fainter outward
  halo = [[0.0011, 0.12], [0.0016, 0.06], [0.0023, 0.03]].map(([r, a]) => {
    const m = new THREE.MeshBasicMaterial({ color: EMBER, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false })
    m.userData.a = a
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), m)
    kit.scene.add(s)
    return s
  })
}

// Pulse position along the path, 0…1
const T0 = 0.45, T1 = 3.5
function pulseU(t) { return kit.ease((t - T0) / (T1 - T0)) }

export default function render(t) {
  kit.begin(t)
  w.root.rotation.set(0, 0, 0)
  w.pose({ beats: (start + t * SPEED) * BPS, wind: 0.9 })

  // Pulse and the glow it leaves on each wheel
  // The pulse sits in the barrel from frame one (the energy of the last shot)
  const u = pulseU(t), on = t < T1 + 0.35
  const fade = 1 - kit.rise(t, T1 + 0.05, 0.3)
  comet.forEach((s, i) => {
    const ui = kit.clamp(u - i * 0.011)
    s.position.copy(curve.getPointAt(ui))
    s.visible = on
    s.material.opacity = fade * (1 - i / 16)
  })
  for (const s of halo) {
    s.position.copy(comet[0].position)
    s.visible = on
    s.material.opacity = fade * s.material.userData.a
  }
  const glow = {}
  for (const [n, mats] of Object.entries(glowSets)) {
    const d = (u - ARR[n]) / 0.07
    const passing = Math.exp(-d * d)
    const after = n === 'hands' ? kit.rise(t, T1 - 0.1, 0.5) * 0.9 : (u > ARR[n] ? 0.15 : 0)
    const g = glow[n] = Math.max(passing, after)
    for (const m of mats) {
      m.color.copy(m.userData.base).lerp(HOT, g * 0.5)
      m.emissiveIntensity = g * (n === 'hands' ? 1.1 : 1.3)
    }
  }
  // The wound spring keeps its stored glow, brightest while the pulse is still in the barrel
  const gs = 0.5 + 0.5 * glow.barrel
  springMat.color.copy(springBase).lerp(HOT, 0.6 * gs)
  springMat.emissiveIntensity = 1.6 * gs

  // Camera: trucks on an arc round the movement, left → right with the pulse, held
  // ends; the hands, raised above the wheels, slide across them (parallax)
  const p = kit.ease((t - 0.3) / 3.6)
  const az = kit.lerp(AZ0, AZ1, p)
  const at = [AIM_R * Math.cos(az), AIM_Y, -AIM_R * Math.sin(az)]
  const from = [at[0] + DIST * Math.sin(az) * Math.cos(ELEV), at[1] + DIST * Math.sin(ELEV), at[2] + DIST * Math.cos(az) * Math.cos(ELEV)]
  kit.look(from, at, 100)

  kit.caption({ head: 'Gears carry that energy to the *hands*' })
  kit.block({ y: 404, cls: 'chip', html: 'time ×60', style: 'width:auto' })
  kit.keep(w.layers.train, 'gear train')
  kit.keep(w.parts.barrel, 'barrel')
  kit.keep(w.layers.hands, 'hands')
  kit.frame()
}
