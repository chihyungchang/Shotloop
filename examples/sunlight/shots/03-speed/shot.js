// 03-speed: golden streaks race across the frame; a light point laps a
// small Earth; the speed counts up to 299,792 km/s.

const C_KMS = 299792.458

export default function render(t, { window }) {
  const { c, W, space, planet, glow, radial, rise, ease, prng, fmt, block, setUI } = window.kit

  space(t, { drift: 60 + t * 40 })

  // Streaks: same seed every frame, positions are a function of t
  const q = prng(299792)
  const on = rise(t, 0, 0.6)
  c.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 46; i++) {
    const y = 380 + q() * 380
    const len = 90 + q() * 260
    const speed = 1300 + q() * 2200
    const span = W + len + 200
    const x = ((q() * span + t * speed) % span) - len
    const a = (0.12 + q() * 0.4) * on
    const g = c.createLinearGradient(x, 0, x + len, 0)
    g.addColorStop(0, 'rgba(255, 180, 70, 0)')
    g.addColorStop(1, `rgba(255, 228, 160, ${a})`)
    c.strokeStyle = g
    c.lineWidth = 1 + q() * 2
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x + len, y)
    c.stroke()
  }
  c.globalCompositeOperation = 'source-over'

  // Earth with a light point lapping its equator (slowed so it reads)
  const ex = 360
  const ey = 610
  planet(t, ex, ey, 66, { light: Math.PI * 1.15, spin: t * 0.15 })
  const ang = t * 4.2 - 1.2
  const rx = 132
  const ry = 34
  c.globalCompositeOperation = 'lighter'
  for (let k = 0; k < 40; k++) {
    const a = ang - k * 0.06
    const px = ex + Math.cos(a) * rx
    const py = ey + Math.sin(a) * ry
    // Hide the part of the trail behind the planet
    if (Math.sin(a) < 0 && Math.abs(px - ex) < 64) continue
    const al = (1 - k / 40) * 0.8 * on
    c.fillStyle = radial(px, py, 0, 6, [[0, `rgba(255, 230, 160, ${al})`], [1, 'rgba(255, 190, 80, 0)']])
    c.fillRect(px - 6, py - 6, 12, 12)
  }
  c.globalCompositeOperation = 'source-over'
  const hx = ex + Math.cos(ang) * rx
  const hy = ey + Math.sin(ang) * ry
  if (!(Math.sin(ang) < 0 && Math.abs(hx - ex) < 64)) glow(hx, hy, 26, '255, 236, 190', 0.95 * on)

  const v = C_KMS * ease.out((t - 0.4) / 1.8)

  setUI(
    block({ y: 150, p: rise(t, 0.05), cls: 'kicker', html: '第二步 · 速度' }) +
      block({ y: 196, p: rise(t, 0.15, 0.7), cls: 'head m', html: '光在真空中，<br>每秒能跑' }) +
      block({ y: 770, p: rise(t, 0.4), html:
        `<span class="num" style="font-size:120px;line-height:1">${fmt(Math.floor(v))}</span>` }) +
      block({ y: 900, p: rise(t, 0.6), cls: 'unit gold', html: '公里 / 秒' }) +
      block({ y: 966, p: rise(t, 2.0), cls: 'sub', html: '相当于 1 秒绕地球赤道约 <span style="color:var(--text)">7.5 圈</span>' })
  )
}
