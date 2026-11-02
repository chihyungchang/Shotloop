// 05-the-escapement: macro on escape wheel and pallet fork, slowed 6x.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildWatch, BPS } from '../../world/watch.js'

const SLOW = 6
let kit, w, flash, halo, centre

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  setLook(kit, { bloom: 0.15 })
  w = buildWatch(kit)
  // Open the movement: dial side faces the camera, the wheels above the escapement removed
  for (const n of ['crystal', 'hands', 'dial', 'train']) w.layers[n].visible = false
  w.root.rotation.set(Math.PI / 2, 0, 0)
  // The escapement is the hero: no jewels or screws scattered on the plate,
  // the plate and balance dark behind, the steel bright and the focus on it
  for (const o of w.layers.mainplate.children) o.visible = o === w.parts.mainplate
  const env = kit.scene.environment, ruby = w.parts.stones[0].material
  const restyle = (group, fn) => {
    const done = new Map()
    group.traverse(o => {
      if (!o.isMesh || o.material === ruby) return
      if (!done.has(o.material)) { const m = o.material.clone(); m.envMap = env; fn(m); done.set(o.material, m) }
      o.material = done.get(o.material)
    })
  }
  restyle(w.parts.mainplate, m => { m.color.set('#73592f'); m.roughness = 0.45; m.envMapIntensity = 0.4 })
  restyle(w.layers.balance, m => { m.color.multiplyScalar(0.45); m.envMapIntensity = 0.4 })
  for (const g of [w.parts.escapeWheel, w.parts.fork]) restyle(g, m => { m.color.set('#dfe3e9'); m.roughness = 0.3; m.envMapIntensity = 0.75 })
  kit.post({ fstop: 8, samples: 24 })
  w.pose({ beats: 0 })
  const e = w.at('escape'), f = w.at('fork')
  centre = kit.mix(e, f, 0.2)
  // A small lamp up and left of the lens: the steel catches it, the plate behind barely does
  const lamp = new kit.THREE.PointLight('#fff1e0', 0.0006, 0, 2)
  lamp.position.set(centre[0] - 0.008, centre[1] + 0.014, centre[2] + 0.035)
  kit.scene.add(lamp)
  // The tick flash: a hot core and a soft halo at the locking stone
  flash = kit.ball(0.00018, kit.glow('#ffd27a', 2))
  halo = kit.ball(0.0005, new kit.THREE.MeshBasicMaterial({ color: '#ffb340', transparent: true, opacity: 0, depthWrite: false }))
  flash.castShadow = halo.castShadow = false
  kit.scene.add(flash, halo)
}

export default function render(t) {
  kit.begin(t)
  const beats = 0.3 + t * BPS / SLOW
  const s = w.pose({ beats, wind: 0.6, glow: 0 })
  // Flash at the stone that just locked a tooth
  const f = Math.pow(1 - kit.clamp(s.sinceTick / 0.35), 2)
  const sp = w.at('stone' + s.lockStone)
  flash.position.set(...sp); halo.position.set(...sp)
  flash.scale.setScalar(0.4 + f)
  flash.visible = f > 0.01
  halo.scale.setScalar(0.6 + 1.2 * f)
  halo.material.opacity = 0.35 * f
  w.pose({ beats, wind: 0.6, glow: f })

  // Slow push-in with a slight orbit; the aim rides above the subject so it sits low in frame
  const p = kit.ease(t / 5)
  const dist = kit.lerp(0.066, 0.053, p)
  const at = [centre[0], centre[1] + dist * 0.053, centre[2]]
  const from = kit.orbit(at, dist, kit.lerp(-9, 5, p), dist * 0.06)
  kit.look(from, at, 100)

  // A dark wash behind the headline keeps it readable over the balance
  kit.block({ x: 0, y: 0, w: 720, style: 'height:600px;background:linear-gradient(#0d0f13f2 0%, #0d0f13d0 55%, #0d0f1300 100%)', html: '' })
  kit.caption({ head: ['The escapement', 'releases it', '*tick by tick*'], size: 58, p: kit.rise(t, 0.1, 0.6) })
  // Label to the left of the escape wheel, clear of the pallets
  const se = kit.screen(w.at('escape')), sf = kit.screen(w.at('fork'))
  if (se && sf) {
    const r = Math.hypot(se[0] - sf[0], se[1] - sf[1]) * 2.3 / 2.66
    kit.block({ x: Math.max(44, se[0] - r - 196), y: se[1] - 22, w: 180, p: kit.rise(t, 0.6, 0.5), cls: 'chip', style: 'width:auto', html: 'escapement' })
  }
  kit.block({ y: 970, p: kit.rise(t, 0.8, 0.5), cls: 'chip', style: 'width:auto', html: 'slowed 6×' })
  kit.keep(w.parts.escapeWheel, 'escape wheel')
  kit.keep(w.parts.fork, 'pallet fork')
  kit.frame()
}
