// 01-hook-the-text-lands: Hook: the text lands.
// The scam alert drops onto a dark lock screen with a buzz; above the phone
// the reported US loss rolls up to $330M; behind, copies of the same alert
// keep piling up (illustrative).
// Shot-local time: t = 0 is this shot's first frame.
import { phone, lockScreen, notification, NOTIF_W } from '../../world/parts.js'

const PH = { cx: 360, cy: 660, w: 312 }

// Ghost alerts: rows piling up from the bottom on both sides of the phone,
// three more rows below it; the order they land in
function ghostSlots(hash) {
  const slots = []
  for (let r = 0; r < 15; r++) {
    const y = 1236 - r * 76
    slots.push({ x: -96 + hash(r, 1) * 44, y })
    slots.push({ x: 556 + hash(r, 2) * 44, y })
    if (r < 3) slots.push({ x: 214 + (hash(r, 3) - 0.5) * 70, y: y + 8 })
  }
  return slots
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, rise, pop, clamp, ease, hash, FONT, HEAD_FONT } = kit
  kit.frame({ kicker: 'Reported losses · US, 2022', head: '', progress: (start + t) / 33 })

  // ghost alerts, each falling into its place in the pile
  let ghosts = ''
  ghostSlots(hash).forEach((g, i) => {
    const q = rise(t, -0.3 + i * 0.115, 0.42)
    if (q <= 0) return
    const rot = (hash(i, 7) - 0.5) * 12
    // the top rows stay clear of the counter and its line
    const out = g.y < 380 ? (g.x < 360 ? -110 : 110) : 0
    ghosts += '<g opacity="' + q * (0.07 + 0.06 * hash(i, 8)) + '" transform="translate(' + (g.x + out) + ' ' + (g.y - (1 - q) * 190) + ') rotate(' + rot + ' ' + NOTIF_W * 0.45 + ' 37)">' +
      notification(kit, { scale: 0.9 }) + '</g>'
  })

  // buzzes: the alert lands, then two more identical ones stack under it
  const buzz = a => (t > a && t < a + 0.9 ? Math.exp(-(t - a) * 5) : 0)
  const shake = Math.sin(t * 110) * 6 * (buzz(0.5) + buzz(2.3) + buzz(3.2))
  const screen = lockScreen(kit, {
    notif: pop(t, 0.42, 0.55),
    stack: rise(t, 2.3, 0.35) + rise(t, 3.2, 0.35)
  })

  // the counter: rolls up, lands with a bounce, glows
  const roll = ease(clamp((t - 0.15) / 1.3))
  const value = '$' + Math.round(330 * roll) + 'M'
  const tb = t - 1.45
  const bounce = tb > 0 ? Math.exp(-tb * 6) * Math.sin(tb * 20) : 0
  const sc = (0.86 + 0.14 * rise(t, 0, 0.35)) * (1 + 0.13 * bounce)
  const glow = 0.45 * rise(t, 1.45, 0.3) * (0.8 + 0.2 * Math.sin(t * 5))
  const num = (extra) => '<text x="0" y="46" text-anchor="middle" font-family="' + HEAD_FONT + '" font-size="132" font-weight="800" fill="' + C.hue.red +
    '" style="font-variant-numeric: tabular-nums" letter-spacing="-2" ' + extra + '>' + value + '</text>'
  const capIn = rise(t, 0, 0.3)

  kit.stage(
    '<defs><filter id="glow" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>' +
    '<radialGradient id="shade"><stop offset=".55" stop-color="#16181d" stop-opacity=".92"/><stop offset="1" stop-color="#16181d" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="hot"><stop offset="0" stop-color="' + C.hue.red + '" stop-opacity=".22"/><stop offset="1" stop-color="' + C.hue.red + '" stop-opacity="0"/></radialGradient></defs>' +
    ghosts +
    '<ellipse cx="360" cy="262" rx="400" ry="150" fill="url(#shade)"/>' +
    '<ellipse cx="360" cy="1012" rx="330" ry="40" fill="url(#shade)"/>' +
    '<ellipse cx="360" cy="228" rx="330" ry="150" fill="url(#hot)" opacity="' + rise(t, 0.6, 1) + '"/>' +
    '<g transform="translate(360 222) scale(' + sc + ')">' +
    '<g opacity="' + glow + '" filter="url(#glow)">' + num('') + '</g>' + num('') + '</g>' +
    '<text x="360" y="318" text-anchor="middle" font-family="' + HEAD_FONT + '" font-size="38" font-weight="700" fill="' + C.text +
    '" opacity="' + capIn + '" transform="translate(0 ' + (1 - capIn) * 12 + ')">lost to text scams in one year</text>' +
    phone(kit, { ...PH, p: 0.75 + 0.25 * rise(t, 0, 0.35), shake, screen }) +
    '<text text-anchor="middle" font-family="' + FONT + '" font-size="12.5" fill="' + C.muted + '" opacity=".85">' +
    '<tspan x="360" y="1004">Source: FTC Consumer Protection Data Spotlight,</tspan>' +
    '<tspan x="360" y="1020">“IYKYK: The top text scams of 2022”, June 2023 · alert pile illustrative</tspan></text>'
  )
}
