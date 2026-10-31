// world/parts.js: the recurring pictures of "Where does the world's coffee come from".
/*
  Each function takes kit (window.kit) and an options object and returns SVG
  markup for kit.stage(). All of them share one camera, `view`, so the map,
  the pins and the routes line up. Pass the same view to every part of a frame.

  view = { center: [lon, lat], zoom = 1, globe = 0, x = 360, y = 640, R = 280 }
    center   the place at the middle of the picture (move center[0] to turn the globe)
    zoom     1: the flat world across the frame's width (same scale as kit.map); 2: twice as close
    globe    0: the flat map, 1: the globe (orthographic, radius R·zoom px); in between,
             the map wraps onto the globe (shot 2 unrolls it: globe 1 → 0)
    x, y     where center sits on the frame
    R        the globe's radius in px at zoom 1

  mapAt(kit, view, lon, lat, alt = 0) → [x, y, vis]
    Where a place is on the frame; vis 0…1 is 0 behind the globe (always 1 on the flat map).
    alt lifts the point above the globe (0.1 = a tenth of the radius).

  coffeeMap(kit, { view, tropics = 1, band = 1, labels = 1, grow = 1, bright = {} })
    THE WORLD MAP WITH THE COFFEE BELT. Navy ocean, slate-grey land, faint graticule;
    on the globe, a lit sphere with an atmosphere rim.
    tropics  0…1 the two dashed gold tropic lines draw on, west to east
    band     0…1 the soft gold band between them fades in
    labels   0…1 'Tropic of Cancer' / 'Tropic of Capricorn' at the left edge of the lines
    grow     0…1 the coffee-growing countries (GROWERS, 70+) light leaf green, west to east
    bright   { 'Brazil': 0…1, … } a grower brightens from the belt's green to full leaf green
             (the top five: Brazil, Vietnam, Colombia, Indonesia, Ethiopia)

  rankPins(kit, { view, drop = [1, 1, 1, 1, 1], notes = {}, scale = 1 })
    THE RANK PINS. Gold teardrop pins with a white badge 1–5 on Brazil, Vietnam, Colombia,
    Indonesia, Ethiopia; the country name in white to the right, typing on as the pin lands.
    drop     p 0…1 per rank (index 0 = rank 1, Brazil), or one number for all; once a
             pin has dropped keep its p at 1
    notes    { 2: 'robusta' } a small second line under a name, by rank
    scale    pin size

  tradeRoutes(kit, { view, draw = 1, flow = 0, importers = 1, labels = 1 })
    THE TRADE ROUTES. Coffee-orange arcs bowing north from the five producers to the
    EU and the US, small beans flowing along them; the importers fill cool blue.
    draw       0…1 the six arcs draw on one after another (or an array of six p's)
    flow       seconds (pass the film or shot time): the beans run along the drawn arcs
    importers  0…1 the EU members and the US fill blue
    labels     0…1 'EU' and 'US' at the destinations

  beanPin(kit, { x, y, p = 1, t = 0, vis = 1, size = 1 })
    A coffee-bean pin standing at (x, y), popping up with p; a leaf-green ring
    pulses at its foot with t (seconds). Use with mapAt for its place.

  bean(kit, { x, y, angle = 0, size = 1, opacity = 1 })
    One small coffee bean (the dots of the routes).

  Data: GROWERS (names lit by grow), TOP5 ([{ rank, name, at: [lon, lat] }]),
  ROUTES ([{ from: name, to: 'EU' | 'US' }]), DEST ({ EU: [lon, lat], US: [lon, lat] }).
*/

const RAD = Math.PI / 180
const TROPIC = 23.44

// The look of the map (fixed): navy ocean, slate land
const OCEAN_IN = '#16295a', OCEAN_OUT = '#0b1634', LAND = '#3a4764', BORDER = 'rgba(255, 255, 255, 0.13)'
const INK = '#0b1533'

// Coffee-growing countries (Natural Earth names; spelling variants are harmless)
export const GROWERS = [
  'Mexico', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Haiti',
  'Dominican Rep.', 'Dominican Republic', 'Jamaica', 'Puerto Rico', 'Trinidad and Tobago', 'Colombia', 'Venezuela',
  'Ecuador', 'Peru', 'Bolivia', 'Brazil', 'Paraguay', 'Guyana', 'Suriname',
  'Ethiopia', 'Uganda', 'Kenya', 'Tanzania', 'United Republic of Tanzania', 'Rwanda', 'Burundi', 'Dem. Rep. Congo',
  'Democratic Republic of the Congo', 'Congo', 'Republic of the Congo', 'Cameroon', 'Central African Rep.',
  'Central African Republic', "Côte d'Ivoire", 'Ivory Coast', 'Ghana', 'Togo', 'Benin', 'Nigeria', 'Guinea',
  'Sierra Leone', 'Liberia', 'Gabon', 'Eq. Guinea', 'Equatorial Guinea', 'Angola', 'Madagascar', 'Malawi',
  'Zambia', 'Zimbabwe', 'Mozambique', 'S. Sudan', 'South Sudan', 'Yemen',
  'India', 'Sri Lanka', 'Nepal', 'Myanmar', 'Thailand', 'Laos', 'Lao PDR', 'Vietnam', 'Viet Nam', 'Cambodia',
  'Philippines', 'Malaysia', 'Indonesia', 'Timor-Leste', 'East Timor', 'Papua New Guinea', 'Vanuatu', 'Fiji'
]

export const TOP5 = [
  { rank: 1, name: 'Brazil', at: [-48, -13] },
  { rank: 2, name: 'Vietnam', at: [107.8, 13] },
  { rank: 3, name: 'Colombia', at: [-74, 4.5] },
  { rank: 4, name: 'Indonesia', at: [111, -6.5] },
  { rank: 5, name: 'Ethiopia', at: [39, 8.5] }
]

export const DEST = { EU: [9, 50.5], US: [-80, 38.5] }
export const ROUTES = [
  { from: 'Brazil', to: 'US' },
  { from: 'Brazil', to: 'EU' },
  { from: 'Colombia', to: 'US' },
  { from: 'Ethiopia', to: 'EU' },
  { from: 'Vietnam', to: 'EU' },
  { from: 'Indonesia', to: 'EU' }
]

const EU = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Czech Rep.', 'Czech Republic', 'Denmark',
  'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania',
  'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden']
const US = ['United States of America', 'United States']

const GROWER_SET = new Set(GROWERS), EU_SET = new Set(EU), US_SET = new Set(US)

// The countries, with each ring's mean longitude (for west-to-east order), read once
let GEO_CACHE = null
function geo() {
  if (GEO_CACHE) return GEO_CACHE
  const src = (typeof window !== 'undefined' && window.GEO) || globalThis.GEO || []
  const list = src.map(cn => {
    let sx = 0, n = 0
    const rings = cn.rings.map(r => {
      let s = 0
      for (const q of r) s += q[0]
      sx += s; n += r.length
      return { pts: r, lon: s / Math.max(1, r.length) }
    })
    return { name: cn.name, rings, lon: sx / Math.max(1, n) }
  })
  const growers = list.filter(c => GROWER_SET.has(c.name)).sort((a, b) => a.lon - b.lon)
  growers.forEach((c, i) => { c.order = i })
  if (src.length) GEO_CACHE = { list, growers: growers.length }
  return { list, growers: growers.length }
}

const f1 = v => v.toFixed(1)
const fontOf = kit => kit.FONT.replace(/"/g, '')

// Where (lon, lat) is on the frame for this view: [x, y, vis]. Points behind the
// globe at alt 0 are pinned to its rim (so land shapes close on the limb).
export function mapAt(kit, view = {}, lon, lat, alt = 0) {
  const [c0, c1] = view.center || [10, 20]
  const zoom = view.zoom ?? 1, g = kit.clamp(view.globe ?? 0)
  const x0 = view.x ?? kit.W / 2, y0 = view.y ?? kit.H / 2, R = (view.R ?? 280) * zoom
  const k = (kit.W / 360) * zoom
  const fx = x0 + (lon - c0) * k, fy = y0 - (lat - c1) * k
  if (g <= 0) return [fx, fy, 1]
  const l = (lon - c0) * RAD, p = lat * RAD, p0 = c1 * RAD
  let gx = Math.cos(p) * Math.sin(l)
  let gy = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)
  const gz = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
  const a = 1 + alt, rr = Math.hypot(gx, gy) * a
  let vis = 1
  if (gz < 0) {
    vis = Math.max(kit.clamp(1 + gz * 12), alt > 0 ? kit.clamp((rr - 1) * 25) : 0)
    if (alt <= 0) { const h = Math.hypot(gx, gy) || 1; gx /= h; gy /= h }
  }
  const sx = x0 + gx * a * R, sy = y0 - gy * a * R
  return [fx + (sx - fx) * g, fy + (sy - fy) * g, 1 + (vis - 1) * g]
}

// Path data of a polyline in lon/lat; with split, the hidden stretches are left out
function line(kit, view, pts, split) {
  let d = '', pen = false
  for (const [lon, lat, alt] of pts) {
    const [x, y, v] = mapAt(kit, view, lon, lat, alt || 0)
    if (split && v < 0.5) { pen = false; continue }
    d += (pen ? 'L' : 'M') + f1(x) + ',' + f1(y)
    pen = true
  }
  return d
}
const parallel = (lat, from = -180, to = 180, step = 2) => {
  const out = []
  for (let lon = from; lon <= to + 1e-9; lon += step) out.push([lon, lat])
  return out
}

// The sea's outline: the world's rectangle on the flat map, the disc on the globe
function oceanPath(kit, view) {
  const g = kit.clamp(view.globe ?? 0), zoom = view.zoom ?? 1
  const x0 = view.x ?? kit.W / 2, y0 = view.y ?? kit.H / 2, R = (view.R ?? 280) * zoom
  const [ax, ay] = mapAt(kit, { ...view, globe: 0 }, -180, 90), [bx, by] = mapAt(kit, { ...view, globe: 0 }, 180, -90)
  const rcx = (ax + bx) / 2, rcy = (ay + by) / 2, hw = (bx - ax) / 2, hh = (by - ay) / 2
  let d = ''
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a)
    const m = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(s)))
    const rx = rcx + c * m, ry = rcy - s * m, gx = x0 + c * R, gy = y0 - s * R
    d += (i ? 'L' : 'M') + f1(rx + (gx - rx) * g) + ',' + f1(ry + (gy - ry) * g)
  }
  return d + 'Z'
}

// The land of one country as path data (rings hidden behind the globe left out)
function countryPath(kit, view, cn, g) {
  let d = ''
  for (const r of cn.rings) {
    let front = false, s = ''
    for (let i = 0; i < r.pts.length; i++) {
      const [x, y, v] = mapAt(kit, view, r.pts[i][0], r.pts[i][1])
      if (v > 0.02) front = true
      s += (i ? 'L' : 'M') + f1(x) + ',' + f1(y)
    }
    if (front || g < 0.98) d += s + 'Z'
  }
  return d
}

export function coffeeMap(kit, { view = {}, tropics = 1, band = 1, labels = 1, grow = 1, bright = {} } = {}) {
  const { C, clamp, PAD } = kit
  const g = clamp(view.globe ?? 0), zoom = view.zoom ?? 1
  const x0 = view.x ?? kit.W / 2, y0 = view.y ?? kit.H / 2, R = (view.R ?? 280) * zoom
  const { list, growers } = geo()
  const ocean = oceanPath(kit, view)
  let out = '<defs>' +
    '<radialGradient id="cm-sea" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="' + OCEAN_IN + '"/><stop offset="1" stop-color="' + OCEAN_OUT + '"/></radialGradient>' +
    '<radialGradient id="cm-atmo"><stop offset="0.84" stop-color="' + C.hue.blue + '" stop-opacity="0"/><stop offset="0.895" stop-color="' + C.hue.blue + '" stop-opacity="0.38"/>' +
    '<stop offset="1" stop-color="' + C.hue.blue + '" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="cm-shade" cx="0.36" cy="0.3" r="0.78"><stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="#030716" stop-opacity="0.6"/></radialGradient>' +
    '</defs>'
  // Atmosphere rim behind the globe
  if (g > 0) out += '<circle cx="' + f1(x0) + '" cy="' + f1(y0) + '" r="' + f1(R * 1.12) + '" fill="url(#cm-atmo)" opacity="' + g + '"/>'
  out += '<path d="' + ocean + '" fill="url(#cm-sea)"/>'
  // Graticule
  let grid = ''
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = []
    for (let lat = -80; lat <= 80; lat += 4) pts.push([lon, lat])
    grid += line(kit, view, pts, g > 0.5)
  }
  for (const lat of [-60, -30, 0, 30, 60]) grid += line(kit, view, parallel(lat, -180, 180, 3), g > 0.5)
  out += '<path d="' + grid + '" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1"/>'
  // The belt: the sea's shape minus the two caps beyond the tropics
  if (band > 0) {
    const cap = s => line(kit, view, [...parallel(s * TROPIC), ...parallel(s * 90).reverse()], false) + 'Z'
    out += '<path d="' + ocean + cap(1) + cap(-1) + '" fill-rule="evenodd" fill="' + C.hue.yellow + '" opacity="' + (clamp(band) * 0.2).toFixed(3) + '"/>'
  }
  // Land; growers in leaf green, west to east
  let land = '', green = ''
  const n = Math.max(1, growers)
  for (const cn of list) {
    const d = countryPath(kit, view, cn, g)
    if (!d) continue
    land += '<path d="' + d + '"/>'
    if (cn.order != null && grow > 0) {
      const li = clamp((grow * (n + 3) - cn.order) / 3)
      if (li > 0) {
        const op = li * (0.62 + 0.38 * clamp(bright[cn.name] || 0))
        green += '<path d="' + d + '" opacity="' + op.toFixed(3) + '"/>'
      }
    }
  }
  out += '<g fill="' + LAND + '" stroke="' + BORDER + '" stroke-width="0.7" stroke-linejoin="round">' + land + '</g>'
  if (green) out += '<g fill="' + C.hue.green + '" stroke="' + C.hue.green + '" stroke-width="0.8" stroke-linejoin="round">' + green + '</g>'
  // Shading of the sphere
  if (g > 0) out += '<circle cx="' + f1(x0) + '" cy="' + f1(y0) + '" r="' + f1(R) + '" fill="url(#cm-shade)" opacity="' + g + '"/>'
  // Tropic lines, drawn on west to east, and their labels at the left edge
  if (tropics > 0) {
    const to = -180 + 360 * clamp(tropics)
    for (const [s, name] of [[1, 'Tropic of Cancer'], [-1, 'Tropic of Capricorn']]) {
      const pts = parallel(s * TROPIC, -180, to, 2)
      out += '<path d="' + line(kit, view, pts, true) + '" fill="none" stroke="' + C.hue.yellow + '" stroke-width="1.8" stroke-dasharray="8 6" stroke-linecap="round" opacity="0.9"/>'
      const lp = clamp(labels) * clamp(tropics * 4)
      if (lp > 0) {
        // the leftmost visible point of the line
        let best = null
        for (const [lon, lat] of parallel(s * TROPIC, -180, 180, 2)) {
          const q = mapAt(kit, view, lon, lat)
          if (q[2] > 0.6 && q[0] >= PAD - 40 && (!best || q[0] < best[0])) best = q
        }
        if (best) {
          const lx = Math.max(PAD + 2, best[0] + 6), ly = best[1] + (s > 0 ? -9 : 21)
          out += '<text x="' + f1(lx) + '" y="' + f1(ly) + '" font-size="15" font-weight="600" fill="' + C.hue.yellow + '" opacity="' + lp.toFixed(3) +
            '" stroke="' + INK + '" stroke-width="3.5" paint-order="stroke" font-family="' + fontOf(kit) + '">' + name + '</text>'
        }
      }
    }
  }
  return out
}

// A gold teardrop pin with its tip at (0, 0) and a white badge
function teardrop(kit, rank) {
  const { C } = kit
  return '<ellipse cx="0" cy="1" rx="7" ry="2.6" fill="#000" opacity="0.35"/>' +
    '<path d="M0,0 C-5,-9 -15,-16 -15,-28 A15,15 0 1 1 15,-28 C15,-16 5,-9 0,0Z" fill="' + C.hue.yellow + '" stroke="' + INK + '" stroke-width="1.5"/>' +
    '<circle cx="0" cy="-28" r="10.5" fill="#ffffff"/>' +
    '<text x="0" y="-22.5" text-anchor="middle" font-size="15" font-weight="800" fill="' + INK + '" font-family="' + fontOf(kit) + '">' + rank + '</text>'
}

export function rankPins(kit, { view = {}, drop = [1, 1, 1, 1, 1], notes = {}, scale = 1 } = {}) {
  const { C, clamp, pop } = kit
  let out = ''
  for (const pin of TOP5) {
    const p = clamp(Array.isArray(drop) ? drop[pin.rank - 1] || 0 : drop)
    if (p <= 0) continue
    const [x, y, vis] = mapAt(kit, view, pin.at[0], pin.at[1])
    if (vis <= 0.02) continue
    const fall = (1 - pop(p, 0, 1)) * -46 * scale
    out += '<g opacity="' + (clamp(p * 3) * vis).toFixed(3) + '"><g transform="translate(' + f1(x) + ',' + f1(y + fall) + ') scale(' + scale + ')">' + teardrop(kit, pin.rank) + '</g></g>'
    // The name types on as the pin lands
    const k = clamp((p - 0.35) / 0.65), name = pin.name.slice(0, Math.round(k * pin.name.length))
    if (name) {
      const tx = x + 19 * scale, ty = y - 22 * scale
      out += '<text x="' + f1(tx) + '" y="' + f1(ty) + '" font-size="' + f1(21 * scale) + '" font-weight="700" fill="#ffffff" opacity="' + vis.toFixed(3) +
        '" stroke="' + INK + '" stroke-width="4" paint-order="stroke" font-family="' + fontOf(kit) + '">' + name + '</text>'
      if (notes[pin.rank]) out += '<text x="' + f1(tx) + '" y="' + f1(ty + 19 * scale) + '" font-size="' + f1(15 * scale) + '" font-weight="600" fill="' + C.muted +
        '" opacity="' + (clamp((p - 0.7) / 0.3) * vis).toFixed(3) + '" stroke="' + INK + '" stroke-width="3.5" paint-order="stroke" font-family="' + fontOf(kit) + '">' + notes[pin.rank] + '</text>'
    }
  }
  return out
}

export function bean(kit, { x, y, angle = 0, size = 1, opacity = 1 } = {}) {
  return '<g transform="translate(' + f1(x) + ',' + f1(y) + ') rotate(' + f1(angle) + ') scale(' + size + ')" opacity="' + opacity.toFixed(3) + '">' +
    '<ellipse rx="5.2" ry="3.6" fill="' + kit.C.hue.orange + '" stroke="#3a1a06" stroke-width="1"/>' +
    '<path d="M-4.2,0 C-1.5,-1.8 1.5,1.8 4.2,0" fill="none" stroke="#3a1a06" stroke-width="1.1" stroke-linecap="round"/></g>'
}

export function beanPin(kit, { x, y, p = 1, t = 0, vis = 1, size = 1 } = {}) {
  const { C, clamp, pop } = kit
  if (p <= 0 || vis <= 0.02) return ''
  const s = pop(p, 0, 1) * size, ring = ((t % 1.6) + 1.6) % 1.6 / 1.6
  return '<g opacity="' + (clamp(p * 4) * vis).toFixed(3) + '" transform="translate(' + f1(x) + ',' + f1(y) + ')">' +
    '<circle r="' + f1((4 + 20 * ring) * size) + '" fill="none" stroke="' + C.hue.green + '" stroke-width="2" opacity="' + ((1 - ring) * 0.7).toFixed(3) + '"/>' +
    '<circle r="' + f1(3 * size) + '" fill="' + C.hue.green + '"/>' +
    '<g transform="scale(' + s.toFixed(3) + ')">' +
    '<line x1="0" y1="0" x2="0" y2="-15" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>' +
    '<g transform="translate(0,-23) rotate(-28)"><ellipse rx="7" ry="9.5" fill="' + C.hue.orange + '" stroke="#ffffff" stroke-width="1.6"/>' +
    '<path d="M0,-7.5 C3.2,-2.5 -3.2,2.5 0,7.5" fill="none" stroke="#3a1a06" stroke-width="1.6" stroke-linecap="round"/></g>' +
    '</g></g>'
}

// The points of one route in lon/lat (bowing north, lifted off the globe)
function routePts(from, to, n = 56) {
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy) || 1
  let nx = -dy / len, ny = dx / len
  if (ny < 0) { nx = -nx; ny = -ny }
  const bow = len * 0.22, out = []
  for (let i = 0; i <= n; i++) {
    const s = i / n, b = Math.sin(Math.PI * s)
    out.push([from[0] + dx * s + nx * bow * b, from[1] + dy * s + ny * bow * b, 0.16 * b * Math.min(1, len / 70)])
  }
  return out
}

export function tradeRoutes(kit, { view = {}, draw = 1, flow = 0, importers = 1, labels = 1 } = {}) {
  const { C, clamp } = kit
  const { list } = geo()
  let out = ''
  // Importers in cool blue (only the European part of France)
  if (importers > 0) {
    let blue = ''
    for (const cn of list) {
      const eu = EU_SET.has(cn.name)
      if (!eu && !US_SET.has(cn.name)) continue
      const d = countryPath(kit, view, { rings: eu ? cn.rings.filter(r => r.lon > -30) : cn.rings }, clamp(view.globe ?? 0))
      if (d) blue += '<path d="' + d + '"/>'
    }
    out += '<g fill="' + C.hue.blue + '" stroke="' + C.hue.blue + '" stroke-width="0.8" opacity="' + (clamp(importers) * 0.9).toFixed(3) + '">' + blue + '</g>'
  }
  const N = ROUTES.length
  let lines = '', glow = '', beans = '', heads = ''
  ROUTES.forEach((r, i) => {
    const p = clamp(Array.isArray(draw) ? draw[i] || 0 : draw * (1 + 0.5 * (N - 1)) - 0.5 * i)
    if (p <= 0) return
    const src = TOP5.find(q => q.name === r.from).at, pts = routePts(src, DEST[r.to])
    const m = Math.max(1, Math.round(p * (pts.length - 1)))
    const d = line(kit, view, pts.slice(0, m + 1), true)
    glow += '<path d="' + d + '"/>'
    lines += '<path d="' + d + '"/>'
    const proj = pts.map(q => mapAt(kit, view, q[0], q[1], q[2]))
    if (p < 1) {
      const e = proj[m]
      if (e[2] > 0.5) heads += '<circle cx="' + f1(e[0]) + '" cy="' + f1(e[1]) + '" r="5" fill="' + C.hue.orange + '"/>'
    }
    // Beans running along the drawn part
    for (let j = 0; j < 4; j++) {
      const s = ((j / 4 + flow * 0.2 + i * 0.13) % 1 + 1) % 1
      if (s > p) continue
      const fi = s * (pts.length - 1), k0 = Math.min(pts.length - 2, Math.floor(fi)), u = fi - k0
      const a = proj[k0], b = proj[k0 + 1], v = Math.min(a[2], b[2])
      if (v < 0.5) continue
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u
      const fade = clamp(s * 10) * clamp((1 - s) * 10)
      beans += bean(kit, { x, y, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD, size: 1.15, opacity: fade * v })
    }
  })
  out += '<g fill="none" stroke="' + C.hue.orange + '" stroke-linecap="round"><g stroke-width="7" opacity="0.22">' + glow + '</g><g stroke-width="2.6">' + lines + '</g></g>' + heads + beans
  // Destination labels
  if (labels > 0) {
    for (const [key, at] of Object.entries(DEST)) {
      const [x, y, v] = mapAt(kit, view, at[0], at[1])
      if (v < 0.5) continue
      out += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="5" fill="#ffffff" stroke="' + C.hue.blue + '" stroke-width="2.5" opacity="' + (clamp(labels) * v).toFixed(3) + '"/>' +
        '<text x="' + f1(x + 10) + '" y="' + f1(y - 9) + '" font-size="20" font-weight="800" fill="#ffffff" opacity="' + (clamp(labels) * v).toFixed(3) +
        '" stroke="' + INK + '" stroke-width="4" paint-order="stroke" font-family="' + fontOf(kit) + '">' + key + '</text>'
    }
  }
  return out
}
