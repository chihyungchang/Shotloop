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
  GTAOPass: 'postprocessing/GTAOPass.js',
  TexturePass: 'postprocessing/TexturePass.js',
  FullScreenQuad: 'postprocessing/Pass.js',
  UnrealBloomPass: 'postprocessing/UnrealBloomPass.js',
  OutputPass: 'postprocessing/OutputPass.js',
  ShaderPass: 'postprocessing/ShaderPass.js',
  VignetteShader: 'shaders/VignetteShader.js',
  FilmPass: 'postprocessing/FilmPass.js',
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

    await init(ctx, { background = '#06080d', exposure = 1, bloom = 0.15, env = 1, tone = 'agx' })
                                    once, in setup: three.js, the renderer, a studio
                                    environment metal and glass reflect (env: its
                                    strength), tone mapping (agx like Blender, neutral
                                    for true product colours, aces), bloom on what is
                                    brighter than white. Then kit.THREE, kit.scene,
                                    kit.camera, kit.renderer
    begin(t)                        starts a frame: clears the type layer
    frame(pose?)                    draws the frame like an offline renderer: samples
                                    sub-frames averaged (antialiasing, soft shadows from
                                    the studio's key light, ambient occlusion, depth of
                                    field). Pass pose(dt), which sets the scene and camera
                                    at t + dt, for true motion blur on moving things
    post({ samples = 8, shutter = 0.5, fstop = 0, focus, ao = 0.8, bloom, exposure,
           tone, grain = 0.04, vignette = 1 })
                                    the look of this shot or moment: fstop 2.8 for a
                                    shallow focus (on the last look's target, or focus
                                    metres away; 16+ samples), samples 16+ for fast motion

    Camera, in metres (1 unit = 1 m; keep real sizes, a watch is 0.04 wide):
    look(from, at, mm = 35)         camera at from [x, y, z], aimed at at, a lens in mm
                                    (24–35 places, 50 people, 85–100 close-ups)
    orbit(at, r, deg, y = 0) → [x, y, z]   a point on a circle round at, for orbits
    One move per shot, eased: mix(from0, from1, ease(...)) between two positions.

    Light and sets (call in setup):
    studio({ size = 1, floor = '#0b0d12', key = 2.5, rim = '#7aa2ff', fade = 4 * size })
                                    product light: key light with soft shadows, a rim
                                    light, a fill, a dark floor that fades into the
                                    background; size: the subject's size in metres
                                    (0.05 for a watch), so its shadow is crisp
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
  - Whites blow out: a pale surface under a strong key or near a point light
    (light falls off with the square of the distance) turns flat white and
    loses its shape. Make big pale parts off-white (about #d8d4cc), keep point
    lights a body's length from them, and let only light sources clip; the
    stills' exposure check stripes blown areas red.
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
      let THREE, A, scene, camera, renderer, sceneComposer, postComposer, bloomPass, gtaoPass, vignettePass, filmPass, accTarget, addQuad, FPS = 30
      // The shot time begun, the last aim (for depth of field and the AO's
      // reach) and the studio's key light (moved for soft shadows)
      let now = 0, aim = { dist: 1, mm: 35 }, key = null
      const opts = { samples: 8, shutter: 0.5, fstop: 0, focus: null, ao: 0.8, grain: 0.04, vignette: 1 }
      const kit = {}
      // Fixed low-discrepancy points for the sub-samples (Halton), never random
      const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b) } return r }

      async function init(ctx, { background = '#06080d', exposure = 1, bloom = 0.15, env = 1, tone = 'agx' } = {}) {
        if (THREE) return kit
        THREE = await ctx.three()
        const names = ${JSON.stringify(Object.keys(ADDONS))}
        const files = ${JSON.stringify(Object.values(ADDONS))}
        const mods = await Promise.all(files.map(f => ctx.three('addons/' + f)))
        A = Object.fromEntries(names.map((n, i) => [n, mods[i][n]]))
        FPS = ctx.fps ?? 30

        // No hardware antialiasing: the sub-samples are jittered instead
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(DPR)
        renderer.setSize(W, H, false)
        renderer.shadowMap.enabled = true
        // r186 removed PCFSoftShadowMap; the new PCF is soft, widened by shadow.radius
        renderer.shadowMap.type = THREE.PCFShadowMap
        renderer.transmissionResolutionScale = 1
        scene = new THREE.Scene()
        scene.background = new THREE.Color(background)
        const pmrem = new THREE.PMREMGenerator(renderer)
        scene.environment = pmrem.fromScene(studioLight(), 0.02, 0.1, 50).texture
        scene.environmentIntensity = env
        camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 2000)

        const px = new THREE.Vector2(Math.round(W * DPR), Math.round(H * DPR))
        const target = () => new THREE.WebGLRenderTarget(px.x, px.y, { type: THREE.HalfFloatType })
        // One sub-sample: the scene and its ambient occlusion, in linear HDR
        sceneComposer = new A.EffectComposer(renderer, target())
        sceneComposer.renderToScreen = false
        sceneComposer.addPass(new A.RenderPass(scene, camera))
        // GTAO makes its denoise noise with Math.random when built: seeded
        // here, so every page (and every still) draws the same
        const random = Math.random
        Math.random = prng(7)
        try {
          gtaoPass = new A.GTAOPass(scene, camera, px.x, px.y)
        } finally {
          Math.random = random
        }
        gtaoPass.output = A.GTAOPass.OUTPUT.Default
        sceneComposer.addPass(gtaoPass)
        // The sub-samples, averaged
        accTarget = target()
        addQuad = new A.FullScreenQuad(new THREE.ShaderMaterial({
          uniforms: { map: { value: null }, weight: { value: 1 } },
          vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D map; uniform float weight; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv) * weight; }',
          // Plain sums (one × source + one × destination): additive blending
          // would weight each sub-sample by its alpha again
          blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
          depthTest: false, depthWrite: false, transparent: true
        }))
        // Once a frame, on the average: bloom, tone mapping, vignette, grain
        postComposer = new A.EffectComposer(renderer)
        postComposer.setPixelRatio(DPR)
        postComposer.setSize(W, H)
        postComposer.addPass(new A.TexturePass(accTarget.texture))
        // Only what is far brighter than a lit surface glows (emissives, hot
        // highlights): a white surface under a strong key reaches about 2 in
        // linear light, and glowing there blows it out
        bloomPass = new A.UnrealBloomPass(px, bloom, 0.35, 2.2)
        postComposer.addPass(bloomPass)
        renderer.toneMapping = TONES[tone] ?? TONES.agx
        renderer.toneMappingExposure = exposure
        postComposer.addPass(new A.OutputPass())
        vignettePass = new A.ShaderPass(A.VignetteShader)
        vignettePass.uniforms.offset.value = 1.0
        postComposer.addPass(vignettePass)
        filmPass = new A.FilmPass(opts.grain, false)
        postComposer.addPass(filmPass)
        Object.assign(kit, { THREE, scene, camera, renderer })
        return kit
      }
      const TONES = { get agx() { return THREE.AgXToneMapping }, get neutral() { return THREE.NeutralToneMapping }, get aces() { return THREE.ACESFilmicToneMapping } }

      // The light metal and glass reflect: three.js's room (an even, bright
      // base, so no face goes black) with product lights in it: a large
      // softbox above, two tall strips at the sides, a rim behind and a soft
      // fill from the camera's side
      function studioLight() {
        const env = new A.RoomEnvironment()
        const panel = (w, h, power, pos, tint = '#ffffff') => {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(power), side: THREE.DoubleSide }))
          m.position.set(...pos)
          m.lookAt(0, 0, 0)
          env.add(m)
        }
        panel(6, 3, 3, [0, 6.5, 1])
        panel(1.5, 6, 4, [-6.5, 1.5, 2])
        panel(1.5, 6, 2, [6.5, 1.5, -1], '#dfe8ff')
        panel(5, 1.5, 1.5, [0, 2.5, -6.5], '#ffe9d6')
        return env
      }

      // samples: sub-samples a frame (8; 16+ for fast motion or depth of
      // field); shutter: the fraction of a frame the shutter is open; fstop:
      // depth of field (0 off, 2.8 shallow), focused at the last look's
      // target or at focus metres; ao: ambient occlusion 0–1; grain; vignette
      function post({ bloom, exposure, tone, samples, shutter, fstop, focus, ao, grain, vignette } = {}) {
        if (bloom != null) bloomPass.strength = bloom
        if (exposure != null) renderer.toneMappingExposure = exposure
        if (tone != null) renderer.toneMapping = TONES[tone] ?? TONES.agx
        Object.assign(opts, Object.fromEntries(Object.entries({ samples, shutter, fstop, focus, ao, grain, vignette }).filter(([, v]) => v !== undefined)))
      }

      const begin = t => { now = t ?? 0; parts = []; ui.innerHTML = '' }
      // Draws the frame: opts.samples sub-samples, each jittered by a
      // fraction of a pixel (antialiasing), with the key light moved over its
      // disk (soft shadows), the lens over its aperture (depth of field) and,
      // when the shot passes pose(dt), the scene at t + dt within the shutter
      // (motion blur); averaged in linear light, then bloom, tone, grade once
      function frame(pose) {
        const n = Math.max(1, Math.round(opts.samples))
        const w = accTarget.width, h = accTarget.height
        const focalPx = (h / 2) / Math.tan(camera.fov * Math.PI / 360)
        const focus = opts.focus ?? aim.dist
        const lens = opts.fstop > 0 ? aim.mm / 1000 / (2 * opts.fstop) : 0
        const right = new THREE.Vector3(), up = new THREE.Vector3(), home = camera.position.clone()
        const autoClear = renderer.autoClear
        renderer.setRenderTarget(accTarget)
        renderer.setClearColor(0x000000, 0)
        renderer.clear()
        gtaoPass.blendIntensity = opts.ao
        for (let i = 0; i < n; i++) {
          if (pose && opts.shutter > 0) pose(((i + 0.5) / n - 0.5) * opts.shutter / FPS)
          camera.updateMatrixWorld()
          camera.matrixWorld.extractBasis(right, up, new THREE.Vector3())
          // The lens over its aperture, the image shifted so the focus plane stays put
          const r = lens * Math.sqrt(halton(i + 1, 5)), a = 2 * Math.PI * halton(i + 1, 7)
          const lx = r * Math.cos(a), ly = r * Math.sin(a)
          const base = camera.position.clone()
          camera.position.addScaledVector(right, lx).addScaledVector(up, ly)
          camera.setViewOffset(w, h, halton(i + 1, 2) - 0.5 - lx * focalPx / focus, halton(i + 1, 3) - 0.5 + ly * focalPx / focus, w, h)
          camera.updateMatrixWorld()
          if (key) {
            const kr = key.r * Math.sqrt(halton(i + 1, 11)), ka = 2 * Math.PI * halton(i + 1, 13)
            key.light.position.copy(key.home).add(new THREE.Vector3(Math.cos(ka) * kr, 0, Math.sin(ka) * kr))
          }
          scene.updateMatrixWorld()
          sceneComposer.render(0)
          renderer.autoClear = false
          renderer.setRenderTarget(accTarget)
          addQuad.material.uniforms.map.value = sceneComposer.readBuffer.texture
          addQuad.material.uniforms.weight.value = 1 / n
          addQuad.render(renderer)
          renderer.autoClear = autoClear
          camera.position.copy(base)
        }
        camera.clearViewOffset()
        camera.position.copy(home)
        camera.updateMatrixWorld()
        if (key) key.light.position.copy(key.home)
        if (pose && opts.shutter > 0) pose(0)
        renderer.setRenderTarget(null)
        vignettePass.uniforms.darkness.value = opts.vignette
        filmPass.uniforms.intensity.value = opts.grain
        // Grain seeded by the shot time: the same frame draws the same
        filmPass.uniforms.time.value = now
        postComposer.render(0)
      }

      // ---- Camera ----
      // A lens's vertical field of view on a 36×24 mm sensor, its long
      // side along the frame's long side
      const lensFov = mm => 2 * Math.atan(${tall ? 18 : 12} / mm) * 180 / Math.PI
      function look(from, at, mm = 35) {
        camera.position.set(...from)
        camera.fov = lensFov(mm)
        const dist = camera.position.distanceTo(new THREE.Vector3(...at))
        aim = { dist, mm }
        camera.near = Math.max(0.005, dist / 200)
        camera.far = camera.near * 4000
        camera.updateProjectionMatrix()
        camera.lookAt(...at)
        camera.updateMatrixWorld()
        // Occlusion reaches a few percent of the distance to the subject
        gtaoPass?.updateGtaoMaterial({ radius: dist * 0.05, thickness: dist * 0.1, distanceFallOff: 1, scale: 1, samples: 16 })
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
      // size: the subject's size in metres: the lights, the shadow's reach
      // (fitted tight: that, more than its resolution, makes it crisp) and
      // the floor's fade follow it
      function studio({ size = 1, floor = '#0b0d12', key: power = 2.5, rim = '#7aa2ff', fade = 4 * size } = {}) {
        const g = new THREE.Group()
        const k = new THREE.DirectionalLight('#fff4e6', power)
        k.position.set(2 * size, 4 * size, 3 * size)
        k.castShadow = true
        k.shadow.mapSize.set(4096, 4096)
        k.shadow.radius = 3
        k.shadow.bias = -0.0004
        k.shadow.normalBias = 0.02 * size
        Object.assign(k.shadow.camera, { left: -1.5 * size, right: 1.5 * size, top: 1.5 * size, bottom: -1.5 * size, near: 0.5 * size, far: 12 * size })
        // Moved over a disk each sub-sample: an area light's soft shadow
        key = { light: k, home: k.position.clone(), r: 0.6 * size }
        const r = new THREE.DirectionalLight(rim, power * 0.8)
        r.position.set(-3 * size, 2 * size, -3 * size)
        g.add(k, r, new THREE.HemisphereLight('#cfd8ff', '#0b0b10', 0.25))
        // Dark and rough: it takes shadows and a little light, and barely
        // mirrors the studio, so it never reads as a wall
        const f = new THREE.Mesh(new THREE.CircleGeometry(30 * size, 64), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.9, envMapIntensity: 0.12 }))
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
