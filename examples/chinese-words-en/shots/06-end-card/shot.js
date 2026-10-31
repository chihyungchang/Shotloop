// 06-end-card: End card. The four-word stack from shot 1 returns; each word's
// amber root pops in down the stack, a FROM CHINESE stamp slams with a short
// shake, and a slow drift zoom settles on shot 1's framing.
// Shot-local time: t = 0 is this shot's first frame.
import { wordStack, embers, sourceLine } from '../../world/parts.js'

const DUR = 3
const ROOTS = ['fish sauce', 'great lord', 'big wind', 'knock head']
const ROOT_AT = [0.3, 0.55, 0.8, 1.05]
const STAMP_AT = 1.45

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, ease } = kit

  // The question: typed in fast, then still to the end
  kit.frame({ head: 'Which one *surprised* you?', typed: rise(t, 0, 0.35), progress: (start + t) / 29.5 })

  // The huge ghost 中 behind the stack, as in shot 1
  const gs = 1.05 + 0.03 * t / DUR
  const ghost = '<g transform="translate(330 660) scale(' + gs.toFixed(4) + ')"><text x="0" y="230" text-anchor="middle" font-size="660" font-weight="800" fill="' +
    C.accent + '" opacity="0.06" font-family="' + kit.FONT + '">中</text></g>'

  const stamp = rise(t, STAMP_AT, 0.22)
  const shake = t >= STAMP_AT + 0.2 ? 1 - rise(t, STAMP_AT + 0.22, 0.5) : 0

  kit.stage(
    embers(kit, { t: t + 3.5 }) + ghost +
    wordStack(kit, { t, mark: 1, roots: ROOTS, rootP: ROOT_AT.map(a => rise(t, a, 0.3)), shake }) +
    // The stamp alone (no words land), a little smaller and right so the roots stay clear
    '<g transform="translate(390 650) scale(0.9) translate(-330 -650)">' +
    wordStack(kit, { t, land: [99, 99, 99, 99], stamp, stampText: 'FROM CHINESE', shake }) + '</g>' +
    sourceLine(kit, { text: 'Source: Online Etymology Dictionary', p: rise(t, 1.9, 0.5) })
  )

  // Slow drift zoom: from slightly wide into shot 1's exact framing
  kit.view({ x: 330, y: 650, s: 0.96 + 0.04 * ease(t / DUR) })
}
