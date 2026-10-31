// 05-kowtow: Kowtow. 叩頭 stamps in, cracks apart into 'knock' + 'head'; KOWTOW lands
// and bows twice onto a ground line (dust puffs), the kneeling icon bowing with it.
// Shot-local time: t = 0 is this shot's first frame.
import { cardRoot, cardWord, cardIcon, cardWordWidth, embers, sourceLine, stackLayout, CARD } from '../../world/parts.js'

const SPLIT = 0.6 // the characters crack apart
const CX = 330
const BOWS = [[1.5, 2.3, 2.7, 3.3], [3.4, 4.1, 4.4, 5.0]] // down from, down at, up from, up at

// 0 → 1 → 0 over one slow bow
function bowAt(kit, t) {
  let b = 0
  for (const [a, d, u, e] of BOWS) b = Math.max(b, Math.min(kit.ease((t - a) / (d - a)), 1 - kit.ease((t - u) / (e - u))))
  return b
}

// Dust puffing out along the ground where the word touches it
function dust(kit, t, x0, x1, y) {
  const { hash, clamp, C } = kit
  let out = ''
  BOWS.forEach(([, d], k) => {
    const p = (t - d + 0.05) / 0.9
    if (p <= 0 || p >= 1) return
    for (let i = 0; i < 18; i++) {
      const dir = hash(i, 20 + k) < 0.5 ? -1 : 1
      const bx = x0 + (x1 - x0) * hash(i, 30 + k)
      const x = Math.min(kit.SAFE_RIGHT, bx + dir * (20 + 60 * hash(i, 40 + k)) * kit.ease(p))
      const yy = y - (10 + 40 * hash(i, 50 + k)) * Math.sin(p * Math.PI * 0.8)
      const r = (4 + 9 * hash(i, 60 + k)) * (0.6 + 0.8 * p)
      out += '<circle cx="' + x.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + (i % 3 ? C.muted : C.hue.orange) +
        '" opacity="' + (0.45 * (1 - p) * clamp(p * 6)).toFixed(3) + '"/>'
    }
  })
  return out
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, ease, clamp, lerp } = kit
  kit.frame({ progress: (start + t) / 29.5 })

  // 叩頭 stamps in as one, then the halves slide apart
  const land = pop(t, -0.2, 0.45), sp = ease((t - SPLIT) / 0.5)
  const lx = lerp(CX - 42, 120, sp), rx = lerp(CX + 42, 540, sp)
  const markP = ease((t - 2.0) / 0.8)
  const s = 1 + 0.5 * (1 - clamp(land))
  const roots = '<g transform="translate(' + CX + ' ' + (CARD.rootY - 30) + ') scale(' + s.toFixed(3) + ') translate(' + -CX + ' ' + -(CARD.rootY - 30) + ')">' +
    cardRoot(kit, { text: '叩', meaning: 'knock', x: lx, align: 'middle', p: clamp(land), mp: rise(t, 1.0, 0.45), mark: markP }) +
    cardRoot(kit, { text: '頭', meaning: 'head', x: rx, align: 'middle', p: clamp(land), mp: rise(t, 1.15, 0.45), mark: ease((t - 2.4) / 0.6) }) + '</g>'

  // The tick: a crack flashing where they split, and a plus settling between
  const cp = clamp((t - SPLIT) / 0.45)
  const crack = cp > 0 && cp < 1
    ? '<path d="M ' + CX + ' ' + (CARD.rootY - 95) + ' l -10 26 l 16 18 l -12 24 l 10 30" fill="none" stroke="' + C.accent2 + '" stroke-width="' + (5 * (1 - cp)).toFixed(1) +
      '" stroke-linejoin="round" opacity="' + (1 - cp).toFixed(3) + '"/>' +
      [-1, 1].map(d => '<line x1="' + (CX + d * (20 + 50 * cp)) + '" y1="' + (CARD.rootY - 40) + '" x2="' + (CX + d * (40 + 70 * cp)) + '" y2="' + (CARD.rootY - 40) +
        '" stroke="' + C.accent2 + '" stroke-width="4" stroke-linecap="round" opacity="' + (1 - cp).toFixed(3) + '"/>').join('')
    : ''
  const plusP = pop(t, 1.0, 0.4)
  const plus = plusP > 0 ? '<text x="' + CX + '" y="' + (CARD.rootY - 14) + '" text-anchor="middle" font-size="60" font-weight="800" fill="' + C.muted +
    '" font-family="' + kit.FONT + '" opacity="' + clamp(plusP).toFixed(3) + '">+</text>' : ''

  // KOWTOW slams in and bows twice onto the ground line
  const bow = bowAt(kit, t)
  const L = stackLayout(kit), ww = cardWordWidth(kit, 'KOWTOW')
  const tip = CARD.x + ww + L.cap * 0.25

  const q = kit.stage(
    embers(kit, { t, opacity: 0.7 }) + crack + roots + plus +
    cardWord(kit, { word: 'KOWTOW', p: pop(t, 0.75, 0.55), bow, ground: rise(t, -0.2, 0.9) }) +
    dust(kit, t, CARD.x + ww * 0.4, Math.min(kit.SAFE_RIGHT - 10, tip), CARD.wordY + 4) +
    cardIcon(kit, { name: 'bow', x: 330 + kit.float(t, 4, 3), p: pop(t, -0.1, 0.5), bend: bow }) +
    sourceLine(kit, { text: "Source: Online Etymology Dictionary, 'kowtow'", p: rise(t, 1.6, 0.5) })
  )

  // The caption, word by word at the top, marker sweeping under 'knock head'
  kit.say({ text: "Kowtow literally means 'knock head'", t, at: -0.3, each: 0.07, y: 150, size: 54,
    hl: ["'knock", "head'"], hlColor: C.accent, mark: ease((t - 2.0) / 0.8) })
}
