// 07-end-card: End card.
// A calm lock screen; a green shield snaps shut like a lock, the old fake
// alert drops in, greys out and dissolves, while the three red flags circle
// the phone slowly.
// Shot-local time: t = 0 is this shot's first frame.
import { phone, lockScreen, notification, flagLabel, textWidth } from '../../world/parts.js'

const PH = { cx: 360, cy: 692, w: 262 }
const ORBIT = { cx: 360, cy: 692, rx: 178, ry: 268 }
const FLAGS = [
  { text: 'Unknown number', a0: -100 },
  { text: 'Rush', a0: 22 },
  { text: 'Odd link', a0: 142 }
]

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, float, FONT, PAD, SAFE_RIGHT } = kit
  const green = C.hue.green

  // caption: typed in fast, then still to the end
  kit.frame({ head: ['Unexpected parcel text?', '*Don’t tap.*'], typed: rise(t, 0, 0.35), progress: (start + t) / 33 })

  // shield, then its shackle snapping shut
  const shield = clamp((t - 0.1) / 0.6)
  const snap = pop(t, 0.62, 0.3)
  const snapT = t - 0.92
  const shackleY = -26 * (1 - snap)
  const shackle = shield <= 0 ? '' :
    '<g opacity="' + clamp(shield * 2) + '" transform="translate(155 ' + (400 - 62 * (0.6 + 0.4 * pop(shield, 0, 1)) + shackleY) + ')">' +
    '<path d="M-17 6 V-12 A17 17 0 0 1 17 -12 V6" fill="none" stroke="' + green + '" stroke-width="6" stroke-linecap="round"/></g>'
  // a ring pulses out when it locks
  const ring = snapT > 0 && snapT < 0.8 ?
    '<circle cx="155" cy="400" r="' + (60 + 90 * ease(snapT / 0.8)) + '" fill="none" stroke="' + green + '" stroke-width="3" opacity="' + 0.7 * (1 - snapT / 0.8) + '"/>' : ''

  // the old fake alert: drops in, greys out, dissolves
  const drop = pop(t, 0.9, 0.45)
  const grey = rise(t, 1.4, 0.5)
  const gone = ease(clamp((t - 1.9) / 0.7))
  const ny = -110 + 324 * drop
  const alert = drop <= 0 || gone >= 1 ? '' :
    '<g opacity="' + clamp(drop * 3) * (1 - 0.3 * grey) * (1 - gone) + '" transform="translate(155 ' + (ny + 41) + ') scale(' + (1 - 0.12 * gone) + ') translate(-155 ' + (-ny - 41 - 10 * gone) + ')">' +
    notification(kit, { x: 12, y: ny, grey }) + '</g>'

  const screen = lockScreen(kit, { shield, dim: 0.2 }) + shackle + ring + alert

  // orbit: a faint dashed ellipse and the three flags circling slowly
  const spin = t * 17
  let flags = ''
  FLAGS.forEach((f, i) => {
    const a = (f.a0 + spin) * Math.PI / 180
    const hw = (textWidth(f.text, 17) + 32) / 2
    const x = clamp((ORBIT.cx + ORBIT.rx * Math.cos(a) - PAD - hw) / (SAFE_RIGHT - PAD - 2 * hw)) * (SAFE_RIGHT - PAD - 2 * hw) + PAD + hw
    const y = ORBIT.cy + ORBIT.ry * Math.sin(a)
    flags += flagLabel(kit, { x: x - hw, y, text: f.text, p: rise(t, 0.35 + i * 0.18, 0.45) })
  })

  const halo = 0.35 + 0.5 * rise(t, 0.9, 0.6) + 0.05 * Math.sin(t * 3)
  kit.stage(
    '<defs><radialGradient id="ecHalo"><stop offset="0" stop-color="' + green + '" stop-opacity=".26"/><stop offset="1" stop-color="' + green + '" stop-opacity="0"/></radialGradient></defs>' +
    '<ellipse cx="360" cy="680" rx="330" ry="380" fill="url(#ecHalo)" opacity="' + halo + '"/>' +
    '<ellipse cx="' + ORBIT.cx + '" cy="' + ORBIT.cy + '" rx="' + ORBIT.rx + '" ry="' + ORBIT.ry + '" fill="none" stroke="' + C.line +
    '" stroke-width="2" stroke-dasharray="4 10" stroke-dashoffset="' + (-t * 30) + '" opacity="' + rise(t, 0.2, 0.6) + '"/>' +
    phone(kit, { ...PH, cy: PH.cy + float(t, 3, 3), p: 0.8 + 0.2 * rise(t, 0, 0.35), screen }) +
    flags +
    '<text x="360" y="1012" text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">' +
    'Source: FTC, “How To Recognize and Report Spam Text Messages”</text>'
  )
}
