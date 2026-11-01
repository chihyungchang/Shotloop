// The element picker's map on the ep01 fixture (2D, a page with named
// elements), and on shots that draw on a three.js or a 2D canvas
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { pickMap } from './pick.mjs'
import { findShot, loadProject } from './project.mjs'

const EXAMPLE = path.resolve(import.meta.dirname, '..', '..', 'fixtures', 'ep01-password-crack-time')
const SHOT = '01-password-field-dots'

// The target the map has at (x, y), fractions of the frame, on a still
function at(map, still, x, y) {
  const m = map.stills[still]
  return m.targets[m.cells[Math.floor(y * m.rows) * m.cols + Math.floor(x * m.cols)]] ?? null
}

test('pick: the named element at a point, and the background as nothing', async () => {
  const project = loadProject(EXAMPLE)
  const map = await pickMap(project, findShot(project, SHOT))
  assert.deepEqual(map.size, { width: 720, height: 1280 })
  assert.equal(map.stills.length, 3)
  assert.equal(map.stills[1].cells.length, map.stills[1].cols * map.stills[1].rows)
  const hook = at(map, 1, 0.5, 0.5)
  assert.equal(hook.kind, 'dom')
  assert.equal(hook.name, 'hook')
  assert.equal(hook.path, 'h1#hook')
  assert.match(hook.text, /crack your password/)
  assert.ok(hook.box.y < 0.5 && hook.box.y + hook.box.h > 0.5)
  assert.equal(at(map, 1, 0.5, 0.2), null)
})

// A copy of the fixture whose shot is the given code; removed after use
async function withShot(code, use) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-pick-'))
  try {
    fs.cpSync(EXAMPLE, dir, { recursive: true, filter: src => !/\.shotloop|\/out(\/|$)/.test(src) })
    fs.writeFileSync(path.join(dir, 'shots', SHOT, 'shot.js'), code)
    const project = loadProject(dir)
    await use(project, findShot(project, SHOT))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('pick: a three.js scene is picked as a whole', () => withShot(`let r, scene, cam
export async function setup(ctx) {
  const THREE = await ctx.three()
  r = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true })
  r.setSize(ctx.window.innerWidth, ctx.window.innerHeight)
  Object.assign(r.domElement.style, { position: 'fixed', inset: '0', zIndex: 9 })
  ctx.document.body.append(r.domElement)
  scene = new THREE.Scene()
  cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 100)
  cam.position.z = 6
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff8800 })))
}
export default function render() { r.render(scene, cam) }
`, async (project, shot) => {
  const hit = at(await pickMap(project, shot), 0, 0.5, 0.5)
  assert.equal(hit.kind, 'three')
  assert.equal(hit.tag, 'canvas')
}))

test('pick: on a 2D canvas, the part named there (picker or subtitle subject), else the drawing', () => withShot(`let c
export function setup({ document }) {
  const cv = document.createElement('canvas')
  cv.width = innerWidth
  cv.height = innerHeight
  Object.assign(cv.style, { position: 'fixed', inset: '0', zIndex: 9 })
  document.body.append(cv)
  c = cv.getContext('2d')
}
export default function render() {
  c.fillStyle = '#123'
  c.fillRect(0, 0, innerWidth, innerHeight)
  window.picker?.part(100, 100, 200, 200, 'sun')
  subtitles.keep(400, 100, 200, 200, 'moon')
}
`, async (project, shot) => {
  const map = await pickMap(project, shot)
  const sun = at(map, 0, 200 / 720, 200 / 1280)
  assert.equal(sun.kind, 'canvas')
  assert.equal(sun.name, 'sun')
  assert.equal(sun.box.w, 200 / 720)
  assert.equal(at(map, 0, 500 / 720, 200 / 1280).name, 'moon')
  const drawing = at(map, 0, 0.5, 0.8)
  assert.equal(drawing.kind, 'canvas')
  assert.equal(drawing.name, null)
  assert.equal(drawing.box, null)
}))
