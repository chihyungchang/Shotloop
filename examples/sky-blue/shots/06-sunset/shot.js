// 06-sunset: the same physics, read the other way. The sun sinks from
// overhead to the horizon; its light now crosses far more air (air mass
// 1 → 38), blue peels off along the way and what reaches you is orange.
// The atmosphere is drawn much thicker than it is.
// Shot-local time: t = 0 is this shot's first frame.

const EARTH = [330, 1800], RE = 980, RA = 1140 // Earth and the top of its air
const O = [330, EARTH[1] - RE] // the person, at the top of the Earth
const ORBIT = 270 // how far from the person the sun is drawn

// Kasten & Young (1989) relative air mass at zenith angle z (degrees)
const airMass = z => 1 / (Math.cos((z * Math.PI) / 180) + 0.50572 * Math.pow(96.07995 - z, -1.6364))

// Distance from the person to the top of the air along direction u
function pathIn(u) {
  const [px, py] = [O[0] - EARTH[0], O[1] - EARTH[1]]
  const b = px * u[0] + py * u[1], c = px * px + py * py - RA * RA
  return -b + Math.sqrt(b * b - c)
}

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C, mix, lerp } = kit
  const sink = kit.glide(t, 1.0, 2.4)
  const z = 90 * sink // zenith angle, degrees
  const warm = kit.ease.inOut(kit.clamp((z - 30) / 60))

  kit.sky(mix('#e4f0fd', '#ffe2c6', warm), mix('#f2f8ff', '#ffd2ad', warm), mix('#fbfdff', '#ffc497', warm))
  kit.chapters(5, 7, t / duration)
  kit.head(t, {
    kicker: '05 · 日落',
    lines: ['日落时，光要穿过', '<b>厚得多的空气</b>'],
    sub: '蓝光在半路就被散射掉了，<br />剩下橙和红照进你的眼睛。',
    accent: '#ea6a2a'
  })

  const enter = kit.glide(t, 0, 0.8)
  const lift = (1 - enter) * 120
  const u = [-Math.sin((z * Math.PI) / 180), -Math.cos((z * Math.PI) / 180)] // person → sun
  const S = [O[0] + u[0] * ORBIT, O[1] + u[1] * ORBIT]
  const L = pathIn(u), L0 = RA - RE
  const thick = kit.clamp((L - L0) / (pathIn([-1, 0]) - L0))
  const beamOn = kit.rise(t, 0.4, 0.5)
  const beamColor = mix('#fff1b8', '#ff6a2b', Math.pow(thick, 0.7))
  const sunCore = mix('#ffd36b', '#ff8a3d', warm)

  // Blue light peeling off the beam: more of it the longer the path
  const n = [-u[1], u[0]]
  let peel = ''
  for (let k = 0; k < 16; k++) {
    const f = (k + 0.5) / 16
    const along = Math.min(ORBIT, L) * f // only inside the air
    const off = 8 + 46 * ((t * 0.7 + k * 0.37) % 1)
    const side = k % 2 ? 1 : -1
    const a = (1 - (off - 8) / 46) * beamOn * (0.25 + 0.75 * thick)
    const x = O[0] + u[0] * along + n[0] * off * side, y = O[1] + u[1] * along + n[1] * off * side
    peel += `<circle cx="${x}" cy="${y}" r="4.5" fill="${C.blue}" opacity="${a}" />`
  }

  const mass = airMass(Math.min(z, 90))
  const tag = kit.rise(t, 0.7, 0.5)

  kit.art(`
    <defs>
      <radialGradient id="air6" cx="${EARTH[0]}" cy="${EARTH[1]}" r="${RA}" gradientUnits="userSpaceOnUse">
        <stop offset="${RE / RA}" stop-color="${mix('#9cc8f6', '#ffb37a', warm)}" />
        <stop offset="1" stop-color="${mix('#d8eafd', '#ffe0c4', warm)}" />
      </radialGradient>
      <linearGradient id="ground6" x1="0" y1="${O[1]}" x2="0" y2="1280" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${mix('#2f64ad', '#5a3a6e', warm)}" /><stop offset="0.5" stop-color="${mix('#1d4f91', '#3a2a5a', warm)}" />
        <stop offset="1" stop-color="${mix('#123766', '#2a1f45', warm)}" />
      </linearGradient>
    </defs>
    <g transform="translate(0 ${lift})">
      <circle cx="${EARTH[0]}" cy="${EARTH[1]}" r="${RA}" fill="url(#air6)" />
      <circle cx="${EARTH[0]}" cy="${EARTH[1]}" r="${RA}" fill="none" stroke="${C.ink}" stroke-opacity="0.12" stroke-dasharray="3 7" stroke-width="2" />
      ${peel}
      <line x1="${S[0]}" y1="${S[1]}" x2="${O[0]}" y2="${O[1] - 30}" stroke="${beamColor}" stroke-width="7" stroke-linecap="round" opacity="${beamOn}" />
      ${kit.sun(S[0], S[1], 28, kit.rise(t, 0.1, 0.6), sunCore)}
      <circle cx="${EARTH[0]}" cy="${EARTH[1]}" r="${RE}" fill="url(#ground6)" />
      <circle cx="${EARTH[0]}" cy="${EARTH[1]}" r="${RE - 1.5}" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="3" />
      <g transform="translate(${O[0]} ${O[1]})">
        <rect x="-11" y="-30" width="22" height="30" rx="10" fill="${C.ink}" />
        <circle cx="0" cy="-42" r="10.5" fill="${C.ink}" />
      </g>
    ${kit.label(458, 520, '光穿过的空气', { color: C.muted, size: 15, a: tag })}
    <text x="458" y="574" font-family="SF Mono, Menlo, monospace" font-size="42" font-weight="700" fill="${mix('#2a74e8', '#ea6a2a', warm)}" opacity="${tag}">×${mass < 10 ? mass.toFixed(1) : Math.round(mass)}</text>
    ${kit.label(458, 612, z < 25 ? '正午' : z < 75 ? '下午' : '日落', { color: C.ink, size: 15, chip: true, a: tag })}
    </g>
  `)
}
