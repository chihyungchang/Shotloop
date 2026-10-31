// world/parts.js: the recurring pictures of "Why is the sky blue, and why are
// sunsets red". Canvas parts for the scene page: each draws on kit.c in world
// coordinates (call after kit.stage, so the camera applies) and is a pure
// function of its options. Defaults sit inside the safe area (x 40…620,
// y 110…1024) with room for a two-line caption at the top.
//
// Colour meanings, fixed for the whole video: BLUE is scattered light,
// ORANGE-RED is light that gets through, TEAL is air.
//
//   import { sunBeam, airMolecules, scatter, earthSection, earthGeometry, figure, STRANDS } from '../../world/parts.js'
//
// STRANDS: the five colour strands, top to bottom:
//   [{ name: 'blue' | 'green' | 'yellow' | 'orange' | 'red', nm, rgb ('r, g, b'), lambda (drawn wave px) }]
//   Use STRANDS[0].rgb for any blue photon, STRANDS[4].rgb / STRANDS[3].rgb for red / orange.
//
// sunBeam(kit, { t, x0 = 120, y0 = 450, sunR = 44, sun = 1, splitX = 300, splitY = 600,
//                x1 = 600, y1 = splitY + 40, gap = 92, p = 1, split = 1, strands = 1,
//                peel = 0, labels = 1, flow = 1, scale = 1 }) → { split: [x, y], ends: [[x, y] ×5] }
//   The Sun blooming at (x0, y0) (radius sunR, glow `sun`, 0 = not drawn), a white beam
//   running to the split point (splitX, splitY), then five glowing wave strands fanning
//   out to x1, centred on y1, `gap` px apart: blue on top (short tight waves) … red at the
//   bottom (long lazy waves). Waves ripple outward with t.
//   p        0…1 the white pulse travelling Sun → split (pass a linear p)
//   split    0…1 how far the strands have drawn on; a number or an array of 5 (stagger)
//   strands  0…1 visibility of each strand; number or array of 5 (blue…red)
//   peel     0…1 per strand (number or array of 5): the strand bends away sideways and
//            fades out (blue/green/yellow peel upward, orange/red downward); shot 6
//   labels   0…1 the '≈470 nm' (above blue end) and '≈700 nm' (below red end) labels;
//            they fade in and count up to their value
//   flow     brightness of photons flowing along the white beam
//   x1 < splitX runs the strands right to left; blue stays on top, labels at the left end.
//
// airMolecules(kit, { t, x = 40, y = 330, w = 580, h = 640, n = 40, seed = 7, far = 0.55,
//                     near = 1.35, p = 1, labels = 0, scale = 1 }) → molecules
//   Air: small soft-glowing white-teal diatomic molecules (two touching dots, slowly
//   turning and jiggling) with faint halos, at parallax depths far…near in the box.
//   Molecules 0 and 1 sit on the subject plane at (30%, 32%) and (68%, 62%) of the box.
//   p        0…1 the field fades in (staggered)
//   labels   0…1 'air molecule' on molecule 0 (show once, in shot 3)
//   Returns [{ i, d, x, y, sx, sy, wx, wy }]: (x, y) in its depth layer d, (sx, sy) on
//   screen, (wx, wy) the subject-plane world point over it: aim photons there to hit it.
//
// scatter(kit, { x, y, p, n = 5, seed = 1, len = 90, rgb = STRANDS[0].rgb, angle = 0,
//                spread = 2π, scale = 1 })
//   A photon ricocheting off a molecule at (x, y): a flash, then n short streaks flying
//   out in seeded directions (angle ± spread / 2), fading as p goes 0 → 1.
//
// earthGeometry({ x = 360, y = 900, R = 520, shell = 120, sunHigh = 260,
//                 sunsetAngle = 0.16, h = 30, sun = 0 }) → geometry
//   The points of the Earth cross-section, without drawing: { center, R, shell, feet, eye,
//   top (shell top above the figure), noonSun, sunsetSun, sunsetEntry (where the sunset
//   path enters the shell), sunPos (the Sun for `sun`), noonLen, sunsetLen (in-shell px) }.
//
// earthSection(kit, { t, x = 360, y = 900, R = 520, shell = 120, sunHigh = 260,
//                     sunsetAngle = 0.16, h = 30, sun = 0, sunR = 30, sunGlow = 1, warm = 0,
//                     noon = 0, sunset = 0, dusk = 0, glow = 1 }) → geometry
//   Earth's curve across the bottom (centre (x, y + R)), a glowing teal atmosphere shell
//   `shell` px thick, a small dark figure (height h) standing on top at (x, y).
//   sun      0 = noon (straight above the figure, sunHigh px over the shell) … 1 = sunset
//            (low at the right horizon, just outside the shell); it glides along an arc
//   warm     0…1 the Sun's colour, white-gold → deep red disc
//   noon     0…1 the noon path drawing on: teal-white light dropping straight down
//   sunset   0…1 the sunset path drawing on: warm light from the right horizon, long
//            through the shell (the in-shell part glows wider)
//   dusk     0…1 the air behind the figure blooms orange-red (shot 6)
//   Returns earthGeometry(...) for placing counters ('1×', '≈38×') and the camera.
//   The drawn path lengths are illustrative, not to scale.
//
// figure(kit, { x, y, h = 30, rim = '255, 220, 160', rimA = 0.7 })
//   The small dark standing figure, feet at (x, y), with a thin rim of light.

export const STRANDS = [
  { name: 'blue', nm: 470, rgb: '80, 150, 255', lambda: 15 },
  { name: 'green', nm: 530, rgb: '90, 225, 140', lambda: 21 },
  { name: 'yellow', nm: 580, rgb: '245, 225, 70', lambda: 26 },
  { name: 'orange', nm: 620, rgb: '255, 110, 20', lambda: 32 },
  { name: 'red', nm: 700, rgb: '255, 45, 60', lambda: 40 }
]
const WHITE = '255, 248, 236'
const AIR = '79, 209, 197'
const tint = (rgb, k) => rgb.split(',').map(v => Math.round(+v + (255 - +v) * k)).join(', ')
const mix = (a, b, k) => {
  const A = a.split(',').map(Number), B = b.split(',').map(Number)
  return A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(', ')
}
const per = (v, i, d) => (Array.isArray(v) ? (v[i] ?? d) : v ?? d)

// A glowing polyline: wide soft glow, inner glow, bright tinted core
function glowLine(kit, pts, rgb, width, a = 1) {
  const { c } = kit
  if (pts.length < 2 || a <= 0) return
  c.save()
  c.globalCompositeOperation = 'lighter'
  c.lineCap = 'round'
  c.lineJoin = 'round'
  for (const [w, al, col] of [[width * 5, 0.09, rgb], [width * 2.2, 0.3, rgb], [width, 1, tint(rgb, 0.2)]]) {
    c.strokeStyle = 'rgba(' + col + ', ' + al * a + ')'
    c.lineWidth = w
    c.beginPath()
    c.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1])
    c.stroke()
  }
  c.restore()
}

// ---- Sunlight beam with colour strands ----
export function sunBeam(kit, o = {}) {
  const { clamp, lerp, ease, halo } = kit
  const { t = 0, x0 = 120, y0 = 450, sunR = 44, sun = 1, splitX = 300, splitY = 600, x1 = 600, gap = 92,
    p = 1, split = 1, strands = 1, peel = 0, labels = 1, flow = 1, scale: k = 1 } = o
  const y1 = o.y1 ?? splitY + 40
  const dir = Math.sign(x1 - splitX) || 1

  if (sun > 0) kit.light(t, x0, y0, sunR, { glow: sun })

  // The white beam, with photons flowing along it
  const L0 = Math.hypot(splitX - x0, splitY - y0) || 1
  const ux = (splitX - x0) / L0, uy = (splitY - y0) / L0
  const s0 = sunR * 0.85, pb = clamp(p)
  if (pb > 0) {
    const head = s0 + (L0 - s0) * pb
    glowLine(kit, [[x0 + ux * s0, y0 + uy * s0], [x0 + ux * head, y0 + uy * head]], WHITE, 4.5 * k)
    for (let i = 0; i < 5; i++) {
      const q = (((t * 0.8 + i / 5) % 1) + 1) % 1
      const d = s0 + (L0 - s0) * q
      if (d < head) halo(x0 + ux * d, y0 + uy * d, 16 * k, WHITE, 0.45 * flow * Math.sin(q * Math.PI))
    }
    if (pb < 1) halo(x0 + ux * head, y0 + uy * head, 46 * k, WHITE, 0.95)
  }

  // The split: a white node that flashes as the strands leave it
  const sp0 = clamp(per(split, 0, 0))
  if (pb >= 1 && sp0 > 0) {
    halo(splitX, splitY, 70 * k, WHITE, 0.25 + 0.6 * (1 - clamp(sp0 * 2.5)))
    halo(splitX, splitY, 16 * k, WHITE, 0.8)
  }

  // Five wave strands fanning out
  const Lx = Math.abs(x1 - splitX) || 1
  const ends = []
  STRANDS.forEach((s, i) => {
    const sp = pb >= 1 ? clamp(per(split, i, 0)) : 0
    const pl = ease(clamp(per(peel, i, 0)))
    const a = clamp(per(strands, i, 1)) * (1 - pl)
    const off = (i - 2) * gap, side = i <= 2 ? -1 : 1
    const lam = s.lambda * k, A = 7 * k
    const at = (sd, wave = true) => {
      const u = sd / Lx, fan = 1 - Math.pow(1 - u, 2.2)
      const y = lerp(splitY, y1, u) + off * fan + side * pl * 280 * k * u * u
      const w = wave ? A * clamp(sd / 60) * Math.sin((2 * Math.PI * (sd - t * 80 * k)) / lam) : 0
      return [splitX + dir * sd, y + w]
    }
    ends.push(at(Lx, false))
    if (sp <= 0 || a <= 0) return
    const n = Math.max(2, Math.ceil((Lx * sp) / 2.5))
    const pts = []
    for (let j = 0; j <= n; j++) pts.push(at((Lx * sp * j) / n))
    glowLine(kit, pts, s.rgb, 2.6 * k, a)
    const [hx, hy] = pts[pts.length - 1]
    halo(hx, hy, (sp < 1 ? 32 : 22) * k, s.rgb, (sp < 1 ? 0.85 : 0.35) * a)
  })

  // nm labels at the blue and red ends, counting up
  if (labels > 0) {
    const q = ease(clamp(labels))
    for (const [i, dy] of [[0, -44 * k], [4, 14 * k]]) {
      const s = STRANDS[i]
      const a = clamp(per(strands, i, 1)) * (1 - ease(clamp(per(peel, i, 0))))
      if (a <= 0) continue
      const [sx, sy] = kit.screen(ends[i][0], ends[i][1] + dy)
      const w = 180
      kit.block({
        x: dir > 0 ? sx - w : sx, y: sy, w, p: clamp(labels * 2.5) * a, dy: 10, cls: 'num',
        style: 'text-align:' + (dir > 0 ? 'right' : 'left') + ';font-size:' + Math.round(26 * k) + 'px;color:rgb(' + tint(s.rgb, 0.4) +
          ');text-shadow:0 0 16px rgba(' + s.rgb + ', 0.9)',
        html: '≈' + Math.round(s.nm * q) + ' nm'
      })
    }
  }
  return { split: [splitX, splitY], ends }
}

// ---- Air molecules ----
export function airMolecules(kit, o = {}) {
  const { clamp, halo, radial, disc } = kit
  const { t = 0, x = 40, y = 330, w = 580, h = 640, n = 40, seed = 7, far = 0.55, near = 1.35, p = 1, labels = 0, scale = 1 } = o
  const q = kit.prng(seed)
  const list = []
  for (let i = 0; i < n; i++) {
    const fx0 = q(), fy0 = q(), dd = q(), ang = q() * Math.PI, ph = q() * 6.283, sp = 0.4 + q() * 0.6
    const d = i < 2 ? 1 : far + (near - far) * dd
    const fx = i === 0 ? 0.3 : i === 1 ? 0.68 : fx0
    const fy = i === 0 ? 0.32 : i === 1 ? 0.62 : fy0
    list.push({
      i, d, ang: ang + t * 0.6 * (sp - 0.7),
      x: x + fx * w + 3 * Math.sin(t * sp * 1.3 + ph), y: y + fy * h + 3 * Math.cos(t * sp + ph * 1.7)
    })
  }
  const draw = m => {
    const a = clamp(p * 1.6 - (m.i / n) * 0.6) * (0.45 + 0.55 * clamp((m.d - far) / Math.max(0.01, near - far)))
    if (a <= 0) return
    const r = 3.4 * scale * Math.pow(m.d, 0.8)
    halo(m.x, m.y, r * 6, AIR, 0.22 * a)
    const cx = Math.cos(m.ang) * r * 0.55, cy = Math.sin(m.ang) * r * 0.55
    for (const s of [-1, 1]) {
      const px = m.x + s * cx, py = m.y + s * cy
      disc(px, py, r * 0.78, radial(px - r * 0.2, py - r * 0.2, 0, r, [[0, 'rgba(255, 255, 255, ' + a + ')'], [0.6, 'rgba(200, 250, 242, ' + 0.9 * a + ')'], [1, 'rgba(' + AIR + ', ' + 0.5 * a + ')']]))
    }
    halo(m.x, m.y, r * 2, '220, 255, 250', 0.35 * a)
  }
  for (const m of [...list].sort((a, b) => a.d - b.d)) kit.depth(m.d, () => draw(m))

  // Screen and subject-plane positions, for aiming photons
  const [ox, oy] = kit.screen(0, 0), [zx] = kit.screen(1, 0), z = zx - ox || 1
  for (const m of list) {
    const [sx, sy] = kit.screen(m.x, m.y, m.d)
    Object.assign(m, { sx, sy, wx: (sx - ox) / z, wy: (sy - oy) / z })
  }
  if (labels > 0) {
    for (const [i, name] of [[0, 'air molecule']]) {
      const m = list[i]
      kit.block({
        x: m.sx + 14, y: m.sy - 40, w: 200, p: clamp(labels), dy: 8,
        style: 'font:600 26px/1 ' + kit.FONT + ';color:rgb(200, 250, 242);text-shadow:0 0 14px rgba(' + AIR + ', 0.9)',
        html: name
      })
    }
  }
  return list.map(({ i, d, x, y, sx, sy, wx, wy }) => ({ i, d, x, y, sx, sy, wx, wy }))
}

// ---- A photon scattered off a molecule ----
export function scatter(kit, { x, y, p, n = 5, seed = 1, len = 90, rgb = STRANDS[0].rgb, angle = 0, spread = Math.PI * 2, scale = 1 } = {}) {
  const { clamp, halo, hash } = kit
  if (p <= 0 || p >= 1) return
  halo(x, y, 28 * scale, rgb, 0.9 * (1 - clamp(p * 4)))
  const out = 1 - Math.pow(1 - p, 2), fade = 1 - p * p
  for (let i = 0; i < n; i++) {
    const a = angle + (hash(seed, i) - 0.5) * spread
    const dist = len * (0.7 + 0.6 * hash(seed, i + 50)) * out
    const tl = Math.max(0, dist - 24 * scale)
    const dx = Math.cos(a), dy = Math.sin(a)
    glowLine(kit, [[x + dx * tl, y + dy * tl], [x + dx * dist, y + dy * dist]], rgb, 2.2 * scale, fade)
    halo(x + dx * dist, y + dy * dist, 10 * scale, rgb, 0.6 * fade)
  }
}

// ---- The small standing figure ----
export function figure(kit, { x, y, h = 30, rim = '255, 220, 160', rimA = 0.7 } = {}) {
  const { c } = kit
  c.save()
  c.beginPath()
  // body: shoulders to feet, legs slightly apart
  c.moveTo(x - h * 0.17, y - h * 0.68)
  c.quadraticCurveTo(x, y - h * 0.76, x + h * 0.17, y - h * 0.68)
  c.lineTo(x + h * 0.14, y - h * 0.3)
  c.lineTo(x + h * 0.12, y)
  c.lineTo(x + h * 0.03, y)
  c.lineTo(x, y - h * 0.3)
  c.lineTo(x - h * 0.03, y)
  c.lineTo(x - h * 0.12, y)
  c.lineTo(x - h * 0.14, y - h * 0.3)
  c.closePath()
  c.moveTo(x + h * 0.12, y - h * 0.87)
  c.arc(x, y - h * 0.87, h * 0.12, 0, 6.283)
  c.fillStyle = '#03050b'
  c.fill()
  c.strokeStyle = 'rgba(' + rim + ', ' + rimA + ')'
  c.lineWidth = 1.2
  c.stroke()
  c.restore()
}

// ---- Earth cross-section with atmosphere ----
export function earthGeometry({ x = 360, y = 900, R = 520, shell = 120, sunHigh = 260, sunsetAngle = 0.16, h = 30, sun = 0 } = {}) {
  const center = [x, y + R], feet = [x, y], eye = [x, y - h * 0.85], top = [x, y - shell]
  const ed = center[1] - eye[1], Rs = R + shell
  const sa = Math.sin(sunsetAngle), ca = Math.cos(sunsetAngle)
  const b = ed * sa, s = -b + Math.sqrt(Math.max(0, b * b - ed * ed + Rs * Rs))
  const sunsetEntry = [eye[0] + ca * s, eye[1] - sa * s]
  const sunsetSun = [eye[0] + ca * (s + 28), eye[1] - sa * (s + 28)]
  const noonSun = [x, y - shell - sunHigh]
  const k = Math.min(1, Math.max(0, sun))
  const th = Math.PI / 2 + (sunsetAngle - Math.PI / 2) * k
  const dist = (eye[1] - noonSun[1]) + (s + 28 - (eye[1] - noonSun[1])) * k
  const sunPos = [eye[0] + Math.cos(th) * dist, eye[1] - Math.sin(th) * dist]
  return { center, R, shell, feet, eye, top, noonSun, sunsetSun, sunsetEntry, sunPos, noonLen: eye[1] - top[1], sunsetLen: s }
}

export function earthSection(kit, o = {}) {
  const { c, clamp, lerp, halo, radial } = kit
  const { t = 0, h = 30, sunR = 30, sunGlow = 1, warm = 0, noon = 0, sunset = 0, dusk = 0, glow = 1 } = o
  const g = earthGeometry(o)
  const [ox, oy] = g.center, Rs = g.R + g.shell

  // The Sun, white-gold to deep red
  if (sunGlow > 0) kit.light(t, g.sunPos[0], g.sunPos[1], sunR * (1 + 0.25 * warm), { glow: sunGlow, color: mix('255, 200, 120', '255, 70, 40', clamp(warm)) })

  // The atmosphere shell
  const air = mix(AIR, '255, 120, 60', 0.5 * clamp(dusk))
  c.save()
  c.globalCompositeOperation = 'lighter'
  c.fillStyle = radial(ox, oy, Rs, Rs + 50, [[0, 'rgba(' + air + ', ' + 0.12 * glow + ')'], [1, 'rgba(' + air + ', 0)']])
  c.beginPath()
  c.arc(ox, oy, Rs + 50, 0, 6.283)
  c.arc(ox, oy, Rs, 0, 6.283, true)
  c.fill()
  c.fillStyle = radial(ox, oy, g.R, Rs, [[0, 'rgba(' + air + ', ' + 0.45 * glow + ')'], [0.4, 'rgba(' + air + ', ' + 0.2 * glow + ')'], [1, 'rgba(' + air + ', ' + 0.05 * glow + ')']])
  c.beginPath()
  c.arc(ox, oy, Rs, 0, 6.283)
  c.arc(ox, oy, g.R, 0, 6.283, true)
  c.fill()
  c.strokeStyle = 'rgba(' + air + ', ' + 0.35 * glow + ')'
  c.lineWidth = 1.5
  c.beginPath()
  c.arc(ox, oy, Rs, 0, 6.283)
  c.stroke()
  c.restore()
  if (dusk > 0) {
    c.save()
    c.beginPath()
    c.arc(ox, oy, Rs, 0, 6.283)
    c.clip()
    halo(g.eye[0] + g.shell * 0.6, g.eye[1] - g.shell * 0.3, g.shell * 2.6, '255, 110, 50', 0.6 * clamp(dusk))
    c.restore()
  }

  // Earth: a dark blue body lit along its top
  c.save()
  c.beginPath()
  c.arc(ox, oy, g.R, 0, 6.283)
  c.fillStyle = radial(g.feet[0], g.feet[1], 0, g.R * 1.3, [[0, '#1f5b8c'], [0.22, '#0d2a4d'], [1, '#02060f']])
  c.fill()
  c.strokeStyle = 'rgba(' + mix('200, 250, 255', '255, 170, 110', clamp(dusk)) + ', 0.8)'
  c.lineWidth = 2
  c.beginPath()
  c.arc(ox, oy, g.R - 1, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9)
  c.stroke()
  c.restore()

  // The paths: light drawn on, the stretch inside the air glowing wider
  const path = (from, entry, p, rgb) => {
    if (p <= 0) return
    const to = [g.eye[0], g.eye[1] - 4]
    kit.trail([from, to], p, { color: rgb, width: 3 })
    const L = Math.hypot(to[0] - from[0], to[1] - from[1]), Le = Math.hypot(entry[0] - from[0], entry[1] - from[1])
    const q = clamp((p * L - Le) / Math.max(1, L - Le))
    if (q > 0) glowLine(kit, [entry, [lerp(entry[0], to[0], q), lerp(entry[1], to[1], q)]], rgb, 9, 0.22)
  }
  path([g.noonSun[0], g.noonSun[1] + sunR], g.top, clamp(noon), '200, 245, 255')
  const dx = g.eye[0] - g.sunsetSun[0], dy = g.eye[1] - g.sunsetSun[1], dl = Math.hypot(dx, dy)
  path([g.sunsetSun[0] + (dx / dl) * sunR, g.sunsetSun[1] + (dy / dl) * sunR], g.sunsetEntry, clamp(sunset), '255, 175, 100')

  figure(kit, { x: g.feet[0], y: g.feet[1], h, rim: mix('255, 220, 160', '255, 120, 70', clamp(warm)) })
  return g
}
