// 05-whole-sky: why the whole sky glows. Sunlight crosses a dome of air;
// at point after point a molecule lights up and sends blue light down to
// the person standing under it, until blue arrives from every direction.
// Shot-local time: t = 0 is this shot's first frame.

const GROUND = 968, CX = 330, RX = 290, RY = 420
const EYE = [CX, GROUND - 46]
const SUN = [64, 600]
const A = 0.42 // sunlight angle, radians below horizontal
const D = [Math.cos(A), Math.sin(A)], N = [-Math.sin(A), Math.cos(A)]
const inDome = (x, y) => ((x - CX) / RX) ** 2 + ((y - GROUND) / RY) ** 2 < 0.82 && y < GROUND - 110

// Rays from the sun, and scattering points along them inside the dome
const RAYS = [-40, 50, 140, 230].map(o => [SUN[0] + N[0] * o, SUN[1] + N[1] * o])
const POINTS = RAYS.flatMap(([x, y], r) =>
  [150, 230, 310, 390, 470, 550].map(s => [x + D[0] * (s + r * 23), y + D[1] * (s + r * 23)]).filter(([px, py]) => inDome(px, py))
).map((p, i, all) => [...p, (i * 7) % all.length]) // a shuffled lighting order

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C } = kit
  kit.sky('#e4f0fd', '#f2f8ff', '#fbfdff')
  kit.chapters(4, 7, t / duration)
  kit.head(t, {
    kicker: '04 · 整片天空',
    lines: ['所以蓝光', '从<b>四面八方</b>来'],
    sub: '每一小块天空都把蓝光散向你，<br />于是整片天都是蓝的。'
  })

  const dome = kit.glide(t, 0.1, 0.8)
  const rays = kit.glide(t, 0.4, 0.9)
  const n = POINTS.length
  const lit = POINTS.map(([, , k]) => kit.rise(t, 0.9 + (k / n) * 1.8, 0.35))
  const fill = lit.reduce((a, b) => a + b, 0) / n

  const sunRays = RAYS.map(([x, y]) => {
    const L = 640 * rays
    return `<line x1="${x}" y1="${y}" x2="${x + D[0] * L}" y2="${y + D[1] * L}" stroke="#ffc94a" stroke-width="2.5" stroke-linecap="round" opacity="0.75" clip-path="url(#dome)" />`
  }).join('')

  const scatter = POINTS.map(([x, y], i) => {
    const p = lit[i]
    if (p <= 0) return ''
    const go = kit.glide(t, 0.9 + (POINTS[i][2] / n) * 1.8 + 0.1, 0.7)
    const ex = kit.lerp(x, EYE[0], go), ey = kit.lerp(y, EYE[1], go)
    return `<line x1="${x}" y1="${y}" x2="${ex}" y2="${ey}" stroke="${C.blue}" stroke-width="2" stroke-linecap="round" opacity="${0.55 * p}" />
      <circle cx="${x}" cy="${y}" r="${18 * p}" fill="${C.sky}" opacity="${0.25 * p}" />
      <circle cx="${x}" cy="${y}" r="${5.5 * p}" fill="${C.blue}" />`
  }).join('')

  const domePath = `M${CX - RX},${GROUND} A${RX},${RY} 0 0 1 ${CX + RX},${GROUND} Z`
  const eyeGlow = kit.rise(t, 2.6, 0.8)

  kit.art(`
    <defs>
      <clipPath id="dome"><path d="${domePath}" /></clipPath>
      <linearGradient id="air" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8ff0" /><stop offset="1" stop-color="#bfdcfb" /></linearGradient>
    </defs>
    <rect x="0" y="${GROUND}" width="720" height="${1280 - GROUND}" fill="#dbe8f5" />
    <rect x="0" y="${GROUND}" width="720" height="3" fill="${C.ink}" opacity="0.12" />
    <path d="${domePath}" fill="url(#air)" opacity="${0.08 + 0.42 * fill}" />
    <path d="${domePath}" fill="none" stroke="${C.blue}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="${1400 * dome} 1400" />
    ${kit.sun(SUN[0], SUN[1], 30, kit.rise(t, 0, 0.6))}
    ${sunRays}
    ${scatter}
    <circle cx="${EYE[0]}" cy="${EYE[1]}" r="${30 + 10 * eyeGlow}" fill="${C.sky}" opacity="${0.3 * eyeGlow}" />
    <g transform="translate(${CX} ${GROUND})">
      <rect x="-13" y="-34" width="26" height="34" rx="11" fill="${C.ink}" />
      <circle cx="0" cy="-48" r="12" fill="${C.ink}" />
    </g>
    ${kit.label(CX, GROUND + 34, '你', { chip: true, size: 17, anchor: 'middle', a: kit.rise(t, 0.6, 0.5) })}
    ${kit.label(612, 716, '大气层', { color: C.blue, anchor: 'end', a: dome, size: 15 })}
  `)
}
