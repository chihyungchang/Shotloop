// 01-hook: the Sun blazing in deep space, and the question.
// Shot-local time: t = 0 is this shot's first frame.

export default function render(t, { window, duration }) {
  const { space, sun, rise, ease, block, setUI } = window.kit
  const push = ease.inOut(t / duration)

  space(t, { drift: t * 6 })
  // Slow push in on the Sun
  sun(t, 360, 790, 128 + 16 * push, { glow: 0.85 + 0.15 * rise(t, 0, 1.2) })

  setUI(
    block({ y: 150, p: rise(t, 0.1), cls: 'kicker', html: 'A JOURNEY OF LIGHT' }) +
      block({ y: 196, p: rise(t, 0.25, 0.8), dy: 36, cls: 'head l', style: 'font-size:70px;white-space:nowrap', html: '<span class="gold">How long</span> does<br>sunlight take<br>to reach Earth?' }) +
      block({ y: 1000, p: rise(t, 1.0, 0.8), cls: 'sub', style: 'text-align:center', x: 80, w: 560,
        html: 'The Sun you see right now<br><span style="color:var(--text)">is the Sun as it was</span>' })
  )
}
