// 02-ketchup: KETCHUP's word card; 'tomato' is struck and rolls into 'pickled fish'
// (Merriam-Webster: Southern Min kê-chiap, 'salted or pickled fish' + 'juice').
// Shot-local time: t = 0 is this shot's first frame.
import { embers, sourceLine, cardRoot, cardWord, cardLine, cardIcon, measure, CARD } from '../../world/parts.js'

const LINE = { before: 'Started as', wrong: 'tomato', right: 'pickled fish', after: 'sauce', size: 44 }
const TYPE_AT = [1.5, 1.72, 1.94, 2.16] // Started, as, tomato, sauce

// Clip that reveals the line word by word (same wrap rule as cardLine)
function typeClip(kit, t) {
  const { rise, PAD, SAFE_RIGHT } = kit
  const m = s => measure(kit, s, LINE.size, 700, kit.FONT)
  const sp = m(' '), lh = LINE.size * 1.2, y = CARD.lineY
  const wrap = m(LINE.before) + sp + Math.max(m(LINE.wrong), m(LINE.right)) + sp + m(LINE.after) > CARD.w
  const sx = wrap ? PAD : PAD + m(LINE.before) + sp, sy = wrap ? y + lh : y
  // Width of each row revealed so far
  const grow = (parts, at) => {
    let w = 0
    parts.forEach((s, i) => { w += (i ? sp : 0) * rise(t, at[i], 0.01) + m(s) * rise(t, at[i], 0.22) })
    return w > 0 ? w + 8 : 0
  }
  const w1 = grow(['Started', 'as'], TYPE_AT.slice(0, 2))
  const w2 = grow([LINE.wrong, LINE.after], TYPE_AT.slice(2))
  const r = (x, yy, w) => '<rect x="' + (x - 8) + '" y="' + (yy - LINE.size * 1.05) + '" width="' + Math.max(0, w + 8) + '" height="' + LINE.size * 1.4 + '"/>'
  return '<clipPath id="typeclip">' + r(PAD, y, w1) + r(sx, sy, Math.min(w2, SAFE_RIGHT - sx + 20)) + '</clipPath>'
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { rise, pop, float, clamp, hash, lerp, ease } = kit

  // Caption: typed in early, then still for the rest of the shot
  kit.frame({
    kicker: '02 / 06 · ketchup',
    head: ['*Ketchup* began as a', 'fish sauce'],
    typed: rise(t, -0.15, 0.75),
    progress: (start + t) / 29.5
  })
  // Two lines at this size keep the caption clear of the card's root
  kit.$('head').style.fontSize = '52px'

  // Fish swims across the lower third, bubbles trailing up
  const fx = lerp(70, 430, ease(clamp((t - 1.0) / 5.0))) + float(t, 6, 1.6)
  const fy = 900 + float(t, 8, 1.3, 0.2)
  let bubbles = ''
  for (let i = 0; i < 6; i++) {
    const age = (t * 0.9 + hash(i, 7)) % 1, born = t - age / 0.9
    if (born < 1.3) continue
    const bx = lerp(70, 430, ease(clamp((born - 1.0) / 5.0))) + 55 + Math.sin(age * 9 + i) * 5
    bubbles += '<circle cx="' + bx.toFixed(1) + '" cy="' + (fy - 12 - age * 70).toFixed(1) + '" r="' + (3 + 3 * hash(i, 8)).toFixed(1) +
      '" fill="none" stroke="' + kit.C.hue.blue + '" stroke-width="2" opacity="' + (0.6 * (1 - age)).toFixed(2) + '"/>'
  }

  const markup =
    embers(kit, { t, n: 26 }) +
    cardRoot(kit, { text: 'kê-chiap', tag: 'Southern Min (Hokkien)', meaning: 'fish sauce', p: rise(t, 0.75, 0.5), mp: rise(t, 1.1, 0.4) }) +
    cardWord(kit, { word: 'KETCHUP', p: pop(t, 0.05, 0.55) }) +
    typeClip(kit, t) +
    '<g clip-path="' + (t < 2.6 ? 'url(#typeclip)' : 'none') + '">' +
    cardLine(kit, { ...LINE, p: rise(t, 1.45, 0.2), strikeP: rise(t, 2.8, 0.45), rollP: clamp((t - 3.4) / 0.55), markP: rise(t, 4.05, 0.5) }) +
    '</g>' +
    bubbles +
    cardIcon(kit, { name: 'fish', x: fx, y: fy, size: 130, p: pop(t, 1.0, 0.5), t }) +
    cardIcon(kit, { name: 'tomato', x: 548, y: 896, size: 76, p: rise(t, 4.7, 0.6), label: 'today' }) +
    sourceLine(kit, { text: "Source: Merriam-Webster, 'ketchup'", p: rise(t, 1.2, 0.5) })

  kit.stage(markup)
}
