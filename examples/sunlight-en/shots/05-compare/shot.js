// 05-compare: three journeys of light on three cards. Moon → Earth,
// Sun → Earth (highlighted), Sun → Neptune.

const ROWS = [
  { icon: 'moon', route: 'Moon → Earth', time: '<span class="num">1.3</span> s' },
  { icon: 'sun', route: 'Sun → Earth', time: '<span class="num">8</span> min <span class="num">19</span> s', hot: true },
  { icon: 'neptune', route: 'Sun → Neptune', time: 'about <span class="num">4</span> h <span class="num">10</span> min' }
]

export default function render(t, { window, voice = [] }) {
  const { c, space, sun, planet, rise, block, setUI } = window.kit

  space(t, { drift: 140 + t * 5 })
  // Timed to the line: Moon with the first sentence, Sun → Earth between,
  // Neptune as the second sentence names it
  const s1 = voice[0] ?? { at: 0.4, end: 1.6 }
  const s2 = voice[1] ?? { at: 1.6, end: 3.6 }
  const ats = [Math.min(0.5, s1.at + 0.3), Math.max(1.1, s1.end - 0.6), s2.at + 0.3]

  let html =
    block({ y: 150, p: rise(t, 0.05), cls: 'kicker', html: 'COMPARE' }) +
    block({ y: 196, p: rise(t, 0.15, 0.7), cls: 'head m', html: 'How long does light<br>take on each trip?' })

  ROWS.forEach((r, i) => {
    // Cards end above the subtitle band (y 870–1011)
    const y = 350 + i * 158
    const p = rise(t, ats[i], 0.7)
    const dy = (1 - p) * 26
    const cy = y + 68 + dy
    c.globalAlpha = p
    if (r.icon === 'sun') sun(t, 124, cy, 26, { glow: 0.45, streak: 0 })
    else planet(t, 124, cy, r.icon === 'moon' ? 22 : 26, { kind: r.icon, light: Math.PI })
    c.globalAlpha = 1
    const card = r.hot
      ? 'background:linear-gradient(90deg,rgba(255,200,97,0.14),rgba(255,200,97,0.03));border:1px solid rgba(255,200,97,0.45);'
      : 'background:rgba(12,20,44,0.55);border:1px solid rgba(154,166,194,0.18);'
    html += block({ y, h: 136, p, style: `height:136px;border-radius:24px;${card}`, html: '' })
    html += block({ x: 196, y: y + 24, w: 400, p, cls: 'sub', style: 'font-size:24px;line-height:1.2', html: r.route })
    html += block({ x: 196, y: y + 60, w: 420, p, cls: 'unit' + (r.hot ? ' gold' : ''), style: 'font-size:46px', html: r.time })
  })

  html += block({ y: 826, p: rise(t, Math.max(2.4, s2.end - 1.2)), cls: 'sub', style: 'font-size:24px',
    html: 'Neptune is about <span class="num" style="color:var(--text)">30</span> AU from the Sun' })
  setUI(html)
}
