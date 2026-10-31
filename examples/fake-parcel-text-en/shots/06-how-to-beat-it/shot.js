// 06-how-to-beat-it: How to beat it.
// Back on the fake text: the link is struck through in red. Then two green
// steps: a courier site you know is real (not the link) opens on a tracking
// screen, and the text is forwarded to 7726 and delivered; finally the
// bubble is swiped away.
// Shot-local time: t = 0 is this shot's first frame.
import { phone, phoneBox, messagesScreen, anchors, flagLabel, finger, ripple, textWidth } from '../../world/parts.js'

const PH = { cx: 360, cy: 368 + 307.3, w: 300 }
const FWD = ['Your parcel is on hold.', 'Pay a $1.99 redelivery fee', 'within 24h:', 'parcel-redeliver.info/xyz']

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, lerp, hash, float, hold, FONT } = kit
  const red = C.hue.red, green = C.hue.green, blue = C.hue.blue

  // headline: each line types in as its step begins
  const typed = (10 + 17 * rise(t, 1.1, 0.3) + 16 * rise(t, 2.0, 0.35)) / 43
  kit.frame({ head: ["Don't tap.", 'Use a known site.', 'Forward to *7726*.'], typed, top: 140, progress: (start + t) / 33 })

  const b = phoneBox(PH), k = b.k
  const toF = (sx, sy) => [b.left + (9 + sx) * k, b.top + (9 + sy) * k]
  const a = anchors(PH)

  // ---- timing
  const strike = rise(t, 0.5, 0.45)
  const iconP = pop(t, 1.1, 0.4)
  const collapse = ease(clamp((t - 2.65) / 0.3))
  const grow = ease(clamp((t - 1.6) / 0.4)) * (1 - collapse)
  const trackP = rise(t, 2.0, 0.7)
  const sheet = rise(t, 2.85, 0.4) * (1 - rise(t, 4.45, 0.35))
  const digits = Math.min(4, Math.floor(clamp((t - 3.15) / 0.5) * 5))
  const sent = pop(t, 4.0, 0.4)
  const swipe = ease(clamp((t - 4.85) / 0.5))
  const gone = rise(t, 5.35, 0.3)

  // ---- screen (screen coordinates)
  let scr = messagesScreen(kit, { bubble: 1, strike, swipe })
  // delete action revealed behind the swiping bubble
  const del = clamp(swipe * 3) * (1 - gone)
  if (del > 0) {
    scr += '<g opacity="' + del + '"><path d="' + rr(232, 196, 64, 84, 16) + '" fill="' + red + '"/>' +
      '<path d="M252 226 h24 M257 226 v-4 h14 v4 M255 230 l2 24 h14 l2 -24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>'
  }
  if (gone > 0) {
    const w = textWidth('Message deleted', 14) + 32
    scr += '<g opacity="' + gone + '" transform="translate(0 ' + (1 - gone) * 12 + ')"><path d="' + rr(155 - w / 2, 222, w, 36, 18) + '" fill="#2c2c2e"/>' +
      tx(155, 245, 'Message deleted', { size: 14, weight: 600, fill: '#fff', anchor: 'middle' }) + '</g>'
  }
  // a saved courier site you know (not the text's link): icon pops, then grows into its tracking screen
  if (iconP > 0 && collapse < 1) {
    const dim = 0.45 * rise(t, 1.1, 0.3)
    const x = lerp(123, 0, grow), y = lerp(372, 0, grow), w = lerp(64, 310, grow), h = lerp(64, 654, grow)
    const sc = grow > 0 ? 1 : 0.4 + 0.6 * iconP
    scr += '<g opacity="' + (1 - collapse) + '">' +
      '<rect width="310" height="654" fill="#000" opacity="' + dim + '"/>' +
      '<g transform="translate(' + (x + w / 2) + ' ' + (y + h / 2) + ') scale(' + sc + ')">' +
      '<path d="' + rr(-w / 2, -h / 2, w, h, lerp(15, 40, grow)) + '" fill="' + green + '"/>' +
      '<g transform="scale(' + (1.5 + grow) + ')" opacity="' + (1 - clamp(grow * 1.6)) + '">' + parcel('#0b2414') + '</g></g>' +
      tx(155, 456, 'Courier', { size: 13, weight: 600, fill: '#fff', anchor: 'middle', extra: 'opacity="' + clamp(iconP) * (1 - clamp(grow * 3)) + '"' }) +
      (grow > 0.7 ? '<g opacity="' + clamp((grow - 0.7) / 0.3) + '">' + tracking(trackP) + '</g>' : '') +
      '</g>'
  }
  // forward sheet: To 7726, send, delivered
  if (sheet > 0) {
    const Y = 110 + (1 - ease(sheet)) * 560
    const num = '7726'.slice(0, digits)
    scr += '<rect width="310" height="654" fill="#000" opacity="' + 0.35 * sheet + '"/>' +
      '<path d="' + rr(0, Y, 310, 620, 22) + '" fill="#ffffff"/>' +
      '<rect x="135" y="' + (Y + 8) + '" width="40" height="5" rx="2.5" fill="#d0d0d6"/>' +
      tx(18, Y + 42, 'Cancel', { size: 15, fill: '#0a72e8' }) +
      tx(155, Y + 42, 'New Message', { size: 16, weight: 700, fill: '#111', anchor: 'middle' }) +
      '<rect y="' + (Y + 58) + '" width="310" height="1" fill="#e0e0e6"/>' +
      tx(18, Y + 88, 'To:', { size: 15, fill: '#8e8e93' }) +
      (digits > 0 ? '<path d="' + rr(46, Y + 70, textWidth(num, 16) + 22, 26, 13) + '" fill="' + blue + '" fill-opacity=".16"/>' +
        tx(57, Y + 89, num, { size: 16, weight: 700, fill: '#0a72e8' }) : '') +
      (digits < 4 && t > 3.2 && Math.floor(t * 4) % 2 === 0 ? '<rect x="' + (digits > 0 ? 72 + textWidth(num, 16) : 50) + '" y="' + (Y + 72) + '" width="2" height="22" fill="#0a72e8"/>' : '') +
      '<rect y="' + (Y + 104) + '" width="310" height="1" fill="#e0e0e6"/>'
    // forwarded text in the input, then as a sent bubble
    const lw = Math.max(...FWD.map(l => textWidth(l, 13))) + 24, bh = FWD.length * 17 + 18
    const ins = 1 - clamp(sent * 2)
    scr += '<g opacity="' + ins + '"><path d="' + rr(12, Y + 222, 286, 96, 18) + '" fill="#fff" stroke="#d2d2d8" stroke-width="1.2"/>' +
      FWD.map((l, i) => tx(26, Y + 244 + 17 * i, l, { size: 13, fill: '#333' })).join('') +
      '<circle cx="280" cy="' + (Y + 298) + '" r="13" fill="#0a84ff"/><path d="M280 ' + (Y + 305) + ' v-13 M274 ' + (Y + 297) + ' l6 -6 l6 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>'
    if (sent > 0) {
      const bx = 298 - lw, by = Y + 124 + (1 - clamp(sent)) * 100
      scr += '<g opacity="' + clamp(sent * 2) + '"><path d="' + rr(bx, by, lw, bh, 18) + '" fill="#0a84ff"/>' +
        FWD.map((l, i) => tx(bx + 12, by + 22 + 17 * i, l, { size: 13, fill: '#fff' })).join('') + '</g>'
      const dp = rise(t, 4.3, 0.3), dw = textWidth('Delivered', 12)
      if (dp > 0) scr += '<g opacity="' + dp + '"><circle cx="' + (290 - dw - 12) + '" cy="' + (by + bh + 15) + '" r="8" fill="' + green + '"/>' +
        '<path d="M' + (290 - dw - 16) + ' ' + (by + bh + 15) + ' l3 3 l5 -6" fill="none" stroke="#0b2414" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        tx(290, by + bh + 19, 'Delivered', { size: 12, weight: 600, fill: '#2f8f50', anchor: 'end' }) + '</g>'
    }
    // keyboard
    let kb = '<rect y="' + (Y + 334) + '" width="310" height="320" fill="#d1d4da"/>'
    ;[10, 9, 7].forEach((n, r) => {
      const x0 = (310 - (n * 29 - 4)) / 2
      for (let i = 0; i < n; i++) kb += '<rect x="' + (x0 + i * 29) + '" y="' + (Y + 344 + r * 48) + '" width="25" height="38" rx="5" fill="#fff"/>'
    })
    kb += '<rect x="80" y="' + (Y + 488) + '" width="150" height="38" rx="5" fill="#fff"/>'
    scr += kb
  }

  // ---- frame layer
  const phoneP = 1

  // background dots and a halo turning from red to green
  let dots = ''
  for (let i = 0; i < 46; i++) {
    const x = hash(i, 1) * 720, y = 300 + hash(i, 2) * 760 - ((t * 10 * (0.5 + hash(i, 3))) % 60)
    dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1 + hash(i, 4) * 1.6).toFixed(2) + '" fill="#fff" opacity="' + (0.04 + 0.07 * hash(i, 5)).toFixed(3) + '"/>'
  }
  const greenOn = rise(t, 1.7, 1.2)
  const breathe = 0.85 + 0.15 * Math.sin(t * 4)

  // "Don't tap" label under the bubble, a line up to the struck link
  const labP = pop(t, 0.8, 0.45) * (1 - rise(t, 1.4, 0.3))
  const lX = a.link.x + 4, lY = a.bubble.y + a.bubble.h + 46 + float(t, 2, 2.8)
  const conn = rise(t, 0.8, 0.35) * (1 - rise(t, 1.4, 0.3))

  // fingers: tap the saved site, tap send, swipe the bubble
  const [ix, iy] = toF(155, 404)
  const f1 = rise(t, 1.0, 0.35) * (1 - rise(t, 1.65, 0.3))
  const p1 = clamp(1 - Math.abs(t - 1.45) / 0.12)
  const [sx, sy] = toF(280, 110 + 298)
  const f2 = rise(t, 3.55, 0.35) * (1 - rise(t, 4.15, 0.3))
  const p2 = clamp(1 - Math.abs(t - 3.97) / 0.12)
  const [wx, wy] = toF(160 - swipe * 190, 238)
  const f3 = rise(t, 4.55, 0.3) * (1 - rise(t, 5.25, 0.3))

  // green step cards: the first moves up when the second lands
  const c1 = rise(t, 1.9, 0.45), c2 = rise(t, 4.05, 0.45)
  const c1y = 938 - 70 * ease(c2)

  kit.stage(
    '<defs><radialGradient id="h6r"><stop offset="0" stop-color="' + red + '" stop-opacity=".26"/><stop offset="1" stop-color="' + red + '" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="h6g"><stop offset="0" stop-color="' + green + '" stop-opacity=".24"/><stop offset="1" stop-color="' + green + '" stop-opacity="0"/></radialGradient></defs>' +
    dots +
    '<ellipse cx="360" cy="640" rx="330" ry="380" fill="url(#h6r)" opacity="' + strike * (1 - greenOn) * breathe + '"/>' +
    '<ellipse cx="360" cy="660" rx="' + (300 + 40 * greenOn) + '" ry="400" fill="url(#h6g)" opacity="' + greenOn * breathe + '"/>' +
    phone(kit, { ...PH, p: phoneP, screen: scr }) +
    ripple(kit, { x: a.link.cx, y: a.link.cy, p: clamp((t - 0.6) / 0.7), color: red }) +
    (conn > 0 ? '<line x1="' + (lX + 30) + '" y1="' + (lY - 19) + '" x2="' + (lX + 30) + '" y2="' + lerp(lY - 19, a.link.y + a.link.h, ease(conn)) + '" stroke="' + red + '" stroke-width="3" stroke-linecap="round" opacity="' + conn + '"/>' : '') +
    flagLabel(kit, { x: lX, y: lY, text: "Don't tap", p: labP }) +
    ripple(kit, { x: ix, y: iy, p: clamp((t - 1.45) / 0.6) }) +
    finger(kit, { x: ix, y: iy, p: f1, press: p1 }) +
    ripple(kit, { x: sx, y: sy, p: clamp((t - 3.97) / 0.6) }) +
    finger(kit, { x: sx, y: sy, p: f2, press: p2 }) +
    finger(kit, { x: wx, y: wy, p: f3, press: clamp((t - 4.75) / 0.1) }) +
    stepCard(kit, c1y + float(t, 1.5, 2.6), 'Use a site you know is real', c1, rise(t, 2.15, 0.35)) +
    stepCard(kit, 938 + float(t, 1.5, 2.6, 0.4), 'Forwarded to 7726', c2, rise(t, 4.3, 0.35)) +
    '<text x="360" y="1016" text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">' +
    'Source: FTC, “How To Recognize and Report Spam Text Messages” · illustration</text>'
  )

  // ---- helpers that need the kit
  function tx(x, y, s, { size = 15, weight = 500, fill = '#111', anchor = 'start', extra = '' } = {}) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + FONT + '" font-size="' + size + '" font-weight="' + weight +
      '" fill="' + fill + '" text-anchor="' + anchor + '" ' + extra + '>' + String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'
  }

  // The courier's tracking screen, reached from a site you know (illustrative)
  function tracking(p) {
    const steps = ['Shipped', 'In transit', 'Out for delivery']
    let s = '<rect width="310" height="654" fill="#f3f5f4"/>' +
      '<rect width="310" height="136" fill="' + green + '"/>' +
      tx(42, 32, '9:41', { size: 15, weight: 700, fill: '#0b2414', anchor: 'middle' }) +
      '<path d="' + rr(20, 62, 46, 46, 12) + '" fill="#fff"/><g transform="translate(43 85) scale(1.1)">' + parcel(green) + '</g>' +
      tx(80, 82, 'Courier', { size: 21, weight: 800, fill: '#0b2414' }) +
      tx(80, 101, 'Site you know is real · Track', { size: 12, weight: 600, fill: '#14532d' }) +
      '<path d="' + rr(14, 152, 282, 214, 16) + '" fill="#fff" stroke="#e1e5e2"/>' +
      tx(30, 180, 'TRACKING', { size: 11, weight: 700, fill: '#7a817c', extra: 'letter-spacing="0.8"' }) +
      tx(30, 204, 'Your parcel', { size: 19, weight: 800, fill: '#111' }) +
      '<line x1="40" y1="236" x2="40" y2="' + lerp(236, 336, ease(p)) + '" stroke="' + green + '" stroke-width="3"/>'
    steps.forEach((l, i) => {
      const q = clamp(p * 3 - i)
      s += '<circle cx="40" cy="' + (236 + 50 * i) + '" r="8" fill="' + (q > 0.5 ? green : '#fff') + '" stroke="' + (q > 0 ? green : '#c9cfcb') + '" stroke-width="3"/>' +
        tx(60, 242 + 50 * i, l, { size: 15, weight: q > 0.5 ? 700 : 500, fill: q > 0.5 ? '#111' : '#8a918c' })
    })
    // other deliveries (placeholder rows)
    for (let i = 0; i < 3; i++) {
      const y = 386 + i * 62
      s += '<path d="' + rr(14, y, 282, 52, 12) + '" fill="#fff" stroke="#e1e5e2"/>' +
        '<rect x="28" y="' + (y + 13) + '" width="26" height="26" rx="7" fill="#e3ece6"/>' +
        '<rect x="66" y="' + (y + 16) + '" width="' + (120 + 40 * hash(i, 9)) + '" height="8" rx="4" fill="#d9dedb"/>' +
        '<rect x="66" y="' + (y + 31) + '" width="' + (70 + 30 * hash(i, 8)) + '" height="6" rx="3" fill="#e6eae8"/>'
    }
    return s
  }
}

// A parcel glyph centred on (0, 0)
const parcel = c => '<path d="M-11 -6 L0 -11 L11 -6 L0 -1 Z M-11 -6 V6 L0 11 V-1 M11 -6 V6 L0 11" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linejoin="round"/>'

// A green step card with a tick, sliding in from the right
function stepCard(kit, y, text, p, tick) {
  if (p <= 0) return ''
  const g = kit.C.hue.green, w = textWidth('Use a site you know is real', 21) + 96, e = 1 - Math.pow(1 - Math.min(1, p), 3)
  const x0 = 360 - w / 2 + (1 - e) * 90
  return '<g opacity="' + Math.min(1, p * 2) + '"><path d="' + rr(x0, y - 28, w, 56, 18) + '" fill="#10261a" fill-opacity=".97" stroke="' + g + '" stroke-width="2"/>' +
    '<circle cx="' + (x0 + 34) + '" cy="' + y + '" r="15" fill="' + g + '"/>' +
    '<path d="M' + (x0 + 27) + ' ' + y + ' l5 5 l9 -10" fill="none" stroke="#0b2414" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - tick) + '"/>' +
    '<text x="' + (x0 + 62) + '" y="' + (y + 7) + '" font-family="' + kit.FONT + '" font-size="21" font-weight="700" fill="#fff">' + text + '</text></g>'
}

// A rounded rectangle path
function rr(x, y, w, h, r) {
  return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) +
    'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) +
    'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z'
}
