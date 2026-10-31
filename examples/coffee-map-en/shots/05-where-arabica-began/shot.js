// 05-where-arabica-began: the camera flies from the belt into the Horn of Africa;
// Ethiopia's highlands glow gold, its rank-5 pin stays, a coffee plant sprouts
// on the southwest highlands ('arabica') and ripples spread out from it.
// Shot-local time: t = 0 is this shot's first frame.
import { coffeeMap, rankPins, mapAt } from '../../world/parts.js'

const INK = '#0b1533', LEAF = '#1f7a45', LEAF_EDGE = '#d9ffe6'
// Where the plant stands: the forests of southwest Ethiopia (Kaffa)
const PLANT = [35.6, 6.9]
// Centre of the glow on the highlands
const HIGH = [38.4, 8.8]

// One leaf, its base at (0, 0), pointing along +x
const leaf = (ang, s, op) =>
  '<g transform="rotate(' + ang + ') scale(' + s.toFixed(3) + ')" opacity="' + op.toFixed(3) + '">' +
  '<path d="M0,0 C6,-9 18,-9 26,0 C18,7 6,7 0,0Z" fill="' + LEAF + '" stroke="' + LEAF_EDGE + '" stroke-width="1.4"/>' +
  '<path d="M2,0 L22,0" stroke="' + LEAF_EDGE + '" stroke-width="0.9" opacity="0.7"/></g>'

// A coffee plant growing leaf by leaf with t (shot seconds)
function plant(kit, x, y, t, s) {
  const { C, clamp, pop, rise } = kit
  const grow = clamp((t - 1.5) / 1.2)
  if (grow <= 0) return ''
  const h = 66 * (1 - Math.pow(1 - grow, 2))
  let out = '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s + ')">' +
    '<ellipse cx="0" cy="2" rx="' + (22 * rise(t, 1.5, 0.3)).toFixed(1) + '" ry="6" fill="' + INK + '" opacity="0.75"/>' +
    '<path d="M0,0 C-2,-' + (h * 0.4).toFixed(1) + ' 2,-' + (h * 0.7).toFixed(1) + ' 0,-' + h.toFixed(1) + '" fill="none" stroke="' + LEAF_EDGE + '" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M0,0 C-2,-' + (h * 0.4).toFixed(1) + ' 2,-' + (h * 0.7).toFixed(1) + ' 0,-' + h.toFixed(1) + '" fill="none" stroke="' + LEAF + '" stroke-width="3" stroke-linecap="round"/>'
  // Leaf pairs, bottom to top, then the cherries
  const pairs = [[-16, 1.75], [-34, 2.05], [-50, 2.35], [-64, 2.6]]
  pairs.forEach(([ly, at], i) => {
    const p = pop(t, at, 0.45)
    if (p <= 0) return
    const sz = 1 - i * 0.16, sw = Math.sin((t + i) * 2.4) * 3
    out += '<g transform="translate(0,' + ly + ')">' +
      leaf(-28 + sw, p * sz, clamp(p * 2)) + leaf(-152 - sw, p * sz, clamp(p * 2)) + '</g>'
  })
  for (let i = 0; i < 3; i++) {
    const p = pop(t, 2.9 + i * 0.12, 0.4)
    if (p <= 0) continue
    out += '<circle cx="' + (-6 + i * 6) + '" cy="' + (-26 + (i % 2) * 5) + '" r="' + (4.6 * p).toFixed(2) + '" fill="' + C.hue.red + '" stroke="' + INK + '" stroke-width="1.2"/>'
  }
  return out + '</g>'
}

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, FONT, clamp, lerp, rise, ease, float } = kit
  const font = FONT.replace(/"/g, '')

  // Rings that wrap the antimeridian (Fiji) draw a line across the map; drop them once
  if (window.GEO && !window.GEO.t5Wrapped) {
    for (const cn of window.GEO) cn.rings = cn.rings.filter(r => {
      let lo = 180, hi = -180
      for (const q of r) { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]) }
      return hi - lo < 180
    })
    window.GEO.t5Wrapped = true
  }

  // Camera: from shot 4's last view over the belt into the Horn of Africa, then a slow push
  const fly = ease(clamp(t / 1.7))
  const zoom = Math.exp(lerp(Math.log(2), Math.log(8), fly)) * (1 + 0.06 * clamp((t - 1.7) / 2.8))
  const view = { center: [lerp(86, 39, ease(clamp(t / 1.5))), lerp(0, 7, fly)], zoom, y: lerp(700, 730, fly) }

  let svg = coffeeMap(kit, { view, tropics: 1, band: 1, labels: 1, grow: 1, bright: { Brazil: 1, Vietnam: 1, Colombia: 1, Indonesia: 1, Ethiopia: 1 } })

  // Gold glow on the highlands, clipped to Ethiopia, breathing
  const et = (window.GEO || []).find(c => c.name === 'Ethiopia')
  const lit = rise(t, 1.0, 0.7)
  if (et && lit > 0) {
    const d = et.rings.map(r => 'M' + r.map(([lon, lat]) => { const q = mapAt(kit, view, lon, lat); return q[0].toFixed(1) + ',' + q[1].toFixed(1) }).join('L') + 'Z').join('')
    const [hx, hy] = mapAt(kit, view, HIGH[0], HIGH[1]), hr = 6.5 * (kit.W / 360) * zoom
    const breathe = 0.5 + 0.5 * Math.sin((t - 1.2) * Math.PI * 2 / 1.5)
    svg += '<defs><clipPath id="a5-et"><path d="' + d + '"/></clipPath>' +
      '<radialGradient id="a5-glow"><stop offset="0" stop-color="' + C.hue.yellow + '" stop-opacity="0.95"/>' +
      '<stop offset="0.55" stop-color="' + C.hue.orange + '" stop-opacity="0.45"/><stop offset="1" stop-color="' + C.hue.orange + '" stop-opacity="0"/></radialGradient></defs>' +
      '<g clip-path="url(#a5-et)"><ellipse cx="' + hx.toFixed(1) + '" cy="' + hy.toFixed(1) + '" rx="' + (hr * (0.95 + 0.1 * breathe)).toFixed(1) + '" ry="' + (hr * (1.05 + 0.1 * breathe)).toFixed(1) +
      '" fill="url(#a5-glow)" opacity="' + (lit * (0.55 + 0.35 * breathe)).toFixed(3) + '"/></g>' +
      '<path d="' + d + '" fill="none" stroke="' + C.hue.yellow + '" stroke-width="' + (2 + 3 * breathe).toFixed(1) + '" stroke-linejoin="round" opacity="' + (lit * (0.3 + 0.3 * breathe)).toFixed(3) + '"/>'
  }

  // Ripples spreading from the plant across the map
  const [px, py] = mapAt(kit, view, PLANT[0], PLANT[1])
  for (let i = 0; i < 4; i++) {
    const age = t - 2.0 - i * 0.6
    if (age <= 0) continue
    const k = (age % 2.4) / 2.4, r = 20 + 330 * (1 - Math.pow(1 - k, 2))
    svg += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="none" stroke="' + C.hue.yellow +
      '" stroke-width="2" opacity="' + (0.45 * (1 - k) * rise(age, 0, 0.3)).toFixed(3) + '"/>'
  }

  // Shade under the headline and at the foot
  svg += '<defs><linearGradient id="a5-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101c44" stop-opacity="0.97"/>' +
    '<stop offset="0.75" stop-color="#0e1a40" stop-opacity="0.9"/><stop offset="1" stop-color="#0d1736" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="a5-foot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080e24" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#080e24" stop-opacity="0.9"/></linearGradient></defs>' +
    '<rect x="0" y="0" width="720" height="460" fill="url(#a5-top)"/>' +
    '<rect x="0" y="900" width="720" height="380" fill="url(#a5-foot)"/>'

  // The rank pins (all dropped; Ethiopia's 5 stays in view)
  svg += rankPins(kit, { view, drop: 1, notes: { 2: 'robusta' }, scale: lerp(1.25, 1.5, fly) })

  // The plant and its label
  svg += plant(kit, px, py + float(t, 1.2, 2.5), t, 1.15)
  const lab = rise(t, 2.6, 0.4)
  if (lab > 0) svg += '<text x="' + (px - 40).toFixed(1) + '" y="' + (py - 34 + (1 - lab) * 10).toFixed(1) + '" text-anchor="end" font-size="28" font-weight="800" font-style="italic" fill="' + C.hue.yellow +
    '" opacity="' + lab.toFixed(3) + '" stroke="' + INK + '" stroke-width="5" paint-order="stroke" font-family="' + font + '">arabica</text>'

  // Source line
  const src = rise(t, 0.6, 0.6)
  svg += '<rect x="30" y="982" width="320" height="32" rx="8" fill="' + INK + '" opacity="' + (0.8 * src).toFixed(3) + '"/>' +
    '<text x="40" y="1004" font-size="15" fill="' + C.muted + '" opacity="' + src.toFixed(3) + '" font-family="' + font + '">Source: Encyclopaedia Britannica, \'Coffee\'</text>'

  kit.stage(svg)

  kit.frame({
    kicker: 'The origin',
    head: ['Ethiopia: where', '*arabica* coffee', 'began'],
    typed: rise(t, 0.05, 0.8),
    progress: (start + t) / 32.5
  })
}
