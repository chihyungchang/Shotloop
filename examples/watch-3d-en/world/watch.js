// The film's one watch, built at real size, and its look.
//
//   import { setLook, buildWatch, PAL, SIZE, HERO, NAMES, BPS } from '../../world/watch.js'
//
//   setLook(kit, { floor = true, bloom = 0.18, exposure = 0.82 })
//       Call first in setup, after kit.init: charcoal studio, warm key, cool rim,
//       a floor 6 cm under the watch, shadows sized for a 4 cm object near the origin.
//   const w = buildWatch(kit)          adds the watch to kit.scene (in setup)
//     w.root     the whole watch, in metres. Move and turn it; keep it near the origin
//                (the shadow box is ±12 cm). Rotation order is 'YXZ':
//                rotation.x = π/2 stands it up, dial facing +z, 12 o'clock up;
//                rotation.y then turns it round the vertical.
//                Local frame (rotation 0): dial up (+y), 12 o'clock at −z,
//                crown at 9 o'clock (−x), "crown on the left" seen from the dial.
//     w.pose({ beats, wind, energy, explode, gap, glow })   each frame, before look()
//         beats    balance beats elapsed. The real watch does BPS = 8 a second:
//                  pass (ctx.start + t) * BPS for real time (hands continue across cuts),
//                  or fewer for slow motion and say so on screen ("slowed 8×").
//                  Drives balance, hairspring, fork, escape wheel, train and hands by
//                  their real ratios (21-tooth escape wheel, 4th wheel 1 turn a minute).
//         wind     0 slack … 1 fully wound: coils the mainspring, turns arbor, ratchet,
//                  winding pinion and crown together (default 0.35).
//         energy   0…1 warm gold glow in the mainspring (gold = stored energy).
//         explode  0 assembled … 1 exploded along local +y, top layers first.
//         gap      metres between exploded layers (default 0.012).
//         glow     0…1 extra glow of the ruby jewels and pallets.
//     w.layers   { caseback, case, mainplate, balance, escapement, barrel, train,
//                  dial, hands, crystal }: groups; hide one for a close-up
//                  (w.layers.dial.visible = false). Explode order bottom → top is this
//                  order (the hands sit above the dial, as they do in the watch; the
//                  caseback drops one gap down, the case stays).
//     w.parts    meshes and groups for keep(): balance, hairspring, fork, stones[2],
//                escapeWheel, barrel (drum), barrelLid (hide it for the cut-away), spring,
//                ratchet (arbor and its small ratchet), crown (crown, stem and winding
//                pinion), centreWheel, thirdWheel, fourthWheel, dial, hourHand,
//                minuteHand, secondsHand, crystal, mainplate, case, caseback, jewels[]
//   Framing: the movement is 25.6 mm across. A 100 mm lens about 9 cm away frames the
//   barrel; about 5 cm away, escape wheel and fork; 2 cm away, the pallets alone.
//   Show the caseback with w.root.rotation.x = −π/2 (the gold movement and the beating
//   balance show through the sapphire window).
//   Example (setup):  const kit = await ctx.window.kit.init(ctx); setLook(kit); w = buildWatch(kit)
//           (render): kit.begin(t); w.root.rotation.set(...HERO.rot); w.pose({ beats: (start + t) * BPS })
//                     kit.look(HERO.from, HERO.at, HERO.mm); …type…; kit.keep(w.root, 'watch'); kit.frame()
//     w.at(name, [dx, dy, dz])  world point [x, y, z] of a part's axis (offset in
//                local millimetres), after pose(): 'watch', 'barrel', 'centre', 'third',
//                'fourth', 'escape', 'fork', 'pallets', 'stone0', 'stone1', 'balance',
//                'crown', 'hands', 'dial', and each layer name (its centre).
//     w.state    from the last pose: balance and fork angle (rad), ticks (locks so far),
//                sinceTick (beats since the last lock, for a flash), lockStone (0/1),
//                explodeP { layer: 0…1 }.
//   HERO       the hero placement and framing of shots 1 and 7:
//              w.root.rotation.set(...HERO.rot); kit.look(HERO.from, HERO.at, HERO.mm)
//   NAMES      short labels for the layers.   PAL  the film's colours.   SIZE  metres.

export const PAL = {
  bg: '#0d0f13', floor: '#14161b', key: '#ffe3c2', rim: '#8fb0ff',
  case: '#c4c8ce', gold: '#d9b15f', plate: '#dcb96c', pinion: '#c0c5cc', steel: '#c9ced5',
  ruby: '#c8102c', blue: '#2c5bd0', dial: '#d9d7d0', ink: '#15171c', seconds: '#e8442a', energy: '#ffb340'
}

// Real sizes in metres
export const SIZE = { case: 0.040, lugs: 0.050, thickness: 0.010, movement: 0.0256, barrel: 0.0112, balance: 0.008, escape: 0.0046, crown: 0.005 }
export const BPS = 8
export const NAMES = {
  crystal: 'Sapphire crystal', hands: 'Hands', dial: 'Dial', train: 'Gear train', barrel: 'Mainspring',
  escapement: 'Escapement', balance: 'Balance wheel', mainplate: 'Mainplate', case: 'Case', caseback: 'Caseback'
}
export const HERO = { rot: [Math.PI / 2 - 0.12, -0.55, 0], from: [0, 0.012, 0.23], at: [0, 0.011, 0], mm: 70 }

const MM = 0.001
const LAYERS = ['caseback', 'case', 'mainplate', 'balance', 'escapement', 'barrel', 'train', 'dial', 'hands', 'crystal']
const RANK = { caseback: -1, case: 0, mainplate: 1, balance: 2, escapement: 3, barrel: 4, train: 5, dial: 6, hands: 7, crystal: 8 }

export function setLook(kit, { floor = true, bloom = 0.18, exposure = 0.82 } = {}) {
  const { THREE, scene } = kit
  scene.background = new THREE.Color(PAL.bg)
  scene.environmentIntensity = 0.55
  const g = kit.studio({ floor: PAL.floor, key: 2.2, rim: PAL.rim, fade: 0.5 })
  g.position.y = -0.06
  g.traverse(o => {
    if (o.isDirectionalLight && o.castShadow) {
      o.color.set(PAL.key)
      o.shadow.mapSize.set(4096, 4096)
      Object.assign(o.shadow.camera, { left: -0.12, right: 0.12, top: 0.12, bottom: -0.12, near: 1, far: 10 })
      o.shadow.camera.updateProjectionMatrix()
      o.shadow.bias = -0.00005
      o.shadow.normalBias = 0.00003
    }
    if (o.isMesh) o.visible = floor
  })
  kit.post({ bloom, exposure })
  return g
}

export function buildWatch(kit) {
  const { THREE } = kit
  const clamp = kit.clamp, lerp = kit.lerp
  const TAU = Math.PI * 2
  const smooth = (a, b, x) => { const p = clamp((x - a) / (b - a)); return p * p * (3 - 2 * p) }

  // ---- Materials ----
  const phys = o => new THREE.MeshPhysicalMaterial(o)
  const M = {
    case: kit.metal(PAL.case, 0.14),
    polish: kit.metal('#e9ecf0', 0.07),
    gold: kit.metal(PAL.gold, 0.24),
    goldPolish: kit.metal('#ecc977', 0.1),
    plate: kit.metal(PAL.plate, 0.3),
    pinion: kit.metal(PAL.pinion, 0.16),
    steel: kit.metal(PAL.steel, 0.2),
    screw: kit.metal(PAL.blue, 0.25),
    dial: kit.plastic(PAL.dial, 0.42),
    ink: phys({ color: PAL.ink, metalness: 0.6, roughness: 0.25, clearcoat: 0.6 }),
    track: kit.matte('#2a2d34', 0.7),
    seconds: kit.plastic(PAL.seconds, 0.3),
    spring: phys({ color: '#c3c8cf', metalness: 1, roughness: 0.3, emissive: '#ff9a1f', emissiveIntensity: 0, side: THREE.DoubleSide }),
    hair: phys({ color: PAL.blue, metalness: 1, roughness: 0.26, side: THREE.DoubleSide }),
    ruby: phys({ color: PAL.ruby, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, emissive: '#ff2244', emissiveIntensity: 0.3 }),
    drum: kit.metal('#8c6d36', 0.34),
    // Sapphire: thin and clear, seen by its reflections
    glass: phys({ color: '#ffffff', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false })
  }
  M.case.side = M.polish.side = THREE.DoubleSide

  // ---- Shape helpers (millimetres; a "polar" angle a is the turn about +y, a point at a is (cos a, −sin a) in x, z) ----
  const alpha = (p, q) => Math.atan2(-(q.z - p.z), q.x - p.x)
  const toward = (p, d, dx, dz) => { const l = Math.hypot(dx, dz); return { x: p.x + d * dx / l, z: p.z + d * dz / l } }
  function slab(shape, depth, mat, bevel = Math.min(depth * 0.15, 0.04)) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 1, curveSegments: 72 })
    g.translate(0, 0, -depth / 2)
    g.rotateX(-Math.PI / 2)
    return kit.mesh(g, mat)
  }
  const poly0 = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s }
  const disc = r => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false); return s }
  const holeAt = (s, x, z, r) => { const h = new THREE.Path(); h.absarc(x, -z, r, 0, TAU, true); s.holes.push(h); return s }
  function wheelShape(n, rp, { kind = 'gear', spokes = 0, hub, rim, hole = 0 } = {}) {
    const s = new THREE.Shape(), step = TAU / n, m = 2 * rp / n
    let tip = rp + m, root = rp - 1.25 * m
    let prof = [[root, -0.42], [tip, -0.14], [tip, 0.14], [root, 0.42]]
    // Escape teeth lean forward (turning +), their leading tip at angle i * step
    if (kind === 'escape') { tip = rp; root = rp * 0.8; prof = [[root, -0.62], [tip, -0.07], [tip, 0], [root, -0.12]] }
    if (kind === 'ratchet') { tip = rp; root = rp * 0.91; prof = [[root, -0.96], [tip, -0.04], [root, 0]] }
    let first = true
    for (let i = 0; i < n; i++) for (const [r, f] of prof) {
      const a = (i + f) * step
      first ? s.moveTo(r * Math.cos(a), r * Math.sin(a)) : s.lineTo(r * Math.cos(a), r * Math.sin(a))
      first = false
    }
    s.closePath()
    if (spokes) {
      const ro = root - (rim ?? rp * 0.14), sw = Math.max(rp * 0.045, 0.06), span = Math.PI / spokes
      const ri = Math.max(hub ?? rp * 0.22, (sw / span) * 1.6)
      if (ro > ri + 0.1) for (let k = 0; k < spokes; k++) {
        const c = (2 * k + 1) * span, h = new THREE.Path()
        const o0 = c - span + sw / ro, o1 = c + span - sw / ro, i0 = c - span + sw / ri, i1 = c + span - sw / ri
        h.moveTo(ro * Math.cos(o0), ro * Math.sin(o0))
        h.absarc(0, 0, ro, o0, o1, false)
        h.lineTo(ri * Math.cos(i1), ri * Math.sin(i1))
        h.absarc(0, 0, ri, i1, i0, true)
        h.closePath()
        s.holes.push(h)
      }
    }
    if (hole) holeAt(s, 0, 0, hole)
    return s
  }
  const lathe = (pts, mat, seg = 160) => kit.mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat)
  const cyl = (r, h, mat, y = 0, x = 0, z = 0, seg = 48) => { const c = kit.cylinder(r, h, mat, seg); c.position.set(x, y, z); return c }
  // A coiled steel strip th thick (springs), its top and both sides drawn:
  // set(fn, y0, y1) with fn(u) → [r, angle], u in 0…1
  function ribbon(segs, mat, th) {
    const V = 6, g = new THREE.BufferGeometry(), pos = new Float32Array((segs + 1) * V * 3), idx = []
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    for (let i = 0; i < segs; i++) {
      const a = i * V, b = a + V
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3, a + 4, a + 5, b + 4, a + 5, b + 5, b + 4)
    }
    g.setIndex(idx)
    const m = kit.mesh(g, mat)
    m.frustumCulled = false
    m.set = (fn, y0, y1) => {
      for (let i = 0; i <= segs; i++) {
        const [r, a] = fn(i / segs), c = Math.cos(a), s = -Math.sin(a), ri = r - th / 2, ro = r + th / 2
        pos.set([ri * c, y1, ri * s, ro * c, y1, ro * s, ro * c, y1, ro * s, ro * c, y0, ro * s, ri * c, y1, ri * s, ri * c, y0, ri * s], i * V * 3)
      }
      g.attributes.position.needsUpdate = true
      g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere()
    }
    return m
  }

  // ---- Groups ----
  const root = new THREE.Group(), mm = new THREE.Group()
  root.rotation.order = 'YXZ'
  mm.scale.setScalar(MM)
  root.add(mm)
  kit.scene.add(root)
  const layers = {}, marks = {}, parts = { jewels: [], stones: [] }
  for (const n of LAYERS) { const g = new THREE.Group(); g.name = n; mm.add(g); layers[n] = g }
  const mark = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); marks[name] = o; return o }
  const pivot = (parent, p, y = 0) => { const g = new THREE.Group(); g.position.set(p.x, y, p.z); parent.add(g); return g }

  // ---- Layout of the movement (mm, x/z), every mesh at its real centre distance ----
  const mod = { barrel: 5.5 * 2 / 84, centre: 4.5 * 2 / 80, third: 3.8 * 2 / 75, fourth: 3.4 * 2 / 80 }
  const RP = {
    barrel: 5.5, centreP: 6 * mod.barrel, centre: 4.5, thirdP: 5 * mod.centre, third: 3.8,
    fourthP: 5 * mod.third, fourth: 3.4, escapeP: 3.5 * mod.fourth
  }
  const N = { barrel: 84, centreP: 12, centre: 80, thirdP: 10, third: 75, fourthP: 10, fourth: 80, escapeP: 7, escape: 21 }
  const R_ESC = 2.3, GAMMA = Math.PI / 6, D_PAL = R_ESC / Math.cos(GAMMA), L_FORK = 3.0, R_PIN = 0.75
  const PHI0 = 9 * Math.PI / 180, AMP = 250 * Math.PI / 180
  const C = { x: 0, z: 0 }
  const B = toward(C, RP.barrel + RP.centreP, -1, 0)
  const T = toward(C, RP.centre + RP.thirdP, 3.2, 3.92)
  const F = toward(T, RP.third + RP.fourthP, 0.94, -0.34)
  const E = toward(F, RP.fourth + RP.escapeP, -0.2, -0.98)
  const P = toward(E, D_PAL, -0.35, -0.937)
  const BAL = toward(E, D_PAL + L_FORK, -0.35, -0.937)

  // ---- Caseback: steel ring, sapphire window ----
  const caseback = lathe([[11.0, 0.2], [17.2, 0.0], [18.3, 0.3], [18.7, 0.97], [11.8, 0.97], [11.0, 0.62], [11.0, 0.2]], M.case)
  const window_ = cyl(11.3, 0.5, M.glass, 0.5, 0, 0, 96)
  layers.caseback.add(caseback, window_)
  mark('caseback', layers.caseback, 0, 0.5, 0)
  parts.caseback = caseback

  // ---- Case: middle, bezel, lugs, crown and stem ----
  const caseG = new THREE.Group()
  caseG.add(lathe([[14.2, 1.0], [18.8, 1.0], [19.6, 1.5], [20.0, 2.6], [20.0, 7.2], [19.7, 8.4], [19.0, 9.1], [17.6, 9.7],
    [15.9, 9.95], [15.4, 9.75], [15.2, 9.1], [14.2, 7.4], [14.2, 1.0]], M.case))
  // Lugs: curved horns, side profile (radius, height) extruded across their width
  const horn = new THREE.ExtrudeGeometry(poly0([[16.5, 1.6], [21.5, 2.0], [24.6, 2.9], [25.0, 3.8], [24.2, 5.0], [21.0, 6.6], [17.5, 7.8], [16.5, 8.0]]),
    { depth: 2.4, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 3, curveSegments: 8 })
  horn.translate(0, 0, -1.2)
  horn.rotateY(-Math.PI / 2)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lug = kit.mesh(horn, M.case)
    lug.position.x = sx * 10.4
    lug.scale.z = sz
    caseG.add(lug)
  }
  const CROWN_Y = 4.95 + 0.9 - 0.12
  const crown = new THREE.Group()
  crown.position.set(0, CROWN_Y, 0)
  const knurl = slab(wheelShape(36, 2.3), 2.4, M.case)
  knurl.rotation.z = Math.PI / 2; knurl.position.x = -21.6
  const cap = cyl(1.9, 0.5, M.polish, 0, -23.0); cap.rotation.z = Math.PI / 2
  const WIND_R = 1.15
  const stem = cyl(0.32, 14.4, M.pinion, 0, -21.4 + 7.2); stem.rotation.z = Math.PI / 2
  const wpin = slab(wheelShape(16, 0.8), 0.5, M.pinion)
  wpin.rotation.z = Math.PI / 2; wpin.position.x = B.x - WIND_R
  crown.add(knurl, cap, stem, wpin)
  caseG.add(crown)
  layers.case.add(caseG)
  mark('case', layers.case, 0, 5, 0)
  mark('crown', crown, -22, 0, 0)
  Object.assign(parts, { case: caseG, crown })

  // ---- Mainplate: gold, a window for the balance, ruby jewels and blue screws ----
  const plate = slab(holeAt(disc(12.8), BAL.x, BAL.z, 4.35), 0.8, M.plate)
  plate.position.y = 1.8
  layers.mainplate.add(plate)
  for (const p of [C, T, F, E, P, B]) for (const y of [2.22, 1.38]) {
    const j = cyl(0.42, 0.16, M.ruby, y, p.x, p.z, 24)
    layers.mainplate.add(j)
    parts.jewels.push(j)
  }
  for (const a of [0.5, 1.6, 2.6, 3.9, 5.2]) {
    const x = 11.6 * Math.cos(a), z = -11.6 * Math.sin(a)
    if (Math.hypot(x - BAL.x, z - BAL.z) < 5) continue
    layers.mainplate.add(cyl(0.7, 0.24, M.screw, 1.3, x, z, 24), cyl(0.7, 0.24, M.screw, 2.3, x, z, 24))
  }
  mark('mainplate', layers.mainplate, 0, 1.8, 0)
  parts.mainplate = plate

  // ---- Balance: gold wheel, blue hairspring, roller with a ruby pin ----
  const balPivot = pivot(layers.balance, BAL)
  const rimRing = slab(holeAt(disc(4.0), 0, 0, 3.55), 0.28, M.gold)
  rimRing.position.y = 2.7
  balPivot.add(rimRing, cyl(0.55, 0.34, M.gold, 2.7), cyl(0.12, 1.65, M.pinion, 3.1), cyl(0.42, 0.18, M.pinion, 3.04),
    cyl(0.9, 0.1, M.pinion, 3.4))
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3 + 0.4, arm = kit.box(3.3, 0.2, 0.34, M.gold, 0.05)
    arm.position.set(1.85 * Math.cos(a), 2.7, -1.85 * Math.sin(a)); arm.rotation.y = a
    balPivot.add(arm)
  }
  for (let k = 0; k < 12; k++) {
    const a = (k + 0.5) * TAU / 12, s = cyl(0.2, 0.36, M.goldPolish, 0, 0, 0, 16)
    s.geometry.rotateZ(Math.PI / 2); s.geometry.translate(4.12, 2.7, 0); s.rotation.y = a
    balPivot.add(s)
  }
  const pin = cyl(0.1, 0.45, M.ruby, 3.62, R_PIN, 0, 16)
  balPivot.add(pin)
  const balBase = alpha(BAL, P)
  const HS = { rin: 0.45, rout: 2.55, turns: 11, out: balBase + Math.PI }
  const hair = ribbon(HS.turns * 96, M.hair, 0.06)
  hair.castShadow = false
  hair.position.set(BAL.x, 0, BAL.z)
  const stud = kit.box(0.4, 0.4, 0.4, M.pinion, 0.05)
  const studA = HS.out + 0.15 * TAU
  stud.position.set(BAL.x + 2.72 * Math.cos(studA), 3.05, BAL.z - 2.72 * Math.sin(studA))
  layers.balance.add(hair, stud)
  mark('balance', balPivot, 0, 2.9, 0)
  Object.assign(parts, { balance: balPivot, hairspring: hair })

  // ---- Escapement: steel escape wheel, pallet fork with two ruby stones ----
  const escPivot = pivot(layers.escapement, E)
  const escWheel = slab(wheelShape(N.escape, R_ESC, { kind: 'escape', spokes: 4, hub: 0.38, rim: 0.28 }), 0.2, M.steel)
  escWheel.position.y = 3.5
  const escPin = slab(wheelShape(N.escapeP, RP.escapeP), 0.45, M.pinion)
  escPin.position.y = 4.43
  escPivot.add(escWheel, escPin, cyl(0.1, 2.6, M.pinion, 3.5))
  const forkBase = alpha(P, BAL)
  const fork = pivot(layers.escapement, P)
  const forkMesh = new THREE.Group()
  const bar = (x0, z0, x1, z1, w, h, y, mat = M.steel) => {
    const b = kit.box(Math.hypot(x1 - x0, z1 - z0), h, w, mat, Math.min(w, h) * 0.3)
    b.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); b.rotation.y = Math.atan2(-(z1 - z0), x1 - x0)
    forkMesh.add(b); return b
  }
  // Fork frame: +x towards the balance, the escape wheel at (−D_PAL, 0)
  bar(0, 0, 1.95, 0, 0.3, 0.16, 3.7)
  bar(1.95, -0.42, 1.95, 0.42, 0.14, 0.16, 3.7)
  for (const s of [-1, 1]) bar(1.9, s * 0.27, 2.55, s * 0.27, 0.18, 0.16, 3.7)
  const stoneLocal = []
  for (const s of [-1, 1]) {
    const dx = Math.cos(GAMMA), dz = -s * Math.sin(GAMMA), rc = R_ESC + 0.33
    const sx = -D_PAL + rc * dx, sz = rc * dz
    bar(0, 0, -D_PAL + (R_ESC + 0.6) * dx, (R_ESC + 0.6) * dz, 0.28, 0.16, 3.7)
    const st = kit.box(0.7, 0.4, 0.24, M.ruby, 0.04)
    st.position.set(sx, 3.58, sz); st.rotation.y = Math.atan2(-dz, dx)
    forkMesh.add(st)
    parts.stones.push(st)
    stoneLocal.push({ x: sx, z: sz })
  }
  mark('stone0', forkMesh, stoneLocal[0].x, 3.58, stoneLocal[0].z)
  mark('stone1', forkMesh, stoneLocal[1].x, 3.58, stoneLocal[1].z)
  mark('pallets', forkMesh, (stoneLocal[0].x + stoneLocal[1].x) / 2, 3.58, 0)
  forkMesh.add(cyl(0.15, 0.75, M.pinion, 3.58), cyl(0.3, 0.06, M.ruby, 3.95))
  fork.add(forkMesh)
  mark('escape', escPivot, 0, 3.5, 0)
  mark('fork', fork, 0, 3.7, 0)
  Object.assign(parts, { escapeWheel: escPivot, fork })

  // ---- Barrel: toothed drum, cut-away-able lid, mainspring, arbor and ratchet ----
  // The drum is darker inside so the steel coils and their glow read against it
  const drum = pivot(layers.barrel, B)
  drum.add(lathe([[0.62, 2.4], [5.0, 2.4], [5.0, 4.3], [4.78, 4.3], [4.78, 2.6], [0.62, 2.6], [0.62, 2.4]], M.drum, 128))
  const bTeeth = slab(wheelShape(N.barrel, RP.barrel, { hole: 4.9 }), 0.3, M.gold)
  bTeeth.position.y = 2.6
  const lid = slab(holeAt(disc(4.95), 0, 0, 0.7), 0.15, M.gold)
  lid.position.y = 4.38
  const spring = ribbon(Math.round(14.2 * 96), M.spring, 0.075)
  drum.add(bTeeth, lid, spring)
  // Arbor with a small ratchet on top, turned by the crown's winding pinion
  const arbor = pivot(layers.barrel, B)
  const ratchet = slab(wheelShape(24, 1.3, { kind: 'ratchet' }), 0.3, M.steel)
  ratchet.position.y = 4.8
  arbor.add(cyl(0.55, 2.7, M.pinion, 3.65), ratchet, cyl(0.5, 0.12, M.polish, 4.99, 0, 0, 32))
  mark('barrel', drum, 0, 3.4, 0)
  Object.assign(parts, { barrel: drum, barrelLid: lid, spring, ratchet: arbor })

  // ---- Gear train: centre, third and fourth wheel, each a brass wheel on a steel pinion ----
  const trainWheel = (p, nw, rw, yw, np, rpn, yp, spokes) => {
    const g = pivot(layers.train, p)
    const w = slab(wheelShape(nw, rw, { spokes }), 0.25, M.gold); w.position.y = yw
    const pn = slab(wheelShape(np, rpn), 0.45, M.pinion); pn.position.y = yp
    g.add(w, pn, cyl(0.12, 4.2, M.pinion, 4.2), cyl(0.5, 0.3, M.gold, yw, 0, 0, 24))
    return g
  }
  const centreW = trainWheel(C, N.centre, RP.centre, 5.72, N.centreP, RP.centreP, 2.6, 5)
  const thirdW = trainWheel(T, N.third, RP.third, 5.12, N.thirdP, RP.thirdP, 5.72, 4)
  const fourthW = trainWheel(F, N.fourth, RP.fourth, 4.42, N.fourthP, RP.fourthP, 5.12, 4)
  mark('centre', centreW, 0, 5.72, 0); mark('third', thirdW, 0, 5.12, 0); mark('fourth', fourthW, 0, 4.42, 0)
  Object.assign(parts, { centreWheel: centreW, thirdWheel: thirdW, fourthWheel: fourthW })

  // ---- Dial: white, black applied indices, minute track ----
  const dial = cyl(14.0, 0.35, M.dial, 7.175, 0, 0, 128)
  layers.dial.add(dial)
  for (let i = 0; i < 60; i++) {
    const th = i * TAU / 60, big = i % 5 === 0
    const offs = i === 0 ? [-0.55, 0.55] : [0]
    for (const o of offs) {
      const b = big ? kit.box(0.7, 0.3, 2.6, M.ink, 0.08) : kit.box(0.14, 0.06, 0.8, M.track, 0.02)
      const r = big ? 11.6 : 13.35, x = r * Math.sin(th) + o * Math.cos(th), z = -r * Math.cos(th) + o * Math.sin(th)
      b.position.set(x, big ? 7.4 : 7.37, z); b.rotation.y = -th
      layers.dial.add(b)
    }
  }
  mark('dial', layers.dial, 0, 7.35, 0)
  parts.dial = dial

  // ---- Hands: black dauphine hour and minute, red seconds ----
  const poly = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s }
  const hand = (shape, y, mat) => { const g = new THREE.Group(); g.position.y = y; const m = slab(shape, 0.12, mat, 0.02); g.add(m); layers.hands.add(g); return g }
  const hourHand = hand(poly([[0, -1.6], [0.7, 0], [0, 7.8], [-0.7, 0]]), 7.66, M.ink)
  const minuteHand = hand(poly([[0, -2.0], [0.55, 0], [0, 12.2], [-0.55, 0]]), 7.92, M.ink)
  const secS = poly([[-0.12, -2.9], [0.12, -2.9], [0.08, 12.9], [-0.08, 12.9]])
  const secondsHand = hand(secS, 8.18, M.seconds)
  const cw = slab(disc(0.55), 0.12, M.seconds, 0.02); cw.position.z = 2.7; secondsHand.add(cw)
  layers.hands.add(cyl(0.8, 0.3, M.ink, 7.52), cyl(0.58, 0.55, M.ink, 7.65), cyl(0.34, 0.85, M.seconds, 7.8), cyl(0.55, 0.18, M.seconds, 8.3))
  mark('hands', layers.hands, 0, 8.0, 0)
  Object.assign(parts, { hourHand, minuteHand, secondsHand })

  // ---- Crystal ----
  const crystal = cyl(15.3, 0.7, M.glass, 9.55, 0, 0, 128)
  crystal.castShadow = false
  layers.crystal.add(crystal)
  mark('crystal', layers.crystal, 0, 9.55, 0)
  parts.crystal = crystal

  // Layer centres ('balance' and 'barrel' are their axes, set above)
  mark('escapement', layers.escapement, (E.x + P.x) / 2, 3.6, (E.z + P.z) / 2)
  mark('train', layers.train, T.x, 5.2, T.z)
  mark('watch', mm, 0, 5, 0)

  // ---- Kinematics ----
  const forkAngle = beta => {
    const b = clamp(beta, -Math.PI / 2, Math.PI / 2)
    return clamp(Math.atan2(-R_PIN * Math.sin(b), L_FORK - R_PIN * Math.cos(b)), -PHI0, PHI0)
  }
  // Escape wheel phase: at beat 0 a tooth tip rests on the locking stone's face
  const stoneAbout = (i, phi) => {
    const s = stoneLocal[i], rho = Math.hypot(s.x, s.z), a = Math.atan2(-s.z, s.x) + forkBase + phi
    const x = P.x + rho * Math.cos(a), z = P.z - rho * Math.sin(a)
    return { d: Math.hypot(x - E.x, z - E.z), a: alpha(E, { x, z }) }
  }
  const phiStart = forkAngle(AMP)
  const s0 = stoneAbout(0, phiStart), s1 = stoneAbout(1, phiStart)
  const lockAtStart = s0.d < s1.d ? 0 : 1
  const E0 = (lockAtStart ? s1 : s0).a - (0.12 + 0.03) / R_ESC
  const HALF = Math.PI / N.escape
  let betaLock = 0
  for (let lo = 0, hi = Math.PI / 2, k = 0; k < 40; k++) { const m = (lo + hi) / 2; Math.abs(forkAngle(m)) < PHI0 - 1e-6 ? (lo = m) : (hi = m); betaLock = hi }
  const LOCK_OFF = Math.acos(-betaLock / AMP) / Math.PI
  // A driver at angle r1 (s1 = its tooth step) and the angle of the wheel it meshes
  const drive = (r1, n1, p1, n2, p2) => {
    const a12 = alpha(p1, p2), s1 = TAU / n1, s2 = TAU / n2
    return a12 + Math.PI - s2 * (0.5 - (a12 - r1) / s1)
  }
  const train = b => {
    const j = Math.floor(b), beta = AMP * Math.cos(Math.PI * b), phi = forkAngle(beta)
    const phiS = forkAngle(AMP * Math.cos(Math.PI * j))
    const prog = clamp((1 - phi / phiS) / 2)
    const rE = E0 + (j + smooth(0.2, 1, prog)) * HALF
    const rF = drive(rE, N.escapeP, E, N.fourth, F)
    const rT = drive(rF, N.fourthP, F, N.third, T)
    const rC = drive(rT, N.thirdP, T, N.centre, C)
    const rB = drive(rC, N.centreP, C, N.barrel, B)
    return { beta, phi, rE, rF, rT, rC, rB }
  }
  const zero = train(0)
  // The hands read 10:10:35 at beat 0
  const H0 = { h: (10 + 10.58 / 60) / 12 * TAU, m: 10.58 / 60 * TAU, s: 35 / 60 * TAU }
  const ARBOR_TURNS = 2.2, WIND_RATIO = WIND_R / 0.8

  const state = {}
  function pose({ beats = 0, wind = 0.35, energy = 0, explode = 0, gap = 0.012, glow = 0 } = {}) {
    const k = train(beats)
    balPivot.rotation.y = balBase + k.beta
    fork.rotation.y = forkBase + k.phi
    escPivot.rotation.y = k.rE
    fourthW.rotation.y = k.rF; thirdW.rotation.y = k.rT; centreW.rotation.y = k.rC; drum.rotation.y = k.rB
    secondsHand.rotation.y = -H0.s + (k.rF - zero.rF)
    minuteHand.rotation.y = -H0.m + (k.rC - zero.rC)
    hourHand.rotation.y = -H0.h + (k.rC - zero.rC) / 12

    // Hairspring: inner end turns with the balance, outer end held by the stud; it breathes
    const bt = k.beta
    hair.set(u => {
      const v = u * (HS.turns + 0.15)
      const f = Math.min(v / HS.turns, 1)
      const r = HS.rin + (HS.rout - HS.rin) * f - 0.1 * bt * Math.sin(Math.PI * f) + (v > HS.turns ? (v - HS.turns) * 1.0 : 0)
      return [r, HS.out + TAU * v + bt * (1 - f)]
    }, 2.95, 3.13)

    // Mainspring: slack coils lie against the drum wall, wound ones wrap the arbor
    const w = clamp(wind), arborA = w * ARBOR_TURNS * TAU
    arbor.rotation.y = arborA
    crown.rotation.x = -arborA * WIND_RATIO
    const rel = arborA - k.rB, NS = 13, p = 0.12, r0 = 0.62, RW = 4.72
    spring.set(u => {
      const v = -0.4 + u * (NS + 0.8)
      const rWound = v < 0 ? r0 : v <= NS ? r0 + v * p : lerp(r0 + NS * p, RW, (v - NS) / 0.4)
      const rSlack = v > NS ? RW : v >= 0 ? RW - (NS - v) * p : lerp(r0, RW - NS * p, (v + 0.4) / 0.4)
      return [lerp(rSlack, rWound, w), TAU * v + rel * (1 - clamp(v / NS))]
    }, 2.75, 4.15)
    M.spring.emissiveIntensity = clamp(energy) * 0.75
    M.ruby.emissiveIntensity = 0.3 + clamp(glow) * 1.6

    // Exploded view: each layer rises by its rank, the top ones first
    const span = RANK.crystal - RANK.caseback, gapMM = gap / MM, ex = {}
    for (const n of LAYERS) {
      const o = (RANK.crystal - RANK[n]) / span
      const pe = kit.ease((clamp(explode) - 0.4 * o) / 0.6)
      layers[n].position.y = pe * RANK[n] * gapMM
      ex[n] = pe
    }

    const sinceLock = beats - LOCK_OFF
    Object.assign(state, {
      balance: k.beta, fork: k.phi, ticks: Math.floor(sinceLock) + 1, sinceTick: sinceLock - Math.floor(sinceLock),
      lockStone: k.phi * phiStart > 0 ? lockAtStart : 1 - lockAtStart, explodeP: ex
    })
    return state
  }

  function at(name, off = [0, 0, 0]) {
    root.updateWorldMatrix(true, true)
    return marks[name].localToWorld(new THREE.Vector3(...off)).toArray()
  }

  pose({})
  return { root, layers, parts, pose, at, state }
}
