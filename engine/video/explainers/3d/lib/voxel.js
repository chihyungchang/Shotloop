// Voxel props for the 3D explainer track (see ../README.md, "Art
// direction: voxel diorama"). Everything is built from boxes with flat
// colours; one voxel is UNIT world units (10 cm), so a person is about
// 1.8 m. Original designs: blocky is a style, nothing here copies a game.
//
// Each builder returns a THREE.Group (plus handles for anything that
// animates). Nothing here animates by itself: episodes drive the handles
// from render(t).

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const UNIT = 0.1

// Seeded random for anything procedural (terrain, windows, fish)
export function seeded(seed = 1) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

const mats = new Map()
/** A flat-shaded material per colour; `glow` makes it emissive. */
export function mat(color, { glow = 0, opacity = 1 } = {}) {
  const key = `${color}|${glow}|${opacity}`
  if (!mats.has(key)) {
    const c = new THREE.Color(color)
    mats.set(
      key,
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: true,
        emissive: glow ? c : 0x000000,
        emissiveIntensity: glow,
        transparent: opacity < 1,
        opacity
      })
    )
  }
  return mats.get(key)
}

const shadows = o => {
  o.traverse(m => {
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
    }
  })
  return o
}

/**
 * A model from boxes in voxel units: [x, y, z, w, h, d, colour, glow?].
 * (x, y, z) is the box's min corner. Boxes of one colour merge into one
 * mesh, so a prop of hundreds of voxels is a handful of draw calls.
 */
export function boxes(parts, unit = UNIT) {
  const byKey = new Map()
  for (const [x, y, z, w, h, d, color, glow = 0] of parts) {
    const g = new THREE.BoxGeometry(w * unit, h * unit, d * unit)
    g.translate((x + w / 2) * unit, (y + h / 2) * unit, (z + d / 2) * unit)
    const key = `${color}|${glow}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(g)
  }
  const group = new THREE.Group()
  for (const [key, geos] of byKey) {
    const [color, glow] = key.split('|')
    group.add(new THREE.Mesh(mergeGeometries(geos), mat(color, { glow: Number(glow) })))
  }
  return shadows(group)
}

/** A text panel (sign, label) as a plane with a canvas texture. */
export function sign(text, { width = 1.6, height = 0.5, bg = '#1c2333', fg = '#ffffff', font = '800 72px Archivo', glow = false } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: Math.round((512 * height) / width) })
  const x = c.getContext('2d')
  x.fillStyle = bg
  x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = fg
  x.font = font
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(text, c.width / 2, c.height / 2 + 4)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    glow ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
  )
  return m
}

/**
 * A person, sitting or standing. Joints are groups you can rotate:
 * head, armL, armR (at the shoulders), legL, legR (at the hips).
 */
export function person({ shirt = '#3b6fd8', pants = '#2b3442', skin = '#e8b48c', hair = '#3a2a20', sitting = false } = {}) {
  const group = new THREE.Group()
  const limb = (color, w, h, d, sleeve) =>
    boxes([
      [-w / 2, -h, -d / 2, w, h, d, color],
      ...(sleeve ? [[-w / 2 - 0.01, -sleeve, -d / 2 - 0.01, w + 0.02, sleeve, d + 0.02, shirt]] : [])
    ])
  // Legs 0–0.6 m, body 0.6–1.2 m, head 1.2–1.6 m
  const body = boxes([[-2, 0, -1, 4, 6, 2, shirt]])
  body.position.y = 0.6
  const head = new THREE.Group()
  head.add(
    boxes([
      [-2, 0, -2, 4, 4, 4, skin],
      [-2.1, 3, -2.1, 4.2, 1.2, 4.2, hair],
      [-2.1, 1.4, -2.1, 4.2, 1.8, 1.2, hair],
      [-1.3, 1.6, 1.95, 0.7, 0.7, 0.2, '#1d1d1d'],
      [0.6, 1.6, 1.95, 0.7, 0.7, 0.2, '#1d1d1d']
    ])
  )
  head.position.y = 1.2
  const armL = new THREE.Group()
  armL.add(limb(skin, 1.6, 6, 1.6, 2.4))
  armL.position.set(-0.28, 1.17, 0)
  const armR = new THREE.Group()
  armR.add(limb(skin, 1.6, 6, 1.6, 2.4))
  armR.position.set(0.28, 1.17, 0)
  const legL = new THREE.Group()
  legL.add(limb(pants, 1.9, 6, 1.9))
  legL.position.set(-0.1, 0.6, 0)
  const legR = new THREE.Group()
  legR.add(limb(pants, 1.9, 6, 1.9))
  legR.position.set(0.1, 0.6, 0)
  if (sitting) {
    legL.rotation.x = legR.rotation.x = -Math.PI / 2
    // Hips onto a 0.5 m seat
    group.position.y = -0.08
  }
  group.add(body, head, armL, armR, legL, legR)
  return { group, head, armL, armR, legL, legR }
}

/** Arms forward over a keyboard, fingers going; `amount` 0..1 blends in. */
export function typing(p, t, amount = 1) {
  const reach = -1.25 * amount
  p.armL.rotation.x = reach + Math.sin(t * 22) * 0.06 * amount
  p.armR.rotation.x = reach + Math.sin(t * 19 + 1) * 0.06 * amount
  p.head.rotation.x = 0.12 * amount
}

export function desk() {
  return boxes([
    [-8, 7, -4, 16, 0.6, 8, '#a0764e'],
    [-7.5, 0, -3.5, 1, 7, 1, '#7d5a3a'],
    [6.5, 0, -3.5, 1, 7, 1, '#7d5a3a'],
    [-7.5, 0, 2.5, 1, 7, 1, '#7d5a3a'],
    [6.5, 0, 2.5, 1, 7, 1, '#7d5a3a']
  ])
}

export function chair() {
  return boxes([
    [-2.2, 4.2, -2.2, 4.4, 0.6, 4.4, '#30384a'],
    [-2.2, 4.8, -2.6, 4.4, 5, 0.6, '#30384a'],
    [-0.4, 0, -0.4, 0.8, 4.2, 0.8, '#202634'],
    [-2, 0, -0.3, 4, 0.4, 0.6, '#202634']
  ])
}

/**
 * A monitor on a stand with a programmable screen (a canvas you draw
 * on; set texture.needsUpdate after), and a keyboard with an Enter key.
 */
export function workstation({ screenW = 1024, screenH = 576 } = {}) {
  const group = new THREE.Group()
  group.add(
    boxes([
      [-0.8, 0, -0.8, 1.6, 0.3, 1.2, '#2a2f3a'],
      [-0.3, 0.3, -0.5, 0.6, 2.6, 0.4, '#2a2f3a'],
      [-5.6, 2.6, -0.9, 11.2, 6.6, 0.5, '#20242e']
    ])
  )
  const canvas = Object.assign(document.createElement('canvas'), { width: screenW, height: screenH })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 0.6),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  )
  screen.position.set(0, 0.59, -0.035)
  group.add(screen)
  const keyboard = boxes([[-4, 0, 3, 8, 0.4, 2.6, '#3a4150']])
  const keys = []
  for (let r = 0; r < 4; r++) for (let c = 0; c < 11; c++) keys.push([-3.6 + c * 0.66, 0.4, 3.2 + r * 0.56, 0.5, 0.2, 0.42, '#5a6274'])
  keyboard.add(boxes(keys))
  const enter = boxes([[0, 0, 0, 0.9, 0.3, 0.9, '#ffb340']])
  enter.position.set(0.31, 0.04, 0.37)
  keyboard.add(enter)
  group.add(keyboard)
  return { group, canvas, texture, ctx: canvas.getContext('2d'), enter }
}

/** A cut-away room: floor, back wall with a window, left wall. */
export function room({ w = 40, d = 30, h = 26, wall = '#d9cbb2', floor = '#8a6a4a' } = {}) {
  return boxes([
    [-w / 2, -0.6, -d / 2, w, 0.6, d, floor],
    [-w / 2, 0, -d / 2 - 0.6, w, h, 0.6, wall],
    [-w / 2 - 0.6, 0, -d / 2 - 0.6, 0.6, h, d + 0.6, wall],
    [4, 9, -d / 2 - 0.5, 10, 8, 0.4, '#9fd3ff'],
    [8.6, 9, -d / 2 - 0.45, 0.8, 8, 0.4, wall],
    [4, 12.6, -d / 2 - 0.45, 10, 0.8, 0.4, wall]
  ])
}

/** A home router with antennas and LEDs (leds: an array of meshes to blink). */
export function router() {
  const group = boxes([
    [-2, 0, -1.2, 4, 0.9, 2.4, '#e9ecf2'],
    [-1.6, 0.9, -0.9, 0.3, 2.6, 0.3, '#2a2f3a'],
    [1.3, 0.9, -0.9, 0.3, 2.6, 0.3, '#2a2f3a']
  ])
  const leds = [0, 1, 2, 3].map(i => {
    const l = boxes([[0, 0, 0, 0.35, 0.25, 0.1, '#55ff9a', 1.5]])
    l.position.set((-1.2 + i * 0.6) * UNIT, 0.45 * UNIT, 1.22 * UNIT)
    group.add(l)
    return l
  })
  return { group, leds }
}

/** A small house from outside: walls, stepped roof, door, lit windows. */
export function house({ wall = '#e3d3b4', roof = '#9a4b3c' } = {}) {
  const parts = [
    [-12, 0, -10, 24, 16, 20, wall],
    [-6, 0, 9.8, 4, 8, 0.4, '#5b3b28'],
    [2, 7, 9.8, 6, 5, 0.4, '#ffe08a', 0.6],
    [-10, 7, 9.8, 2.5, 5, 0.4, '#ffe08a', 0.6]
  ]
  for (let i = 0; i < 6; i++) parts.push([-13 + i * 2, 16 + i * 1.6, -11, 26 - i * 4, 1.6, 22, roof])
  return boxes(parts)
}

/** A utility pole for overhead cables. */
export function pole() {
  return boxes([
    [-0.4, 0, -0.4, 0.8, 60, 0.8, '#6b4a2f'],
    [-3, 56, -0.3, 6, 0.6, 0.6, '#6b4a2f']
  ])
}

/**
 * An office/provider/data-centre building. Window lights are returned so
 * an episode can flicker them. `roofFans` adds cooling units on top.
 */
export function building({ w = 30, d = 24, h = 50, color = '#8e9bb0', window = '#ffe08a', roofFans = false, seed = 3 } = {}) {
  const r = seeded(seed)
  const parts = [[-w / 2, 0, -d / 2, w, h, d, color]]
  const lit = []
  for (let y = 5; y < h - 4; y += 6)
    for (let x = -w / 2 + 3; x < w / 2 - 3; x += 5) {
      const on = r() > 0.35
      ;(on ? lit : parts).push([x, y, d / 2 - 0.2, 3, 3.4, 0.4, on ? window : '#3b4252', on ? 0.8 : 0])
    }
  if (roofFans)
    for (let x = -w / 2 + 3; x < w / 2 - 4; x += 7)
      parts.push([x, h, -d / 4, 5, 2.4, 5, '#c9d1dc'], [x + 1, h + 2.4, -d / 4 + 1, 3, 0.3, 3, '#3b4252'])
  const group = boxes(parts)
  const windows = boxes(lit)
  group.add(windows)
  return { group, windows }
}

/**
 * Voxel terrain: columns on a grid, height and colour from functions of
 * (i, j). Returns an InstancedMesh (one draw call) per colour band.
 */
export function terrain({ cols, rows, size = 1, height, color }) {
  const group = new THREE.Group()
  const cells = new Map()
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const h = Math.max(0.2, height(i, j))
      const c = color(i, j, h)
      if (!cells.has(c)) cells.set(c, [])
      cells.get(c).push([i, j, h])
    }
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const m = new THREE.Matrix4()
  for (const [c, list] of cells) {
    const inst = new THREE.InstancedMesh(geo, mat(c), list.length)
    list.forEach(([i, j, h], k) => {
      m.makeScale(size, h, size).setPosition((i - cols / 2 + 0.5) * size, h / 2, (j - rows / 2 + 0.5) * size)
      inst.setMatrixAt(k, m)
    })
    inst.receiveShadow = true
    inst.castShadow = true
    group.add(inst)
  }
  return group
}

/** A flat block of sea, see-through from below. */
export function water(w, d, { color = '#2d7fc1', opacity = 0.72, depth = 0.4 } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), mat(color, { opacity }))
  m.receiveShadow = true
  return m
}

export function fish(color = '#ff8a3d') {
  return boxes([
    [-2, -1, -0.6, 4, 2, 1.2, color],
    [2, -1.4, -0.3, 1.4, 2.8, 0.6, color],
    [-1.4, 0.2, 0.62, 0.5, 0.5, 0.1, '#1d1d1d']
  ])
}

/**
 * A cable laid along a curve as a chain of cubes (InstancedMesh), plus
 * the curve itself so travellers can ride it.
 */
export function cable(curve, { color = '#1f2430', size = 0.12, step = 0.08 } = {}) {
  const n = Math.ceil(curve.getLength() / step)
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), mat(color), n)
  const m = new THREE.Matrix4()
  for (let i = 0; i < n; i++) {
    m.makeTranslation(curve.getPointAt(i / (n - 1)))
    inst.setMatrixAt(i, m)
  }
  inst.castShadow = true
  return inst
}

/** A server rack with blinking LEDs (leds: InstancedMesh, one per slot). */
export function rack({ color = '#2b313d' } = {}) {
  const group = boxes([
    [-3, 0, -4, 6, 20, 8, color],
    ...Array.from({ length: 9 }, (_, i) => [-2.6, 1.2 + i * 2, 3.95, 5.2, 1.6, 0.2, '#3d4555'])
  ])
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), mat('#55ff9a', { glow: 2 }), 27)
  const m = new THREE.Matrix4()
  let k = 0
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 3; j++) {
      m.makeTranslation((-2 + j * 0.45) * UNIT, (2 + i * 2) * UNIT, 4.1 * UNIT)
      leds.setMatrixAt(k++, m)
    }
  group.add(leds)
  return { group, leds }
}

/** An AI accelerator board: PCB, a big chip in the middle, memory, fans. */
export function gpu({ chip = '#ffb340' } = {}) {
  const group = boxes([
    [-8, 0, -4, 16, 0.4, 8, '#1f6b4a'],
    [-2, 0.4, -2, 4, 0.5, 4, '#2a2f3a'],
    ...[-3.2, 2.6].map(x => [x, 0.4, -3.2, 0.6, 0.3, 1.2, '#3d4555']),
    ...[-3.2, 2.6].map(x => [x, 0.4, 2, 0.6, 0.3, 1.2, '#3d4555'])
  ])
  const die = boxes([[-1.2, 0, -1.2, 2.4, 0.2, 2.4, chip, 0.4]])
  die.position.y = 0.9 * UNIT
  group.add(die)
  return { group, die }
}

/**
 * A model drawn as a machine: n stacked grids of cells. layers[i] is an
 * InstancedMesh with its own material, so a layer can light up.
 */
export function layerStack({ n = 8, cols = 10, rows = 10, gap = 1.4, cell = 0.22, color = '#3a4560' } = {}) {
  const group = new THREE.Group()
  const frame = boxes([
    [-1, 0, -1, 0.2, n * gap * 10, 0.2, '#5a6274'],
    [cols * cell * 10 + 0.8, 0, -1, 0.2, n * gap * 10, 0.2, '#5a6274']
  ])
  frame.position.set(-(cols * cell) / 2, 0, -(rows * cell) / 2)
  const layers = []
  const geo = new THREE.BoxGeometry(cell * 0.8, cell * 0.25, cell * 0.8)
  const m = new THREE.Matrix4()
  for (let l = 0; l < n; l++) {
    const material = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color('#ffb340'), emissiveIntensity: 0, flatShading: true, roughness: 0.6 })
    const inst = new THREE.InstancedMesh(geo, material, cols * rows)
    let k = 0
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        m.makeTranslation((i - cols / 2 + 0.5) * cell, l * gap, (j - rows / 2 + 0.5) * cell)
        inst.setMatrixAt(k++, m)
      }
    layers.push(inst)
    group.add(inst)
  }
  return { group, layers }
}

/** The thing we follow: a glowing cube in the episode's accent colour. */
export function packet(color = '#ffb340', size = 0.25) {
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(color, { glow: 1.6 }))
}
