// world/parts.js: the recurring pictures of "Everyday English words that came from Chinese".
// Every function is pure: the same options draw the same frame. Each returns SVG
// markup for kit.stage() (concatenate several, then call kit.stage(markup) once).
// Coordinates are the page's 720×1280 stage; the defaults sit in the safe area.
//
// Layout bands shared by every shot (no captions.html: each shot draws its own
// one-line caption at the top with kit.frame, keep it to two lines):
//   y 110…330  caption (kit.frame headline, or shot 1's counter + caption)
//   y 360…990  the picture (stack or word card)
//   y ~1010    the source line (sourceLine)
//
// Colors (one meaning each, for the whole video):
//   English words  C.text (white)        Chinese roots   C.accent2 (amber)
//   marker, counter, stamp  C.accent (fire orange)       wrong guess strike  C.hue.red
//
// ── Helpers ───────────────────────────────────────────────────────────────
// measure(kit, text, size, weight = 800, font = kit.HEAD_FONT) → px width of text.
// sourceLine(kit, { text, p = 1, y = 1010 }) → the small source line (muted, 17 px).
// embers(kit, { t, n = 26, opacity = 1 }) → background embers rising slowly (a depth layer;
//   put it first in the markup).
//
// ── Four-word stack (shots 1, 6) ──────────────────────────────────────────
// STACK_WORDS = ['KETCHUP', 'TYCOON', 'TYPHOON', 'KOWTOW']
// stackLayout(kit, { cy = 650 }) → { x, size, cap, pitch, top, bottom, rows: [{ word, y, w }] }
//   y is each word's baseline, w its width; size is fitted so the widest word fills
//   x 40…620. Use it to place things relative to the words.
// wordStack(kit, {
//   cy = 650,         vertical centre of the stack (keep 650 in both shots)
//   t = 0,            shot-local time (drives the drop, squash and shake)
//   land = [-9, -9, -9, -9],  time each word lands; it falls from above in the 0.32 s
//                     before and squashes/bounces after. Default: all already there.
//   mark = 0,         0→1 sweeps the orange marker under the words, top to bottom
//   roots = null,     e.g. ['fish sauce', 'great lord', 'big wind', 'knock head']: small
//                     amber line under each word (shot 6)
//   rootP = [1,1,1,1],  0→1 per root, pops it in
//   stamp = 0,        0→1 slams the fire-orange stamp across the stack
//   stampText = 'FROM CHINESE',
//   shake = 0 })      0…1 shake amplitude of the whole stack (needs t)
// counterRoll(kit, { x = 40, y, value = 1, size = 210, p = 1, pulse = 0 })
//   Big fire-orange digit rolling up like a slot reel: value 2.4 is between 2 and 3.
//   y is the baseline; p fades/scales it in; pulse 0…1 bumps it (on each landing).
//   counterWidth(kit, size = 210) → its width, to place text beside it.
//
// ── Word card (shots 2–5) ─────────────────────────────────────────────────
// CARD = { x: 40, w: 580, rootY: 452, meaningY: 500, wordY: 668, lineY: 756,
//          iconY: 905, iconSize: 140 }   the card's baselines (icon: centre)
// cardRoot(kit, { text, meaning = '', tag = '', x = 40, y = CARD.rootY, size = 80, p = 1,
//   mp = p, mark = 0, align = 'start' | 'middle' | 'end', color = C.accent2 })
//   Chinese root in amber (characters or romanisation) rising in with p; its literal
//   meaning small in white beneath (mp); tag a small grey label above ('HOKKIEN').
//   mark 0→1 sweeps the orange marker under the meaning. For two roots (typhoon) call
//   it twice with align and x; pass color: C.hue.gray for a non-Chinese root.
// cardWord(kit, { word, x = 40, y = CARD.wordY, size = stack size, p = 1, spin = 1,
//   bow = 0, wobble = 0, t = 0, ground = 0 })
//   The English word, huge and white (same size as in the stack). p: pass
//   kit.pop(t, at) for a slam (shrinks in from 1.6×, overshoots). spin 0→1: a quarter
//   turn settling (1 = upright). bow 0→1: leans forward and folds down onto its
//   baseline, like a bow. wobble: px of per-letter gust wobble (needs t). ground 0→1
//   draws a ground line at its baseline.
//   cardWordWidth(kit, word, size?) → its width (e.g. to drop a crown on the last O).
// cardLine(kit, { before = '', wrong, right, after = '', x = 40, y = CARD.lineY,
//   size = 44, p = 1, strikeP = 0, rollP = 0, markP = 0 })
//   'before [wrong] after': strikeP draws the red strike over wrong, rollP rolls it up
//   like a slot reel into right (the slot widens/narrows, after slides), markP sweeps
//   the orange marker under right. Wraps to two rows (before / slot + after) when too
//   long for the width.
// cardIcon(kit, { name, x = 330, y = CARD.iconY, size = 140, p = 1, t = 0, label = '',
//   bend = 1 })
//   One simple icon, centred at x, y: 'fish' (blue, tail wags with t), 'tomato',
//   'crown', 'wind' (streaks flow with t), 'bow' (kneeling figure; bend 0 upright →
//   1 forehead on the ground). p pops it in; label small and grey beneath.
// wordCard(kit, { root, word, line, icon })  convenience: each key holds the options of
//   cardRoot / cardWord / cardLine / cardIcon (omit a key to skip that piece).

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const f1 = n => (+n).toFixed(1)

const widths = new Map()
let ctx2d = null
export function measure(kit, text, size, weight = 800, font = kit.HEAD_FONT) {
  const key = weight + '|' + size + '|' + font + '|' + text
  if (widths.has(key)) return widths.get(key)
  if (!ctx2d) ctx2d = kit.$('stage').ownerDocument.createElement('canvas').getContext('2d')
  ctx2d.font = weight + ' ' + size + 'px ' + font
  const w = ctx2d.measureText(String(text)).width
  widths.set(key, w)
  return w
}

const text = (kit, x, y, s, { size, weight = 800, color, anchor = 'start', font, opacity = 1, extra = '' }) =>
  '<text x="' + f1(x) + '" y="' + f1(y) + '" font-size="' + size + '" font-weight="' + weight + '" fill="' + color +
  '" font-family="' + (font || kit.HEAD_FONT) + '" text-anchor="' + anchor + '" opacity="' + (+opacity).toFixed(3) + '"' + extra + '>' + esc(s) + '</text>'

// The big white words: the kit's font tops out at semibold, so a stroke of the same
// white makes the heavy weight; a soft fire glow behind
const heavy = (kit, size) => ' stroke="' + kit.C.text + '" stroke-width="' + f1(size * 0.028) + '" stroke-linejoin="round"' +
  ' style="filter: drop-shadow(0 0 16px rgba(255, 110, 40, 0.35))"'

// ── Helpers ───────────────────────────────────────────────────────────────

export function sourceLine(kit, { text: s, p = 1, y = 1010 } = {}) {
  return text(kit, kit.PAD, y, s, { size: 17, weight: 500, color: kit.C.muted, font: kit.FONT, opacity: kit.clamp(p) * 0.85 })
}

export function embers(kit, { t = 0, n = 26, opacity = 1 } = {}) {
  const { hash, clamp, W, H, C } = kit
  let out = ''
  for (let i = 0; i < n; i++) {
    const speed = 30 + 50 * hash(i, 3), span = H + 60
    const y = H + 30 - ((hash(i, 2) * span + t * speed) % span)
    const x = hash(i, 1) * W + Math.sin(t * 0.8 + i * 1.7) * 16
    const r = 1.2 + 2.8 * hash(i, 4)
    const a = clamp(y / 500) * (0.25 + 0.45 * hash(i, 5)) * opacity
    out += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r) + '" fill="' + C.hue.orange + '" opacity="' + a.toFixed(3) + '"/>'
  }
  return out
}

// ── Four-word stack ───────────────────────────────────────────────────────

export const STACK_WORDS = ['KETCHUP', 'TYCOON', 'TYPHOON', 'KOWTOW']

export function stackLayout(kit, { cy = 650 } = {}) {
  const w = kit.SAFE_RIGHT - kit.PAD
  const widest = Math.max(...STACK_WORDS.map(s => measure(kit, s, 100)))
  const size = Math.min(150, Math.floor(100 * w / widest))
  const cap = size * 0.72, pitch = size * 1.24
  const top = cy - (3 * pitch + cap) / 2
  return {
    x: kit.PAD, size, cap, pitch, top, bottom: top + cap + 3 * pitch,
    rows: STACK_WORDS.map((word, i) => ({ word, y: top + cap + i * pitch, w: measure(kit, word, size) }))
  }
}

export function wordStack(kit, { cy = 650, t = 0, land = [-9, -9, -9, -9], mark = 0, roots = null, rootP = [1, 1, 1, 1],
  stamp = 0, stampText = 'FROM CHINESE', shake = 0 } = {}) {
  const { C, clamp, hash } = kit
  const L = stackLayout(kit, { cy })
  const fr = Math.floor(t * 30)
  const dx = shake * (hash(fr, 1) - 0.5) * 18, dy = shake * (hash(fr, 2) - 0.5) * 12
  let out = '<g transform="translate(' + f1(dx) + ' ' + f1(dy) + ')">'
  L.rows.forEach((r, i) => {
    const dt = t - land[i]
    if (dt < -0.32) return
    let oy = 0, sx = 1, sy = 1, op = 1
    if (dt < 0) {
      const q = (dt + 0.32) / 0.32
      oy = -(1 - q * q) * 340
      op = clamp(q * 2.5)
    } else {
      const k = Math.exp(-dt * 9) * Math.cos(dt * 26)
      sy = 1 - 0.2 * k
      sx = 1 + 0.1 * k
    }
    out += '<g transform="translate(' + L.x + ' ' + f1(r.y + oy) + ') scale(' + sx.toFixed(3) + ' ' + sy.toFixed(3) + ')" opacity="' + op.toFixed(3) + '">'
    const m = clamp((mark - i * 0.17) / 0.49)
    if (m > 0) out += '<rect x="' + f1(-0.05 * L.size) + '" y="' + f1(-L.cap * 0.46) + '" width="' + f1((r.w + 0.1 * L.size) * m) +
      '" height="' + f1(L.cap * 0.52) + '" rx="' + f1(L.size * 0.05) + '" fill="' + C.accent + '" opacity="0.7"/>'
    out += text(kit, 0, 0, r.word, { size: L.size, weight: 800, color: C.text, extra: heavy(kit, L.size) })
    if (roots && roots[i]) {
      const p = clamp(rootP[i])
      if (p > 0) out += '<g transform="translate(' + f1((1 - p) * -24) + ' 0)">' +
        text(kit, 2, L.size * 0.29, roots[i], { size: 26, weight: 700, color: C.accent2, font: kit.FONT, opacity: p }) + '</g>'
    }
    out += '</g>'
  })
  if (stamp > 0) {
    const ss = 46, tw = measure(kit, stampText, ss, 900) + ss * 0.08 * (stampText.length - 1)
    const bw = tw + 44, bh = ss * 1.55, s = 1 + 1.4 * (1 - clamp(stamp))
    out += '<g transform="translate(' + f1(kit.PAD + 290) + ' ' + f1(cy) + ') rotate(-8) scale(' + s.toFixed(3) + ')" opacity="' + clamp(stamp * 1.5).toFixed(3) + '">' +
      '<rect x="' + f1(-bw / 2) + '" y="' + f1(-bh / 2) + '" width="' + f1(bw) + '" height="' + f1(bh) + '" rx="10" fill="rgba(12, 5, 5, 0.85)" stroke="' + C.accent + '" stroke-width="5"/>' +
      text(kit, 0, ss * 0.36, stampText, { size: ss, weight: 900, color: C.accent, anchor: 'middle', extra: ' letter-spacing="0.08em"' }) + '</g>'
  }
  return out + '</g>'
}

export const counterWidth = (kit, size = 210) => measure(kit, '4', size, 900)

export function counterRoll(kit, { x = kit.PAD, y, value = 1, size = 210, p = 1, pulse = 0 } = {}) {
  const { C, clamp } = kit
  if (p <= 0) return ''
  const lh = size * 1.0, cap = size * 0.72, dw = counterWidth(kit, size)
  const lo = Math.floor(value), fr = value - lo
  const id = 'roll' + Math.round(x) + '_' + Math.round(y)
  const s = (0.6 + 0.4 * p) * (1 + 0.14 * clamp(pulse))
  let digits = ''
  for (const d of fr > 0.001 ? [lo, lo + 1] : [lo])
    digits += text(kit, 0, (d - value) * lh, String(d), { size, weight: 900, color: C.accent })
  return '<g transform="translate(' + f1(x + dw / 2) + ' ' + f1(y - cap / 2) + ') scale(' + s.toFixed(3) + ') translate(' + f1(-dw / 2) + ' ' + f1(cap / 2) + ')" opacity="' + clamp(p).toFixed(3) + '"' +
    ' style="filter: drop-shadow(0 0 24px rgba(255, 110, 40, 0.55))">' +
    '<clipPath id="' + id + '"><rect x="-20" y="' + f1(-cap - size * 0.05) + '" width="' + f1(dw + 40) + '" height="' + f1(cap + size * 0.1) + '"/></clipPath>' +
    '<g clip-path="url(#' + id + ')">' + digits + '</g></g>'
}

// ── Word card ─────────────────────────────────────────────────────────────

export const CARD = { x: 40, w: 580, rootY: 452, meaningY: 500, wordY: 668, lineY: 756, iconY: 905, iconSize: 140 }

export function cardRoot(kit, { text: s, meaning = '', tag = '', x = CARD.x, y = CARD.rootY, size = 80, p = 1, mp = p, mark = 0,
  align = 'start', color } = {}) {
  const { C, clamp } = kit
  color = color || C.accent2
  let out = ''
  const pr = clamp(p), pm = clamp(mp)
  if (pr > 0) {
    out += '<g transform="translate(0 ' + f1((1 - pr) * 40) + ')">'
    if (tag) out += text(kit, x, y - size - 8, tag.toUpperCase(), { size: 19, weight: 600, color: C.muted, anchor: align, font: kit.FONT, opacity: pr, extra: ' letter-spacing="0.12em"' })
    out += text(kit, x, y, s, { size, weight: 800, color, anchor: align, font: kit.FONT, opacity: pr, extra: ' style="filter: drop-shadow(0 0 18px rgba(255, 198, 92, 0.35))"' })
    out += '</g>'
  }
  if (meaning && pm > 0) {
    const my = y + (CARD.meaningY - CARD.rootY), mw = measure(kit, meaning, 30, 700, kit.FONT)
    const mx = align === 'middle' ? x - mw / 2 : align === 'end' ? x - mw : x
    out += '<g transform="translate(0 ' + f1((1 - pm) * 20) + ')" opacity="' + pm.toFixed(3) + '">'
    if (mark > 0) out += '<rect x="' + f1(mx - 5) + '" y="' + f1(my - 15) + '" width="' + f1((mw + 10) * clamp(mark)) + '" height="17" rx="3" fill="' + C.accent + '" opacity="0.7"/>'
    out += text(kit, x, my, meaning, { size: 30, weight: 700, color: C.text, anchor: align, font: kit.FONT }) + '</g>'
  }
  return out
}

export const cardWordWidth = (kit, word, size = stackLayout(kit).size) => measure(kit, word, size)

export function cardWord(kit, { word, x = CARD.x, y = CARD.wordY, size, p = 1, spin = 1, bow = 0, wobble = 0, t = 0, ground = 0 } = {}) {
  const { C, clamp } = kit
  size = size || stackLayout(kit).size
  const w = measure(kit, word, size), cap = size * 0.72
  let out = ''
  if (ground > 0) out += '<line x1="' + x + '" y1="' + f1(y + 6) + '" x2="' + f1(x + (kit.SAFE_RIGHT - x) * clamp(ground)) + '" y2="' + f1(y + 6) +
    '" stroke="' + C.muted + '" stroke-width="3" stroke-linecap="round" opacity="0.8"/>'
  if (p <= 0) return out
  const s = 1 + 0.6 * (1 - p), ang = -90 * (1 - spin), cx = x + w / 2, cy = y - cap / 2
  let glyphs
  if (wobble) {
    // Per-letter gusts: absolute x/y/rotate lists keep the font's own advances
    const xs = [], ys = [], rs = []
    for (let i = 0; i < word.length; i++) {
      xs.push(f1(x + measure(kit, word.slice(0, i), size)))
      ys.push(f1(y + wobble * Math.sin(t * 9 + i * 1.3)))
      rs.push((wobble * 0.7 * Math.sin(t * 7 + i * 2.1)).toFixed(1))
    }
    glyphs = '<text x="' + xs.join(' ') + '" y="' + ys.join(' ') + '" rotate="' + rs.join(' ') + '" font-size="' + size + '" font-weight="800" fill="' + C.text +
      '" font-family="' + kit.HEAD_FONT + '"' + heavy(kit, size) + '>' + esc(word) + '</text>'
  } else glyphs = text(kit, x, y, word, { size, weight: 800, color: C.text, extra: heavy(kit, size) })
  const b = clamp(bow)
  out += '<g transform="translate(' + f1(cx) + ' ' + f1(cy) + ') rotate(' + ang.toFixed(2) + ') scale(' + s.toFixed(3) + ') translate(' + f1(-cx) + ' ' + f1(-cy) + ')" opacity="' + clamp(p * 3).toFixed(3) + '">' +
    '<g transform="translate(' + x + ' ' + f1(y) + ') skewX(' + (-50 * b).toFixed(2) + ') scale(1 ' + (1 - 0.8 * b).toFixed(3) + ') translate(' + -x + ' ' + f1(-y) + ')">' +
    glyphs + '</g></g>'
  return out
}

export function cardLine(kit, { before = '', wrong = '', right = '', after = '', x = CARD.x, y = CARD.lineY, size = 44, p = 1, strikeP = 0, rollP = 0, markP = 0 } = {}) {
  const { C, clamp, ease, lerp } = kit
  if (p <= 0) return ''
  const m = s => measure(kit, s, size, 700, kit.FONT)
  const sp = m(' '), bw = before ? m(before) : 0, ww = m(wrong), rw = m(right), aw = after ? m(after) : 0
  const r = ease(rollP), slotW = lerp(ww, rw, r), lh = size * 1.2
  const wrap = bw + (before ? sp : 0) + Math.max(ww, rw) + (after ? sp + aw : 0) > CARD.w
  const sx = wrap ? x : x + bw + (before ? sp : 0), sy = wrap ? y + lh : y
  const id = 'slot' + Math.round(x) + '_' + Math.round(y)
  const opt = { size, weight: 700, color: C.text, font: kit.FONT }
  let out = '<g transform="translate(0 ' + f1((1 - clamp(p)) * 20) + ')" opacity="' + clamp(p).toFixed(3) + '">'
  if (before) out += text(kit, x, y, before, opt)
  if (markP > 0) out += '<rect x="' + f1(sx - 5) + '" y="' + f1(sy - size * 0.42) + '" width="' + f1((rw + 10) * clamp(markP)) + '" height="' + f1(size * 0.48) +
    '" rx="4" fill="' + C.accent + '" opacity="0.7"/>'
  const wy = sy - r * lh
  out += '<clipPath id="' + id + '"><rect x="' + f1(sx - 8) + '" y="' + f1(sy - size * 1.02) + '" width="' + f1(Math.max(ww, rw) + 16) + '" height="' + f1(size * 1.32) + '"/></clipPath>' +
    '<g clip-path="url(#' + id + ')">' +
    text(kit, sx, wy, wrong, { ...opt, opacity: 1 - 0.45 * clamp(strikeP) })
  if (strikeP > 0) out += '<line x1="' + f1(sx - 4) + '" y1="' + f1(wy - size * 0.32) + '" x2="' + f1(sx - 4 + (ww + 8) * clamp(strikeP)) + '" y2="' + f1(wy - size * 0.32) +
    '" stroke="' + C.hue.red + '" stroke-width="' + f1(size * 0.1) + '" stroke-linecap="round"/>'
  if (r > 0) out += text(kit, sx, sy + (1 - r) * lh, right, opt)
  out += '</g>'
  if (after) out += text(kit, sx + slotW + sp, sy, after, opt)
  return out + '</g>'
}

function iconBody(kit, name, t, bend) {
  const { C, lerp } = kit
  const ink = '#0c0505'
  if (name === 'fish') {
    const wag = Math.sin(t * 12) * 16
    return '<g transform="rotate(' + wag.toFixed(1) + ' -28 0)"><path d="M -26 0 L -50 -22 Q -43 0 -50 22 Z" fill="' + C.hue.blue + '" opacity="0.8"/></g>' +
      '<path d="M -4 -19 Q 8 -36 20 -20 Z" fill="' + C.hue.blue + '" opacity="0.8"/>' +
      '<path d="M -32 0 C -18 -27 24 -29 48 0 C 24 29 -18 27 -32 0 Z" fill="' + C.hue.blue + '"/>' +
      '<path d="M -32 0 C -14 10 26 12 48 0 C 24 29 -18 27 -32 0 Z" fill="#fff" opacity="0.22"/>' +
      '<path d="M 20 -15 Q 13 0 20 15" stroke="' + ink + '" stroke-width="3" fill="none" opacity="0.4"/>' +
      '<circle cx="32" cy="-5" r="4.2" fill="' + ink + '"/>'
  }
  if (name === 'tomato') {
    return '<circle cx="0" cy="6" r="36" fill="' + C.hue.red + '"/>' +
      '<ellipse cx="-13" cy="-8" rx="10" ry="6" fill="#fff" opacity="0.3"/>' +
      '<path d="M 0 -26 L -18 -36 L -6 -26 L -10 -42 L 1 -29 L 12 -41 L 8 -26 L 20 -32 Z" fill="' + C.hue.green + '"/>' +
      '<rect x="-2" y="-46" width="4" height="14" rx="2" fill="' + C.hue.green + '"/>'
  }
  if (name === 'crown') {
    return '<path d="M -42 20 L -46 -22 L -22 2 L 0 -34 L 22 2 L 46 -22 L 42 20 Z" fill="' + C.hue.yellow + '"/>' +
      '<rect x="-43" y="14" width="86" height="14" rx="3" fill="' + C.hue.orange + '"/>' +
      [[-46, -22], [0, -34], [46, -22]].map(([a, b]) => '<circle cx="' + a + '" cy="' + b + '" r="6" fill="' + C.hue.yellow + '"/>').join('') +
      '<circle cx="0" cy="2" r="6" fill="' + C.hue.red + '"/>'
  }
  if (name === 'wind') {
    const ds = ' fill="none" stroke="' + C.hue.gray + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="70 18" stroke-dashoffset="' + f1(-t * 140) + '"'
    return '<path d="M -48 -20 H 22 A 14 14 0 1 0 8 -34"' + ds + '/>' +
      '<path d="M -48 2 H 44"' + ds + '/>' +
      '<path d="M -48 24 H 16 A 12 12 0 1 1 4 36"' + ds + '/>'
  }
  if (name === 'bow') {
    // Kneeling figure: hip, knee and foot fixed; the torso swings from upright to the ground
    const a = lerp(-88, 14, kit.ease(bend)) * Math.PI / 180
    const hx = -12, hy = 22, shx = hx + Math.cos(a) * 40, shy = hy + Math.sin(a) * 40
    const head = [shx + Math.cos(a) * 15, shy + Math.sin(a) * 15]
    const hand = [lerp(shx + 6, 44, kit.ease(bend)), lerp(shy + 32, 42, kit.ease(bend))]
    const st = ' stroke="' + C.text + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"'
    return '<line x1="-56" y1="48" x2="56" y2="48" stroke="' + C.muted + '" stroke-width="3" stroke-linecap="round"/>' +
      '<polyline points="-40,42 8,42 ' + hx + ',' + hy + '"' + st + '/>' +
      '<line x1="' + hx + '" y1="' + hy + '" x2="' + f1(shx) + '" y2="' + f1(shy) + '"' + st + '/>' +
      '<line x1="' + f1(shx) + '" y1="' + f1(shy) + '" x2="' + f1(hand[0]) + '" y2="' + f1(hand[1]) + '"' + st + '/>' +
      '<circle cx="' + f1(head[0]) + '" cy="' + f1(head[1]) + '" r="10" fill="' + C.text + '"/>'
  }
  return ''
}

export function cardIcon(kit, { name, x = 330, y = CARD.iconY, size = CARD.iconSize, p = 1, t = 0, label = '', bend = 1 } = {}) {
  const { C, clamp } = kit
  if (p <= 0) return ''
  const s = (size / 100) * (0.4 + 0.6 * p)
  let out = '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + s.toFixed(3) + ')" opacity="' + clamp(p * 2).toFixed(3) + '">' + iconBody(kit, name, t, bend) + '</g>'
  if (label) out += text(kit, x, y + size * 0.5 + 26, label, { size: 22, weight: 600, color: C.muted, anchor: 'middle', font: kit.FONT, opacity: clamp(p) })
  return out
}

export function wordCard(kit, { root, word, line, icon } = {}) {
  return (root ? cardRoot(kit, root) : '') + (word ? cardWord(kit, word) : '') + (line ? cardLine(kit, line) : '') + (icon ? cardIcon(kit, icon) : '')
}
