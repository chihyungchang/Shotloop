// 03-tycoon: 大君 hops through Japanese 'taikun' to TYCOON; 'boss' rolls into 'great lord'.
// Shot-local time: t = 0 is this shot's first frame.
import { embers, sourceLine, measure, stackLayout, cardRoot, cardWord, cardLine, cardIcon, CARD } from '../../world/parts.js'

// A straight hop drawn on with p, its head appearing at the end
function hop(kit, x1, y1, x2, y2, p, color) {
  const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1), hl = 16
  const ex = x2 - Math.cos(a) * hl * 0.6, ey = y2 - Math.sin(a) * hl * 0.6
  const pt = (r) => (x2 + Math.cos(a + r) * hl).toFixed(1) + ',' + (y2 + Math.sin(a + r) * hl).toFixed(1)
  let out = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="' + color +
    '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + len.toFixed(1) + '" stroke-dashoffset="' + (len * (1 - kit.clamp(p))).toFixed(1) + '"/>'
  if (p > 0.85) out += '<polygon points="' + x2 + ',' + y2 + ' ' + pt(Math.PI - 0.45) + ' ' + pt(Math.PI + 0.45) + '" fill="' + color +
    '" opacity="' + kit.clamp((p - 0.85) / 0.15).toFixed(2) + '"/>'
  return out
}

// A stop lighting as the path reaches it: a dot and an expanding ring
function stop(kit, x, y, t, at) {
  const p = kit.rise(t, at, 0.5)
  if (p <= 0) return ''
  return '<circle cx="' + x + '" cy="' + y + '" r="' + (6 * kit.pop(t, at, 0.4)).toFixed(1) + '" fill="' + kit.C.accent + '"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + (6 + 26 * p).toFixed(1) + '" fill="none" stroke="' + kit.C.accent + '" stroke-width="3" opacity="' + (1 - p).toFixed(2) + '"/>'
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, rise, pop, ease, float } = kit

  {
    kit.frame({ kicker: '03 / 06', head: ["Tycoon: *'great lord',*", 'by way of Japanese'], typed: rise(t, -0.15, 0.6), progress: (start + t) / 29.5 })
  }

  const L = stackLayout(kit), size = L.size, cap = L.cap
  const wordTop = CARD.wordY - cap
  const rootW = measure(kit, '大君', 80, 800, kit.FONT)

  // Hop path: 大君 → taikun → TYCOON
  const a1 = { x1: CARD.x + rootW + 24, y1: CARD.rootY - 28, x2: 440, y2: CARD.rootY - 28 }
  const a2 = { x1: 530, y1: CARD.rootY + 26, x2: 330, y2: wordTop - 14 }
  const p1 = ease((t - 0.9) / 0.4), p2 = ease((t - 1.45) / 0.4)
  const tLand = 1.85

  // Crown dropping onto the last O
  const oW = measure(kit, 'O', size), oX = CARD.x + measure(kit, 'TYCOO', size) + oW / 2
  const crownSize = 62, crownY = wordTop - crownSize * 0.3, cDrop = 4.3
  let cy = crownY
  if (t < cDrop) { const q = clamp((t - (cDrop - 0.4)) / 0.4); cy = crownY - 300 * (1 - q * q) }
  else { const dt = t - cDrop; cy = crownY - 16 * Math.exp(-dt * 7) * Math.abs(Math.sin(dt * 16)) }

  let m = embers(kit, { t: t + 9.5 })
  // Root and its meaning
  m += cardRoot(kit, { text: '大君', meaning: 'great + lord', tag: 'Chinese', p: pop(t, -0.1, 0.5), mp: rise(t, 0.4), mark: ease((t - 3.8) / 0.4) })
  m += hop(kit, a1.x1, a1.y1, a1.x2, a1.y2, p1, C.accent) + stop(kit, a1.x1 - 10, a1.y1, t, 0.9)
  // Japanese stop (not Chinese: gray)
  m += cardRoot(kit, { text: 'taikun', tag: 'Japanese', x: 620, size: 56, align: 'end', color: C.hue.gray, p: pop(t, 1.3, 0.45) })
  m += stop(kit, 446, a1.y1, t, 1.3)
  m += hop(kit, a2.x1, a2.y1, a2.x2, a2.y2, p2, C.accent)
  // English word slams in
  m += cardWord(kit, { word: 'TYCOON', p: pop(t, tLand, 0.45), ground: rise(t, tLand + 0.1, 0.6) })
  m += stop(kit, a2.x2, wordTop - 4, t, tLand)
  // Wrong guess struck and rolled into the meaning
  m += cardLine(kit, { before: 'first meant', wrong: 'boss', right: 'great lord', p: rise(t, 2.35, 0.4),
    strikeP: ease((t - 2.75) / 0.3), rollP: ease((t - 3.25) / 0.45), markP: ease((t - 3.8) / 0.4) })
  // Lower third: the shogun's title
  m += cardIcon(kit, { name: 'crown', x: 330, y: 872 + float(t, 4, 2.6), size: 118, p: pop(t, 2.0, 0.5), label: 'a title for the shogun' })
  m += sourceLine(kit, { text: "Source: Online Etymology Dictionary, 'tycoon'", p: rise(t, 0.6, 0.5) })

  kit.stage(m)
  // The small crown sits on the rendered last O (the glyph's own extent)
  if (t > cDrop - 0.4) {
    // Canvas measure overshoots the stroked word; the last O's centre read off the render
    const ox = 413
    kit.$('stage').insertAdjacentHTML('beforeend', cardIcon(kit, { name: 'crown', x: ox, y: cy, size: crownSize, p: 1 }))
  }
  // Slow push in on the card, centred so nothing shifts
  kit.view({ x: kit.W / 2, y: kit.H / 2, s: 1 + 0.02 * ease(t / 5.5) })
}
