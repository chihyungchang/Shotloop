// 04-card-details-typed-in: Card details typed in.
// The fake pay page scrolls to its card form; card number, expiry and
// security code type in one after another, each copied out as a red chip
// beside the phone; then the finger presses Pay $1.99.
// Shot-local time: t = 0 is this shot's first frame.
import { phone, payScreen, anchors, finger, ripple, dataChip, textWidth } from '../../world/parts.js'

const PH = { cx: 384, cy: 668, w: 330 }
const CARD = '4••• •••• •••• 1234', EXP = '08/27', CVC = '•••'

// Field i: focused from a, typed over [b, b + d]
const FIELDS = [
  { label: 'Card number', value: CARD, chip: '•••• 1234', a: 0.9, b: 1.05, d: 1.0, chipY: 606 },
  { label: 'Expiry', value: EXP, chip: EXP, a: 2.2, b: 2.3, d: 0.45, chipY: 680 },
  { label: 'Security code', value: CVC, chip: CVC, a: 2.9, b: 3.0, d: 0.35, chipY: 760 }
]
const TAP = 3.85

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, hash, float, FONT } = kit
  kit.frame({ kicker: 'The fake page', head: ['A *$1.99* fee for', 'your full card'], typed: rise(t, 0, 0.45), progress: (start + t) / 33 })

  const scroll = ease(clamp((t - 0.25) / 0.7))
  const A = anchors({ ...PH, scroll })

  // typing state: the active field and the typed text of each
  let active = -1
  const values = FIELDS.map((f, i) => {
    if (t >= f.a && (i === 2 ? t < TAP - 0.4 : t < FIELDS[i + 1].a)) active = i
    const n = Math.round(f.value.length * clamp((t - f.b) / f.d))
    return f.value.slice(0, n)
  })
  const typing = FIELDS.some(f => t > f.b && t < f.b + f.d)
  const caret = typing || Math.floor(t * 3.2) % 2 === 0

  // the press on Pay
  const press = Math.min(rise(t, TAP - 0.08, 0.12), 1 - rise(t, TAP + 0.25, 0.25))
  const screen = payScreen(kit, { scroll, addr: 1, active, values, caret, pressed: press })

  // chips: each field copied out when it is filled, a red line from the field
  const fieldBox = [A.card, A.expiry, A.cvc]
  let chips = ''
  FIELDS.forEach((f, i) => {
    const q = rise(t, f.b + f.d + 0.05, 0.45)
    if (q <= 0) return
    // chips left-aligned at x 58 (same width rule as dataChip)
    const cw = Math.max(textWidth(f.chip, 15), textWidth(f.label, 11)) + 30
    const fb = fieldBox[i], cx = 58 + cw / 2, cy = f.chipY + float(t, 2, 3, i * 0.3)
    const pulse = t > TAP ? 1 + 0.06 * Math.exp(-(t - TAP - i * 0.12) * 4) * Math.max(0, Math.sin((t - TAP - i * 0.12) * 12)) : 1
    // the security code's line leaves under its field, through the gap above Pay
    const x1 = i === 2 ? fb.x + 14 : fb.x, y1 = i === 2 ? fb.y + fb.h + 9 : fb.cy, x2 = 58 + cw, y2 = cy
    const mid = i === 2 ? ' L' + (A.expiry.x - 4) + ' ' + y1 : ''
    const sx = i === 2 ? A.expiry.x - 4 : x1
    chips += '<path d="M' + x1 + ' ' + y1 + mid + ' C' + (sx - 30) + ' ' + y1 + ' ' + (x2 + 30) + ' ' + y2 + ' ' + x2 + ' ' + y2 +
      '" fill="none" stroke="' + C.hue.red + '" stroke-width="2" stroke-dasharray="4 5" stroke-dashoffset="' + (-t * 30) + '" opacity="' + 0.8 * q + '"/>' +
      '<circle cx="' + x1 + '" cy="' + y1 + '" r="4" fill="' + C.hue.red + '" opacity="' + q + '"/>' +
      dataChip(kit, { x: cx + (1 - ease(q)) * 60, y: cy, label: f.label, value: f.chip, p: q, scale: pulse })
  })

  // the bracket gathering the three chips: the whole card
  const br = rise(t, TAP + 0.35, 0.5)
  const bracket = br <= 0 ? '' :
    '<path d="M50 576 H42 V790 H50" fill="none" stroke="' + C.hue.red + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - br) + '"/>'

  // ambient: a soft glow behind the phone and drifting dust
  let dust = ''
  for (let i = 0; i < 26; i++) {
    const x = 40 + hash(i, 1) * 580, y = 340 + ((hash(i, 2) * 700 - t * (8 + hash(i, 3) * 14)) % 700 + 700) % 700
    dust += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1 + hash(i, 4) * 1.8).toFixed(1) + '" fill="' + C.hue.blue + '" opacity="' + (0.08 + 0.14 * hash(i, 5)).toFixed(2) + '"/>'
  }
  const focusY = active >= 0 ? fieldBox[active].cy : A.pay.cy

  const fp = rise(t, TAP - 0.75, 0.6)
  kit.stage(
    '<defs><radialGradient id="g4"><stop offset="0" stop-color="' + C.hue.blue + '" stop-opacity=".22"/><stop offset="1" stop-color="' + C.hue.blue + '" stop-opacity="0"/></radialGradient></defs>' +
    '<ellipse cx="' + PH.cx + '" cy="' + focusY + '" rx="300" ry="220" fill="url(#g4)" opacity="' + rise(t, 0.6, 0.5) + '"/>' +
    dust +
    phone(kit, { ...PH, p: 0.8 + 0.2 * rise(t, 0, 0.3), screen }) +
    chips + bracket +
    ripple(kit, { x: A.pay.cx, y: A.pay.cy, p: (t - TAP) / 0.65 }) +
    finger(kit, { x: A.pay.cx + 40, y: A.pay.cy + 6, p: fp, press, angle: -18 }) +
    '<text x="360" y="1018" text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">Illustration · not a real courier site or card</text>'
  )
}
