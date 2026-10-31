// 03-the-tap-and-the: The tap and the fake page.
// A finger taps the link in the fake text, the copycat pay page slides up
// over Messages, then its address bar lifts out of the phone, scales up,
// turns red and pulses: 'Not the courier's site'.
// Shot-local time: t = 0 is this shot's first frame.
import { phone, messagesScreen, payScreen, addressBar, finger, ripple, flagLabel, anchors, textWidth, SCREEN_H } from '../../world/parts.js'

const PH = { cx: 360, cy: 650, w: 312 }
// The lifted address bar: its size and centre on the frame
const BAR_W = 286, BAR_H = 34, BIG = 1.6, BIG_CY = 760

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, float, FONT } = kit
  kit.frame({ kicker: 'Step 2 · the tap', head: ['The page looks *real*.', 'The address *isn’t.*'], typed: rise(t, -0.15, 0.7), progress: (start + t) / 33 })

  const a = anchors(PH)

  // the tap: finger arrives, presses the link, leaves
  const fIn = rise(t, 0.05, 0.55), press = rise(t, 0.6, 0.12) * (1 - rise(t, 0.85, 0.15))
  const fOut = rise(t, 1.25, 0.5)
  const linkTap = rise(t, 0.62, 0.1) * (1 - rise(t, 1.2, 0.3))

  // the page slides up over the messages and loads
  const slide = ease(clamp((t - 1.0) / 0.7))
  const pageY = (1 - slide) * SCREEN_H
  const loaded = rise(t, 1.45, 0.5)
  // a glint across the page: it looks the part
  const glint = clamp((t - 1.9) / 0.8)

  // the address bar lifts out, grows, turns red
  const lift = ease(clamp((t - 2.5) / 0.75))
  const red = rise(t, 3.05, 0.4)
  const s = kit.lerp(a.address.w / BAR_W, BIG, lift)
  const cx = kit.lerp(a.address.cx, 360, lift)
  const cy = kit.lerp(a.address.cy, BIG_CY, lift) + float(t, 3, 2.4) * rise(t, 3.3, 0.5)
  const bx = cx - BAR_W * s / 2, by = cy - BAR_H * s / 2

  let screen = messagesScreen(kit, { bubble: 1, linkTap })
  if (slide > 0) {
    screen += '<g transform="translate(0 ' + pageY + ')">' +
      '<rect y="-18" width="310" height="18" fill="#000" opacity="' + 0.18 * (1 - slide) + '"/>' +
      payScreen(kit, { page: loaded, addr: red }) + '</g>'
    if (glint > 0 && glint < 1) {
      const gx = -120 + glint * 520
      screen += '<g opacity="' + Math.sin(glint * Math.PI) * 0.55 + '"><path d="M' + gx + ' 97 l60 0 l-120 480 l-60 0 z" fill="url(#glint)"/></g>'
    }
  }

  // red outline pulses round the lifted bar
  let pulses = ''
  if (red > 0) {
    for (let i = 0; i < 3; i++) {
      const q = ((t - 3.3) / 1.2 + i / 3) % 1
      if (t < 3.3 + (i / 3) * 1.2 || q <= 0) continue
      const g = 4 + q * 14
      pulses += '<rect x="' + (bx - g) + '" y="' + (by - g) + '" width="' + (BAR_W * s + 2 * g) + '" height="' + (BAR_H * s + 2 * g) + '" rx="' + (11 * s + g) +
        '" fill="none" stroke="' + C.hue.red + '" stroke-width="3" opacity="' + (1 - q) * 0.8 + '"/>'
    }
  }

  // callout lines from the bar's place in the phone to the lifted bar
  const call = lift > 0 ? (() => {
    const o = 0.5 * rise(t, 2.6, 0.4)
    const l = (x1, y1, x2, y2) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (red > 0.5 ? C.hue.red : C.text) + '" stroke-width="1.6" stroke-dasharray="5 5" opacity="' + o + '"/>'
    return l(a.address.x, a.address.y + a.address.h, bx, by) + l(a.address.x + a.address.w, a.address.y + a.address.h, bx + BAR_W * s, by) +
      '<rect x="' + a.address.x + '" y="' + a.address.y + '" width="' + a.address.w + '" height="' + a.address.h + '" rx="10" fill="none" stroke="' + (red > 0.5 ? C.hue.red : C.text) + '" stroke-width="2" opacity="' + o * 1.6 + '"/>'
  })() : ''

  const label = "Not the courier's site"
  const lw = textWidth(label, 17) + 32
  const camS = 1 + 0.04 * ease(clamp(t / 5))

  kit.stage(
    '<defs><linearGradient id="glint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<filter id="barShadow" x="-20%" y="-60%" width="140%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '<radialGradient id="hot"><stop offset="0" stop-color="' + C.hue.red + '" stop-opacity=".25"/><stop offset="1" stop-color="' + C.hue.red + '" stop-opacity="0"/></radialGradient></defs>' +
    '<ellipse cx="360" cy="' + BIG_CY + '" rx="340" ry="160" fill="url(#hot)" opacity="' + red + '"/>' +
    phone(kit, { ...PH, p: 1, screen }) +
    // the phone dims a little while the bar is lifted out
    '<rect x="' + (a.screen.x) + '" y="' + a.screen.y + '" width="' + a.screen.w + '" height="' + a.screen.h + '" rx="40" fill="#000" opacity="' + 0.35 * lift + '"/>' +
    finger(kit, { x: a.link.cx + 30, y: a.link.cy + 2, p: fIn * (1 - fOut), press }) +
    ripple(kit, { x: a.link.cx + 30, y: a.link.cy, p: clamp((t - 0.66) / 0.6) }) +
    call + pulses +
    (lift > 0 ? '<rect x="' + (bx + 8) + '" y="' + (by + 14) + '" width="' + (BAR_W * s - 16) + '" height="' + BAR_H * s + '" rx="18" fill="#000" opacity="' + 0.55 * lift + '" filter="url(#barShadow)"/>' +
      addressBar(kit, { x: bx, y: by, scale: s, red }) : '') +
    flagLabel(kit, { x: 360 - lw / 2, y: BIG_CY + 72, text: label, p: rise(t, 3.45, 0.4) }) +
    '<text text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">' +
    '<tspan x="360" y="1000">Source: FTC, “How To Recognize and Report Spam Text Messages”</tspan>' +
    '<tspan x="360" y="1016">Illustration: page and address are made up</tspan></text>'
  )
  kit.view({ x: 360, y: 660, s: camS })
}
