// 02-distance: Sun at the left edge, Earth a blue speck, a ruler drawn
// between them; the distance counts up to 149.6 million km = 1 AU.

const AU_KM = 149597870.7

export default function render(t, { window }) {
  const { c, space, sun, planet, glow, rise, ease, lerp, block, setUI } = window.kit
  const y = 600
  const x0 = 150
  const x1 = 596

  space(t, { drift: 30 + t * 6 })
  sun(t, -30, y, 180, { streak: 0.6 })
  planet(t, x1, y, 16, { light: Math.PI })
  glow(x1, y, 40, '120, 180, 255', 0.25)

  // The ruler: drawn left to right, ticks at both ends
  const draw = ease.inOut((t - 0.5) / 1.4)
  const ry = y + 88
  c.strokeStyle = 'rgba(255, 200, 97, 0.85)'
  c.lineWidth = 2
  c.beginPath()
  c.moveTo(x0, ry)
  c.lineTo(lerp(x0, x1, draw), ry)
  c.stroke()
  c.globalAlpha = rise(t, 0.4, 0.3)
  c.beginPath()
  c.moveTo(x0, ry - 12)
  c.lineTo(x0, ry + 12)
  c.stroke()
  c.globalAlpha = rise(t, 1.8, 0.3)
  c.beginPath()
  c.moveTo(x1, ry - 12)
  c.lineTo(x1, ry + 12)
  c.stroke()
  c.globalAlpha = 1
  // Faint guides from the bodies down to the ruler
  c.strokeStyle = 'rgba(255, 200, 97, 0.25)'
  c.lineWidth = 1
  c.setLineDash([3, 6])
  c.beginPath()
  c.moveTo(x1, y + 26)
  c.lineTo(x1, ry - 14)
  c.stroke()
  c.setLineDash([])

  const km = AU_KM * ease.out((t - 0.6) / 1.8)
  const mkm = (km / 1e6).toFixed(1)

  setUI(
    block({ y: 150, p: rise(t, 0.05), cls: 'kicker', html: 'STEP 1 · DISTANCE' }) +
      block({ y: 196, p: rise(t, 0.15, 0.7), cls: 'head m', html: 'The mean distance<br>from the Sun to Earth' }) +
      block({ x: x1 - 60, y: ry + 22, w: 120, p: rise(t, 1.8), cls: 'sub', style: 'font-size:22px;text-align:center', html: 'Earth' }) +
      block({ y: 790, p: rise(t, 0.6), style: 'white-space:nowrap', html:
        `<span class="num gold" style="font-size:120px;line-height:1">${mkm}</span><span class="unit" style="margin-left:14px;font-size:36px">million km</span>` }) +
      block({ y: 940, p: rise(t, 2.4), cls: 'chip', w: 'auto', style: 'font-size:26px;color:var(--text)',
        html: '= 1 astronomical unit <span class="num gold" style="font-size:24px">AU</span>' })
  )
}
