// 01-hook-four-words: Hook: four words. The four-word stack slams in word by word
// while the fire-orange counter rolls 1 → 4; a marker sweeps the stack, which shakes.
// Shot-local time: t = 0 is this shot's first frame.
import { wordStack, counterRoll, counterWidth, embers, measure, sourceLine } from '../../world/parts.js'

const LAND = [0.35, 0.8, 1.25, 1.7]
const LINES = ['English words', 'shaped by Chinese']

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, ease, clamp } = kit
  kit.frame({ progress: (start + t) / 29.5 })

  // The counter: 1 pops in with the first word, then rolls up with each landing
  const n = LAND.reduce((s, a) => s + rise(t, a - 0.04, 0.26), 0)
  const pulse = Math.max(0, ...LAND.map(a => (t >= a ? Math.exp(-(t - a) * 8) : 0)))
  const cSize = 210, cY = 300, cW = counterWidth(kit, cSize)

  // The caption beside it, fitted to the space right of the digit
  const tx = kit.PAD + cW + 24, room = kit.SAFE_RIGHT - tx
  const size = Math.min(54, Math.floor(54 * room / Math.max(...LINES.map(l => measure(kit, l, 54)))))
  const line = (s, y, p, hl) => '<g transform="translate(0 ' + ((1 - p) * 26).toFixed(1) + ')" opacity="' + p.toFixed(3) + '">' +
    '<text x="' + tx + '" y="' + y + '" font-size="' + size + '" font-weight="800" fill="' + C.text + '" font-family="' + kit.HEAD_FONT + '">' +
    (hl ? s.replace(hl, '<tspan fill="' + C.accent + '">' + hl + '</tspan>') : s) + '</text></g>'

  // A huge ghost 中 behind the stack, slowly breathing
  const gs = 1 + 0.05 * t / 3.5
  const ghost = '<g transform="translate(330 660) scale(' + gs.toFixed(4) + ')"><text x="0" y="230" text-anchor="middle" font-size="660" font-weight="800" fill="' +
    C.accent + '" opacity="' + (0.06 * rise(t, -0.4, 0.8)).toFixed(3) + '" font-family="' + kit.FONT + '">中</text></g>'

  const shake = t >= 2.98 ? 1 - rise(t, 3.0, 0.45) : 0

  kit.stage(
    embers(kit, { t }) + ghost +
    counterRoll(kit, { x: kit.PAD, y: cY, value: Math.max(1, n), size: cSize, p: rise(t, LAND[0] - 0.08, 0.22), pulse }) +
    line(LINES[0], cY - size * 1.15, rise(t, -0.25, 0.35), '') +
    line(LINES[1], cY, rise(t, -0.15, 0.35), 'Chinese') +
    wordStack(kit, { t, land: LAND, mark: ease((t - 2.0) / 1.0), shake }) +
    sourceLine(kit, { text: 'Sources: Online Etymology Dictionary; Merriam-Webster', p: rise(t, 2.0, 0.5) })
  )
}
