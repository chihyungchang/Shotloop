// 06-past: a big sunlit Earth, a small far Sun, rays arriving. The
// payoff: the light on your face left the Sun about 8 minutes ago.

export default function render(t, { window, duration }) {
  const { space, sun, planet, beam, rise, ease, block, setUI } = window.kit
  const push = ease.inOut(t / duration)
  const sx = 96
  const sy = 560
  const ex = 560
  const ey = 900
  const er = 240 + 14 * push

  space(t, { drift: 200 + t * 8 })
  sun(t, sx, sy, 30, { glow: 0.9, streak: 0.8 })
  const light = Math.atan2(sy - ey, sx - ex)
  // Rays to points on the lit limb, pulses arriving in turn
  for (let i = 0; i < 5; i++) {
    const a = light + (i - 2) * 0.32
    const tx = ex + Math.cos(a) * er
    const ty = ey + Math.sin(a) * er
    beam(sx, sy, tx, ty, ((t * 0.45 + i * 0.21) % 1) * 1.2, { tail: 0.45, width: 2, guide: 0.1, head: 0.7 })
  }
  planet(t, ex, ey, er, { light, spin: t * 0.04 })

  setUI(
    block({ y: 150, p: rise(t, 0.05), cls: 'sub', style: 'font-size:34px;color:var(--text)', html: '照在你脸上的这束阳光' }) +
      block({ y: 208, p: rise(t, 0.3, 0.8), dy: 40, html:
        `<span class="num gold" style="font-size:150px;line-height:1">8</span><span class="head gold" style="font-size:96px;margin-left:12px">分钟前</span>` }) +
      block({ y: 380, p: rise(t, 0.8), cls: 'head m', html: '就已离开太阳' })
  )
}
