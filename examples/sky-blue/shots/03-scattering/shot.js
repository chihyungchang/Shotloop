// 03-scattering: two lanes, one air molecule each. A blue wave (450 nm)
// hits its molecule and throws strong ripples in every direction; a red
// wave (700 nm) mostly passes through, its ripples faint.
// Shot-local time: t = 0 is this shot's first frame.

const MX = 316
const LANES = [
  { y: 624, len: 30, color: '#2a74e8', name: '蓝光 · 450 nm', ring: 0.85, pass: 0.4, verdict: '散射 强' },
  { y: 884, len: 47, color: '#ef4a3c', name: '红光 · 700 nm', ring: 0.16, pass: 0.95, verdict: '散射 弱' }
]

const molecule = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <circle r="46" fill="#fff" opacity="0.7" filter="url(#soft)" />
  <circle cx="-11" r="19" fill="#0c2340" /><circle cx="11" r="19" fill="#1d4f91" />
  <circle cx="-16" cy="-7" r="5" fill="#fff" opacity="0.35" />
  <text y="5" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="13" font-weight="700" fill="#fff">N₂</text></g>`

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C, lerp } = kit
  kit.sky('#e4f0fd', '#f3f8ff', '#fbfdff')
  kit.chapters(2, 7, t / duration)
  kit.head(t, {
    kicker: '02 · 空气',
    lines: ['空气分子', '更爱散射<b>蓝光</b>'],
    sub: '分子比光的波长小上千倍；<br />波长越短，被弹向四方的越多。'
  })

  const front = lerp(36, 640, kit.glide(t, 0.5, 2.6))
  const hit = lerp(0.5, 3.1, (MX - 36) / (640 - 36)) // when the front reaches the molecule (approx.)
  const phase = t * 90

  const lanes = LANES.map((L, i) => {
    const a = kit.rise(t, 0.35 + i * 0.15, 0.5)
    const inEnd = Math.min(front, MX - 30)
    const incoming = front > 40 ? `<path d="${kit.wave(36, L.y, inEnd, L.y, { len: L.len, amp: 13, phase })}" fill="none" stroke="${L.color}" stroke-width="4" stroke-linecap="round" />` : ''
    const onward = front > MX + 30 ? `<path d="${kit.wave(MX + 30, L.y, front, L.y, { len: L.len, amp: 13 * L.pass, phase })}" fill="none" stroke="${L.color}" stroke-width="3" stroke-linecap="round" opacity="${L.pass}" />` : ''
    // Ripples: a new ring every 0.32 s once the wave arrives, fading as it grows
    let rings = ''
    for (let k = 0; k < 10; k++) {
      const age = t - hit - k * 0.32
      if (age <= 0) continue
      const r = 34 + age * 70
      if (r > 124) continue
      const o = L.ring * (1 - (r - 34) / 90)
      rings += `<circle cx="${MX}" cy="${L.y}" r="${r}" fill="none" stroke="${L.color}" stroke-width="${i ? 2 : 3}" opacity="${o}" stroke-dasharray="${i ? '3 7' : 'none'}" />`
    }
    // Short arrows thrown off the molecule, in every direction
    const spray = kit.rise(t, hit + 0.2, 0.8)
    const arrows = Array.from({ length: 8 }, (_, j) => {
      const ang = (j / 8) * Math.PI * 2 + 0.4
      const r0 = 44, r1 = 44 + 50 * spray
      return `<line x1="${MX + Math.cos(ang) * r0}" y1="${L.y + Math.sin(ang) * r0}" x2="${MX + Math.cos(ang) * r1}" y2="${L.y + Math.sin(ang) * r1}"
        stroke="${L.color}" stroke-width="${i ? 2 : 4}" stroke-linecap="round" opacity="${(i ? 0.25 : 0.9) * spray}" />`
    }).join('')
    const verdict = kit.rise(t, hit + 0.9 + i * 0.2, 0.5)
    return `<g opacity="${a}">
      <line x1="36" y1="${L.y}" x2="620" y2="${L.y}" stroke="${C.ink}" stroke-opacity="0.07" stroke-width="1" />
      ${rings}${arrows}${incoming}${onward}
      ${molecule(MX, L.y, kit.pop(t, 0.2 + i * 0.15, 0.6))}
      ${kit.label(56, L.y - 54, L.name, { color: L.color, chip: true })}
      ${kit.label(608, L.y - 54, L.verdict, { color: L.color, anchor: 'end', a: verdict, size: 18, weight: 700 })}
    </g>`
  }).join('')

  kit.art(lanes)
}
