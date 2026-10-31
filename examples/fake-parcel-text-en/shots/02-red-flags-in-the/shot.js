// 02-red-flags-in-the: Red flags in the text.
// The lock screen opens into Messages, the fake text lands, and three red
// flags pin on in turn (the unknown sender, the 24h rush, the odd link)
// while the phone zooms gently in.
// Shot-local time: t = 0 is this shot's first frame.
import { phone, lockScreen, messagesScreen, anchors, flagLabel, ripple } from '../../world/parts.js'

const TOP = 304 // the phone's top edge stays put while it grows
const FLAGS = { number: 1.0, rush: 2.0, link: 3.0 }

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, hash, float, FONT } = kit
  const red = C.hue.red

  kit.frame({ head: ['Unknown number,', 'a rush, an *odd link*'], typed: rise(t, 0, 0.6), progress: (start + t) / 33 })

  // gentle zoom
  const w = 312 + 24 * ease(clamp(t / 5))
  const h = w * 672 / 328
  // starts where shot 01 left the phone (top ≈ 340), then rises under the headline
  const PH = { cx: 360, cy: kit.lerp(340, TOP, rise(t, 0, 0.7)) + h / 2, w }
  const a = anchors(PH)

  // flags: ring drawn, then the label slides out
  const ring = k => rise(t, FLAGS[k], 0.5)
  const lab = k => pop(t, FLAGS[k] + 0.3, 0.45)
  const done = ring('number') + ring('rush') + ring('link')

  // Messages opens from the lock screen, the bubble lands
  const open = rise(t, 0.05, 0.4)
  const screen = messagesScreen(kit, {
    bubble: pop(t, 0.35, 0.5),
    flags: { number: ring('number'), rush: ring('rush'), link: ring('link') }
  }) + (open < 1 ? '<g opacity="' + (1 - open) + '" transform="translate(155 327) scale(' + (1 + 0.15 * open) + ') translate(-155 -327)">' + lockScreen(kit, { notif: 1, stack: 2 }) + '</g>' : '')

  // background: drifting dots, a red halo growing with each flag
  let dots = ''
  for (let i = 0; i < 46; i++) {
    const x = hash(i, 1) * 720, y = 300 + hash(i, 2) * 760 - ((t * 10 * (0.5 + hash(i, 3))) % 60)
    dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1 + hash(i, 4) * 1.6).toFixed(2) + '" fill="#fff" opacity="' + (0.04 + 0.07 * hash(i, 5)).toFixed(3) + '"/>'
  }

  // connector from a label to its part
  const link = (x1, y1, x2, y2, p) => p <= 0 ? '' :
    '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + lerpN(x1, x2, ease(p)) + '" y2="' + lerpN(y1, y2, ease(p)) + '" stroke="' + red + '" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="' + x2 + '" cy="' + y2 + '" r="4.5" fill="' + red + '" opacity="' + clamp(p * 2 - 1) + '"/>'

  // label positions (frame coordinates), with idle float
  const nY = a.number.cy + float(t, 2, 2.6)
  const nX = a.number.x + a.number.w + 14
  const rY = a.rush.cy + float(t, 2, 2.4, 0.3)
  const rX = a.bubble.x + a.bubble.w + 12
  const lY = a.bubble.y + a.bubble.h + 46 + float(t, 2, 2.8, 0.6)
  const lX = a.link.x + 4

  const ripples = ['number', 'rush', 'link'].map(k => ripple(kit, { x: a[k].cx, y: a[k].cy, p: clamp((t - FLAGS[k] - 0.4) / 0.7), color: red })).join('')

  kit.stage(
    '<defs><radialGradient id="halo"><stop offset="0" stop-color="' + red + '" stop-opacity=".28"/><stop offset="1" stop-color="' + red + '" stop-opacity="0"/></radialGradient></defs>' +
    dots +
    '<ellipse cx="360" cy="560" rx="' + (300 + 30 * done) + '" ry="360" fill="url(#halo)" opacity="' + (done / 3) * (0.85 + 0.15 * Math.sin(t * 4)) + '"/>' +
    phone(kit, { ...PH, p: 1, screen }) +
    ripples +
    // Unknown number: to the right of the sender
    flagLabel(kit, { x: nX, y: nY, text: 'Unknown number', p: lab('number') }) +
    // Rush: right of the bubble, a line back to '24h:'
    link(rX, rY, a.rush.x + a.rush.w + 2, a.rush.cy, rise(t, FLAGS.rush + 0.3, 0.35)) +
    flagLabel(kit, { x: rX, y: rY, text: 'Rush', p: lab('rush') }) +
    // Odd link: under the bubble, a line up to the link
    link(lX + 30, lY - 19, lX + 30, a.link.y + a.link.h, rise(t, FLAGS.link + 0.3, 0.35)) +
    flagLabel(kit, { x: lX, y: lY, text: 'Odd link', p: lab('link') }) +
    '<text x="360" y="1016" text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">' +
    'Source: FTC, “How To Recognize and Report Spam Text Messages” · example text</text>'
  )
}

const lerpN = (a, b, p) => (a + (b - a) * p).toFixed(1)
