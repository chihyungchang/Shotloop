/*
  Recurring pictures of "How does a zipper work" (blueprint line art on the Midnight look).
  Every function is pure: (kit, options) → SVG markup for kit.stage(). Nothing reads the clock:
  pass the state you want (how far the slider is, how much is drawn on, what glows).

  Colours, the same in every shot:
    line art (tapes, slider, stops)   C.text ink, hatched sections in C.muted
    left row of teeth                  C.hue.blue
    right row of teeth                 C.hue.orange (amber)
    teal glow (C.hue.teal)             a tooth that is locked
    red (C.hue.red)                    force

  ── toothShape(kit, { x = 330, y = 600, size = 60, side = 'left', angle = 0, p = 1, fill = 1,
                       hatch = 0, glow = 0, ghost = false, labels = 0, opacity = 1 })
    One tooth, drawn the same everywhere (the zipper column uses it too). (x, y) is the
    centre of its head; size is the head's height in px. The head is 2.4·size wide; a neck
    runs 2.4·size back from the head centre towards the tape. Raised bump on top (towards −y),
    hollow pocket underneath. side 'left' = blue, head pointing right (neck to the left);
    'right' = amber, the mirror image (bump still on top). angle (deg) tilts it about the
    head centre (negative = counter-clockwise). p 0→1 traces the outline on; fill 0→1 its
    tint; hatch 0→1 section hatching (a cut-open tooth); glow 0→1 the teal "locked" halo;
    ghost: a faint dashed outline (e.g. the next tooth sliding in), its opacity follows p;
    labels 0→1 snaps out the 'bump' and 'hollow' callouts and types them on.
    Nesting: put a tooth of the other side (size + 2) px higher (same x, same size) and
    this tooth's bump sits exactly in that tooth's hollow.

  ── toothPoints(kit, { x, y, size, side, angle }) → { bump, hollow, tip, neck }
    World points ({ x, y }) on a tooth placed like toothShape: top of the bump, inside the
    hollow, the far end of the head, the end of the neck (where it grips the tape).

  ── zipperColumn(kit, { x = 330, y = 330, h = 680, close = 0, draw = 1, sliderIn = 1,
                         glow = 0, trail = 1, force = 0, spread = 1, skip = [], id = 'z' })
    The whole zipper, upright, seen from the front. x = its centre line, y = top of the
    tapes, h = height (everything, pull tab included, stays in y…y+h). 14 teeth a side.
    close 0→1 moves the slider from the bottom (open: the rows spread in a V above it) to the
    top (closed). Below the slider the teeth are interlocked (heads stacked on the centre
    line, blue and amber alternating, each bump in the next hollow).
    draw 0→1 traces the tapes and teeth on from top to bottom; sliderIn 0→1 draws the
    slider and its pull tab on. glow 0→1 a steady teal glow on every locked tooth;
    trail 0→1 the teal flash on the teeth just leaving the slider (the "click"; set 0 for
    a still, closed zipper). force 0→1 red arrows pulling the tapes apart. spread scales
    the V. skip: tooth ids left out, e.g. ['L6'] when a tooth has been lifted out.
    Size at h = 680: ≈ 200 px wide closed, ≈ 500 px across the top when fully open.
    id: a unique name when two columns share a frame.

  ── zipperGeom(kit, same options) → where things are, for callouts and moving parts:
    { cx, top, h, u (tooth size), p (pitch, same side), n, yT / yEnd (first / last tooth),
      sliderTop, sliderBottom, slider: { x, y } (its centre), sliderW, sliderH,
      tabEnd: { x, y }, teeth: [{ id: 'L0'…'L13' / 'R0'…'R13', side, i, x, y, angle, locked }],
      tapes: { left: { inner, outer }, right: … } (lists of [x, y], top to bottom), off(y) }
    A tooth from teeth[] drawn with toothShape(kit, { x, y, size: u, side, angle }) is
    exactly the one in the column.

  ── sliderCutaway(kit, { x = 330, y = 600, scale = 1, p = 1, labels = 0, arc = 0,
                          wedgeGlow = 0, id = 's' })
    The slider cut open, large: a Y-shaped channel, two arms at the top (left arm takes the
    blue row, right arm the amber row) running down into one throat that exits at the
    bottom; the divider between the arms (drawn as a wedge); hatched walls. (x, y) is its centre; at scale 1 it
    covers x−240…x+240, y−270…y+270. p 0→1 traces it on; labels 0→1 the 'Y-channel' and
    'divider' callouts; arc 0→1 the angle arc at the meeting point (with its two guide
    lines), drawn from the left arm towards the right. wedgeGlow 0→1 warms the divider
    (amber) when it is parting the teeth.

  ── sliderGeom(kit, { x, y, scale }) → { u (tooth size to use inside it), pitch, half (deg,
      each arm's tilt from vertical), meet, wedgeTip, entryL, entryR, exit (points),
      arm(side, f) → { x, y, angle }: a tooth riding the arm, f 0 at the top entry → 1 at the
        meeting point (f < 0 is above the slider);
      throat(f) → { x, y, angle: 0 }: a locked tooth on the throat's axis, f 0 at the
        meeting point → 1 at the exit (f > 1 continues below) }
    Draw the teeth with toothShape(kit, { ...sliderGeom.arm('left', f), size: u, side: 'left' }).

  ── tag(kit, x, y, text, { dx = 60, dy = -40, color = C.text, p = 1, size = 20 })
    The callout every part uses: a dot on (x, y), a leader that snaps out by (dx, dy),
    a short shoulder and the label typed on. p 0→1. Use it for any extra label.
*/

const r1 = n => Math.round(n * 10) / 10
const cl = x => Math.min(1, Math.max(0, x))
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const poly = pts => pts.map((q, i) => (i ? 'L' : 'M') + r1(q[0]) + ',' + r1(q[1])).join('')
// Draw a stroke on with p 0 → 1 (pathLength makes it pure markup)
const dash = p => p >= 1 ? '' : ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - cl(p)).toFixed(4) + '"'
const SOLID = '#101b43'   // a solid part's face: hides what it covers
const HALO = '#0b1532'    // the ground, behind label text

function defs(kit) {
  const { C } = kit
  const hatch = (id, color, op) => '<pattern id="' + id + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<line x1="0" y1="0" x2="0" y2="7" stroke="' + color + '" stroke-width="1.3" stroke-opacity="' + op + '"/></pattern>'
  return '<defs>' + hatch('zp-hatch-blue', C.hue.blue, 0.85) + hatch('zp-hatch-amber', C.hue.orange, 0.85) + hatch('zp-hatch-ink', C.muted, 0.55) +
    '<filter id="zp-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4"/></filter></defs>'
}

export function tag(kit, x, y, text, { dx = 60, dy = -40, color, p = 1, size = 20 } = {}) {
  const { C, FONT } = kit
  if (p <= 0) return ''
  color = color || C.text
  const q = cl(p / 0.55), ex = x + dx * q, ey = y + dy * q, dir = dx >= 0 ? 1 : -1
  const sh = 14 * cl((p - 0.4) / 0.2)
  const n = Math.ceil(text.length * cl((p - 0.5) / 0.5))
  let s = '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="4" fill="' + color + '"/>' +
    '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r1(4 + 6 * q) + '" fill="none" stroke="' + color + '" stroke-opacity="' + (0.6 * (1 - cl(p * 1.5 - 0.5))).toFixed(2) + '" stroke-width="1.5"/>' +
    '<path d="M' + r1(x) + ',' + r1(y) + 'L' + r1(ex) + ',' + r1(ey) + 'l' + r1(dir * sh) + ',0" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>'
  if (n > 0) s += '<text x="' + r1(ex + dir * (sh + 8)) + '" y="' + r1(ey + size * 0.36) + '" font-size="' + size + '" font-weight="600" fill="' + color +
    '" text-anchor="' + (dir > 0 ? 'start' : 'end') + '" font-family="' + FONT.replace(/"/g, '') + '" letter-spacing="0.02em" paint-order="stroke" stroke="' + HALO +
    '" stroke-width="5" stroke-linejoin="round">' + esc(text.slice(0, n)) + '<tspan fill-opacity="0" stroke-opacity="0">' + esc(text.slice(n)) + '</tspan></text>'
  return s
}

// ── The tooth ────────────────────────────────────────────────────────────

// Outline of a left tooth around its head centre, head height u
function toothPath(u) {
  const n = r1, hx = 1.2 * u, hy = 0.5 * u, r = 0.2 * u, bw = 0.36 * u, bh = 0.4 * u, pw = 0.4 * u, ph = 0.43 * u, nx = 2.4 * u, ny = 0.28 * u
  return 'M' + n(-nx) + ',' + n(-ny) + 'L' + n(-hx) + ',' + n(-ny) + 'L' + n(-hx) + ',' + n(-hy + r) + 'Q' + n(-hx) + ',' + n(-hy) + ' ' + n(-hx + r) + ',' + n(-hy) +
    'L' + n(-bw) + ',' + n(-hy) + 'C' + n(-bw) + ',' + n(-hy - bh) + ' ' + n(bw) + ',' + n(-hy - bh) + ' ' + n(bw) + ',' + n(-hy) +
    'L' + n(hx - r) + ',' + n(-hy) + 'Q' + n(hx) + ',' + n(-hy) + ' ' + n(hx) + ',' + n(-hy + r) + 'L' + n(hx) + ',' + n(hy - r) + 'Q' + n(hx) + ',' + n(hy) + ' ' + n(hx - r) + ',' + n(hy) +
    'L' + n(pw) + ',' + n(hy) + 'C' + n(pw) + ',' + n(hy - ph) + ' ' + n(-pw) + ',' + n(hy - ph) + ' ' + n(-pw) + ',' + n(hy) +
    'L' + n(-hx + r) + ',' + n(hy) + 'Q' + n(-hx) + ',' + n(hy) + ' ' + n(-hx) + ',' + n(hy - r) + 'L' + n(-hx) + ',' + n(ny) + 'L' + n(-nx) + ',' + n(ny) + 'Z'
}

function toothBody(kit, { x, y, size, side = 'left', angle = 0, p = 1, fill = 1, hatch = 0, glow = 0, ghost = false, opacity = 1 }) {
  const { C } = kit
  const right = side === 'right', col = right ? C.hue.orange : C.hue.blue
  const d = toothPath(size), sw = Math.max(1.6, Math.min(3, size * 0.07)).toFixed(2)
  const g = '<g transform="translate(' + r1(x) + ',' + r1(y) + ') rotate(' + r1(angle) + ') scale(' + (right ? -1 : 1) + ',1)" opacity="' + opacity + '">'
  if (p <= 0) return ''
  if (ghost) return g + '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-dasharray="6 5" opacity="' + (0.6 * cl(p)).toFixed(3) + '"/></g>'
  let s = g
  if (glow > 0) s += '<path d="' + d + '" fill="' + C.hue.teal + '" fill-opacity="' + (0.35 * glow).toFixed(3) + '" stroke="' + C.hue.teal + '" stroke-width="' + r1(size * 0.32) +
    '" stroke-opacity="' + cl(glow).toFixed(3) + '" filter="url(#zp-glow)"/>'
  s += '<path d="' + d + '" fill="' + SOLID + '" fill-opacity="' + (0.6 * cl(p * 2 - 1)).toFixed(3) + '"/>'
  s += '<path d="' + d + '" fill="' + col + '" fill-opacity="' + ((right ? 0.42 : 0.34) * fill * cl(p * 2 - 1)).toFixed(3) + '"/>'
  if (hatch > 0) s += '<path d="' + d + '" fill="url(#zp-hatch-' + (right ? 'amber' : 'blue') + ')" opacity="' + cl(hatch).toFixed(3) + '"/>'
  s += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-linecap="round"' + dash(p) + '/>'
  if (glow > 0) s += '<path d="' + d + '" fill="none" stroke="' + C.hue.teal + '" stroke-width="' + sw + '" stroke-linejoin="round" stroke-opacity="' + (0.7 * cl(glow)).toFixed(3) + '"/>'
  return s + '</g>'
}

export function toothPoints(kit, { x = 330, y = 600, size = 60, side = 'left', angle = 0 } = {}) {
  const a = angle * Math.PI / 180, sx = side === 'right' ? -1 : 1
  const at = (lx, ly) => ({ x: x + sx * lx * Math.cos(a) - ly * Math.sin(a), y: y + sx * lx * Math.sin(a) + ly * Math.cos(a) })
  return { bump: at(0, -0.62 * size), hollow: at(0, 0.38 * size), tip: at(1.2 * size, 0), neck: at(-2.4 * size, 0) }
}

export function toothShape(kit, o = {}) {
  const { x = 330, y = 600, size = 60, side = 'left', angle = 0, labels = 0 } = o
  let s = defs(kit) + toothBody(kit, { ...o, x, y, size, side, angle })
  if (labels > 0) {
    const pt = toothPoints(kit, { x, y, size, side, angle }), sx = side === 'right' ? -1 : 1
    const fs = Math.round(Math.max(17, Math.min(26, size * 0.38)))
    s += tag(kit, pt.bump.x, pt.bump.y, 'bump', { dx: sx * 1.9 * size, dy: -1.05 * size, p: cl(labels * 1.25), size: fs })
    s += tag(kit, pt.hollow.x, pt.hollow.y, 'hollow', { dx: sx * 1.9 * size, dy: 1.05 * size, p: cl(labels * 1.25 - 0.25), size: fs })
  }
  return s
}

// ── The zipper column ────────────────────────────────────────────────────

export function zipperGeom(kit, { x = 330, y = 330, h = 680, close = 0, spread = 1 } = {}) {
  const lerp = (a, b, p) => a + (b - a) * p
  const s = h / 680, u = 17 * s, p = 2 * u + 4 * s, n = 14
  const yT = y + 1.6 * u + 6 * s, yEnd = yT + (n - 0.5) * p + 0.5 * u
  const ti = 2.4 * u - 4 * s, tw = 3.8 * u, sh = 6 * u, sw = 7.4 * u
  const sTop = lerp(yEnd + 2 * s - sh, yT - 0.75 * u, cl(close)), sBot = sTop + sh
  const k = 0.29 * spread, o0 = 0.9 * u, tilt = Math.atan(k) * 180 / Math.PI
  const off = yy => yy >= sBot ? 0 : yy >= sTop ? o0 * (sBot - yy) / sh : o0 + (sTop - yy) * k
  const ang = yy => yy >= sBot ? 0 : yy >= sTop ? tilt * (sBot - yy) / sh : tilt
  const teeth = []
  for (let i = 0; i < n; i++) {
    for (const side of ['left', 'right']) {
      const ty = yT + i * p + (side === 'right' ? p / 2 : 0), sx = side === 'right' ? 1 : -1
      teeth.push({ id: (side === 'right' ? 'R' : 'L') + i, side, i, x: x + sx * off(ty), y: ty, angle: -sx * ang(ty), locked: ty > sBot })
    }
  }
  const ys = [y, sTop, sBot, y + h - 24 * s]
  const tape = sx => ({
    inner: ys.map(yy => [x + sx * (ti + off(yy)), yy]),
    outer: ys.map(yy => [x + sx * (ti + tw + off(yy)), yy])
  })
  const hy = sTop + 0.3 * sh
  return {
    cx: x, top: y, h, s, u, p, n, yT, yEnd, ti, tw, off,
    sliderTop: sTop, sliderBottom: sBot, slider: { x, y: sTop + sh / 2 }, sliderW: sw, sliderH: sh,
    hinge: { x, y: hy }, tabEnd: { x, y: hy + 7 * u }, teeth, tapes: { left: tape(-1), right: tape(1) }
  }
}

export function zipperColumn(kit, o = {}) {
  const { C } = kit
  const { draw = 1, sliderIn = 1, glow = 0, trail = 1, force = 0, skip = [], id = 'z' } = o
  const g = zipperGeom(kit, o)
  const { cx, top, h, u, s: k } = g
  const reveal = yy => cl((draw * 1.35 - (yy - top) / h) / 0.35)
  const front = top + h * (draw * 1.35 - 0.175)
  let s = defs(kit)

  // Centre line and tape fabric, revealed from the top
  s += '<clipPath id="' + id + '-rev"><rect x="-200" y="' + r1(top - 30) + '" width="1120" height="' + r1(Math.max(0, front - top + 30)) + '"/></clipPath>'
  s += '<g clip-path="url(#' + id + '-rev)">'
  s += '<path d="M' + cx + ',' + r1(top - 18) + 'L' + cx + ',' + r1(top + h + 6) + '" stroke="' + C.muted + '" stroke-width="1.2" stroke-dasharray="18 6 3 6" opacity="0.5"/>'
  for (const side of ['left', 'right']) {
    const t = g.tapes[side], d = poly(t.inner.concat(t.outer.slice().reverse())) + 'Z'
    s += '<path d="' + d + '" fill="' + C.panel + '"/><path d="' + d + '" fill="url(#zp-hatch-ink)"/>'
  }
  s += '</g>'
  // Tape edges, traced top to bottom
  if (draw > 0) for (const side of ['left', 'right']) {
    const t = g.tapes[side]
    for (const edge of [t.inner, t.outer]) s += '<path d="' + poly(edge) + '" fill="none" stroke="' + C.text + '" stroke-width="2" stroke-linejoin="round"' + dash(draw) + '/>'
    const a = t.inner[0], b = t.outer[0], c = t.inner[t.inner.length - 1], e = t.outer[t.outer.length - 1]
    s += '<path d="' + poly([a, b]) + '" stroke="' + C.text + '" stroke-width="2"' + dash(reveal(top) * 1.5) + '/>'
    if (draw >= 0.95) s += '<path d="' + poly([c, e]) + '" stroke="' + C.text + '" stroke-width="2" stroke-dasharray="4 5"/>'
  }

  // Top stops and bottom stop
  const ys = g.yT - 1.2 * u
  for (const sx of [-1, 1]) {
    const ix = cx + sx * (g.ti + g.off(ys))
    const x0 = sx < 0 ? ix - 0.5 * u : ix - 1.1 * u
    s += '<rect x="' + r1(x0) + '" y="' + r1(ys - 0.4 * u) + '" width="' + r1(1.6 * u) + '" height="' + r1(0.8 * u) + '" rx="' + r1(0.25 * u) +
      '" fill="' + SOLID + '" stroke="' + C.text + '" stroke-width="1.6"' + dash(reveal(ys) * 1.4) + '/>'
  }
  const bs = g.yEnd + 3 * k
  s += '<rect x="' + r1(cx - 1.7 * u) + '" y="' + r1(bs) + '" width="' + r1(3.4 * u) + '" height="' + r1(1.1 * u) + '" rx="' + r1(0.3 * u) +
    '" fill="url(#zp-hatch-ink)" fill-opacity="' + cl(reveal(bs) * 2 - 1).toFixed(3) + '" stroke="' + C.text + '" stroke-width="1.8"' + dash(reveal(bs)) + '/>'

  // The teeth (a locked tooth glows teal; the ones just out of the slider flash)
  for (const t of g.teeth) {
    if (skip.includes(t.id)) continue
    const flash = t.locked ? trail * Math.exp(-(t.y - g.sliderBottom) / (2.2 * u)) : 0
    s += toothBody(kit, { x: t.x, y: t.y, size: u, side: t.side, angle: t.angle, p: reveal(t.y), glow: t.locked ? Math.max(glow, flash) : 0 })
  }

  // Force pulling the tapes apart
  if (force > 0) {
    for (let j = 0; j < 4; j++) {
      const yy = g.sliderBottom + 1.5 * u + (g.yEnd - g.sliderBottom - 2.5 * u) * (j + 0.5) / 4
      if (yy <= g.sliderBottom + u) continue
      const len = (16 + 64 * cl(force)) * k, ox = g.ti + g.tw + 6 * k
      s += kit.arrow(cx - ox, yy, cx - ox - len, yy, { color: C.hue.red, width: 4 * k }) + kit.arrow(cx + ox, yy, cx + ox + len, yy, { color: C.hue.red, width: 4 * k })
    }
  }

  // The slider, then its pull tab hanging over the closed teeth
  if (sliderIn > 0) {
    const a = g.sliderW / 2, b = 2.8 * u, t0 = g.sliderTop, t1 = g.sliderBottom, r = 0.8 * u, sh = g.sliderH
    const body = (i) => {
      const A = a - i, B = b - i, T = t0 + i, Bt = t1 - i, R = Math.max(2, r - i * 0.5)
      return 'M' + r1(cx - A) + ',' + r1(T + R) + 'Q' + r1(cx - A) + ',' + r1(T) + ' ' + r1(cx - A + R) + ',' + r1(T) + 'L' + r1(cx + A - R) + ',' + r1(T) +
        'Q' + r1(cx + A) + ',' + r1(T) + ' ' + r1(cx + A) + ',' + r1(T + R) + 'L' + r1(cx + A) + ',' + r1(t0 + 0.3 * sh) +
        'C' + r1(cx + A) + ',' + r1(t0 + 0.62 * sh) + ' ' + r1(cx + B) + ',' + r1(t1 - 0.3 * sh) + ' ' + r1(cx + B) + ',' + r1(Bt - R) +
        'Q' + r1(cx + B) + ',' + r1(Bt) + ' ' + r1(cx + B - R) + ',' + r1(Bt) + 'L' + r1(cx - B + R) + ',' + r1(Bt) + 'Q' + r1(cx - B) + ',' + r1(Bt) + ' ' + r1(cx - B) + ',' + r1(Bt - R) +
        'C' + r1(cx - B) + ',' + r1(t1 - 0.3 * sh) + ' ' + r1(cx - A) + ',' + r1(t0 + 0.62 * sh) + ' ' + r1(cx - A) + ',' + r1(t0 + 0.3 * sh) + 'Z'
    }
    const fo = cl(sliderIn * 1.6 - 0.5).toFixed(3)
    s += '<path d="' + body(0) + '" fill="' + SOLID + '" fill-opacity="' + fo + '" stroke="' + C.text + '" stroke-width="2.4" stroke-linejoin="round"' + dash(sliderIn) + '/>'
    s += '<path d="' + body(0.45 * u) + '" fill="none" stroke="' + C.text + '" stroke-opacity="0.45" stroke-width="1.4"' + dash(sliderIn * 1.3 - 0.3) + '/>'
    // the bridge that holds the tab
    const hy = g.hinge.y
    s += '<rect x="' + r1(cx - 0.95 * u) + '" y="' + r1(t0 + 0.12 * sh) + '" width="' + r1(1.9 * u) + '" height="' + r1(0.38 * sh) + '" rx="' + r1(0.4 * u) +
      '" fill="url(#zp-hatch-ink)" stroke="' + C.text + '" stroke-width="1.6"' + dash(sliderIn * 1.4 - 0.2) + '/>'
    const L = 7 * u, w0 = 1.3 * u, w1 = 1.5 * u
    const tab = 'M' + r1(cx - w0) + ',' + r1(hy) + 'L' + r1(cx + w0) + ',' + r1(hy) + 'L' + r1(cx + w1) + ',' + r1(hy + L - w1) +
      'A' + r1(w1) + ',' + r1(w1) + ' 0 0 1 ' + r1(cx - w1) + ',' + r1(hy + L - w1) + 'Z'
    s += '<path d="' + tab + '" fill="' + SOLID + '" fill-opacity="' + fo + '" stroke="' + C.text + '" stroke-width="2.2" stroke-linejoin="round"' + dash(sliderIn * 1.3 - 0.3) + '/>'
    s += '<rect x="' + r1(cx - 0.55 * u) + '" y="' + r1(hy + 3.7 * u) + '" width="' + r1(1.1 * u) + '" height="' + r1(2 * u) + '" rx="' + r1(0.55 * u) +
      '" fill="none" stroke="' + C.text + '" stroke-width="1.6"' + dash(sliderIn * 1.5 - 0.5) + '/>'
    s += '<circle cx="' + cx + '" cy="' + r1(hy + 0.5 * u) + '" r="' + r1(0.42 * u) + '" fill="none" stroke="' + C.text + '" stroke-width="1.6"' + dash(sliderIn * 1.5 - 0.5) + '/>'
  }
  return s
}

// ── The slider, cut open ─────────────────────────────────────────────────

// Local units (scale 1): arm centre lines run from (∓150, −250) to the meeting point (0, 30)
export function sliderGeom(kit, { x = 330, y = 600, scale = 1 } = {}) {
  const s = scale, th = Math.atan2(150, 280), deg = th * 180 / Math.PI, u = 24 * s
  const P = (px, py) => ({ x: x + px * s, y: y + py * s })
  return {
    s, u, pitch: 2 * u + 4 * s, half: deg,
    meet: P(0, 30), wedgeTip: P(0, -86), entryL: P(-150, -250), entryR: P(150, -250), exit: P(0, 270),
    arm(side, f) {
      const sx = side === 'right' ? 1 : -1, c = P(sx * (150 - 150 * f), -250 + 280 * f), sh = 0.6 * u * (1 - cl(f))
      return { x: c.x - sx * sh * Math.cos(th), y: c.y - sh * Math.sin(th), angle: sx * deg }
    },
    throat(f) { const q = P(0, 30 + 240 * f); return { x: q.x, y: q.y, angle: 0 } }
  }
}

export function sliderCutaway(kit, o = {}) {
  const { C } = kit
  const { x = 330, y = 600, scale = 1, p = 1, labels = 0, arc = 0, wedgeGlow = 0 } = o
  const g = sliderGeom(kit, { x, y, scale }), s = scale
  const P = (px, py) => [x + px * s, y + py * s]
  const xc = yy => -150 + 150 * (yy + 250) / 280
  const ow = yy => xc(yy) - 62, iw = yy => xc(yy) + 62   // outer and inner (wedge-side) wall of the left arm
  const leftWall = [P(-240, -270), P(ow(-270), -270), P(-75, 6), P(-75, 270), P(-100, 270), P(-240, -200)]
  const rightWall = leftWall.map(([px, py]) => [2 * x - px, py])
  const wedge = [P(iw(-270), -270), P(-iw(-270), -270), P(5, -92), P(0, -86), P(-5, -92)]
  const fo = cl(p * 1.5 - 0.5).toFixed(3)
  let out = defs(kit)
  for (const wall of [leftWall, rightWall]) {
    const d = poly(wall) + 'Z'
    out += '<path d="' + d + '" fill="' + SOLID + '" fill-opacity="' + fo + '"/><path d="' + d + '" fill="url(#zp-hatch-ink)" opacity="' + fo + '"/>' +
      '<path d="' + d + '" fill="none" stroke="' + C.text + '" stroke-width="2.4" stroke-linejoin="round"' + dash(p) + '/>'
  }
  const wd = poly(wedge) + 'Z'
  out += '<path d="' + wd + '" fill="' + SOLID + '" fill-opacity="' + fo + '"/><path d="' + wd + '" fill="url(#zp-hatch-ink)" opacity="' + fo + '"/>'
  if (wedgeGlow > 0) out += '<path d="' + wd + '" fill="' + C.hue.orange + '" fill-opacity="' + (0.25 * cl(wedgeGlow)).toFixed(3) + '" stroke="' + C.hue.orange +
    '" stroke-width="8" stroke-opacity="' + (0.6 * cl(wedgeGlow)).toFixed(3) + '" filter="url(#zp-glow)"/>'
  out += '<path d="' + wd + '" fill="none" stroke="' + C.text + '" stroke-width="3" stroke-linejoin="round"' + dash(p * 1.2 - 0.2) + '/>'
  // the top plate's edge across the channel mouths, dashed (it is cut away)
  out += '<path d="' + poly([P(-240, -270), P(240, -270)]) + '" stroke="' + C.text + '" stroke-opacity="0.4" stroke-width="1.4" stroke-dasharray="6 6"' + (p < 1 ? ' opacity="' + fo + '"' : '') + '/>'

  if (arc > 0) {
    const m = g.meet, R = 72 * s, a0 = Math.atan2(-280, -150), a1 = Math.atan2(-280, 150)
    const pt = a => [m.x + R * Math.cos(a), m.y + R * Math.sin(a)]
    const q = cl(arc), ae = a0 + (a1 - a0) * q, A = pt(a0), E = pt(ae)
    const ray = a => '<path d="' + poly([[m.x, m.y], [m.x + 120 * s * Math.cos(a), m.y + 120 * s * Math.sin(a)]]) + '" stroke="' + C.muted + '" stroke-width="1.4" stroke-dasharray="5 5" opacity="' + cl(q * 3).toFixed(3) + '"/>'
    out += ray(a0) + ray(a1)
    out += '<path d="M' + r1(A[0]) + ',' + r1(A[1]) + 'A' + r1(R) + ',' + r1(R) + ' 0 0 1 ' + r1(E[0]) + ',' + r1(E[1]) + '" fill="none" stroke="' + C.text + '" stroke-width="2.2" stroke-linecap="round"/>'
    out += '<circle cx="' + r1(m.x) + '" cy="' + r1(m.y) + '" r="3.5" fill="' + C.text + '"/>'
  }
  if (labels > 0) {
    out += tag(kit, x - 4 * s, y - 200 * s, 'divider', { dx: -130 * s, dy: -20 * s, p: cl(labels * 1.3) })
    out += tag(kit, x, y + 190 * s, 'Y-channel', { dx: 100 * s, dy: 30 * s, p: cl(labels * 1.3 - 0.3) })
  }
  return out
}
