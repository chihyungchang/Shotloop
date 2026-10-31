// 07-end-card: End card. The zipper from shot 1 zips shut one last time while a patent-style
// title block draws on beside it; the year rolls up to 1917 and lands.
// Shot-local time: t = 0 is this shot's first frame.
import { zipperColumn, zipperGeom, tag } from '../../world/parts.js'

const Z = { x: 215, y: 340, h: 620, id: 'end' }
const B = { x: 400, y: 470, w: 220 }   // the title block
const r1 = n => Math.round(n * 10) / 10
const poly = pts => pts.map((q, i) => (i ? 'L' : 'M') + r1(q[0]) + ',' + r1(q[1])).join('')
const dash = p => p >= 1 ? '' : ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="' + (1 - Math.min(1, Math.max(0, p))).toFixed(4) + '"'

export default function render(t, { window, start }) {
  const kit = window.kit
  const { C, clamp, ease, rise, FONT } = kit
  const font = FONT.replace(/"/g, '')
  const txt = (x, y, s, { size = 15, weight = 600, color = C.muted, anchor = 'start', ls = '0.12em', op = 1, extra = '' } = {}) =>
    '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + size + '" font-weight="' + weight + '" fill="' + color + '" text-anchor="' + anchor +
    '" letter-spacing="' + ls + '" font-family="' + font + '" opacity="' + clamp(op).toFixed(3) + '"' + extra + '>' + s + '</text>'

  // The year rolls up (in the headline and the block alike) and lands
  const roll = ease(clamp((t - 0.3) / 0.7))
  const year = Math.round(kit.lerp(1900, 1917, roll))
  kit.frame({ kicker: 'How a zipper works', head: 'Patented in *' + year + '*', typed: clamp(0.45 + t / 0.3), progress: (start + t) / 32 })

  // The slider races up from halfway, the teeth clicking shut behind it
  const close = 0.5 + 0.5 * ease(clamp(t / 1.3))
  const z = { ...Z, close, trail: 1 - rise(t, 1.6, 0.8), glow: 0.45 * rise(t, 1.1, 0.7) }
  const g = zipperGeom(kit, z), g0 = zipperGeom(kit, { ...Z, close: 0.5 })

  let s = ''
  // Where the open V was, left behind as a dashed trace
  const trace = 0.4 * clamp(t / 0.5)
  for (const side of ['left', 'right']) for (const edge of ['inner', 'outer']) {
    s += '<path d="' + poly(g0.tapes[side][edge]) + '" fill="none" stroke="' + C.muted + '" stroke-width="1.3" stroke-dasharray="7 6" opacity="' + trace.toFixed(3) + '"/>'
  }
  s += zipperColumn(kit, z)
  const tooth = g.teeth.find(q => q.id === 'L9')
  s += tag(kit, tooth.x - 8, tooth.y, 'teeth', { dx: -40, dy: 60, p: clamp((t - 1.4) / 0.6) })

  // Title block: border traced on, then its rows
  const { x, y, w } = B, rows = [y, y + 46, y + 152, y + 300, y + 360]
  const border = clamp((t - 0.05) / 0.75)
  s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (rows[4] - y) + '" fill="#0d1838" fill-opacity="' + (0.85 * clamp(border * 2)).toFixed(3) + '"/>'
  s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (rows[4] - y) + '" fill="none" stroke="' + C.text + '" stroke-width="2.4"' + dash(border) + '/>'
  s += '<rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="' + (w - 12) + '" height="' + (rows[4] - y - 12) + '" fill="none" stroke="' + C.text + '" stroke-opacity="0.35" stroke-width="1"' + dash(border * 1.2 - 0.2) + '/>'
  for (let i = 1; i < 4; i++) {
    const pr = clamp((t - 0.35 - i * 0.12) / 0.35)
    s += '<path d="M' + x + ',' + rows[i] + 'L' + (x + w) + ',' + rows[i] + '" stroke="' + C.text + '" stroke-width="1.6"' + dash(pr) + '/>'
  }
  const midX = x + w / 2
  s += '<path d="M' + midX + ',' + rows[3] + 'L' + midX + ',' + rows[4] + '" stroke="' + C.text + '" stroke-width="1.6"' + dash(clamp((t - 0.8) / 0.3)) + '/>'

  // Row texts, each sliding up a little as it appears
  const inA = (a, d = 0.35) => rise(t, a, d)
  const up = a => (1 - inA(a)) * 10
  s += txt(x + 16, rows[0] + 30 + up(0.45), 'U.S. PATENT', { op: inA(0.45) })
  s += txt(x + 16, rows[1] + 40 + up(0.6), 'SEPARABLE', { size: 27, weight: 800, color: C.text, ls: '0.03em', op: inA(0.6) })
  s += txt(x + 16, rows[1] + 78 + up(0.7), 'FASTENER', { size: 27, weight: 800, color: C.text, ls: '0.03em', op: inA(0.7) })
  s += txt(x + 16, rows[2] + 30 + up(0.25), 'YEAR', { op: inA(0.25) })
  // The year lands with a bounce
  const land = Math.sin(Math.PI * clamp((t - 0.95) / 0.35)) * (t > 0.95 ? 1 : 0)
  const sc = 1 + 0.12 * land
  const yx = midX, yy = rows[2] + 108
  s += '<g transform="translate(' + yx + ',' + yy + ') scale(' + sc.toFixed(3) + ')">' +
    txt(0, 0, String(year), { size: 70, weight: 800, color: C.accent, anchor: 'middle', ls: '0', op: inA(0.25) }) + '</g>'
  s += '<path d="M' + (x + 24) + ',' + (rows[2] + 124) + 'L' + (x + w - 24) + ',' + (rows[2] + 124) + '" stroke="' + C.accent + '" stroke-width="2" stroke-linecap="round"' + dash(clamp((t - 1.05) / 0.4)) + '/>'
  s += txt(x + 14, rows[3] + 36, 'FIG. A', { op: inA(0.95), size: 14 })
  // The check mark draws on once the zipper is shut
  s += '<path d="M' + (midX + 40) + ',' + (rows[3] + 30) + 'l9,10l18,-22" fill="none" stroke="' + C.hue.teal + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"' + dash(clamp((t - 1.7) / 0.35)) + '/>'

  // Leader from the block to the drawing it names
  const lp = clamp((t - 1.3) / 0.5)
  if (lp > 0) {
    const ay = rows[3] + 30, ax = x - 4, bx = g.cx + g.ti + g.tw + 2
    s += '<path d="M' + ax + ',' + ay + 'L' + r1(bx) + ',' + ay + '" fill="none" stroke="' + C.muted + '" stroke-width="1.4" stroke-dasharray="5 5"' + dash(lp) + '/>'
    s += '<circle cx="' + r1(bx) + '" cy="' + ay + '" r="4" fill="' + C.muted + '" opacity="' + clamp(lp * 3 - 2).toFixed(3) + '"/>'
  }

  // The PATENTED stamp comes down under the block and lands
  const st = clamp((t - 2.05) / 0.3)
  if (st > 0) {
    const ss = 1 + 0.5 * (1 - ease(st)) + 0.05 * Math.sin(Math.PI * clamp((t - 2.35) / 0.25))
    s += '<g transform="translate(' + (x + w / 2) + ',' + (rows[4] + 62) + ') rotate(-8) scale(' + ss.toFixed(3) + ')" opacity="' + (0.9 * st).toFixed(3) + '">' +
      '<rect x="-96" y="-28" width="192" height="56" rx="8" fill="none" stroke="' + C.hue.teal + '" stroke-width="3"/>' +
      '<rect x="-89" y="-21" width="178" height="42" rx="5" fill="none" stroke="' + C.hue.teal + '" stroke-width="1.2"/>' +
      txt(0, 9, 'PATENTED', { size: 26, weight: 800, color: C.hue.teal, anchor: 'middle', ls: '0.14em' }) + '</g>'
  }

  // Source, small under the picture
  s += txt(40, 1012, 'Source: US Patent 1,219,881 (1917)', { size: 15, weight: 500, ls: '0.02em', op: rise(t, 0.6, 0.5) })

  kit.stage(s)
}
