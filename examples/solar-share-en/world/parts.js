// world/parts.js: the recurring pictures of "How much of the world's electricity
// comes from solar power". Each function returns SVG markup for kit.stage();
// they are pure functions of their options. Keep their design: pass only the
// options below, never restyle them in a shot.
//
// ENERGY: the video's colour meanings (never swapped):
//   ENERGY.solar   warm gold: solar, always (bars, counters, badges, sun disc)
//   ENERGY.clean   teal: other clean sources (hydro, nuclear, wind)
//   ENERGY.fossil  muted slate-red: fossil fuels (coal, gas)
//   ENERGY.other   slate: 'other' sources
//   ENERGY.slate   the dim slate fill of the world bar
//
// SHARES: world electricity 2025 by source (Ember, Global Electricity Review
//   2026), ordered from the far end of the bar to the solar end:
//   coal 33, gas 21.8, other 5.1 (the remainder), hydro 14, nuclear 8.9,
//   wind 8.5, solar 8.7
//   (each { id, name, pct, kind: 'fossil' | 'clean' | 'other' | 'solar' }).
//   Source line for them: "Ember, Global Electricity Review 2026".
//
// worldBar(kit, opts) → SVG markup. One long bar = 100% of world electricity
//   in 2025: rounded ends, dim slate fill, label 'WORLD ELECTRICITY · 2025'.
//   Solar's gold segment is always at the solar end: the LEFT end when
//   horizontal, the BOTTOM when vertical.
//   opts:
//     x, y        top-left corner of the bar (default PAD, 800)
//     length      along the bar, px (default 580 horizontal, 760 vertical)
//     thick       across the bar, px (default 30 horizontal, 120 vertical)
//     vertical    false: lies left→right; true: stands, solar at the bottom
//     solar       solar's share drawn, % (default 8.7; shot 6 may push it
//                 wider, the other segments then shrink to fit)
//     solarP      0→1 wipes the gold segment in from the solar end
//     split       0→1 the other segments appear in turn from the far end
//                 (coal first), sliding in; 0 = just the dim slate rest
//     labels      true: name and rolling % for each segment that is in
//                 (vertical: to the right of the bar; horizontal: under it,
//                 only segments wide enough). Solar's label shows 8.7%;
//                 whole shares show as integers, others with one decimal.
//     outline     segment id to outline (e.g. 'coal'), outlineP 0→1 draws it
//     glow        0→1 warm glow around the gold segment
//     title       true: 'WORLD ELECTRICITY · 2025' above the bar (+ '100%'
//                 at the far end when horizontal)
//     titleP      0→1 fades the title in
//     tag         text under the gold segment (horizontal) or to its left
//                 (vertical), e.g. 'SOLAR 8.7%'; pass the rolling number
//     tagP        0→1 fades the tag in
//     p           0→1 the whole bar fades and rises in
//     t           seconds, for the shimmer on the gold edge
//     id          unique id prefix if two bars share a frame (default 'wb')
//   Space it needs: horizontal, title 26 px above, tag/labels ~60 px below;
//   vertical, title 26 px above, labels ~170 px to the right.
//
// sunDisc(kit, opts) → SVG markup. The soft gold sun behind a number: a
//   halo, slowly turning rays (reaching 1.62 r from the centre) and a
//   breathing disc, dim enough for gold text to read on it.
//   opts: x, y centre (default 330, 580); r disc radius (default 160);
//     t seconds (rays turn, disc breathes); rays 0→1 ray strength (default 1);
//     glow 0→1 overall brightness (default 1); p 0→1 grows it in;
//     id unique id prefix (default 'sun').
//
// bolt(kit, { x, y, size, color, fill }) → SVG markup: one small lightning
//   bolt (a unit of electricity), centred on x, y; fill false = outline only.

export const ENERGY = {
  solar: '#ffb340',
  solarHi: '#ffd27a',
  clean: '#4fd1c5',
  fossil: '#a8606b',
  other: '#6f7ea6',
  slate: 'rgba(159, 176, 214, 0.17)'
}

export const SHARES = [
  { id: 'coal', name: 'Coal', pct: 33, kind: 'fossil' },
  { id: 'gas', name: 'Gas', pct: 21.8, kind: 'fossil' },
  { id: 'other', name: 'Other', pct: 5.1, kind: 'other' },
  { id: 'hydro', name: 'Hydro', pct: 14, kind: 'clean' },
  { id: 'nuclear', name: 'Nuclear', pct: 8.9, kind: 'clean' },
  { id: 'wind', name: 'Wind', pct: 8.5, kind: 'clean' },
  { id: 'solar', name: 'Solar', pct: 8.7, kind: 'solar' }
]

const kindColor = kind => ENERGY[kind] || ENERGY.other
const font = kit => kit.FONT.replace(/"/g, '')
const f1 = n => Number(n).toFixed(2)

export function worldBar(kit, {
  x = kit.PAD, y = 800, length, thick, vertical = false,
  solar = 8.7, solarP = 1, split = 0, labels = false,
  outline = null, outlineP = 1, glow = 0,
  title = true, titleP = 1, tag = '', tagP = 1, p = 1, t = 0, id = 'wb'
} = {}) {
  const { clamp, rise, C } = kit
  const L = length ?? (vertical ? 760 : 580)
  const T = thick ?? (vertical ? 120 : 30)
  const F = font(kit)
  const bw = vertical ? T : L, bh = vertical ? L : T
  // A span [a, b] in % from the solar end → rectangle in frame space
  const span = (a, b) => vertical
    ? { x, y: y + L - (b / 100) * L, w: T, h: ((b - a) / 100) * L }
    : { x: x + (a / 100) * L, y, w: ((b - a) / 100) * L, h: T }
  const rect = (r, attrs) => '<rect x="' + f1(r.x) + '" y="' + f1(r.y) + '" width="' + f1(Math.max(0, r.w)) + '" height="' + f1(Math.max(0, r.h)) + '" ' + attrs + '/>'

  // Segment spans from the solar end; the rest shrinks to fit a wider solar
  const rest = SHARES.slice(0, -1)
  const scale = (100 - solar) / (100 - 8.7)
  let a = solar
  const spans = {}
  for (let i = rest.length - 1; i >= 0; i--) {
    const b = a + rest[i].pct * scale
    spans[rest[i].id] = [a, Math.min(100, b)]
    a = b
  }
  spans.solar = [0, solar]

  const lift = (1 - clamp(p)) * 18
  let out = '<g opacity="' + f1(clamp(p)) + '" transform="translate(0 ' + f1(lift) + ')">'
  out += '<defs><clipPath id="' + id + '-clip"><rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="' + T / 2 + '"/></clipPath>' +
    '<filter id="' + id + '-blur" filterUnits="userSpaceOnUse" x="' + (x - 120) + '" y="' + (y - 120) + '" width="' + (bw + 240) + '" height="' + (bh + 240) + '"><feGaussianBlur stdDeviation="' + (T * 0.35 + 6) + '"/></filter>' +
    '<linearGradient id="' + id + '-gold" x1="0" y1="0" x2="' + (vertical ? 1 : 0) + '" y2="' + (vertical ? 0 : 1) + '">' +
    '<stop offset="0" stop-color="' + ENERGY.solarHi + '"/><stop offset="1" stop-color="' + ENERGY.solar + '"/></linearGradient></defs>'

  // Title above the bar
  if (title) {
    out += '<g opacity="' + f1(clamp(titleP)) + '" font-family="' + F + '">' +
      '<text x="' + x + '" y="' + (y - 14) + '" font-size="17" font-weight="600" letter-spacing="2.6" fill="' + C.muted + '">WORLD ELECTRICITY · 2025</text>' +
      (vertical ? '' : '<text x="' + (x + L) + '" y="' + (y - 14) + '" text-anchor="end" font-size="17" font-weight="600" letter-spacing="1.5" fill="' + C.muted + '">100%</text>') +
      '</g>'
  }

  // Glow behind the gold segment
  const sw = clamp(solarP)
  const sSpan = span(0, solar * sw)
  if (glow > 0 && sw > 0) out += rect(sSpan, 'rx="' + T / 2 + '" fill="' + ENERGY.solar + '" opacity="' + f1(0.85 * clamp(glow)) + '" filter="url(#' + id + '-blur)"')

  // The bar: dim slate body, segments, gold solar end
  out += '<g clip-path="url(#' + id + '-clip)">'
  out += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" fill="' + ENERGY.slate + '"/>'
  const n = rest.length
  const reveal = i => rise(clamp(split) * (n * 0.5 + 0.6), i * 0.5, 0.6)
  rest.forEach((s, i) => {
    const k = reveal(i)
    if (k <= 0) return
    const [sa, sb] = spans[s.id]
    const r = span(sa, sb)
    // Slide in from the far end, 1.5 px gap between segments
    const slide = (1 - k) * 26
    const g = { x: r.x + (vertical ? 0 : 1.5 + slide), y: r.y + (vertical ? 1.5 - slide : 0), w: r.w - (vertical ? 0 : 3), h: r.h - (vertical ? 3 : 0) }
    out += rect(g, 'fill="' + kindColor(s.kind) + '" opacity="' + f1(k * (s.kind === 'other' ? 0.8 : 0.92)) + '"')
  })
  if (sw > 0) {
    const g = { x: sSpan.x, y: sSpan.y, w: sSpan.w - (vertical ? 0 : 1.5), h: sSpan.h - (vertical ? 1.5 : 0) }
    out += rect(g, 'fill="url(#' + id + '-gold)"')
    // A bright edge travelling with the wipe, then a slow shimmer
    const edge = vertical ? { x, y: g.y, w: T, h: 3 } : { x: g.x + g.w - 3, y, w: 3, h: T }
    out += rect(edge, 'fill="#fff4d6" opacity="' + f1(0.35 + 0.25 * Math.sin(t * 3)) + '"')
  }
  // A soft top light along the bar for depth
  out += vertical
    ? '<rect x="' + x + '" y="' + y + '" width="' + T * 0.28 + '" height="' + L + '" fill="#ffffff" opacity="0.07"/>'
    : '<rect x="' + x + '" y="' + y + '" width="' + L + '" height="' + T * 0.3 + '" fill="#ffffff" opacity="0.07"/>'
  out += '</g>'
  out += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="' + T / 2 + '" fill="none" stroke="' + C.line + '" stroke-width="1.5"/>'

  // Outline of one segment, drawn on
  if (outline && spans[outline] && (outline === 'solar' || reveal(rest.findIndex(s => s.id === outline)) > 0)) {
    const r = span(...spans[outline]), m = 5
    const per = 2 * (r.w + r.h + 4 * m)
    out += '<rect x="' + f1(r.x - m) + '" y="' + f1(r.y - m) + '" width="' + f1(r.w + 2 * m) + '" height="' + f1(r.h + 2 * m) + '" rx="8" fill="none" stroke="' + C.text +
      '" stroke-width="2.5" stroke-dasharray="' + f1(per) + '" stroke-dashoffset="' + f1(per * (1 - clamp(outlineP))) + '"/>'
  }

  // Segment labels with rolling percentages
  if (labels) {
    const all = [...rest.map((s, i) => [s, reveal(i)]), [SHARES[SHARES.length - 1], sw]]
    all.forEach(([s, k]) => {
      if (k <= 0) return
      const [sa, sb] = spans[s.id]
      const r = span(sa, sb)
      const val = s.id === 'solar' ? (solar * k).toFixed(1) : (Number.isInteger(s.pct) ? String(Math.round(s.pct * k)) : (s.pct * k).toFixed(1))
      const col = kindColor(s.kind)
      if (vertical) {
        const ly = r.y + r.h / 2 + 8
        out += '<text x="' + (x + T + 18) + '" y="' + f1(ly) + '" font-family="' + F + '" opacity="' + f1(k) + '">' +
          '<tspan font-size="28" font-weight="800" fill="' + (s.kind === 'other' ? C.muted : col) + '" style="font-variant-numeric: tabular-nums">' + val + '%</tspan>' +
          '<tspan dx="10" font-size="20" font-weight="600" fill="' + C.muted + '">' + s.name + '</tspan></text>'
      } else if (s.id !== 'solar' && r.w >= (val.includes('.') ? 60 : 44)) {
        const lx = r.x + r.w / 2
        out += '<g font-family="' + F + '" text-anchor="middle" opacity="' + f1(k) + '">' +
          '<text x="' + f1(lx) + '" y="' + (y + T + 26) + '" font-size="20" font-weight="800" fill="' + (s.kind === 'other' ? C.muted : col) + '">' + val + '%</text>' +
          '<text x="' + f1(lx) + '" y="' + (y + T + 46) + '" font-size="15" font-weight="600" fill="' + C.muted + '">' + s.name + '</text></g>'
      }
    })
  }

  // Tag on the gold segment
  if (tag && tagP > 0) {
    const r = span(0, solar * sw)
    if (vertical) {
      const ty = r.y + r.h / 2 + 7
      out += '<text x="' + (x - 14) + '" y="' + f1(ty) + '" text-anchor="end" font-family="' + F + '" font-size="20" font-weight="800" letter-spacing="1.5" fill="' + ENERGY.solar + '" opacity="' + f1(clamp(tagP)) + '">' + tag + '</text>'
    } else {
      const cx = r.x + Math.max(r.w, 2) / 2
      out += '<g opacity="' + f1(clamp(tagP)) + '">' +
        '<line x1="' + f1(cx) + '" y1="' + (y + T + 4) + '" x2="' + f1(cx) + '" y2="' + (y + T + 16) + '" stroke="' + ENERGY.solar + '" stroke-width="2.5" stroke-linecap="round"/>' +
        '<text x="' + x + '" y="' + (y + T + 40) + '" font-family="' + F + '" font-size="20" font-weight="800" letter-spacing="1.5" fill="' + ENERGY.solar + '" style="font-variant-numeric: tabular-nums">' + tag + '</text></g>'
    }
  }
  return out + '</g>'
}

export function sunDisc(kit, { x = 330, y = 580, r = 160, t = 0, rays = 1, glow = 1, p = 1, id = 'sun' } = {}) {
  const { clamp } = kit
  const k = clamp(p), g = clamp(glow)
  if (k <= 0) return ''
  const breathe = 1 + 0.035 * Math.sin(t * Math.PI * 2 / 2.6)
  const R = r * breathe * (0.7 + 0.3 * k)
  let out = '<defs>' +
    '<radialGradient id="' + id + '-halo"><stop offset="0" stop-color="' + ENERGY.solar + '" stop-opacity="0.26"/><stop offset="0.45" stop-color="' + ENERGY.solar + '" stop-opacity="0.09"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="' + id + '-disc" cx="0.42" cy="0.38"><stop offset="0" stop-color="' + ENERGY.solarHi + '" stop-opacity="0.34"/><stop offset="0.7" stop-color="' + ENERGY.solar + '" stop-opacity="0.16"/><stop offset="1" stop-color="' + ENERGY.solar + '" stop-opacity="0.1"/></radialGradient>' +
    '</defs>'
  out += '<g opacity="' + (k * (0.55 + 0.45 * g)).toFixed(3) + '">'
  out += '<circle cx="' + x + '" cy="' + y + '" r="' + (R * 2.4).toFixed(1) + '" fill="url(#' + id + '-halo)"/>'
  // Rays: thin wedges turning slowly, alternating long and short
  const n = 18, spin = t * 7
  let wedges = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, wa = 0.05, long = i % 2 ? 1.35 : 1.62
    const r0 = R * 1.12, r1 = R * long
    const pt = (rr, aa) => (x + Math.cos(aa) * rr).toFixed(1) + ',' + (y + Math.sin(aa) * rr).toFixed(1)
    wedges += '<polygon points="' + pt(r0, a0 - wa) + ' ' + pt(r1, a0) + ' ' + pt(r0, a0 + wa) + '" fill="' + ENERGY.solar + '" opacity="' + (i % 2 ? 0.14 : 0.2).toFixed(2) + '"/>'
  }
  out += '<g opacity="' + clamp(rays).toFixed(3) + '" transform="rotate(' + spin.toFixed(2) + ' ' + x + ' ' + y + ')">' + wedges + '</g>'
  out += '<circle cx="' + x + '" cy="' + y + '" r="' + R.toFixed(1) + '" fill="url(#' + id + '-disc)" stroke="' + ENERGY.solar + '" stroke-opacity="0.45" stroke-width="2"/>'
  out += '<circle cx="' + x + '" cy="' + y + '" r="' + (R * 0.78).toFixed(1) + '" fill="none" stroke="' + ENERGY.solar + '" stroke-opacity="0.12" stroke-width="1.5"/>'
  return out + '</g>'
}

export function bolt(kit, { x = 0, y = 0, size = 28, color = ENERGY.solar, fill = true } = {}) {
  const s = size / 28
  const pts = [[3, -14], [-8, 2], [-1, 2], [-4, 14], [8, -3], [1, -3], [4, -14]]
    .map(([px, py]) => (x + px * s).toFixed(1) + ',' + (y + py * s).toFixed(1)).join(' ')
  return '<polygon points="' + pts + '" fill="' + (fill ? color : 'none') + '" stroke="' + color + '" stroke-width="' + (fill ? 1 : 1.6) + '" stroke-linejoin="round"/>'
}
