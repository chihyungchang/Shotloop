// The world page of the cinematic scene style (styles.mjs): a lit canvas
// world under glowing type, after the sunlight example. Light blooms
// (additive blending), lit spheres have a night side, particles sit at
// depths and drift with parallax, a camera moves through it all, and a
// vignette closes the frame. The look gives the colors (looks.mjs, scene).

export function scenePage(L, { w, h, pad, safeTop, safeRight, safeBottom, headSize, headTop }) {
  const S = L.scene
  return `<!doctype html>
<!--
  shotloop-look: ${L.id}
  shotloop-style: scene
  World of a 2D Shotloop project in the cinematic scene style, "${L.name.en}"
  colors. ${w}×${h} CSS px, rendered at 1.5x. A canvas holds the lit world
  (sky, particles, lights, objects); a DOM layer above it holds the type.
  Every frame is a pure function of time: a shot calls stage(t, …) first,
  which clears the canvas and the type, then draws.

  Keep text and the subject inside x ${pad}…${safeRight}, y ${safeTop}…${safeBottom} (the
  platforms' buttons cover the rest); the sky and light fill the whole frame.

  How it reads as 3D: one light source that blooms; objects lit from it
  (sphere: a night side away from the light); particles at several depths
  drifting with parallax; a camera that keeps moving a little; depth()
  for near and far layers; the vignette. Draw the explanation as an event
  in this world (something travels, grows, glows, breaks), and draw any
  data as light in it (trail, beam, glowing counters), not as flat panels.

  kit:
    W, H, PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM, C, FONT, HEAD_FONT, MONO
    C                               colors: text, muted, accent, accent2, accent3 (CSS)
                                    and rgb: { accent, accent2, accent3, light, cool }
                                    ('r, g, b' strings for the glow functions)
    c                               the canvas 2D context, in CSS px, camera applied
    clamp, lerp, ease(p), rise(t, a, d = 0.6), fall(t, a, d = 0.4), pop(t, a, d = 0.5)
    stagger(t, i, a, step = 0.12, d = 0.4), hold(t, a, b, d = 0.3),
    float(t, amp = 4, period = 3, phase = 0), readTime(text), hash(a, b), prng(seed),
    count(p, from, to, digits = 0), fmt(x, digits = 0)  (grouped thousands)

    stage(t, { camera: { x, y, zoom }, drift = t * 6, driftY = 0, glow = 1, specks = 1 })
                                    starts the frame: the sky, its clouds and a field of
                                    specks (stars, dust) at depths, drifting with parallax;
                                    then the camera for everything drawn after: (x, y) is
                                    the world point at the frame's center (default W/2,
                                    H/2), zoom 1 the whole frame. Move it a little in every
                                    shot (a slow push in, a drift) so the world stays alive.
    depth(d, draw)                  draw() with parallax for depth d: 1 is the subject
                                    plane, 0.5 a far layer (moves half as much), 1.4 near
    screen(x, y, d = 1) → [x, y]    where a world point is on screen under the camera:
                                    place a label (block) on a world object with it
    light(t, x, y, r, { color = C.rgb.light, glow = 1, rays = 1, streak = 1 })
                                    a light source: wide bloom, slowly turning rays, an
                                    anamorphic lens streak, a hot white core
    sphere(t, x, y, r, { color, atmosphere, light = Math.PI, spin = 0, bands = 0 })
                                    a lit ball (planet, cell, atom, drop): color is a hex
                                    base; lit from angle light (radians, toward the light),
                                    a night side, a thin lit rim, an atmosphere glow
    halo(x, y, r, rgb, a)           a soft glow (arrivals, flashes, emphasis)
    beam(x0, y0, x1, y1, p, { color = C.rgb.light, width = 3, tail = 0.35, guide = 0.16, head = 1 })
                                    a pulse of light travelling along a line (constant speed:
                                    pass a linear p for physical things)
    trail(points, p, { color = C.rgb.accent, width = 3, glow = 1 })
                                    a glowing polyline drawn on with p: curves and charts as light
    particles(t, { n = 60, seed = 1, x, y, w, h, size = 2, color = C.rgb.cool, vx = 40, vy = 0, life = 3 })
                                    glowing particles streaming through a box (flows, wind,
                                    current, ions); seeded, so the same every frame

    caption({ kicker, head, sub, p = 1, y = ${headTop}, align = 'left', size })
                                    the condensed line in glowing type; *word* is the accent;
                                    p 0→1 fades, lifts and unblurs it in
    source(text, p = 1)             the small source line at the bottom of the safe area
    block({ x, y, w, p, cls, html, style })  free type; classes: kicker, head, sub, num
                                    (tabular mono digits), hl (accent glow), muted, chip
    card(t, { kicker, title, body, progress })  the starter title card
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root { --text: ${L.text}; --muted: ${L.muted}; --accent: ${L.accent}; --font: 'PingFang SC', -apple-system, 'Helvetica Neue', sans-serif;
        --head: ${L.head}; --mono: 'SF Mono', ui-monospace, Menlo, monospace; }
      * { box-sizing: border-box; margin: 0; }
      html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: ${S.sky[2]}; color: var(--text); font-family: var(--font);
        -webkit-font-smoothing: antialiased; }
      canvas, #vignette, #ui { position: absolute; inset: 0; width: ${w}px; height: ${h}px; }
      #vignette { background: radial-gradient(120% 80% at 50% 45%, transparent 55%, rgba(0, 0, 4, 0.7) 100%); pointer-events: none; }
      #ui > * { position: absolute; }
      .kicker { font: 600 ${Math.round(headSize * 0.36)}px/1 var(--font); letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent);
        display: flex; align-items: center; gap: 14px; }
      .kicker::before { content: ''; width: 36px; height: 2px; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
      .head { font: ${L.headWeight} ${headSize}px/1.18 var(--head); letter-spacing: 0.01em; text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6); }
      .sub { font: 500 ${Math.round(headSize * 0.46)}px/1.5 var(--font); color: var(--muted); }
      .num { font-family: var(--mono); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
      .hl, .head b { color: var(--accent); font-weight: inherit; text-shadow: 0 0 24px var(--accent); }
      .muted { color: var(--muted); }
      .chip { font: 600 ${Math.round(headSize * 0.36)}px/1 var(--font); color: var(--muted); padding: 10px 16px; border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(0, 0, 0, 0.35); }
      .source { font: 500 ${Math.round(headSize * 0.3)}px/1.4 var(--font); color: var(--muted); opacity: 0.75; }
    </style>
  </head>
  <body>
    <canvas id="world"></canvas>
    <div id="vignette"></div>
    <div id="ui"></div>
    <script>
      const W = ${w}, H = ${h}, PAD = ${pad}, SAFE_TOP = ${safeTop}, SAFE_RIGHT = ${safeRight}, SAFE_BOTTOM = ${safeBottom}
      const FONT = "'PingFang SC', -apple-system, sans-serif", HEAD_FONT = ${JSON.stringify(L.head)}, MONO = "'SF Mono', ui-monospace, Menlo, monospace"
      const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')
      const C = {
        text: '${L.text}', muted: '${L.muted}', accent: '${L.accent}', accent2: '${L.accent2}', accent3: '${L.accent3}',
        rgb: { accent: rgbOf('${L.accent}'), accent2: rgbOf('${L.accent2}'), accent3: rgbOf('${L.accent3}'), light: '${S.light}', cool: '${S.cool}' }
      }
      const DPR = window.devicePixelRatio || 1
      const cv = document.getElementById('world')
      cv.width = Math.round(W * DPR)
      cv.height = Math.round(H * DPR)
      const c = cv.getContext('2d')
      const ui = document.getElementById('ui')

      // ---- Time ----
      const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
      const lerp = (a, b, p) => a + (b - a) * p
      const ease = p => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2 }
      const rise = (t, a, d = 0.6) => 1 - Math.pow(1 - clamp((t - a) / d), 3)
      const fall = (t, a, d = 0.4) => 1 - ease((t - a) / d)
      const pop = (t, a, d = 0.5) => {
        const p = clamp((t - a) / d), k = 1.7
        return p <= 0 ? 0 : 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2)
      }
      const stagger = (t, i, a, step = 0.12, d = 0.4) => rise(t, a + i * step, d)
      const hold = (t, a, b, d = 0.3) => Math.min(rise(t, a, d), 1 - rise(t, b - d, d))
      const float = (t, amp = 4, period = 3, phase = 0) => amp * Math.sin((t / period + phase) * Math.PI * 2)
      // Seconds a caption must stay fully on screen (agent/src/principles.ts)
      function readTime(text) {
        const cjk = /[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]/gu
        const chars = (String(text).match(cjk) || []).length
        const words = String(text).replace(cjk, ' ').split(/\\s+/).filter(w => /[\\p{L}\\p{N}]/u.test(w)).length
        return chars + words ? 1 + 0.3 * words + 0.15 * chars : 0
      }
      function hash(a, b = 0) {
        let h = Math.imul(Math.round(a * 1000) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(b * 1000), 0xc2b2ae35)
        h ^= h >>> 13
        h = Math.imul(h, 0x27d4eb2f)
        h ^= h >>> 16
        return (h >>> 0) / 4294967296
      }
      function prng(seed) {
        return () => {
          seed |= 0; seed = (seed + 0x6d2b79f5) | 0
          let r = Math.imul(seed ^ (seed >>> 15), 1 | seed)
          r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
          return ((r ^ (r >>> 14)) >>> 0) / 4294967296
        }
      }
      const count = (p, from, to, digits = 0) => lerp(from, to, clamp(p)).toFixed(digits)
      const fmt = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

      // ---- Drawing helpers ----
      const radial = (x, y, r0, r1, stops) => {
        const g = c.createRadialGradient(x, y, r0, x, y, r1)
        for (const [o, col] of stops) g.addColorStop(o, col)
        return g
      }
      const disc = (x, y, r, fill) => {
        c.fillStyle = fill
        c.beginPath()
        c.arc(x, y, r, 0, 6.283)
        c.fill()
      }
      function halo(x, y, r, rgb, a) {
        if (a <= 0 || r <= 0) return
        c.globalCompositeOperation = 'lighter'
        c.fillStyle = radial(x, y, 0, r, [[0, 'rgba(' + rgb + ', ' + a + ')'], [1, 'rgba(' + rgb + ', 0)']])
        c.fillRect(x - r, y - r, r * 2, r * 2)
        c.globalCompositeOperation = 'source-over'
      }

      // ---- The sky and the camera ----
      const rnd = prng(20120831)
      const SPECKS = Array.from({ length: Math.round(W * H / 2700) }, () => {
        const big = rnd() < 0.05
        return { x: rnd() * W, y: rnd() * H, depth: 0.25 + rnd() * 0.75, r: big ? 1.2 + rnd() * 0.9 : 0.35 + rnd() * 0.75,
          a: big ? 0.8 + rnd() * 0.2 : 0.2 + rnd() * 0.55, tw: 0.6 + rnd() * 1.6, ph: rnd() * 6.283, big, warm: rnd() < 0.25 }
      })
      let cam = { x: W / 2, y: H / 2, zoom: 1 }
      // The canvas transform for depth d: parallax scales the camera's
      // offset and zoom by d
      function view(d = 1) {
        const z = 1 + (cam.zoom - 1) * d
        const x = W / 2 + (cam.x - W / 2) * d, y = H / 2 + (cam.y - H / 2) * d
        c.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - x * z), DPR * (H / 2 - y * z))
      }
      function screen(x, y, d = 1) {
        const z = 1 + (cam.zoom - 1) * d
        const cx = W / 2 + (cam.x - W / 2) * d, cy = H / 2 + (cam.y - H / 2) * d
        return [W / 2 + (x - cx) * z, H / 2 + (y - cy) * z]
      }
      function depth(d, draw) {
        c.save()
        view(d)
        draw()
        c.restore()
        view(1)
      }

      let parts = []
      function stage(t, { camera = {}, drift = t * 6, driftY = 0, glow = 1, specks = 1 } = {}) {
        parts = []
        ui.innerHTML = ''
        cam = { x: W / 2, y: H / 2, zoom: 1, ...camera }
        c.setTransform(DPR, 0, 0, DPR, 0, 0)
        c.globalCompositeOperation = 'source-over'
        c.filter = 'none'
        const g = c.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, '${S.sky[0]}')
        g.addColorStop(0.55, '${S.sky[1]}')
        g.addColorStop(1, '${S.sky[2]}')
        c.fillStyle = g
        c.fillRect(0, 0, W, H)
        // Clouds and specks sit far away: they move a fraction of the camera
        const far = (cam.x - W / 2) * 0.15, farY = (cam.y - H / 2) * 0.15
        for (const [fx, fy, fr, rgb, a] of ${JSON.stringify(S.clouds)}) {
          const x = fx * W - drift * 0.2 - far, y = fy * H - farY, r = fr * W
          c.fillStyle = radial(x, y, 0, r, [[0, 'rgba(' + rgb + ', ' + a * glow + ')'], [1, 'rgba(0,0,0,0)']])
          c.fillRect(0, 0, W, H)
        }
        if (specks > 0) {
          for (const s of SPECKS) {
            const x = (((s.x - (drift + (cam.x - W / 2) * 0.4) * s.depth) % W) + W) % W
            const y = (((s.y - (driftY + (cam.y - H / 2) * 0.4) * s.depth) % H) + H) % H
            const a = specks * s.a * (0.72 + 0.28 * Math.sin(t * s.tw + s.ph))
            const col = s.warm ? '${S.specks[1]}' : '${S.specks[0]}'
            c.fillStyle = 'rgba(' + col + ', ' + a + ')'
            c.beginPath()
            c.arc(x, y, s.r, 0, 6.283)
            c.fill()
            if (s.big) {
              c.fillStyle = radial(x, y, 0, s.r * 6, [[0, 'rgba(' + col + ', ' + a * 0.35 + ')'], [1, 'rgba(' + col + ', 0)']])
              c.fillRect(x - s.r * 6, y - s.r * 6, s.r * 12, s.r * 12)
            }
          }
        }
        view(1)
      }

      // ---- A light source: bloom, rays, lens streak, hot core ----
      function light(t, x, y, r, { color = C.rgb.light, glow: gl = 1, rays = 1, streak = 1 } = {}) {
        c.globalCompositeOperation = 'lighter'
        const pulse = 1 + 0.03 * Math.sin(t * 1.7)
        c.fillStyle = radial(x, y, 0, r * 7 * pulse, [[0, 'rgba(' + color + ', ' + 0.32 * gl + ')'], [0.25, 'rgba(' + color + ', ' + 0.12 * gl + ')'], [1, 'rgba(' + color + ', 0)']])
        c.fillRect(x - r * 8, y - r * 8, r * 16, r * 16)
        c.fillStyle = radial(x, y, r * 0.8, r * 2.2, [[0, 'rgba(255, 240, 210, ' + 0.6 * gl + ')'], [0.35, 'rgba(' + color + ', ' + 0.25 * gl + ')'], [1, 'rgba(' + color + ', 0)']])
        c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6)
        if (rays > 0) {
          c.save()
          c.translate(x, y)
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * 6.283 + t * 0.06 + (i % 2) * 0.13
            const len = r * (1.9 + 0.6 * Math.sin(i * 2.3 + t * 0.8))
            c.rotate(a)
            const g = c.createLinearGradient(0, 0, len, 0)
            g.addColorStop(0, 'rgba(' + color + ', ' + 0.16 * gl * rays + ')')
            g.addColorStop(1, 'rgba(' + color + ', 0)')
            c.fillStyle = g
            c.beginPath()
            c.moveTo(r * 0.6, -r * 0.09)
            c.lineTo(len, 0)
            c.lineTo(r * 0.6, r * 0.09)
            c.fill()
            c.rotate(-a)
          }
          c.restore()
        }
        if (streak > 0) {
          c.save()
          c.translate(x, y)
          c.scale(1, 0.018)
          c.fillStyle = radial(0, 0, 0, r * 7, [[0, 'rgba(255, 240, 210, ' + 0.55 * streak * gl + ')'], [1, 'rgba(' + color + ', 0)']])
          c.fillRect(-r * 7, -r * 7, r * 14, r * 14)
          c.restore()
        }
        c.globalCompositeOperation = 'source-over'
        disc(x, y, r, radial(x - r * 0.12, y - r * 0.12, 0, r * 1.05, [[0, '#fffef8'], [0.55, 'rgba(255, 245, 225, 1)'], [0.85, 'rgba(' + color + ', 1)'], [1, 'rgba(' + color + ', 0.9)']]))
        halo(x, y, r * 1.35, '255, 240, 215', 0.28 * gl)
      }

      // ---- A lit sphere with a night side ----
      function shade(hex, k) {
        const [r, g, b] = rgbOf(hex).split(', ').map(Number)
        const f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))
        return 'rgb(' + f(r) + ', ' + f(g) + ', ' + f(b) + ')'
      }
      function sphere(t, x, y, r, { color = C.accent2, atmosphere = null, light: la = Math.PI, spin = 0, bands = 0 } = {}) {
        const lx = Math.cos(la), ly = Math.sin(la)
        const atm = atmosphere ?? rgbOf(color)
        halo(x, y, r * 1.7, atm, 0.3)
        disc(x, y, r, radial(x + lx * r * 0.4, y + ly * r * 0.4, 0, r * 1.25, [[0, shade(color, 0.7)], [0.35, shade(color, 0.15)], [0.75, shade(color, -0.25)], [1, shade(color, -0.65)]]))
        c.save()
        c.beginPath()
        c.arc(x, y, r, 0, 6.283)
        c.clip()
        // Soft bands drifting with spin (clouds, currents)
        c.strokeStyle = 'rgba(255, 255, 255, 0.16)'
        c.lineCap = 'round'
        for (let i = 0; i < bands; i++) {
          const yy = y - r * 0.7 + i * (r * 1.4 / Math.max(1, bands - 1))
          c.lineWidth = r * (0.05 + (i % 2) * 0.03)
          c.beginPath()
          c.moveTo(x - r + ((spin * 40 + i * 37) % (r * 0.6)), yy)
          c.bezierCurveTo(x - r * 0.3, yy - r * 0.12, x + r * 0.2, yy + r * 0.12, x + r * 0.7, yy - r * 0.05)
          c.stroke()
        }
        // Night side: darkness away from the lit point
        c.fillStyle = radial(x + lx * r * 0.6, y + ly * r * 0.6, r * 0.2, r * 2, [[0, 'rgba(2, 5, 16, 0)'], [0.4, 'rgba(2, 5, 16, 0.5)'], [0.62, 'rgba(2, 5, 16, 0.9)'], [1, 'rgba(2, 5, 16, 0.97)']])
        c.fillRect(x - r, y - r, r * 2, r * 2)
        c.restore()
        c.strokeStyle = 'rgba(' + atm + ', 0.7)'
        c.lineWidth = Math.min(3, Math.max(1, r * 0.035))
        c.beginPath()
        c.arc(x, y, r - c.lineWidth / 2, la - 1.2, la + 1.2)
        c.stroke()
      }

      // ---- Light that travels ----
      function beam(x0, y0, x1, y1, p, { color = C.rgb.light, width = 3, tail = 0.35, guide = 0.16, head = 1 } = {}) {
        const pt = q => [lerp(x0, x1, q), lerp(y0, y1, q)]
        if (guide > 0) {
          c.strokeStyle = 'rgba(' + color + ', ' + guide + ')'
          c.lineWidth = 1
          c.setLineDash([2, 8])
          c.beginPath()
          c.moveTo(x0, y0)
          c.lineTo(x1, y1)
          c.stroke()
          c.setLineDash([])
        }
        if (p <= 0) return
        const [ax, ay] = pt(Math.max(0, p - tail))
        const [bx, by] = pt(Math.min(1, p))
        c.globalCompositeOperation = 'lighter'
        for (const [w, a] of [[width * 6, 0.12], [width * 2.5, 0.35], [width, 1]]) {
          const g = c.createLinearGradient(ax, ay, bx, by)
          g.addColorStop(0, 'rgba(' + color + ', 0)')
          g.addColorStop(1, 'rgba(' + color + ', ' + a + ')')
          c.strokeStyle = g
          c.lineWidth = w
          c.lineCap = 'round'
          c.beginPath()
          c.moveTo(ax, ay)
          c.lineTo(bx, by)
          c.stroke()
        }
        c.globalCompositeOperation = 'source-over'
        if (head > 0 && p < 1) halo(bx, by, 34, color, head)
      }

      // A glowing polyline drawn on with p (curves and charts as light)
      function trail(points, p, { color = C.rgb.accent, width = 3, glow: gl = 1 } = {}) {
        if (points.length < 2 || p <= 0) return
        const seg = []
        let total = 0
        for (let i = 1; i < points.length; i++) {
          const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
          seg.push(d)
          total += d
        }
        let end = points[0]
        const path = () => {
          c.beginPath()
          c.moveTo(points[0][0], points[0][1])
          let rest = total * clamp(p)
          for (let i = 1; i < points.length && rest > 0; i++) {
            const k = Math.min(1, rest / seg[i - 1])
            end = [lerp(points[i - 1][0], points[i][0], k), lerp(points[i - 1][1], points[i][1], k)]
            c.lineTo(end[0], end[1])
            rest -= seg[i - 1]
          }
        }
        c.globalCompositeOperation = 'lighter'
        c.lineCap = 'round'
        c.lineJoin = 'round'
        for (const [w, a] of [[width * 5, 0.1 * gl], [width * 2.2, 0.3 * gl], [width, 1]]) {
          path()
          c.strokeStyle = 'rgba(' + color + ', ' + a + ')'
          c.lineWidth = w
          c.stroke()
        }
        c.globalCompositeOperation = 'source-over'
        if (p < 1) halo(end[0], end[1], width * 9, color, 0.8 * gl)
      }

      // Glowing particles streaming through a box, seeded
      function particles(t, { n = 60, seed = 1, x = 0, y = 0, w = W, h = H, size = 2, color = C.rgb.cool, vx = 40, vy = 0, life = 3 } = {}) {
        const q = prng(seed)
        c.globalCompositeOperation = 'lighter'
        for (let i = 0; i < n; i++) {
          const px0 = q(), py0 = q(), ph = q(), s = size * (0.5 + q())
          const age = ((t / life + ph) % 1)
          const px = x + ((((px0 * w + vx * age * life) % w) + w) % w)
          const py = y + ((((py0 * h + vy * age * life) % h) + h) % h)
          const a = Math.sin(age * Math.PI)
          c.fillStyle = radial(px, py, 0, s * 4, [[0, 'rgba(' + color + ', ' + 0.9 * a + ')'], [0.3, 'rgba(' + color + ', ' + 0.35 * a + ')'], [1, 'rgba(' + color + ', 0)']])
          c.fillRect(px - s * 4, py - s * 4, s * 8, s * 8)
        }
        c.globalCompositeOperation = 'source-over'
      }

      // ---- Type ----
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      const show = (p, dy = 26) => 'opacity:' + clamp(p).toFixed(3) + ';transform:translateY(' + ((1 - clamp(p)) * dy).toFixed(1) + 'px);filter:blur(' + ((1 - clamp(p)) * 8).toFixed(1) + 'px)'
      function add(html) {
        parts.push(html)
        ui.innerHTML = parts.join('')
      }
      const block = ({ x = PAD, y, w = SAFE_RIGHT - PAD, p = 1, dy, cls = '', html, style = '' }) =>
        add('<div class="' + cls + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;' + show(p, dy) + ';' + style + '">' + html + '</div>')
      const setUI = html => { parts = [html]; ui.innerHTML = html }
      function caption({ kicker = '', head = '', sub = '', p = 1, y = ${headTop}, align = 'left', size } = {}) {
        const fmtHead = s => esc(s).replace(/\\*(.+?)\\*/g, '<b>$1</b>')
        const lines = (Array.isArray(head) ? head : [head]).filter(Boolean).map(fmtHead).join('<br>')
        const style = 'text-align:' + align + (size ? ';font-size:' + size + 'px' : '')
        if (kicker) block({ y: y - 46, p: clamp(p * 1.4), cls: 'kicker', style: align === 'center' ? 'justify-content:center' : '', html: esc(kicker) })
        if (lines) block({ y, p, cls: 'head', style, html: lines })
        if (sub) block({ y: y + (size || ${headSize}) * 1.18 * (Array.isArray(head) ? head.length : 1) + 18, p: clamp(p * 1.2 - 0.2), cls: 'sub', style, html: esc(sub) })
      }
      const source = (text, p = 1) => block({ y: SAFE_BOTTOM - 36, p, dy: 8, cls: 'source', html: esc(text) })

      // The starter title card, until a shot gets its own design
      function card(t, { kicker, title, body, progress }) {
        stage(t, { camera: { zoom: 1 + 0.03 * t } })
        light(t, W * 0.5, H * 0.62, Math.min(W, H) * 0.12)
        caption({ kicker, head: title.replace(/<\\/?b>/g, '*'), sub: body, p: rise(t, 0.1, 0.7) })
      }

      window.kit = { W, H, PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM, C, FONT, HEAD_FONT, MONO, c, clamp, lerp, ease, rise, fall, pop, stagger, hold, float,
        readTime, hash, prng, count, fmt, radial, disc, stage, depth, screen, light, sphere, halo, glow: halo, beam, trail, particles, caption, source, block, setUI, show, card }
      window.ready = document.fonts.ready
    </script>
  </body>
</html>
`
}
