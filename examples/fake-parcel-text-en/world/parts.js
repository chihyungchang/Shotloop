// Recurring pictures of "How a fake delivery text message steals your card details".
// Every function returns SVG markup for kit.stage() (join the strings in the
// order you want them layered). They are pure functions of their options:
// the design (layout, colours, labels) is fixed here, so every shot shows the
// same phone, the same text and the same fake page. Draw them on the SVG
// stage (not with kit.phone), so overlays, kit.view() zooms and the finger
// layer correctly. Colour meaning, for the whole video: red (C.hue.red) marks
// scam elements, green (C.hue.green) safe actions, blue (C.hue.blue) the
// active field or a tap.
//
// THE PHONE
//   phone(kit, { cx = 360, cy = 650, w = 312, p = 1, tilt = 0, shake = 0, screen = '' })
//     Graphite phone with thin bezels, centred at (cx, cy), w wide (height
//     w × 2.05). The default sits between the headline (2 lines max, ends
//     ≈ y 300) and a small source line at y ≈ 1000–1020. Zoom it by passing
//     a bigger w (or use kit.view). p 0→1: slides up and fades in. tilt: degrees.
//     shake: px sideways (a buzz: Math.sin(t * 110) * 5 * envelope).
//     screen: markup from a screen function below (screen coordinates,
//     310 × 654, origin at the screen's top-left). Screens can be stacked or
//     moved inside: e.g. messagesScreen(...) + '<g transform="translate(0 300)">'
//     + payScreen(...) + '</g>' slides the page up over the messages.
//   phoneBox({ cx, cy, w }) → { left, top, w, h, k }   the phone's frame box
//   anchors({ cx, cy, w, scroll = 0 }) → named boxes in FRAME coordinates
//     { x, y, w, h, cx, cy } for the phone drawn with the same cx, cy, w (at
//     p = 1, tilt 0): screen, notif (lock-screen alert), number (sender at
//     the top of Messages), avatar, bubble, rush ('24h:' in the bubble), link,
//     input, address (browser address bar), header (yellow courier header),
//     fee ('Delivery fee: $1.99'), card, expiry, cvc (form fields), pay (the
//     Pay button). Pay-page boxes follow payScreen's scroll. Use them to put
//     flag labels beside the phone, the finger on the link, chips on fields.
//
// SCREENS (pass the result as phone's screen)
//   lockScreen(kit, { notif = 0, stack = 0, grey = 0, dim = 0, shield = 0 })
//     Dark lock screen (wallpaper, date, 9:41 clock, torch/camera buttons).
//     notif 0→1 drops the 'Your parcel is on hold' alert from the top (pass a
//     kit.pop value for a landing bounce; 0 = no alert). stack 0→2: one or
//     two more identical alerts piling under it. grey 0→1 greys the alert
//     out (end card), dim 0→1 darkens the wallpaper. shield 0→1: a green
//     shield snaps on over the middle of the screen (end card).
//   messagesScreen(kit, { bubble = 1, flags = {}, strike = 0, swipe = 0, linkTap = 0 })
//     The Messages app, unknown sender '+1 (202) 555-0148' at the top, the
//     fake text as a grey incoming bubble on the left: 'Your parcel is on
//     hold. / Pay a $1.99 redelivery fee / within 24h: /
//     parcel-redeliver.info/xyz' (link blue, underlined). bubble 0→1: the
//     bubble arrives. flags { number, rush, link } each 0→1: a red ring
//     draws round the sender, a red underline under '24h:', a red box round
//     the link. strike 0→1: red line through the link ("don't tap").
//     swipe 0→1: the bubble flies off to the left (deleted). linkTap 0→1:
//     the link's pressed highlight (blue).
//   payScreen(kit, { scroll = 0, addr = 0, active = -1, values = ['', '', ''], caret = false, pressed = 0, page = 1 })
//     Mobile browser on the fake page: address bar 'parcel-redeliver.info'
//     at the top, yellow courier-style header with a generic parcel icon
//     ('PARCEL DELIVERY', no real brand), a card 'Your parcel is on hold /
//     Delivery fee: $1.99', then the card form: Card number, Expiry,
//     Security code and a wide black 'Pay $1.99' button. scroll 0→1 moves
//     the page up 110 px to centre the form. addr 0→1 turns the address
//     bar red. active 0|1|2 lights that field blue (-1 none). values: the
//     typed text of the three fields (e.g. '4••• •••• •••• 1234', '08/27',
//     '•••'); type them in by slicing. caret: show the blue cursor after the
//     active field's text (blink it yourself). pressed 0→1: Pay pressed.
//     page 0→1: the page content fades in under the bar (loading).
//
// PIECES (frame or screen coordinates, wherever you put them)
//   notification(kit, { x = 0, y = 0, scale = 1, grey = 0 })
//     The alert card (286 × 82 at scale 1, top-left at x, y): grey Messages
//     icon, 'MESSAGES · now', sender, 'Your parcel is on hold.'. The same card
//     the lock screen drops; use it for ghost copies (wrap it in a <g
//     opacity="…">) and label piles of them illustrative.
//   addressBar(kit, { x, y, scale = 1, red = 0 })
//     The browser address pill (286 × 34 at scale 1, top-left at x, y) with
//     'aA', 'parcel-redeliver.info' and the reload arrow; red 0→1 turns it
//     red. The same pill payScreen draws: lift it out of the phone with this.
//   finger(kit, { x, y, p = 1, press = 0, angle = -18 })
//     A fingertip (skin tone, nail) whose tip is at (x, y), arriving from the
//     bottom right with p, pressing with press 0→1.
//   ripple(kit, { x, y, p, color = C.hue.blue })   a tap ripple, p 0→1 (nothing outside)
//   flagLabel(kit, { x, y, text, p = 1, align = 'start' })
//     A red pill label (white bold 17 px) centred vertically on y, starting
//     at x (align 'start') or ending at x ('end'); slides out with p.
//     Used for 'Unknown number', 'Rush', 'Odd link', 'Not the courier's site'.
//   dataChip(kit, { x, y, label, value, p = 1, scale = 1 })
//     A red data chip centred at (x, y): small label over a bold value
//     (a field that has been taken, e.g. 'Card number' / '4••• … 1234').
//   textWidth(text, size)   the width the parts assume for text (px)
//   NOTIF_W, NOTIF_H, SCREEN_W, SCREEN_H   sizes above

const DW = 328, DH = 672, BZ = 9
export const SCREEN_W = 310, SCREEN_H = 654
export const NOTIF_W = 286, NOTIF_H = 82
const SW = SCREEN_W, SH = SCREEN_H

const SENDER = '+1 (202) 555-0148'
const DOMAIN = 'parcel-redeliver.info'
const LINK = 'parcel-redeliver.info/xyz'
const LINK_BLUE = '#0a72e8'
const PAGE_SCROLL = 110

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cl = x => Math.min(1, Math.max(0, x))
const ez = p => 1 - Math.pow(1 - cl(p), 3)

// Advance widths (per 1000 em) of a neo-grotesque sans, for layout
const ADV = {
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  ' ': 278, '.': 278, ',': 278, ':': 278, '/': 278, '-': 333, '$': 556, '(': 333, ')': 333, '+': 584,
  '•': 350, "'": 191, '’': 222, '?': 556, '!': 278, '&': 667, '·': 278,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611
}
export function textWidth(s, size) {
  let w = 0
  for (const ch of String(s)) w += ADV[ch] ?? 556
  return (w * size) / 1000
}

// Hex colour mix
function mix(a, b, p) {
  const h = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  const x = h(a), y = h(b), q = cl(p)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * q).toString(16).padStart(2, '0')).join('')
}

function tx(kit, x, y, s, { size = 15, weight = 500, fill = '#111', anchor = 'start', fit = false, ls = 0, extra = '' } = {}) {
  return '<text x="' + x + '" y="' + y + '" font-family="' + kit.FONT + '" font-size="' + size + '" font-weight="' + weight +
    '" fill="' + fill + '" text-anchor="' + anchor + '"' + (ls ? ' letter-spacing="' + ls + '"' : '') +
    (fit ? ' textLength="' + textWidth(s, size).toFixed(1) + '" lengthAdjust="spacing"' : '') + (extra ? ' ' + extra : '') + '>' + esc(s) + '</text>'
}

// A rounded rectangle as a path (draws on with pathLength)
function rr(x, y, w, h, r) {
  return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) +
    'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) +
    'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z'
}
// A stroke drawn on with p (0 → 1)
const drawn = (d, color, width, p, extra = '') => p <= 0 ? '' :
  '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - cl(p)) + '" ' + extra + '/>'

// ---------------------------------------------------------------- the phone

export function phoneBox({ cx = 360, cy = 650, w = 312 } = {}) {
  const k = w / DW, h = DH * k
  return { left: cx - w / 2, top: cy - h / 2, w, h, k }
}

export function phone(kit, { cx = 360, cy = 650, w = 312, p = 1, tilt = 0, shake = 0, screen = '' } = {}) {
  const b = phoneBox({ cx, cy, w }), e = kit.ease(p)
  const side = (x, y, h) => '<rect x="' + x + '" y="' + y + '" width="4" height="' + h + '" rx="2" fill="#3b3f46"/>'
  return '<g opacity="' + cl(p * 1.5) + '" transform="translate(' + (b.left + shake) + ' ' + (b.top + (1 - e) * 60) + ') scale(' + b.k + ') rotate(' + tilt + ' ' + DW / 2 + ' ' + DH / 2 + ')">' +
    '<defs>' +
    '<linearGradient id="slBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d626b"/><stop offset=".3" stop-color="#33373e"/><stop offset="1" stop-color="#16181c"/></linearGradient>' +
    '<linearGradient id="slGlare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<filter id="slShadow" x="-40%" y="-30%" width="180%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>' +
    '<clipPath id="slScreen"><rect width="' + SW + '" height="' + SH + '" rx="42"/></clipPath>' +
    '</defs>' +
    '<rect x="16" y="44" width="' + (DW - 32) + '" height="' + (DH - 24) + '" rx="50" fill="#000" opacity=".6" filter="url(#slShadow)"/>' +
    side(-3, 128, 28) + side(-3, 178, 52) + side(-3, 240, 52) + side(DW - 1, 200, 84) +
    '<rect width="' + DW + '" height="' + DH + '" rx="52" fill="url(#slBody)"/>' +
    '<rect x=".8" y=".8" width="' + (DW - 1.6) + '" height="' + (DH - 1.6) + '" rx="51.2" fill="none" stroke="rgba(255,255,255,.24)" stroke-width="1.6"/>' +
    '<rect x="4.5" y="4.5" width="' + (DW - 9) + '" height="' + (DH - 9) + '" rx="48" fill="#050608"/>' +
    '<g transform="translate(' + BZ + ' ' + BZ + ')"><g clip-path="url(#slScreen)">' + screen +
    '<rect width="' + SW + '" height="' + SH + '" fill="url(#slGlare)"/></g>' +
    '<rect x="' + (SW / 2 - 46) + '" y="11" width="92" height="27" rx="13.5" fill="#000"/>' +
    '<circle cx="' + (SW / 2 + 30) + '" cy="24.5" r="4.5" fill="#10131a"/>' +
    '</g></g>'
}

// Status bar (time, signal, wifi, battery)
function statusBar(kit, { dark = false, time = true } = {}) {
  const c = dark ? '#ffffff' : '#111111'
  let s = time ? tx(kit, 42, 32, '9:41', { size: 15, weight: 700, fill: c, anchor: 'middle' }) : ''
  for (let i = 0; i < 4; i++) s += '<rect x="' + (220 + i * 5) + '" y="' + (32 - 4 - i * 2.4) + '" width="3.5" height="' + (4 + i * 2.4) + '" rx=".9" fill="' + c + '"/>'
  s += '<path d="M249 33 L241.5 25 A11 11 0 0 1 256.5 25 Z" fill="' + c + '"/>'
  s += '<rect x="262" y="22.5" width="24" height="12" rx="3.6" fill="none" stroke="' + c + '" stroke-opacity=".45" stroke-width="1.1"/>' +
    '<rect x="264" y="24.5" width="17" height="8" rx="2.2" fill="' + c + '"/><rect x="287" y="26.5" width="1.8" height="4" rx=".9" fill="' + c + '" opacity=".45"/>'
  return s
}

const homeBar = dark => '<rect x="' + (SW / 2 - 62) + '" y="640" width="124" height="5" rx="2.5" fill="' + (dark ? '#fff' : '#111') + '"/>'

// ---------------------------------------------------------------- pieces

export function notification(kit, { x = 0, y = 0, scale = 1, grey = 0 } = {}) {
  const g = cl(grey)
  const ink = mix('#111111', '#7a7d85', g), soft = mix('#6b6b72', '#8e9198', g)
  return '<g transform="translate(' + x + ' ' + y + ') scale(' + scale + ')">' +
    '<rect width="' + NOTIF_W + '" height="' + NOTIF_H + '" rx="20" fill="' + mix('#f6f6f9', '#c5c7cd', g) + '" fill-opacity=".96"/>' +
    '<rect x="12" y="20" width="38" height="38" rx="9" fill="' + mix('#8a94a3', '#9a9ca2', g) + '"/>' +
    '<path d="M31 29 c-7.5 0 -12 4.2 -12 9.2 c0 2.9 1.6 5.4 4.2 7 l-1.4 4.6 l5.2 -2.9 c1.3 .3 2.6 .5 4 .5 c7.5 0 12 -4.2 12 -9.2 s-4.5 -9.2 -12 -9.2z" fill="#fff"/>' +
    tx(kit, 62, 29, 'MESSAGES', { size: 11, weight: 600, fill: soft, ls: 0.6 }) +
    tx(kit, NOTIF_W - 14, 29, 'now', { size: 11, weight: 500, fill: soft, anchor: 'end' }) +
    tx(kit, 62, 50, SENDER, { size: 15, weight: 700, fill: ink }) +
    tx(kit, 62, 70, 'Your parcel is on hold.', { size: 15, weight: 500, fill: ink }) +
    '</g>'
}

export function addressBar(kit, { x = 0, y = 0, scale = 1, red = 0 } = {}) {
  const r = cl(red), redInk = mix(kit.C.hue.red, '#000000', 0.18)
  return '<g transform="translate(' + x + ' ' + y + ') scale(' + scale + ')">' +
    '<path d="' + rr(0, 0, 286, 34, 11) + '" fill="' + mix('#e3e3e8', '#ffe3e4', r) + '"/>' +
    (r > 0 ? '<path d="' + rr(0, 0, 286, 34, 11) + '" fill="none" stroke="' + kit.C.hue.red + '" stroke-width="' + 2.6 * r + '"/>' : '') +
    tx(kit, 12, 22, 'aA', { size: 13, weight: 700, fill: '#555' }) +
    tx(kit, 143, 22.5, DOMAIN, { size: 15, weight: 600, fill: mix('#111111', redInk, r), anchor: 'middle', fit: true }) +
    '<path d="M275 13.5 A6 6 0 1 0 276.5 19" fill="none" stroke="#555" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M271.5 12.5 L276 13.6 L274.8 9" fill="none" stroke="#555" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</g>'
}

export function finger(kit, { x, y, p = 1, press = 0, angle = -18 } = {}) {
  if (p <= 0) return ''
  const e = ez(p), s = 1 - 0.07 * cl(press)
  return '<g opacity="' + cl(p * 2) + '" transform="translate(' + (x + (1 - e) * 150) + ' ' + (y + (1 - e) * 280) + ')"><g transform="rotate(' + angle + ') scale(' + s + ')">' +
    '<defs><linearGradient id="slSkin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9976f"/><stop offset=".45" stop-color="#f4c9a8"/><stop offset="1" stop-color="#cf8c65"/></linearGradient></defs>' +
    '<rect x="-22" y="' + (14 + 10 * (1 - cl(press))) + '" width="52" height="236" rx="26" fill="#000" opacity=".28"/>' +
    '<rect x="-25" y="0" width="50" height="240" rx="25" fill="url(#slSkin)" stroke="#b9805e" stroke-width="1.2"/>' +
    '<rect x="-15" y="7" width="30" height="36" rx="13" fill="#f8ddcc" stroke="#d6a688" stroke-width="1.1"/>' +
    '<path d="M-12 96 q12 6 24 0 M-10 104 q10 5 20 0 M-12 176 q12 6 24 0" fill="none" stroke="#b9805e" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>' +
    '</g></g>'
}

export function ripple(kit, { x, y, p, color = kit.C.hue.blue } = {}) {
  if (p <= 0 || p >= 1) return ''
  const e = ez(p)
  return '<circle cx="' + x + '" cy="' + y + '" r="' + (10 + 40 * e) + '" fill="none" stroke="' + color + '" stroke-width="3.5" opacity="' + (1 - p) + '"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="16" fill="' + color + '" opacity="' + 0.5 * (1 - p) + '"/>'
}

export function flagLabel(kit, { x, y, text, p = 1, align = 'start' } = {}) {
  if (p <= 0) return ''
  const w = textWidth(text, 17) + 32, h = 38, e = ez(p)
  const x0 = (align === 'start' ? x : x - w) + (1 - e) * (align === 'start' ? -26 : 26)
  return '<g opacity="' + cl(p * 2) + '"><path d="' + rr(x0, y - h / 2, w, h, h / 2) + '" fill="' + kit.C.hue.red + '"/>' +
    tx(kit, x0 + w / 2, y + 6, text, { size: 17, weight: 700, fill: '#fff', anchor: 'middle' }) + '</g>'
}

export function dataChip(kit, { x, y, label, value, p = 1, scale = 1 } = {}) {
  if (p <= 0) return ''
  const w = Math.max(textWidth(value, 15), textWidth(label, 11)) + 30, h = 48
  return '<g opacity="' + cl(p * 2) + '" transform="translate(' + x + ' ' + y + ') scale(' + scale * (0.85 + 0.15 * ez(p)) + ')">' +
    '<path d="' + rr(-w / 2, -h / 2, w, h, 12) + '" fill="' + kit.C.hue.red + '"/>' +
    tx(kit, -w / 2 + 15, -5, label, { size: 11, weight: 600, fill: 'rgba(255,255,255,.82)' }) +
    tx(kit, -w / 2 + 15, 15, value, { size: 15, weight: 700, fill: '#fff' }) + '</g>'
}

// ---------------------------------------------------------------- screens

export function lockScreen(kit, { notif = 0, stack = 0, grey = 0, dim = 0, shield = 0 } = {}) {
  let s = '<defs>' +
    '<linearGradient id="slWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3550"/><stop offset=".55" stop-color="#151a26"/><stop offset="1" stop-color="#0b0c11"/></linearGradient>' +
    '<radialGradient id="slBlobA"><stop offset="0" stop-color="#3f6aa8" stop-opacity=".55"/><stop offset="1" stop-color="#3f6aa8" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="slBlobB"><stop offset="0" stop-color="#6a4f9c" stop-opacity=".45"/><stop offset="1" stop-color="#6a4f9c" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<rect width="' + SW + '" height="' + SH + '" fill="url(#slWall)"/>' +
    '<circle cx="40" cy="500" r="230" fill="url(#slBlobA)"/><circle cx="290" cy="250" r="210" fill="url(#slBlobB)"/>' +
    statusBar(kit, { dark: true, time: false }) +
    // padlock
    '<path d="M150 68 v-5 a5 5 0 0 1 10 0 v5" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2"/>' +
    '<rect x="147" y="67" width="16" height="12" rx="3" fill="#fff" fill-opacity=".9"/>' +
    tx(kit, SW / 2, 108, 'Friday, June 14', { size: 17, weight: 600, fill: 'rgba(255,255,255,.82)', anchor: 'middle' }) +
    tx(kit, SW / 2, 190, '9:41', { size: 86, weight: 700, fill: '#fff', anchor: 'middle', ls: -2 })
  // the alert, with identical ones piling under it
  if (notif > 0) {
    const y = -110 + (214 + 110) * notif
    for (let j = 2; j >= 1; j--) {
      const q = cl(stack - (j - 1))
      if (q > 0) s += '<path d="' + rr(12 + 9 * j, y + 20, NOTIF_W - 18 * j, NOTIF_H - 20 + 9 * j * ez(q), 18) + '" fill="' + mix('#e9e9ee', '#b9bcc3', grey) + '" fill-opacity="' + (0.62 - 0.2 * j) * q + '"/>'
    }
    s += '<g opacity="' + cl(notif * 3) * (1 - 0.35 * cl(grey)) + '">' + notification(kit, { x: 12, y, grey }) + '</g>'
  }
  if (shield > 0) {
    const e = kit.pop(shield, 0, 1), g = kit.C.hue.green
    s += '<g opacity="' + cl(shield * 2) + '" transform="translate(155 400) scale(' + (0.6 + 0.4 * e) + ')">' +
      '<path d="M0 -62 L50 -44 V-4 C50 30 28 52 0 64 C-28 52 -50 30 -50 -4 V-44 Z" fill="' + g + '" fill-opacity=".22" stroke="' + g + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M-20 0 L-6 14 L22 -16" fill="none" stroke="' + g + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>'
  }
  // torch and camera
  s += '<circle cx="54" cy="586" r="23" fill="#fff" fill-opacity=".14"/><circle cx="256" cy="586" r="23" fill="#fff" fill-opacity=".14"/>' +
    '<path d="M50 576 h8 v5 l-2 4 v11 h-4 v-11 l-2 -4 z" fill="#fff"/>' +
    '<rect x="245" y="579" width="22" height="15" rx="3.5" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="256" cy="586.5" r="3.8" fill="none" stroke="#fff" stroke-width="1.8"/>' +
    homeBar(true)
  if (dim > 0) s += '<rect width="' + SW + '" height="' + SH + '" fill="#000" opacity="' + 0.6 * cl(dim) + '"/>'
  return s
}

// Messages layout (screen coordinates)
const B = { x: 12, y: 184, size: 17, lh: 22 }
const BLINES = ['Your parcel is on hold.', 'Pay a $1.99 redelivery fee', 'within', 'parcel-redeliver.info/xyz']
const BW = Math.max(...BLINES.map(l => textWidth(l, B.size))) + 28
const BH = BLINES.length * B.lh + 20
const TX = B.x + 14
const RUSH_X = TX + textWidth('within ', B.size)
const LINK_W = textWidth(LINK, B.size)
const lineY = i => B.y + 10 + 16 + i * B.lh
const NUM_W = textWidth(SENDER, 13)

export function messagesScreen(kit, { bubble = 1, flags = {}, strike = 0, swipe = 0, linkTap = 0 } = {}) {
  const red = kit.C.hue.red
  const fN = cl(flags.number || 0), fR = cl(flags.rush || 0), fL = cl(flags.link || 0)
  let s = '<defs><linearGradient id="slAv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9bdc6"/><stop offset="1" stop-color="#8b909a"/></linearGradient>' +
    '<clipPath id="slAvClip"><circle cx="155" cy="76" r="24"/></clipPath></defs>' +
    '<rect width="' + SW + '" height="' + SH + '" fill="#ffffff"/>' +
    '<rect width="' + SW + '" height="131" fill="#f5f5f8"/><rect y="131" width="' + SW + '" height="1" fill="#d9d9df"/>' +
    statusBar(kit, { dark: false }) +
    '<path d="M25 64 l-9 9.5 l9 9.5" fill="none" stroke="' + LINK_BLUE + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="155" cy="76" r="24" fill="url(#slAv)"/>' +
    '<g clip-path="url(#slAvClip)"><circle cx="155" cy="70" r="8.5" fill="#fff"/><ellipse cx="155" cy="96" rx="16" ry="12" fill="#fff"/></g>' +
    (fN > 0 ? '<path d="' + rr(155 - NUM_W / 2 - 12, 100, NUM_W + 24, 26, 13) + '" fill="' + red + '" fill-opacity="' + 0.12 * fN + '"/>' : '') +
    tx(kit, 155, 118, SENDER, { size: 13, weight: 600, fill: mix('#111111', mix(red, '#000000', 0.2), fN), anchor: 'middle', fit: true }) +
    drawn(rr(155 - NUM_W / 2 - 12, 100, NUM_W + 24, 26, 13), red, 3, fN) +
    tx(kit, 155, 156, 'Text Message', { size: 11, weight: 600, fill: '#8e8e93', anchor: 'middle' }) +
    tx(kit, 155, 170, 'Today 9:41', { size: 11, weight: 500, fill: '#8e8e93', anchor: 'middle' })
  // the bubble
  if (bubble > 0) {
    const e = ez(bubble), sc = 0.88 + 0.12 * e, ox = B.x, oy = B.y + BH
    s += '<g opacity="' + cl(bubble * 2) * (1 - cl(swipe * 1.4 - 0.4)) + '" transform="translate(' + (-swipe * 360) + ' ' + (1 - e) * 16 + ') translate(' + ox + ' ' + oy + ') scale(' + sc + ') translate(' + -ox + ' ' + -oy + ')">' +
      '<path d="' + rr(B.x, B.y, BW, BH, 19) + '" fill="#e9e9ee"/>' +
      '<path d="M' + (B.x + 2) + ' ' + (oy - 14) + ' C' + (B.x + 2) + ' ' + (oy - 4) + ' ' + (B.x - 3) + ' ' + oy + ' ' + (B.x - 8) + ' ' + (oy + 2) + ' C' + (B.x) + ' ' + (oy + 3) + ' ' + (B.x + 9) + ' ' + (oy) + ' ' + (B.x + 13) + ' ' + (oy - 6) + ' Z" fill="#e9e9ee"/>' +
      (linkTap > 0 ? '<path d="' + rr(TX - 5, lineY(3) - 17, LINK_W + 10, 24, 6) + '" fill="' + kit.C.hue.blue + '" opacity="' + 0.28 * cl(linkTap) + '"/>' : '') +
      (fR > 0 ? '<path d="' + rr(RUSH_X - 4, lineY(2) - 16, textWidth('24h:', B.size) + 8, 22, 5) + '" fill="' + red + '" fill-opacity="' + 0.14 * fR + '"/>' : '') +
      (fL > 0 ? '<path d="' + rr(TX - 6, lineY(3) - 18, LINK_W + 12, 26, 7) + '" fill="' + red + '" fill-opacity="' + 0.1 * fL + '"/>' : '') +
      BLINES.slice(0, 3).map((l, i) => tx(kit, TX, lineY(i), l, { size: B.size, weight: 500, fill: '#111', fit: true })).join('') +
      tx(kit, RUSH_X, lineY(2), '24h:', { size: B.size, weight: fR > 0 ? 700 : 500, fill: mix('#111111', mix(red, '#000000', 0.15), fR), fit: true }) +
      tx(kit, TX, lineY(3), LINK, { size: B.size, weight: 500, fill: LINK_BLUE, fit: true }) +
      '<rect x="' + TX + '" y="' + (lineY(3) + 3) + '" width="' + LINK_W + '" height="1.4" fill="' + LINK_BLUE + '"/>' +
      drawn('M' + (RUSH_X - 1) + ' ' + (lineY(2) + 6) + ' H' + (RUSH_X + textWidth('24h:', B.size) + 1), red, 3.2, fR) +
      drawn(rr(TX - 6, lineY(3) - 18, LINK_W + 12, 26, 7), red, 3, fL) +
      drawn('M' + (TX - 4) + ' ' + (lineY(3) - 5) + ' H' + (TX + LINK_W + 4), red, 3.4, strike) +
      '</g>'
  }
  // input bar
  s += '<rect y="590" width="' + SW + '" height="' + (SH - 590) + '" fill="#ffffff"/>' +
    '<circle cx="28" cy="611" r="15" fill="#e9e9ee"/><path d="M28 604 v14 M21 611 h14" stroke="#8e8e93" stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="' + rr(52, 594, 244, 34, 17) + '" fill="#fff" stroke="#d2d2d8" stroke-width="1.2"/>' +
    tx(kit, 68, 616, 'Text Message', { size: 15, weight: 500, fill: '#b2b2b8' }) +
    homeBar(false)
  return s
}

// Pay page layout (screen coordinates, before scrolling)
const F = { card: [26, 370, 258, 42], expiry: [26, 444, 126, 42], cvc: [158, 444, 126, 42], pay: [26, 504, 258, 50] }

export function payScreen(kit, { scroll = 0, addr = 0, active = -1, values = ['', '', ''], caret = false, pressed = 0, page = 1 } = {}) {
  const blue = kit.C.hue.blue, sy = -cl(scroll) * PAGE_SCROLL
  const box = (key, i) => {
    const [x, y, w, h] = F[key], on = active === i, v = values[i] || ''
    return (on ? '<path d="' + rr(x - 3, y - 3, w + 6, h + 6, 12) + '" fill="none" stroke="' + blue + '" stroke-opacity=".28" stroke-width="5"/>' : '') +
      '<path d="' + rr(x, y, w, h, 10) + '" fill="#fff" stroke="' + (on ? blue : '#cfcfd6') + '" stroke-width="' + (on ? 2.4 : 1.2) + '"/>' +
      tx(kit, x + 12, y + 27, v, { size: 17, weight: 600, fill: '#111' }) +
      (on && caret ? '<rect x="' + (x + 13 + textWidth(v, 17)) + '" y="' + (y + 10) + '" width="2" height="22" rx="1" fill="' + blue + '"/>' : '')
  }
  const [px, py, pw, ph] = F.pay, pr = cl(pressed), ps = 1 - 0.04 * pr
  let s = '<defs><clipPath id="slPage"><rect y="97" width="' + SW + '" height="' + (SH - 97) + '"/></clipPath></defs>' +
    '<rect width="' + SW + '" height="' + SH + '" fill="#f1f1f5"/>' +
    '<g clip-path="url(#slPage)"><g opacity="' + cl(page) + '" transform="translate(0 ' + (sy + (1 - ez(page)) * 24) + ')">' +
    // courier-style header with a generic parcel icon
    '<rect y="97" width="' + SW + '" height="58" fill="' + kit.C.hue.yellow + '"/>' +
    '<g transform="translate(22 110)"><path d="M0 9 L16 2 L32 9 L16 16 Z" fill="#e2b077"/><path d="M0 9 V27 L16 34 V16 Z" fill="#b97f45"/><path d="M32 9 V27 L16 34 V16 Z" fill="#cf9558"/><path d="M8 5.5 L24 12.5 V19 L20 17.5 V14 L4 7 Z" fill="#f0dbb5"/></g>' +
    tx(kit, 64, 125, 'PARCEL DELIVERY', { size: 14, weight: 800, fill: '#1d1d1f', ls: 0.6 }) +
    tx(kit, 64, 142, 'Tracking & redelivery', { size: 11, weight: 500, fill: '#4b4220' }) +
    '<path d="M268 118 h20 M268 126 h20 M268 134 h20" stroke="#1d1d1f" stroke-width="2.4" stroke-linecap="round"/>' +
    // the parcel card
    '<path d="' + rr(14, 168, 282, 134, 14) + '" fill="#fff" stroke="#e2e2e8"/>' +
    '<g transform="translate(26 186)"><path d="M0 14 L28 3 L56 14 L28 25 Z" fill="#e2b077"/><path d="M0 14 V44 L28 56 V25 Z" fill="#b97f45"/><path d="M56 14 V44 L28 56 V25 Z" fill="#cf9558"/><path d="M14 8.5 L42 19.5 V30 L35 27 V22 L7 11 Z" fill="#f0dbb5"/>' +
    '<circle cx="54" cy="6" r="10" fill="' + kit.C.hue.orange + '"/><rect x="52.6" y="0" width="2.8" height="7.5" rx="1.4" fill="#fff"/><circle cx="54" cy="11" r="1.6" fill="#fff"/></g>' +
    tx(kit, 98, 202, 'Your parcel is on hold', { size: 16, weight: 700, fill: '#111' }) +
    tx(kit, 98, 229, 'Delivery fee: $1.99', { size: 19, weight: 800, fill: '#111' }) +
    tx(kit, 98, 249, 'Pay now to rebook delivery', { size: 12, weight: 500, fill: '#6b6b72' }) +
    '<path d="M48 272 H262" stroke="#d6d6dc" stroke-width="2"/>' +
    '<circle cx="48" cy="272" r="5.5" fill="#9aa0a8"/><circle cx="155" cy="272" r="5.5" fill="#9aa0a8"/><circle cx="262" cy="272" r="6" fill="#fff" stroke="' + kit.C.hue.orange + '" stroke-width="3"/>' +
    tx(kit, 48, 292, 'Shipped', { size: 10.5, weight: 500, fill: '#8a8a92', anchor: 'middle' }) +
    tx(kit, 155, 292, 'In transit', { size: 10.5, weight: 500, fill: '#8a8a92', anchor: 'middle' }) +
    tx(kit, 262, 292, 'On hold', { size: 10.5, weight: 700, fill: '#c46a12', anchor: 'middle' }) +
    // the card form
    '<path d="' + rr(14, 314, 282, 264, 14) + '" fill="#fff" stroke="#e2e2e8"/>' +
    tx(kit, 28, 342, 'Card details', { size: 15, weight: 700, fill: '#111' }) +
    '<rect x="226" y="330" width="26" height="17" rx="3.5" fill="#d9dbe1"/><rect x="256" y="330" width="26" height="17" rx="3.5" fill="#c9ccd3"/>' +
    tx(kit, 28, 363, 'Card number', { size: 11.5, weight: 500, fill: '#6b6b72' }) + box('card', 0) +
    tx(kit, 28, 437, 'Expiry', { size: 11.5, weight: 500, fill: '#6b6b72' }) + box('expiry', 1) +
    tx(kit, 160, 437, 'Security code', { size: 11.5, weight: 500, fill: '#6b6b72' }) + box('cvc', 2) +
    '<g transform="translate(' + (px + pw / 2) + ' ' + (py + ph / 2) + ') scale(' + ps + ')">' +
    '<path d="' + rr(-pw / 2, -ph / 2, pw, ph, 12) + '" fill="' + mix('#1d1d1f', '#000000', pr) + '"/>' +
    tx(kit, 0, 6.5, 'Pay $1.99', { size: 18, weight: 700, fill: '#fff', anchor: 'middle' }) + '</g>' +
    tx(kit, 155, 570, 'By paying you accept the redelivery terms', { size: 10.5, weight: 500, fill: '#9a9aa2', anchor: 'middle' }) +
    '</g></g>' +
    // browser bar on top
    '<rect width="' + SW + '" height="97" fill="#f7f7f9"/><rect y="96" width="' + SW + '" height="1" fill="#dadae0"/>' +
    statusBar(kit, { dark: false }) +
    addressBar(kit, { x: 12, y: 54, red: addr }) +
    homeBar(false)
  return s
}

// ---------------------------------------------------------------- anchors

export function anchors({ cx = 360, cy = 650, w = 312, scroll = 0 } = {}) {
  const b = phoneBox({ cx, cy, w }), k = b.k
  const box = (x, y, bw, bh) => {
    const fx = b.left + (BZ + x) * k, fy = b.top + (BZ + y) * k, fw = bw * k, fh = bh * k
    return { x: fx, y: fy, w: fw, h: fh, cx: fx + fw / 2, cy: fy + fh / 2 }
  }
  const sy = -cl(scroll) * PAGE_SCROLL, f = key => box(F[key][0], F[key][1] + sy, F[key][2], F[key][3])
  return {
    screen: box(0, 0, SW, SH),
    notif: box(12, 214, NOTIF_W, NOTIF_H),
    avatar: box(131, 52, 48, 48),
    number: box(155 - NUM_W / 2 - 12, 100, NUM_W + 24, 26),
    bubble: box(B.x, B.y, BW, BH),
    rush: box(RUSH_X - 4, lineY(2) - 16, textWidth('24h:', B.size) + 8, 22),
    link: box(TX - 6, lineY(3) - 18, LINK_W + 12, 26),
    input: box(52, 594, 244, 34),
    address: box(12, 54, 286, 34),
    header: box(0, 97 + sy, SW, 58),
    fee: box(98, 212 + sy, textWidth('Delivery fee: $1.99', 19), 22),
    card: f('card'), expiry: f('expiry'), cvc: f('cvc'), pay: f('pay')
  }
}
