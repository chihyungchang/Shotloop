// 04-typhoon: Typhoon. Two roots fly in from opposite sides (大風 amber, Typhon grey),
// collide in a flash and recoil; TYPHOON spins in beneath them and wobbles in the gusts
// while wind streaks pour left to right across the whole frame.
// Shot-local time: t = 0 is this shot's first frame.
import { cardRoot, cardWord, cardIcon, embers, measure, sourceLine, CARD } from '../../world/parts.js'

const HIT = 0.85 // the roots collide
const CX = 330 // where they meet

// Wind streaks behind everything, streaming left to right
function streaks(kit, t, gust) {
  const { hash, W, C } = kit
  let out = ''
  for (let i = 0; i < 42; i++) {
    const len = 60 + 180 * hash(i, 7), speed = 520 + 620 * hash(i, 8), span = W + len + 80
    const x = ((hash(i, 6) * span + t * speed) % span) - len - 40
    const y = 120 + 980 * hash(i, 9) + Math.sin(t * 1.6 + i) * 10
    const bend = (hash(i, 10) - 0.5) * 24
    const a = (0.1 + 0.22 * hash(i, 11)) * (0.6 + 0.6 * gust)
    out += '<path d="M ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' q ' + (len / 2).toFixed(1) + ' ' + bend.toFixed(1) + ' ' + len.toFixed(1) + ' 0" fill="none" stroke="' +
      (i % 3 ? C.hue.gray : '#fff4ec') + '" stroke-width="' + (1.5 + 2.5 * hash(i, 12)).toFixed(1) + '" stroke-linecap="round" opacity="' + a.toFixed(3) + '"/>'
  }
  return out
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, ease, clamp, lerp, drawOn } = kit
  kit.frame({ progress: (start + t) / 29.5 })

  const gust = 0.5 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 0.9 + 1)

  // Roots: fly in to touch at CX, then recoil to the card's sides
  const lw = measure(kit, '大風', 80, 800, kit.FONT), rw = measure(kit, 'Typhon', 80, 800, kit.FONT)
  const fly = ease((t + 0.45) / (HIT + 0.45)), back = pop(t, HIT, 0.7)
  const lx = lerp(lerp(-lw - 40, CX - lw - 6, fly), CARD.x, back)
  const rx = lerp(lerp(kit.W + rw + 40, CX + rw + 6, fly), kit.SAFE_RIGHT, back)
  const rp = rise(t, -0.2, 0.4), mp = rise(t, 1.45, 0.45)

  // The collision flash
  const fp = clamp((t - HIT) / 0.6)
  const flash = t >= HIT && fp < 1
    ? '<circle cx="' + CX + '" cy="' + (CARD.rootY - 28) + '" r="' + (30 + 230 * ease(fp)).toFixed(1) + '" fill="none" stroke="' + C.accent2 + '" stroke-width="' + (10 * (1 - fp)).toFixed(1) + '" opacity="' + (1 - fp).toFixed(3) + '"/>' +
      '<circle cx="' + CX + '" cy="' + (CARD.rootY - 28) + '" r="' + (60 + 90 * fp).toFixed(1) + '" fill="#fff4ec" opacity="' + (0.55 * Math.pow(1 - fp, 2)).toFixed(3) + '"/>'
    : ''

  // A plus between the roots, and two strokes fusing down into the word
  const plusP = pop(t, 1.35, 0.4)
  const plus = plusP > 0 ? '<text x="' + ((CARD.x + lw + kit.SAFE_RIGHT - rw) / 2).toFixed(1) + '" y="' + (CARD.rootY - 12) + '" text-anchor="middle" font-size="64" font-weight="800" fill="' + C.muted +
    '" font-family="' + kit.FONT + '" opacity="' + clamp(plusP).toFixed(3) + '">+</text>' : ''
  const fuse = '<path id="fl" d="M 110 518 Q 130 560 250 574" fill="none" stroke="' + C.accent2 + '" stroke-width="4" stroke-linecap="round" opacity="0.7"/>' +
    '<path id="fr" d="M 500 518 Q 480 560 410 574" fill="none" stroke="' + C.hue.gray + '" stroke-width="4" stroke-linecap="round" opacity="0.7"/>'

  // TYPHOON spins in with the flash, then wobbles in the gusts
  const wp = pop(t, HIT + 0.05, 0.55), spin = ease((t - HIT - 0.05) / 0.75)
  const wobble = rise(t, 1.8, 0.8) * (2 + 5 * gust)

  const q = kit.stage(
    embers(kit, { t, opacity: 0.7 }) + streaks(kit, t, gust) + flash +
    cardRoot(kit, { text: '大風', meaning: 'big wind', x: lx, p: rp, mp, mark: ease((t - 2.6) / 0.7) }) +
    cardRoot(kit, { text: 'Typhon', meaning: 'Greek storm monster', x: rx, align: 'end', color: C.hue.gray, p: rp, mp: rise(t, 1.6, 0.45) }) +
    plus + fuse +
    cardWord(kit, { word: 'TYPHOON', p: wp, spin, wobble, t, ground: rise(t, 1.7, 0.8) }) +
    cardIcon(kit, { name: 'wind', x: 330 + kit.float(t, 6, 2), p: pop(t, 2.2, 0.5), t }) +
    sourceLine(kit, { text: "Source: Online Etymology Dictionary, 'typhoon'", p: rise(t, 2.0, 0.5) })
  )
  drawOn(q('#fl'), rise(t, 1.5, 0.5))
  drawOn(q('#fr'), rise(t, 1.65, 0.5))

  // The caption, word by word at the top (y 150…320), clear of the card
  kit.say({ text: "Typhoon: Chinese 'big wind', plus a Greek monster", t, at: -0.3, each: 0.07, y: 150, size: 50,
    hl: ["'big", "wind'"], hlColor: C.accent })
}
