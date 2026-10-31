// 05-where-your-details-go: Where your details go.
// The filled card form shrinks to the left; its three fields peel off as red
// chips and travel a dotted line to the scammers' server, which glows red;
// a receipt of unknown charges (illustrative) slides in under it.
// Shot-local time: t = 0 is this shot's first frame.
import { phone, payScreen, anchors, dataChip, flagLabel, textWidth } from '../../world/parts.js'

// phone: from shot 04's place to the left
const PH0 = { cx: 384, cy: 668, w: 330 }, PH1 = { cx: 150, cy: 705, w: 226 }
const VALUES = ['4••• •••• •••• 1234', '08/27', '•••']
const CHIPS = [
  { label: 'Card number', value: '•••• 1234' },
  { label: 'Expiry', value: '08/27' },
  { label: 'Security code', value: '•••' }
]
const PEEL = 1.0, STEP = 0.5, TRAVEL = 0.9
// the server group is drawn around y 400–600 and moved down by DY
const DY = 50
const SRV = { x: 515, y: 520 + DY }, S_IN = { x: 446, y: 548 + DY }
const RCPT = { x: 380, y: 676 + DY, w: 232 }
const CHARGES = [['Online store', 249.0], ['Gift cards', 500.0], ['Electronics', 899.99], ['Travel booking', 612.4]]
const ROW0 = 3.25, ROW_STEP = 0.3

const bez = (p0, p1, p2, p3, u) => {
  const v = 1 - u
  return {
    x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
    y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y
  }
}
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, lerp, hash, float, FONT } = kit
  const red = C.hue.red
  kit.frame({ kicker: 'Where it goes', head: ['Your card goes', 'straight to the', '*scammers*'], typed: rise(t, 0, 0.5), progress: (start + t) / 33 })

  // the phone shrinks to the left
  const sh = ease(clamp(t / 0.9))
  const PH = { cx: lerp(PH0.cx, PH1.cx, sh), cy: lerp(PH0.cy, PH1.cy, sh), w: lerp(PH0.w, PH1.w, sh) }
  const A = anchors({ ...PH, scroll: 1 })
  const fields = [A.card, A.expiry, A.cvc]

  // a field empties as its chip peels off
  const peelAt = i => PEEL + i * STEP
  const values = VALUES.map((v, i) => (t < peelAt(i) ? v : ''))
  const screen = payScreen(kit, { scroll: 1, addr: 1, values })

  // the hop path: stubs from the fields to a junction, then one line to the server
  const J = { x: A.screen.x + A.screen.w + 26, y: A.expiry.cy }
  const c1 = { x: J.x + 80, y: J.y }, c2 = { x: S_IN.x - 80, y: S_IN.y + 10 }
  const draw = clamp((t - 0.6) / 0.6)
  let path = ''
  const N = 26, march = (t * 1.6) % 1
  for (let k = 0; k < N; k++) {
    const u = (k + march) / N
    if (u > draw) continue
    const q = bez(J, c1, c2, S_IN, u)
    path += '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="3.2" fill="' + red + '" opacity=".85"/>'
  }
  fields.forEach((f, i) => {
    // the expiry chip leaves over the security code field: no stub through it
    if (i === 1) { path += '<circle cx="' + (f.x + f.w - 6) + '" cy="' + f.cy + '" r="4" fill="' + red + '" opacity="' + clamp((t - 0.5) / 0.3) + '"/>'; return }
    const sx = f.x + f.w - 6, len = Math.hypot(J.x - sx, J.y - f.cy), n = Math.max(2, Math.round(len / 12))
    const sp = clamp((t - 0.45 - i * 0.08) / 0.3)
    for (let k = 0; k <= n * sp; k++) {
      const u = k / n
      path += '<circle cx="' + lerp(sx, J.x, u).toFixed(1) + '" cy="' + lerp(f.cy, J.y, u).toFixed(1) + '" r="2.4" fill="' + red + '" opacity=".7"/>'
    }
    path += '<circle cx="' + sx + '" cy="' + f.cy + '" r="4" fill="' + red + '" opacity="' + sp + '"/>'
  })
  path += '<circle cx="' + J.x + '" cy="' + J.y + '" r="' + 5 * rise(t, 0.6, 0.3) + '" fill="' + red + '"/>'

  // chips travelling: field → junction → along the curve → into the server
  let chips = '', landed = 0, flashes = ''
  CHIPS.forEach((c, i) => {
    const raw = (t - peelAt(i)) / TRAVEL
    if (raw >= 1) {
      landed++
      const fp = (t - peelAt(i) - TRAVEL) / 0.6
      if (fp < 1) flashes += '<circle cx="' + SRV.x + '" cy="' + SRV.y + '" r="' + (40 + 90 * ease(fp)) + '" fill="none" stroke="' + red + '" stroke-width="4" opacity="' + (1 - fp) + '"/>'
      return
    }
    if (raw <= 0) return
    const u = ease(raw), f = fields[i]
    let pos
    if (u < 0.18) {
      const k = u / 0.18
      pos = { x: lerp(f.cx, J.x, k), y: lerp(f.cy, J.y, k) - Math.sin(k * Math.PI) * 18 }
    } else pos = bez(J, c1, c2, S_IN, (u - 0.18) / 0.82)
    const sc = u < 0.3 ? lerp(0.7, 1, u / 0.3) : u > 0.85 ? lerp(1, 0.45, (u - 0.85) / 0.15) : 1
    const op = u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1
    chips += '<g opacity="' + op + '">' + dataChip(kit, { x: pos.x, y: pos.y - 30, label: c.label, value: c.value, p: rise(t, peelAt(i), 0.2), scale: sc }) + '</g>'
  })

  // the server glows redder with each chip it takes
  const glow = clamp(landed / 3 + 0.15 * rise(t, 0.5, 0.4)) * (1 + 0.08 * Math.sin(t * 6))
  const sp = pop(t, 0.35, 0.6), fy = float(t, 3, 3.2)
  let rack = ''
  for (let r = 0; r < 3; r++) {
    const y = 505 + r * 32, lit = r < landed
    rack += '<rect x="-76" y="' + y + '" width="152" height="27" rx="6" fill="#1d2027" stroke="' + (lit ? red : '#3a3f48') + '" stroke-opacity="' + (lit ? 0.8 : 1) + '" stroke-width="1.5"/>' +
      '<path d="M-62 ' + (y + 10) + ' H10 M-62 ' + (y + 17) + ' H10" stroke="#3a3f48" stroke-width="2" stroke-linecap="round"/>' +
      [0, 1].map(j => '<circle cx="' + (44 + j * 14) + '" cy="' + (y + 13.5) + '" r="4" fill="' + (lit ? red : '#4a505b') + '" opacity="' + (lit && hash(r, Math.floor(t * 8) + j) > 0.25 ? 1 : 0.55) + '"/>').join('')
  }
  const server =
    '<ellipse cx="' + SRV.x + '" cy="' + SRV.y + '" rx="150" ry="150" fill="url(#g5)" opacity="' + glow + '"/>' +
    '<g opacity="' + clamp(sp * 1.5) + '" transform="translate(' + SRV.x + ' ' + (DY + fy + (1 - sp) * 30) + ')">' +
    // hooded figure behind the rack
    '<path d="M-80 515 C-76 488 -52 478 -34 476 L34 476 C52 478 76 488 80 515 Z" fill="#2a2e36"/>' +
    '<path d="M-46 500 C-50 440 -30 400 0 400 C30 400 50 440 46 500 Z" fill="#30343d" stroke="' + red + '" stroke-opacity="' + 0.5 * glow + '" stroke-width="2"/>' +
    '<ellipse cx="0" cy="456" rx="21" ry="28" fill="#08090c"/>' +
    '<circle cx="-8" cy="454" r="3.2" fill="' + red + '" opacity="' + (0.35 + 0.65 * glow) + '"/><circle cx="8" cy="454" r="3.2" fill="' + red + '" opacity="' + (0.35 + 0.65 * glow) + '"/>' +
    rack + '</g>' + flashes +
    flagLabel(kit, { x: SRV.x - (textWidth('Scammers', 17) + 32) / 2, y: 632 + DY + fy, text: 'Scammers', p: rise(t, 0.7, 0.4) })

  // the receipt of unknown charges (illustrative)
  const rp = rise(t, 2.95, 0.45)
  let receipt = ''
  if (rp > 0) {
    const { x, y, w } = RCPT, h = 54 + CHARGES.length * 42 + 10
    let rows = ''
    CHARGES.forEach(([name, amt], i) => {
      const a = ROW0 + i * ROW_STEP, q = rise(t, a, 0.35)
      if (q <= 0) return
      const ry = y + 54 + i * 42
      rows += '<g opacity="' + q + '" transform="translate(' + (1 - q) * 40 + ' 0)">' +
        '<circle cx="' + (x + 22) + '" cy="' + (ry + 21) + '" r="9" fill="' + red + '" opacity=".16"/>' +
        '<text x="' + (x + 22) + '" y="' + (ry + 26) + '" text-anchor="middle" font-family="' + FONT + '" font-size="13" font-weight="800" fill="' + red + '">?</text>' +
        '<text x="' + (x + 40) + '" y="' + (ry + 26) + '" font-family="' + FONT + '" font-size="14" font-weight="600" fill="#1d1d1f">' + name + '</text>' +
        '<text x="' + (x + w - 14) + '" y="' + (ry + 26) + '" text-anchor="end" font-family="' + FONT + '" font-size="14.5" font-weight="800" fill="#d6393f">−' + money(+kit.count(rise(t, a + 0.1, 0.55), 0, amt, 2)) + '</text>' +
        (i < CHARGES.length - 1 ? '<rect x="' + (x + 14) + '" y="' + (ry + 41) + '" width="' + (w - 28) + '" height="1" fill="#e2e2e8"/>' : '') + '</g>'
    })
    receipt = '<g opacity="' + rp + '" transform="translate(0 ' + ((1 - rp) * -40 + float(t, 2, 3.6, 0.4)) + ')">' +
      '<rect x="' + (x + 6) + '" y="' + (y + 10) + '" width="' + w + '" height="' + h + '" rx="14" fill="#000" opacity=".35"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="14" fill="#f6f6f8"/>' +
      '<text x="' + (x + 14) + '" y="' + (y + 30) + '" font-family="' + FONT + '" font-size="15" font-weight="800" fill="#1d1d1f">Your card</text>' +
      '<text x="' + (x + w - 14) + '" y="' + (y + 30) + '" text-anchor="end" font-family="' + FONT + '" font-size="10.5" font-weight="700" letter-spacing="0.8" fill="#8a8a92">ILLUSTRATIVE</text>' +
      '<text x="' + (x + 14) + '" y="' + (y + 46) + '" font-family="' + FONT + '" font-size="11.5" font-weight="500" fill="#6b6b72">Charges you didn’t make</text>' +
      '<rect x="' + x + '" y="' + (y + 53) + '" width="' + w + '" height="1" fill="#d6d6dc"/>' +
      rows + '</g>'
    // a short red link from the server down to the receipt
    receipt = '<path d="M' + SRV.x + ' ' + (655 + DY) + ' V' + (RCPT.y - 4) + '" stroke="' + red + '" stroke-width="2.5" stroke-dasharray="3 6" stroke-dashoffset="' + (-t * 24) + '" opacity="' + 0.8 * rp + '"/>' + receipt
  }

  // ambient: a red glow growing on the right and drifting dust
  let dust = ''
  for (let i = 0; i < 26; i++) {
    const x = 40 + hash(i, 1) * 580, y = 340 + ((hash(i, 2) * 700 - t * (8 + hash(i, 3) * 14)) % 700 + 700) % 700
    dust += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1 + hash(i, 4) * 1.8).toFixed(1) + '" fill="' + (x > 360 ? red : C.hue.blue) + '" opacity="' + (0.08 + 0.14 * hash(i, 5)).toFixed(2) + '"/>'
  }

  kit.stage(
    '<defs><radialGradient id="g5"><stop offset="0" stop-color="' + red + '" stop-opacity=".45"/><stop offset="1" stop-color="' + red + '" stop-opacity="0"/></radialGradient></defs>' +
    dust +
    phone(kit, { ...PH, screen }) +
    server + path + receipt + chips +
    '<text x="360" y="1018" text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">Illustration · not a real courier site, card or charges</text>'
  )
  // a slow push in on the stage
  kit.view({ x: 360, y: 690, s: 1 + 0.025 * ease(clamp(t / 5)) })
}
