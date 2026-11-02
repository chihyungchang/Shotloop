// world/lock.js: the film's pin tumbler lock, its door and its look.
//
// Metres, real sizes: a 12.6 mm brass plug, 2.9 mm pins on a 4 mm pitch, a 30 mm
// cylinder. Lock-local axes: X along the plug (the key goes in from -X, so it
// travels left to right on screen), Y up through the pins, Z out of the cut
// face. The lock is a cutaway cut on the plane z = 0 with the back half kept
// (pins and key whole, half proud of the cut): a camera on +Z looking -Z sees
// it square on. Its axis sits LOCK.Y above the studio floor.
//
//   import { setLook, buildLock, buildDoor, LOCK, PAL, fitWidth, tag } from '../world/lock.js'
//
// setLook(kit, { size = 0.05, fade = 1.2, env = 0.55, key = 2.2, rim = PAL.warm,
//                kick = 1.1, floor = true, bloom = 0.12, exposure = 1 })
//     First in setup, after kit.init. Dark room: studio key from front-right,
//     warm rim from behind, a warm kick light grazing the cut face from the
//     key side (the glow along the brass), dark matte floor. Returns
//     { studio, kick, floor }.
// const lock = buildLock(kit, { y = LOCK.Y })   in setup; adds lock.root to kit.scene.
// lock.pose(s)   each frame, before the camera. Every field is optional:
//     key: 'right' | 'wrong' | null (default 'right'); keyX: metres, 0 = fully
//       in (default 0), LOCK.KEY_OUT = tip just left of the keyway. The pins
//       ride the key's real profile under each pin (closed form, no state).
//     lift: number or [5], extra metres on each stack (springs squeeze): drops.
//     turn: plug angle in radians about X; + unlocks: the copper pins swing
//       toward +Z and the cam drives the bolt back along -Z by THROW·sin(turn).
//       bolt: extra metres on the bolt (overlap, settle).
//     housing: 0..1 opacity of the steel (1). shell: 0..1 glass front half of
//       the housing (0); plugShell: same for the plug (0). wire: 0..1 thin
//       wireframe of the housing (0). Shells hide the cut face's occlusion:
//       keep them low.
//     shear: 0..1 glow of the cyan shear line (1); shearDraw: 0..1 drawn from left (1).
//     split: number or [5], 0..1 cyan flash ring at each split (copper|blue).
//     flag: number or [5], 0..1 a key pin turns red (the wrong one).
//     outline: 0..1 amber glow on the right key's ridge and the five pin heights.
//     mech: show the cam, the bolt and the strike plate it passes through
//       (false). Seen from a three-quarter view on the key side (camera at
//       x < 0, z > 0) the bolt slides back right to left.
// lock.at(name) / lock.world([x, y, z]): a named or lock-local point as a world
//     Vector3 (kit.look, kit.label, kit.screen). Names: center, shearLeft,
//     shearMid, shearRight, keyway, cam, boltEnd, top, bottom.
// lock.split(i): world point of stack i's split as last posed.
// lock.keyTop(name, u): the key's ridge height at key-local u (for drawing).
// Objects for kit.keep(obj, name): lock.root, .housing, .plug, .bolt, .strike,
//     .keys.right / .keys.wrong, .pins.key[i] / .driver[i] / .springs[i] / .splits[i],
//     .shearLine, .wire, .outlines.key / .outlines.pins; materials in lock.mats.
// buildDoor(kit, lock, { width = 0.85 })   shot 06: a 45 mm varnished door round
//     the lock (axis 1 m up, door edge 35 mm off the axis) with a cutaway
//     pocket so the lock shows, a jamb with the strike, a dark wall round the
//     doorway and a warm room behind it (+X). Keep the camera on the outside
//     (x < -0.05). The door reaches below the floor: setLook({ floor: false,
//     fade: 4, size: 0.3 }). door.pose({ open: radians (+ swings the edge into
//     the room), spill: 0..1 the warm light }). Pull the bolt back first.
// fitWidth(w, mm, fill = 0.85): camera distance at which w metres fill the frame width.
//     Square on, key at KEY_OUT (lock + key ≈ 0.09 m wide):
//     kit.look([0, LOCK.CENTER[1], fitWidth(0.09, 50)], LOCK.CENTER, 50); the lock
//     alone is 0.03 m wide and 0.031 m tall (y -0.0115…0.019 about the axis).
// tag(kit, at, text, color = PAL.shear, opts): a kit.label chip with a coloured dot.
// PAL: the palette (css colours); PAL.*Text are lighter versions for type.

export const PAL = {
  bg: '#05070b', brass: '#d0a24c', steel: '#9ea7b1', key: '#cdd1d6', driver: '#2f6bff', copper: '#e08a5a',
  spring: '#cfd5dc', bolt: '#bfc6cf', shear: '#36e2ff', wrong: '#ff4d55', warm: '#ffb36b', wood: '#4e3626',
  jamb: '#2a2d34', wall: '#1b1e24', driverText: '#7ea4ff', copperText: '#f0a37a', brassText: '#e8c477'
}

// ---- Sizes (lock-local metres) ----
const L = 0.030 // cylinder length, x from -L/2 (key side) to L/2
const RP = 0.0063, RPH = 0.00642, RH = 0.0115 // plug radius, housing bore, housing outer
const TD = 0.0055, TOP = 0.019, CH_TOP = 0.0175 // tower depth behind the cut, tower top, chamber top
const PIN_R = 0.00145, CW = PIN_R + 0.00008, PITCH = 0.004
const PIN_X = [-0.008, -0.004, 0, 0.004, 0.008]
const WD = PIN_R + 0.00005 // depth of the open chambers and keyway behind the cut face
const KW_BOT = -0.0046, KW_TOP = 0.0026, KW_END = 0.014 // keyway
const SHEAR_Y = (RP + RPH) / 2
const REST = -0.002 // key pin bottom with no key under it
const DP = 0.0055 // driver pin length
const SPRING_H = 0.01, SPRING_R = 0.00112, SPRING_TURNS = 7
// Key: ridge top, cut step, flat of a cut; shoulder, tip, tip height, blade bottom (key-local u)
const Y_TOP = 0.0022, STEP = 0.0008, FLAT = 0.0006
const SH = -0.0152, TIP = 0.013, TIP_Y = -0.0022, BOT = -0.0042
const RIGHT = [1, 4, 2, 3, 0], WRONG = [1, 4, 0, 3, 0] // cut depths in steps
const cutsOf = d => d.map(k => Y_TOP - k * STEP)
const CUTS = { right: cutsOf(RIGHT), wrong: cutsOf(WRONG) }
// Key pin lengths: the right key puts every split exactly on the plug's edge
const KP = CUTS.right.map(h => RP - h)
const THROW = 0.0125 // cam radius = bolt travel
export const LOCK_Y = 0.035

export const LOCK = {
  Y: LOCK_Y, CENTER: [0, LOCK_Y + 0.0037, 0], L, PLUG_R: RP, HOUSING_R: RH, TOP, PIN_R, PIN_X, PITCH,
  SHEAR_Y, KEY_OUT: -0.0315, KEY_LEN: 0.0525, THROW, RIGHT, WRONG
}

const POINTS = {
  center: [0, 0.0037, 0], shearLeft: [-L / 2, SHEAR_Y, 0.0002], shearMid: [0, SHEAR_Y, 0.0002],
  shearRight: [L / 2, SHEAR_Y, 0.0002], keyway: [-L / 2, -0.001, 0], cam: [0.0167, 0, 0],
  boltEnd: [0.0195, -0.0165, 0.047], top: [0, TOP, 0], bottom: [0, -RH, 0]
}

// The key's ridge height at key-local u (-Infinity off the blade): five
// flat-bottomed 45° cuts, capped by the uncut blade and the tip's ramp
function keyTop(h, u) {
  if (u < SH - 1e-9 || u > TIP + 1e-9) return -Infinity
  let y = Math.min(Y_TOP, TIP_Y + (TIP - u))
  for (let i = 0; i < 5; i++) y = Math.min(y, h[i] + Math.max(0, Math.abs(u - PIN_X[i]) - FLAT / 2))
  return y
}

const per = (v, i) => (Array.isArray(v) ? v[i] ?? 0 : v ?? 0)

export const fitWidth = (w, mm, fill = 0.85) => (w / fill / 2) * mm / 10.125

export function tag(kit, at, text, color = PAL.shear, opts = {}) {
  const dot = '<span style="display:inline-block;width:10px;height:10px;margin-right:10px;border-radius:50%;vertical-align:2px;background:' +
    color + ';box-shadow:0 0 10px ' + color + '"></span>'
  kit.label(at, dot + text, opts)
}

// Smooth normals across faces less than deg apart, hard edges elsewhere
// (extrusions come with flat normals)
function crease(THREE, g, deg = 35) {
  g.computeVertexNormals()
  const p = g.attributes.position, n = g.attributes.normal, c = Math.cos(deg * Math.PI / 180)
  const key = i => Math.round(p.getX(i) * 1e6) + ',' + Math.round(p.getY(i) * 1e6) + ',' + Math.round(p.getZ(i) * 1e6)
  const groups = new Map()
  for (let i = 0; i < p.count; i++) {
    const k = key(i)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(i)
  }
  const out = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    let x = 0, y = 0, z = 0
    for (const j of groups.get(key(i))) {
      if (n.getX(i) * n.getX(j) + n.getY(i) * n.getY(j) + n.getZ(i) * n.getZ(j) < c) continue
      x += n.getX(j); y += n.getY(j); z += n.getZ(j)
    }
    const l = Math.hypot(x, y, z) || 1
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3))
  return g
}

// Points of an arc in the (depth d, y) section plane, angles from +d
const arc = (r, a0, a1, n = 48) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + (a1 - a0) * i / n
  return [r * Math.cos(a), r * Math.sin(a)]
})
// The section strip 0 <= d <= WD (just behind the cut face) between lo(d) and hi(d)
function strip(lo, hi, n = 6) {
  const ds = Array.from({ length: n + 1 }, (_, i) => WD * i / n)
  return [...ds.map(d => [d, lo(d)]), ...[...ds].reverse().map(d => [d, hi(d)])]
}
const circ = r => d => Math.sqrt(r * r - d * d)
// x ranges of solid between the five chambers
const EDGES = [-L / 2, ...PIN_X.flatMap(x => [x - CW, x + CW]), L / 2]
const BETWEEN = [0, 2, 4, 6, 8, 10].map(i => [EDGES[i], EDGES[i + 1]])

function fade(mat, o) {
  const t = o < 0.999
  if (mat.transparent !== t) {
    mat.transparent = t
    mat.depthWrite = !t
    mat.needsUpdate = true
  }
  mat.opacity = o
}

export function setLook(kit, { size = 0.05, fade: far = 1.2, env = 0.55, key = 2.2, rim = PAL.warm, kick = 1.1, floor = true, bloom = 0.12, exposure = 1 } = {}) {
  const { THREE, scene } = kit
  scene.background = new THREE.Color(PAL.bg)
  const studio = kit.studio({ size, key, rim, fade: far, floor: '#0b0c10' })
  scene.environmentIntensity = env
  // Matte floor: no grey sheen at grazing angles
  const fl = studio.children.find(o => o.isMesh)
  fl.material = new THREE.MeshLambertMaterial({ color: '#0b0c10' })
  fl.receiveShadow = true
  fl.visible = floor
  // Warm light from the key side, grazing the cut face and the brass
  const k = new THREE.DirectionalLight('#ffa65a', kick)
  k.position.set(-1, 0.35, 0.45)
  scene.add(k)
  kit.post({ bloom, exposure, vignette: 1.15, ao: 0.6, grain: 0.035 })
  return { studio, kick: k, floor: fl }
}

export function buildLock(kit, { y = LOCK_Y } = {}) {
  const { THREE } = kit
  const V = (a, b) => new THREE.Vector2(a, b)
  const root = new THREE.Group(), housing = new THREE.Group(), plug = new THREE.Group(), bolt = new THREE.Group()
  root.name = 'lock'
  root.position.set(0, y, 0)
  root.add(housing, plug, bolt)
  kit.scene.add(root)

  const brass = kit.metal(PAL.brass, 0.3)
  const steel = kit.metal(PAL.steel, 0.36)
  const keyMat = kit.metal(PAL.key, 0.26)
  const driverMat = new THREE.MeshPhysicalMaterial({ color: PAL.driver, metalness: 0.7, roughness: 0.3, clearcoat: 0.5 })
  const springMat = kit.metal(PAL.spring, 0.32)
  const boltMat = kit.metal(PAL.bolt, 0.3)
  const ghost = c => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.2, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false })
  const housingGhost = ghost('#cfe2ff'), plugGhost = ghost('#ffd98a')
  const shearMat = kit.glow(PAL.shear, 2.5)
  const outlineMat = kit.glow(PAL.warm, 3)
  outlineMat.transparent = true
  const copper = new THREE.Color(PAL.copper), red = new THREE.Color(PAL.wrong)

  // A section (d, y) extruded along x from x0 to x1; d is depth behind the cut (z = -d)
  const prism = (pts, x0, x1, mat) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([d, yy]) => V(d, yy))), { depth: x1 - x0, bevelEnabled: false })
    g.rotateY(Math.PI / 2)
    g.translate(x0, 0, 0)
    return kit.mesh(crease(THREE, g), mat)
  }

  // Plug: the back segment, then the strip at the cut with the keyway and chambers open
  const a0 = Math.acos(WD / RP)
  const plugParts = [
    prism(arc(RP, a0, -a0, 64), -L / 2, L / 2, brass),
    prism(strip(d => -circ(RP)(d), () => KW_BOT), -L / 2, L / 2, brass),
    prism(strip(() => KW_BOT, () => KW_TOP), KW_END, L / 2, brass),
    ...BETWEEN.map(([x0, x1]) => prism(strip(() => KW_TOP, circ(RP)), x0, x1, brass))
  ]
  plug.add(...plugParts)
  const plugShell = prism(arc(RP, Math.PI / 2, 1.5 * Math.PI, 64), -L / 2, L / 2, plugGhost)
  plugShell.castShadow = false
  plug.add(plugShell)

  // Housing: a C round the plug with the pin tower on top, chambers open at the cut
  const aH = Math.acos(WD / RH), aT = Math.acos(TD / RH), aP = Math.acos(WD / RPH)
  const back = prism([...arc(RH, -aH, aT), [TD, TOP], [WD, TOP], ...arc(RPH, aP, -aP, 64)], -L / 2, L / 2, steel)
  const housingParts = [
    back,
    prism(strip(d => -circ(RH)(d), d => -circ(RPH)(d)), -L / 2, L / 2, steel),
    prism(strip(() => CH_TOP, () => TOP), -L / 2, L / 2, steel),
    ...BETWEEN.map(([x0, x1]) => prism(strip(circ(RPH), () => CH_TOP), x0, x1, steel))
  ]
  housing.add(...housingParts)
  const shellPts = [...arc(RH, -Math.PI / 2, aT), [TD, TOP], [0, TOP], ...arc(RPH, Math.PI / 2, -Math.PI / 2, 64)].map(([d, yy]) => [-d, yy])
  const housingShell = prism(shellPts, -L / 2, L / 2, housingGhost)
  housingShell.castShadow = false
  housing.add(housingShell)

  // Wireframe: the housing's outlines and the chambers on the cut face
  const seg = []
  for (const m of [back, housingShell]) {
    const e = new THREE.EdgesGeometry(m.geometry, 30).attributes.position
    for (let i = 0; i < e.count; i++) seg.push(e.getX(i), e.getY(i), e.getZ(i))
  }
  for (const x of PIN_X) {
    const z = 0.0001
    seg.push(x - CW, RPH, z, x - CW, CH_TOP, z, x + CW, RPH, z, x + CW, CH_TOP, z, x - CW, CH_TOP, z, x + CW, CH_TOP, z)
  }
  const wg = new THREE.BufferGeometry()
  wg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
  const wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: 0, depthWrite: false }))
  housing.add(wire)

  // The shear line: the gap between plug and housing, a thin cyan glow 0.15 mm proud of the cut
  const sg = new THREE.BoxGeometry(L, 0.00035, 0.0005)
  sg.translate(L / 2, 0, -0.0001)
  const shearLine = new THREE.Mesh(sg, shearMat)
  shearLine.position.set(-L / 2, SHEAR_Y, 0)
  housing.add(shearLine)

  // Pins: copper key pins ride in the plug (and turn with it), blue drivers and
  // springs stay in the housing; each lathe has its origin at its bottom
  const lathe = pts => new THREE.LatheGeometry(pts.map(([r, yy]) => V(r, yy)), 48)
  const c = 0.00015
  const driverGeo = lathe([[0, 0], [PIN_R - c, 0], [PIN_R, c], [PIN_R, DP - c], [PIN_R - c, DP], [0, DP]])
  class Helix extends THREE.Curve {
    getPoint(t, v = new THREE.Vector3()) {
      const a = t * SPRING_TURNS * Math.PI * 2
      return v.set(SPRING_R * Math.cos(a), SPRING_H * t, SPRING_R * Math.sin(a))
    }
  }
  const springGeo = new THREE.TubeGeometry(new Helix(), 360, 0.0002, 8, false)
  const ringGeo = new THREE.TorusGeometry(PIN_R + 0.00007, 0.00011, 12, 48)
  const keyPins = [], drivers = [], springs = [], splits = [], keyMats = [], splitMats = []
  PIN_X.forEach((x, i) => {
    const km = kit.metal(PAL.copper, 0.3)
    const kp = kit.mesh(lathe([[0, 0], [PIN_R * 0.45, 0.00008], [PIN_R * 0.8, 0.0003], [PIN_R, 0.0007], [PIN_R, KP[i] - c], [PIN_R - c, KP[i]], [0, KP[i]]]), km)
    kp.position.x = x
    const dr = kit.mesh(driverGeo, driverMat)
    dr.position.x = x
    const sp = kit.mesh(springGeo, springMat)
    sp.position.x = x
    const sm = kit.glow(PAL.shear, 0)
    const ring = new THREE.Mesh(ringGeo, sm)
    ring.rotation.x = Math.PI / 2
    ring.position.x = x
    plug.add(kp, ring)
    housing.add(dr, sp)
    keyPins.push(kp); drivers.push(dr); springs.push(sp); splits.push(ring); keyMats.push(km); splitMats.push(sm)
  })

  // Keys: the blade's top edge is keyTop() exactly, so the pins ride what is drawn
  const makeKey = (name) => {
    const h = CUTS[name], k = new THREE.Group()
    k.name = 'key-' + name
    const pts = [[SH - 0.0006, BOT], [TIP - 0.0012, BOT], [TIP, -0.003]]
    const n = Math.round((TIP - SH) / 0.00005)
    for (let i = 0; i <= n; i++) {
      const u = TIP - (TIP - SH) * i / n
      pts.push([u, keyTop(h, u)])
    }
    pts.push([SH - 0.0006, Y_TOP])
    const bg = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, b]) => V(a, b))), { depth: 0.002, bevelEnabled: false })
    bg.translate(0, 0, -0.001)
    k.add(kit.mesh(bg, keyMat))
    // Bow: a neck from the shoulder into a round head with a hole
    const cx = -0.028, cy = -0.0013, R = 0.0115, NX = -0.0156, NT = 0.0036, NB = -0.0062
    const aa = Math.asin((NB - cy) / R)
    const bow = [[NX, NT], [NX, NB]]
    for (let i = 0; i <= 64; i++) {
      const a = aa - (2 * Math.PI + 2 * aa) * i / 64
      bow.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
    }
    const shape = new THREE.Shape(bow.map(([a, b]) => V(a, b)))
    const hole = new THREE.Path()
    hole.absarc(-0.0335, cy, 0.0028, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const wg2 = new THREE.ExtrudeGeometry(shape, { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.0003, bevelSegments: 3, curveSegments: 32 })
    wg2.translate(0, 0, -0.0011)
    k.add(kit.mesh(crease(THREE, wg2, 40), keyMat))
    plug.add(k)
    return k
  }
  const keys = { right: makeKey('right'), wrong: makeKey('wrong') }

  // Outlines (shot 06): amber along the right key's ridge, and a bar at each
  // key pin's bottom for the right key: the two patterns match
  const ridge = []
  for (let i = 0; i <= 140; i++) {
    const u = SH + (TIP - SH) * i / 140
    ridge.push([u, keyTop(CUTS.right, u), 0.0012])
  }
  const keyLine = kit.tube(ridge, 0.00012, outlineMat)
  keyLine.castShadow = false
  keys.right.add(keyLine)
  const pinBars = new THREE.Group()
  const barGeo = new THREE.BoxGeometry(2 * PIN_R + 0.0004, 0.00024, 0.00024)
  PIN_X.forEach((x, i) => {
    const b = new THREE.Mesh(barGeo, outlineMat)
    b.position.set(x, CUTS.right[i], PIN_R + 0.0002)
    pinBars.add(b)
  })
  plug.add(pinBars)

  // Cam on the plug's back end, and the bolt it drives along Z (toward the door edge)
  const cam = kit.cylinder(0.0045, 0.003, brass)
  cam.rotation.z = Math.PI / 2
  cam.position.x = 0.0167
  const lobe = kit.box(0.003, 0.0085, 0.003, brass)
  lobe.position.set(0.0167, -0.0083, 0)
  plug.add(cam, lobe)
  const body = kit.box(0.008, 0.008, 0.052, boltMat)
  body.position.set(0.0195, -0.0165, 0.021)
  const t1 = kit.box(0.008, 0.0018, 0.0016, boltMat)
  t1.position.set(0.0195, -0.0116, 0.0027)
  const t2 = t1.clone()
  t2.position.z = -0.0027
  bolt.add(body, t1, t2)
  // Strike plate the locked bolt passes through (35 mm out, where the door's jamb is)
  const strike = new THREE.Group()
  for (const [x0, x1, y0, y1] of [[0.0115, 0.0275, -0.012, -0.008], [0.0115, 0.0275, -0.025, -0.021], [0.0115, 0.015, -0.021, -0.012], [0.024, 0.0275, -0.021, -0.012]]) {
    const b = kit.box(x1 - x0, y1 - y0, 0.0008, boltMat, 0.0002)
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.0381)
    strike.add(b)
  }
  root.add(strike)

  const state = { split: KP.map(k => REST + k) }

  function pose(s = {}) {
    const name = s.key === undefined ? 'right' : s.key, keyX = s.keyX ?? 0
    for (const k of ['right', 'wrong']) {
      keys[k].visible = name === k
      keys[k].position.x = keyX
    }
    const h = name ? CUTS[name] : null
    PIN_X.forEach((x, i) => {
      let yb = REST
      if (h) yb = Math.max(REST, keyTop(h, x - keyX))
      yb += per(s.lift, i)
      const top = yb + KP[i]
      keyPins[i].position.y = yb
      drivers[i].position.y = top
      springs[i].position.y = top + DP
      springs[i].scale.y = Math.max(0.05, (CH_TOP - top - DP) / SPRING_H)
      splits[i].position.y = top
      const f = per(s.split, i)
      splits[i].visible = f > 0.002
      splitMats[i].emissiveIntensity = 3.5 * Math.min(1, f)
      const r = per(s.flag, i)
      keyMats[i].color.copy(copper).lerp(red, r)
      keyMats[i].emissive.copy(red)
      keyMats[i].emissiveIntensity = 0.9 * r
      state.split[i] = top
    })

    const turn = s.turn ?? 0
    plug.rotation.x = turn
    const mech = !!s.mech
    cam.visible = lobe.visible = bolt.visible = strike.visible = mech
    bolt.position.z = -THROW * Math.sin(Math.min(Math.PI / 2, Math.max(0, turn))) + (s.bolt ?? 0)

    const ho = s.housing ?? 1
    fade(steel, ho)
    for (const m of housingParts) {
      m.visible = ho > 0.003
      m.castShadow = ho > 0.5
    }
    const sh = s.shell ?? 0, ps = s.plugShell ?? 0
    housingGhost.opacity = 0.35 * sh
    housingShell.visible = sh > 0.003
    plugGhost.opacity = 0.35 * ps
    plugShell.visible = ps > 0.003
    const w = s.wire ?? 0
    wire.material.opacity = 0.7 * w
    wire.visible = w > 0.003

    const glow = s.shear ?? 1, draw = s.shearDraw ?? 1
    shearMat.emissiveIntensity = 2.5 * glow
    shearLine.visible = glow > 0.003 && draw > 0.003
    shearLine.scale.x = Math.max(0.001, Math.min(1, draw))

    const o = s.outline ?? 0
    outlineMat.opacity = Math.min(1, o)
    outlineMat.emissiveIntensity = 3 * Math.min(1, o)
    keyLine.visible = pinBars.visible = o > 0.003
  }
  pose()

  const world = p => {
    root.updateWorldMatrix(true, false)
    return root.localToWorld(new THREE.Vector3(...p))
  }
  const at = name => world(POINTS[name])
  const split = i => {
    plug.updateWorldMatrix(true, false)
    return plug.localToWorld(new THREE.Vector3(PIN_X[i], state.split[i], PIN_R))
  }

  return {
    root, housing, plug, bolt, strike, keys, wire, shearLine,
    pins: { key: keyPins, driver: drivers, springs, splits },
    outlines: { key: keyLine, pins: pinBars },
    mats: { brass, steel, key: keyMat, driver: driverMat, keyPins: keyMats, spring: springMat, bolt: boltMat, shear: shearMat, splits: splitMats, outline: outlineMat, housingGhost, plugGhost },
    pose, world, at, split, state,
    keyTop: (name, u) => keyTop(CUTS[name], u)
  }
}

export function buildDoor(kit, lock, { width = 0.85 } = {}) {
  const { THREE } = kit
  // Lock-local: door faces at X0 (outside, key side) and X1 (room side), edge at EDGE
  const X0 = -0.016, X1 = 0.029, T = X1 - X0, EDGE = 0.035, P = 0.032, Z0 = -0.03
  const J0 = 0.0385, J1 = 0.0585, YLO = -1, YHI = 1, ZL = EDGE - width
  const root = new THREE.Group()
  root.position.copy(lock.root.position)
  kit.scene.add(root)
  // The hinge on the room side of the far edge; frame is the lock-local frame riding the door
  const pivot = new THREE.Group()
  pivot.position.set(X1, 0, ZL)
  const frame = new THREE.Group()
  frame.position.set(-X1, 0, -ZL)
  root.add(pivot)
  pivot.add(frame)
  lock.root.removeFromParent()
  lock.root.position.set(0, 0, 0)
  frame.add(lock.root)

  // The slab, with a cutaway pocket round the lock open to the edge and both faces
  const B = 0.001
  const shape = new THREE.Shape([[ZL, YLO], [EDGE - B, YLO], [EDGE - B, -P], [Z0, -P], [Z0, P], [EDGE - B, P], [EDGE - B, YHI], [ZL, YHI]]
    .map(([a, b]) => new THREE.Vector2(a, b)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: T - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 2 })
  g.rotateY(-Math.PI / 2)
  g.translate(X1 - B, 0, 0)
  const slab = kit.mesh(crease(THREE, g, 40), kit.plastic(PAL.wood, 0.55))
  frame.add(slab)

  // Brass faceplate on the edge above and below the pocket; the lock's strike
  // stays on the jamb when the door swings
  const brass = kit.metal(PAL.brass, 0.3)
  for (const s of [1, -1]) {
    const fp = kit.box(0.016, 0.07, 0.0014, brass)
    fp.position.set(0.0195, s * (P + 0.036), EDGE + 0.0008)
    frame.add(fp)
  }
  root.attach(lock.strike)

  // Jamb, and a dark wall round the doorway (header above, both sides)
  const jm = kit.matte(PAL.jamb, 0.7), wm = kit.matte(PAL.wall, 0.9), jw = T + 0.024, xc = (X0 + X1) / 2
  const jamb = kit.box(jw, YHI - YLO, J1 - J0, jm, 0.001)
  jamb.position.set(xc, 0, (J0 + J1) / 2)
  const wallA = kit.box(jw, YHI - YLO + 0.4, 1.5, wm, 0.002)
  wallA.position.set(xc, 0.2, J1 + 0.75)
  const wallB = kit.box(jw, YHI - YLO + 0.4, 1.5, wm, 0.002)
  wallB.position.set(xc, 0.2, ZL - 0.003 - 0.75)
  const header = kit.box(jw, 0.4 - 0.003, J1 - ZL + 0.003, wm, 0.002)
  header.position.set(xc, YHI + 0.003 + (0.4 - 0.003) / 2, (J1 + ZL - 0.003) / 2)
  root.add(jamb, wallA, wallB, header)

  // The warm room behind the door: a lit far wall and a lamp
  const warm = new THREE.Color(PAL.warm)
  const glowMat = new THREE.MeshBasicMaterial({ color: PAL.warm, fog: false })
  const room = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), glowMat)
  room.rotation.y = -Math.PI / 2
  room.position.set(0.9, 0, -0.4)
  const light = new THREE.PointLight(PAL.warm, 0, 0, 2)
  light.position.set(0.35, 0.12, 0.05)
  root.add(room, light)

  function pose({ open = 0, spill = 0 } = {}) {
    pivot.rotation.y = open
    glowMat.color.copy(warm).multiplyScalar(1.3 * spill)
    room.visible = spill > 0.003
    light.intensity = 0.5 * spill
  }
  pose()
  return { root, pivot, frame, slab, jamb, room, light, pose }
}
