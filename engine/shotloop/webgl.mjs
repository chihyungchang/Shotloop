// The world page of a 3D film drawn in WebGL (renderer "webgl"): a
// three.js stage under the type layer the cinematic scene page uses
// (pagekit.mjs). It is a page like any 2D world, so render2d.mjs records
// it, the subtitle check and the element picker read it, and a shot is a
// shot.js with render(t). After oliverzdev's ep20, whose three.js cut
// rendered about 20 times faster a frame than its Blender cut.

import { KIT_CORE, kitType, typeCss } from './pagekit.mjs'

const ADDONS = {
  RoomEnvironment: 'environments/RoomEnvironment.js',
  EffectComposer: 'postprocessing/EffectComposer.js',
  RenderPass: 'postprocessing/RenderPass.js',
  UnrealBloomPass: 'postprocessing/UnrealBloomPass.js',
  OutputPass: 'postprocessing/OutputPass.js',
  GLTFLoader: 'loaders/GLTFLoader.js',
  RoundedBoxGeometry: 'geometries/RoundedBoxGeometry.js',
  Line2: 'lines/Line2.js',
  LineMaterial: 'lines/LineMaterial.js',
  LineGeometry: 'lines/LineGeometry.js'
}

export function webglPage(L, { w, h, pad, safeTop, safeRight, safeBottom, headSize, headTop, hue }) {
  const tall = h > w
  return `<!doctype html>
<!--
  shotloop-renderer: webgl
  World of a 3D Shotloop film drawn in WebGL (three.js). ${w}×${h} CSS px,
  rendered at 1.5x. A canvas holds the 3D world; a DOM layer above it holds
  the type. Every frame is a pure function of time.

  A shot:
    export async function setup(ctx) { await kit.init(ctx) ; build what it shows }
    export default function render(t) { kit.begin(t); pose, move, aim; type; kit.frame() }
  In render(t): set every position, rotation and value from t first, then the
  camera (look), then labels and keep(), then frame(). Objects a shot builds
  in setup stay in kit.scene for that shot only (each shot has its own page).
  Build what several shots share once, in world/*.js modules the shots
  import (a set, a character, a machine), each a function of its options.

  Keep text and the subject inside x ${pad}…${safeRight}, y ${safeTop}…${safeBottom} (the
  platforms' buttons cover the rest); the world may fill the whole frame.

  kit (window.kit):
    W, H, PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM, C, FONT, HEAD_FONT, MONO
    C, C.hue                        the type's colors (C.text, C.muted, C.accent…) and
                                    content colors (red … gray) for things with a meaning
    clamp, lerp, ease(p), rise(t, a, d = 0.4), fall(t, a, d = 0.4), pop(t, a, d = 0.5),
    stagger(t, i, a, step = 0.12, d = 0.4), hold(t, a, b, d = 0.3),
    float(t, amp = 4, period = 3, phase = 0), readTime(text), hash(a, b), prng(seed),
    count(p, from, to, digits = 0), fmt(x, digits = 0), mix(a, b, p) (arrays)

    await init(ctx, { background = '#06080d', exposure = 1, bloom = 0.35, env = 1 })
                                    once, in setup: three.js, the renderer (ACES tone
                                    mapping, soft shadows), a studio environment that
                                    metal and glass reflect (env: its strength), bloom.
                                    Then kit.THREE, kit.scene, kit.camera, kit.renderer
    begin(t)                        starts a frame: clears the type layer
    frame()                         draws the frame (after everything is set)
    post({ bloom, exposure })       change them for this shot or moment

    Camera, in metres (1 unit = 1 m; keep real sizes, a watch is 0.04 wide):
    look(from, at, mm = 35)         camera at from [x, y, z], aimed at at, a lens in mm
                                    (24–35 places, 50 people, 85–100 close-ups)
    orbit(at, r, deg, y = 0) → [x, y, z]   a point on a circle round at, for orbits
    One move per shot, eased: mix(from0, from1, ease(...)) between two positions.

    Light and sets (call in setup):
    studio({ floor = '#0b0d12', key = 2.5, rim = '#7aa2ff', fade = 4 })
                                    product light: key light with soft shadows, a rim
                                    light, a fill, a dark floor that fades into the
                                    background from fade metres away
    space({ stars = 5000, seed = 1 }) a star field at infinity (never swims)
    sky(top, horizon)               a gradient dome for outdoor scenes

    Materials (MeshPhysical/Standard, they all reflect the studio):
    metal(color = '#c9ccd1', rough = 0.25), plastic(color, rough = 0.45),
    matte(color, rough = 0.85), glass(tint = '#ffffff', rough = 0.04),
    glow(color, strength = 2)       emissive, capped at 4: glows read as light,
                                    never as a white blob

    Shapes (meshes casting and taking shadows; add them with kit.scene.add):
    box(w, h, d, mat, r = min/12)   a box with rounded edges (bevels catch light)
    cylinder(r, h, mat, seg = 64), ball(r, mat), ring(r, tube, mat)
    gear({ teeth, r, depth, mat, hole = r * 0.25 })
                                    a spur gear in the xy plane; turn it by its ratio:
                                    rotation.z = angle * teethOther / teeth (opposite sense)
    tube(points, r, mat)            a smooth tube through [x, y, z] points (cables, paths)
    line(points, { color, width = 3, dashed })  a fat line, constant width on screen
    await model(url, { size })      a glTF from the project (url relative to this page,
                                    '../assets/<id>/model.glb'), scaled so its largest
                                    side is size metres; in setup

    Type (DOM, above the world):
    caption({ kicker, head, sub, p = 1, y = ${headTop}, align = 'left', size })
                                    the headline; *word* is the accent
    source(text, p = 1)             the small source line
    block({ x, y, w, p, cls, html, style })  free type; classes kicker, head, sub, num, hl,
                                    muted, chip
    label(at, html, { dx = 0, dy = -24, p = 1, cls = 'chip' })
                                    a label pinned to a point or an object, hidden when it
                                    is behind the camera
    screen(at) → [x, y] or null     where a point or an object is on screen (CSS px)
    keep(object, name)              report an object the viewer must see to the subtitle
                                    check and the picker; call it each frame, after the
                                    camera is set

    card(t, { kicker, title, body }) the starter title card

  Pitfalls (each cost a draft once):
  - Glow and bloom: keep the background and skies dim; only small hot parts
    (a sun disc, a spark) far above them. Bloom on a bright sky washes the
    frame white.
  - Coplanar faces flicker: decals and labels sit 1 mm proud; boxes that touch
    share no face. Keep the camera's near plane >= 1% of the subject's distance.
  - Billboards built in a shader can face away: use side: DoubleSide.
  - GLSL smoothstep(a, b, x) with a > b is undefined: write 1.0 - smoothstep(b, a, x).
  - A shader that fails to compile just doesn't draw: check
    renderer.info.programs[i].diagnostics.
  - A point behind the camera projects mirrored onto the screen: screen() and
    label() return nothing for it; do the same in your own code.
  - Determinism: no Math.random, no clock; hash() for anything scattered,
    physics stepped with fixed steps from t = 0 (or closed form).
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root { --text: ${L.text}; --muted: ${L.muted}; --accent: ${L.accent}; --font: 'PingFang SC', -apple-system, 'Helvetica Neue', sans-serif;
        --head: ${L.head}; --mono: 'SF Mono', ui-monospace, Menlo, monospace; }
      * { box-sizing: border-box; margin: 0; }
      html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: #06080d; color: var(--text); font-family: var(--font);
        -webkit-font-smoothing: antialiased; }
      canvas, #ui { position: absolute; inset: 0; width: ${w}px; height: ${h}px; }
      #ui > * { position: absolute; }
${typeCss(L, headSize)}    </style>
  </head>
  <body>
    <canvas id="world"></canvas>
    <div id="ui"></div>
    <script>
      const W = ${w}, H = ${h}, PAD = ${pad}, SAFE_TOP = ${safeTop}, SAFE_RIGHT = ${safeRight}, SAFE_BOTTOM = ${safeBottom}
      const FONT = "'PingFang SC', -apple-system, sans-serif", HEAD_FONT = ${JSON.stringify(L.head)}, MONO = "'SF Mono', ui-monospace, Menlo, monospace"
      const C = { text: '${L.text}', muted: '${L.muted}', accent: '${L.accent}', accent2: '${L.accent2}', accent3: '${L.accent3}', hue: ${JSON.stringify(hue)} }
      const DPR = window.devicePixelRatio || 1
      const canvas = document.getElementById('world')
      const ui = document.getElementById('ui')
      let parts = []

      // ---- Time ----
${KIT_CORE}      const fall = (t, a, d = 0.4) => 1 - ease((t - a) / d)
      function prng(seed) {
        return () => {
          seed |= 0; seed = (seed + 0x6d2b79f5) | 0
          let r = Math.imul(seed ^ (seed >>> 15), 1 | seed)
          r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
          return ((r ^ (r >>> 14)) >>> 0) / 4294967296
        }
      }
      const fmt = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
      const mix = (a, b, p) => a.map((v, i) => lerp(v, b[i], p))

${kitType({ headTop, headSize })}      // ---- 3D ----
      let THREE, A, scene, camera, renderer, composer, bloomPass
      const kit = {}

      async function init(ctx, { background = '#06080d', exposure = 1, bloom = 0.35, env = 1 } = {}) {
        if (THREE) return kit
        THREE = await ctx.three()
        const names = ${JSON.stringify(Object.keys(ADDONS))}
        const files = ${JSON.stringify(Object.values(ADDONS))}
        const mods = await Promise.all(files.map(f => ctx.three('addons/' + f)))
        A = Object.fromEntries(names.map((n, i) => [n, mods[i][n]]))

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(DPR)
        renderer.setSize(W, H, false)
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        scene = new THREE.Scene()
        scene.background = new THREE.Color(background)
        const pmrem = new THREE.PMREMGenerator(renderer)
        scene.environment = pmrem.fromScene(new A.RoomEnvironment(), 0.04).texture
        scene.environmentIntensity = env
        camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 2000)
        composer = new A.EffectComposer(renderer)
        composer.setPixelRatio(DPR)
        composer.setSize(W, H)
        composer.addPass(new A.RenderPass(scene, camera))
        bloomPass = new A.UnrealBloomPass(new THREE.Vector2(W * DPR, H * DPR), bloom, 0.45, 0.9)
        composer.addPass(bloomPass)
        // Tone mapping (ACES) and sRGB at the end, after bloom
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = exposure
        composer.addPass(new A.OutputPass())
        Object.assign(kit, { THREE, scene, camera, renderer })
        return kit
      }

      function post({ bloom, exposure } = {}) {
        if (bloom != null) bloomPass.strength = bloom
        if (exposure != null) renderer.toneMappingExposure = exposure
      }

      const begin = () => { parts = []; ui.innerHTML = '' }
      function frame() {
        scene.updateMatrixWorld()
        composer.render()
      }

      // ---- Camera ----
      // A lens's vertical field of view on a 36×24 mm sensor, its long
      // side along the frame's long side
      const lensFov = mm => 2 * Math.atan(${tall ? 18 : 12} / mm) * 180 / Math.PI
      function look(from, at, mm = 35) {
        camera.position.set(...from)
        camera.fov = lensFov(mm)
        camera.near = Math.max(0.005, camera.position.distanceTo(new THREE.Vector3(...at)) / 200)
        camera.far = camera.near * 4000
        camera.updateProjectionMatrix()
        camera.lookAt(...at)
        camera.updateMatrixWorld()
      }
      const orbit = (at, r, deg, y = 0) => [at[0] + r * Math.sin(deg * Math.PI / 180), at[1] + y, at[2] + r * Math.cos(deg * Math.PI / 180)]

      // ---- Where things are on screen ----
      const point = at => (Array.isArray(at) ? new THREE.Vector3(...at) : at.isVector3 ? at.clone() : at.getWorldPosition(new THREE.Vector3()))
      function screen(at) {
        camera.updateMatrixWorld()
        const v = point(at).project(camera)
        if (v.z > 1) return null
        return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]
      }
      // An object's box on screen: the corners of its bounds in front of the camera
      function rectOf(object) {
        object.updateWorldMatrix(true, true)
        camera.updateMatrixWorld()
        const b = new THREE.Box3().setFromObject(object)
        if (b.isEmpty()) return null
        const xs = [], ys = []
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera)
          if (v.z > 1) continue
          xs.push((v.x + 1) / 2 * W)
          ys.push((1 - v.y) / 2 * H)
        }
        if (!xs.length) return null
        const x0 = clamp(Math.min(...xs), 0, W), x1 = clamp(Math.max(...xs), 0, W)
        const y0 = clamp(Math.min(...ys), 0, H), y1 = clamp(Math.max(...ys), 0, H)
        return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null
      }
      function keep(object, name) {
        const r = rectOf(object)
        if (!r) return
        window.subtitles?.keep(...r, name)
        window.picker?.part(...r, name)
      }
      function label(at, html, { dx = 0, dy = -24, p = 1, cls = 'chip' } = {}) {
        const s = screen(at)
        if (!s) return
        block({ x: s[0] + dx, y: s[1] + dy, w: 0, p, cls, html, style: 'width:auto;transform:translate(-50%, -100%);white-space:nowrap' })
      }

      // ---- Materials ----
      const metal = (color = '#c9ccd1', rough = 0.25) => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough })
      const plastic = (color = '#d8dbe2', rough = 0.45) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.3 })
      const matte = (color = '#9aa0a8', rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough })
      const glass = (tint = '#ffffff', rough = 0.04) => new THREE.MeshPhysicalMaterial({ color: tint, roughness: rough, transmission: 1, thickness: 0.004, ior: 1.5 })
      const glow = (color = '#ffd27a', strength = 2) => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: Math.min(4, strength) })

      // ---- Shapes ----
      function mesh(geometry, mat) {
        const m = new THREE.Mesh(geometry, mat ?? matte())
        m.castShadow = m.receiveShadow = true
        return m
      }
      const box = (w, h, d, mat, r = Math.min(w, h, d) / 12) => mesh(new A.RoundedBoxGeometry(w, h, d, 4, r), mat)
      const cylinder = (r, h, mat, seg = 64) => mesh(new THREE.CylinderGeometry(r, r, h, seg), mat)
      const ball = (r, mat) => mesh(new THREE.SphereGeometry(r, 64, 32), mat)
      const ring = (r, tube, mat) => mesh(new THREE.TorusGeometry(r, tube, 24, 96), mat)
      function gear({ teeth = 20, r = 0.01, depth = r * 0.2, mat, hole = r * 0.25 } = {}) {
        const tip = r, root = r * (1 - 2.4 / teeth), s = new THREE.Shape()
        for (let i = 0; i < teeth; i++) {
          const a = i / teeth * Math.PI * 2, step = Math.PI * 2 / teeth
          const at = (rad, f) => [Math.cos(a + step * f) * rad, Math.sin(a + step * f) * rad]
          const pts = [at(root, 0), at(tip, 0.2), at(tip, 0.45), at(root, 0.65)]
          pts.forEach(([x, y], k) => (i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
        }
        s.closePath()
        if (hole > 0) {
          const hp = new THREE.Path()
          hp.absarc(0, 0, hole, 0, Math.PI * 2, true)
          s.holes.push(hp)
        }
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.12, bevelSize: r * 0.01, bevelSegments: 2, curveSegments: 24 })
        g.translate(0, 0, -depth / 2)
        return mesh(g, mat ?? metal('#d4b26a', 0.3))
      }
      const tube = (points, r, mat) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(16, points.length * 12), r, 16), mat)
      function line(points, { color = C.accent, width = 3, dashed = false } = {}) {
        const g = new A.LineGeometry()
        g.setPositions(points.flat())
        const m = new A.LineMaterial({ color, linewidth: width, dashed, dashSize: 0.02, gapSize: 0.015, worldUnits: false })
        m.resolution.set(W * DPR, H * DPR)
        const l = new A.Line2(g, m)
        l.computeLineDistances()
        return l
      }
      async function model(url, { size = 1 } = {}) {
        const gltf = await new A.GLTFLoader().loadAsync(url)
        const root = gltf.scene
        root.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true })
        const b = new THREE.Box3().setFromObject(root), d = b.getSize(new THREE.Vector3())
        root.scale.setScalar(size / Math.max(d.x, d.y, d.z))
        return root
      }

      // ---- Light and sets ----
      function studio({ floor = '#0b0d12', key = 2.5, rim = '#7aa2ff', fade = 4 } = {}) {
        const g = new THREE.Group()
        const k = new THREE.DirectionalLight('#fff4e6', key)
        k.position.set(2, 4, 3)
        k.castShadow = true
        k.shadow.mapSize.set(2048, 2048)
        k.shadow.radius = 6
        k.shadow.bias = -0.0002
        Object.assign(k.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 20 })
        const r = new THREE.DirectionalLight(rim, key * 0.8)
        r.position.set(-3, 2, -3)
        g.add(k, r, new THREE.HemisphereLight('#cfd8ff', '#0b0b10', 0.35))
        // Dark and rough: it takes shadows and a little light, and barely
        // mirrors the studio, so it never reads as a wall
        const f = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.9, envMapIntensity: 0.12 }))
        f.rotation.x = -Math.PI / 2
        f.receiveShadow = true
        g.add(f)
        scene.fog = new THREE.Fog(scene.background, fade, fade * 3)
        scene.add(g)
        return g
      }
      function space({ stars = 5000, seed = 1 } = {}) {
        const pos = new Float32Array(stars * 3), size = new Float32Array(stars)
        for (let i = 0; i < stars; i++) {
          const u = hash(i, seed) * 2 - 1, a = hash(i, seed + 1) * Math.PI * 2, s = Math.sqrt(1 - u * u)
          pos.set([Math.cos(a) * s, u, Math.sin(a) * s], i * 3)
          size[i] = 0.6 + Math.pow(hash(i, seed + 2), 8) * 3
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        g.setAttribute('size', new THREE.BufferAttribute(size, 1))
        // At infinity: drawn round the camera at the far plane, so they never swim
        const m = new THREE.ShaderMaterial({
          uniforms: { dpr: { value: DPR } }, transparent: true, depthWrite: false,
          vertexShader: 'attribute float size; uniform float dpr; varying float b; void main() { vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; gl_PointSize = size * dpr; b = size; }',
          fragmentShader: 'varying float b; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.75 + 0.1 * b), (1.0 - smoothstep(0.1, 0.5, d)) * 0.9); }'
        })
        const p = new THREE.Points(g, m)
        p.frustumCulled = false
        scene.add(p)
        return p
      }
      function sky(top = '#203a6b', horizon = '#e8a76a') {
        const m = new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false,
          uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } },
          vertexShader: 'varying vec3 d; void main() { d = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }',
          fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 d; void main() { float y = normalize(d).y; gl_FragColor = vec4(mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.6)), 1.0); }'
        })
        const s = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m)
        s.frustumCulled = false
        scene.add(s)
        return s
      }

      // The starter title card: a turning object in the studio, until a
      // shot gets its own design
      let cardObject = null
      function card(t, { kicker, title, body }) {
        if (!cardObject) {
          studio()
          cardObject = box(0.3, 0.3, 0.3, metal('#d4b26a', 0.3))
          cardObject.position.y = 0.15
          scene.add(cardObject)
        }
        begin(t)
        cardObject.rotation.y = t * 0.4
        look(orbit([0, 0.15, 0], 1.6, 20 + t * 4, 0.45), [0, 0.12, 0], 50)
        caption({ kicker, head: title.replace(/<\\/?b>/g, '*'), sub: body, p: rise(t, 0.1, 0.7) })
        keep(cardObject, 'object')
        frame()
      }

      Object.assign(kit, { W, H, PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM, C, FONT, HEAD_FONT, MONO, clamp, lerp, ease, rise, fall, pop, stagger, hold, float,
        readTime, hash, prng, count, fmt, mix, init, post, begin, frame, look, orbit, screen, keep, label, metal, plastic, matte, glass, glow, mesh, box,
        cylinder, ball, ring, gear, tube, line, model, studio, space, sky, caption, source, block, setUI, show, card })
      window.kit = kit
      window.ready = document.fonts.ready
    </script>
  </body>
</html>
`
}
