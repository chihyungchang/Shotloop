// 03-the-biggest-ever: The biggest ever.
// The record crypto thefts as a bar race: Poly Network and Ronin grow in
// gray, Bybit shoots past both in red as the voice says "biggest", and a
// NEW RECORD stamp lands with an alarm flash on "record".
// Shot-local time: t = 0 is this shot's first frame.
import { sourceLine, when, FILM } from '../../world/parts.js'

const THEFTS = [
  { name: 'Poly Network', year: '2021', m: 611 },
  { name: 'Ronin', year: '2022', m: 625 },
  { name: 'Bybit', year: '2025', m: 1460 }
]
const BASE = 780, TALL = 420, BW = 160, GAP = 50, X0 = 360 - (3 * BW + 2 * GAP) / 2

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { C, rise, ease, clamp, HEAD_FONT, FONT } = kit
  const BIGGEST = when(voice, 'biggest', 1.2)
  const RECORD = when(voice, 'old record', 3.2) + 0.3
  kit.frame({ head: 'Biggest *ever*', typed: rise(t, BIGGEST, 0.35), progress: (start + t) / FILM })

  let out = ''
  THEFTS.forEach((f, i) => {
    const last = i === THEFTS.length - 1
    const g = last ? ease(clamp((t - BIGGEST) / 1.1)) : ease(clamp((t - 0.2 - i * 0.3) / 0.7))
    const h = (f.m / 1460) * TALL * g, x = X0 + i * (BW + GAP), color = last ? C.hue.red : C.hue.gray
    const value = last ? '$' + (1.46 * g).toFixed(2) + 'B' : '$' + Math.round(f.m * g) + 'M'
    out += '<rect x="' + x + '" y="' + (BASE - h) + '" width="' + BW + '" height="' + h + '" rx="10" fill="' + color + '" opacity="' + (last ? 1 : 0.75) + '"/>' +
      (g > 0 ? '<text x="' + (x + BW / 2) + '" y="' + (BASE - h - 16) + '" text-anchor="middle" font-family="' + HEAD_FONT + '" font-size="' + (last ? 44 : 32) +
        '" font-weight="800" fill="' + (last ? C.hue.red : C.text) + '" style="font-variant-numeric: tabular-nums">' + value + '</text>' : '') +
      '<text x="' + (x + BW / 2) + '" y="' + (BASE + 34) + '" text-anchor="middle" font-family="' + FONT + '" font-size="21" font-weight="700" fill="' + C.text + '">' + f.name + '</text>' +
      '<text x="' + (x + BW / 2) + '" y="' + (BASE + 58) + '" text-anchor="middle" font-family="' + FONT + '" font-size="17" fill="' + C.muted + '">' + f.year + '</text>'
  })
  // the old record's line, which Bybit's bar breaks through
  const recY = BASE - (625 / 1460) * TALL
  const line = '<line x1="40" y1="' + recY + '" x2="680" y2="' + recY + '" stroke="' + C.text + '" stroke-opacity=".4" stroke-width="2" stroke-dasharray="8 8"/>'

  kit.stage('<g opacity="' + rise(t, BIGGEST, 0.4) + '">' + line + '</g>' + '<line x1="40" y1="' + BASE + '" x2="680" y2="' + BASE + '" stroke="' + C.line + '" stroke-width="3"/>' + out +
    sourceLine(kit, 'Elliptic, 21 Feb 2025 · values as reported at the time · 1.46 ÷ 0.625 ≈ 2.3') +
    kit.alarm(t, RECORD, { d: 0.5 }))
  const [dx, dy] = kit.shake(t, RECORD, { amp: 8 })
  kit.stamp('NEW RECORD', rise(t, RECORD, 0.25), { x: 110 + dx, y: 400 + dy, size: 40, color: C.hue.yellow, rotate: -8 })
}
