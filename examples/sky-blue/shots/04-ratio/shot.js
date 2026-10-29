// 04-ratio: how much more. Scattering goes as 1/λ⁴, so blue (450 nm)
// against red (700 nm) is (700/450)⁴ ≈ 5.86. Two bars on a 1×–6× scale:
// red stops at 1×, blue climbs past it with a counter riding its top.
// Shot-local time: t = 0 is this shot's first frame.

const BASE = 960, UNIT = 66 // px per 1×
const RATIO = Math.pow(700 / 450, 4) // 5.857…
const BARS = [
  { x: 196, color: '#2a74e8', light: '#7db6ff', nm: '450 nm', name: '蓝', value: RATIO },
  { x: 330, color: '#ef4a3c', light: '#ff9a8a', nm: '700 nm', name: '红', value: 1 }
]
const W = 96

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C } = kit
  kit.sky('#e4f0fd', '#f3f8ff', '#fbfdff')
  kit.chapters(3, 7, t / duration)
  kit.head(t, {
    kicker: '03 · 差多少',
    lines: ['蓝光被散射的', '是红光的 <b>5.9</b> 倍'],
    sub: '散射强度与波长的四次方成反比。'
  })

  const grid = kit.rise(t, 0.3, 0.6)
  const red = kit.glide(t, 0.6, 0.6)
  const blue = kit.glide(t, 0.9, 1.9)
  const formula = kit.rise(t, 1.9, 0.6)

  let ticks = ''
  for (let k = 1; k <= 6; k++) {
    const y = BASE - k * UNIT
    ticks += `<line x1="104" y1="${y}" x2="610" y2="${y}" stroke="${C.ink}" stroke-opacity="${0.07 * grid}" stroke-dasharray="4 6" />
      ${kit.label(92, y + 5, `${k}×`, { color: C.faint, anchor: 'end', a: grid, size: 14 })}`
  }

  const bars = BARS.map((b, i) => {
    const grow = i === 0 ? blue : red
    const v = 1e-3 + (b.value - 1e-3) * grow
    const h = v * UNIT, y = BASE - h, r = Math.min(16, h / 2)
    const count = i === 0 ? 1 + (RATIO - 1) * blue : 1
    return `<g opacity="${red}">
      <defs><linearGradient id="bar${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.light}" /><stop offset="1" stop-color="${b.color}" /></linearGradient></defs>
      <path d="M${b.x},${BASE} V${y + r} Q${b.x},${y} ${b.x + r},${y} H${b.x + W - r} Q${b.x + W},${y} ${b.x + W},${y + r} V${BASE} Z" fill="url(#bar${i})" />
      <text x="${b.x + W / 2}" y="${y - 18}" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="${i ? 22 : 34}" font-weight="700"
        fill="${b.color}">×${count.toFixed(i ? 0 : 2)}</text>
      ${kit.label(b.x + W / 2, BASE + 34, b.nm, { color: b.color, anchor: 'middle', size: 16 })}
    </g>`
  }).join('')

  kit.art(`
    ${ticks}
    <line x1="104" y1="${BASE}" x2="610" y2="${BASE}" stroke="${C.ink}" stroke-opacity="${0.35 * grid}" stroke-width="2" />
    ${bars}
    <g opacity="${formula}" transform="translate(${(1 - formula) * 16} 0)">
      <rect x="434" y="618" width="176" height="190" rx="22" fill="#fff" filter="url(#shadow)" />
      <text x="522" y="674" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="26" font-weight="700" fill="${C.ink}">I ∝ <tspan fill="${C.blue}">1/λ⁴</tspan></text>
      <line x1="458" y1="702" x2="586" y2="702" stroke="${C.ink}" stroke-opacity="0.1" />
      <text x="522" y="740" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="17" font-weight="600" fill="${C.muted}">(700/450)⁴</text>
      <text x="522" y="780" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="24" font-weight="700" fill="${C.blue}">≈ 5.86</text>
    </g>
  `)
}
