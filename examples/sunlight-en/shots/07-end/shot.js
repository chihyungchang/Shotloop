// 07-end: end card. A calm Sun, the closing line, the example label.

export default function render(t, { window }) {
  const { space, sun, rise, block, setUI } = window.kit

  space(t, { drift: 260 + t * 5 })
  sun(t, 360, 520, 70 + 4 * rise(t, 0, 2), { glow: 0.8, streak: 0.7 })

  setUI(
    block({ y: 720, p: rise(t, 0.1, 0.7), cls: 'head', style: 'text-align:center', html: 'Light is fast.<br><span class="gold">Space is bigger.</span>' }) +
      block({ y: 920, p: rise(t, 0.5), style: 'text-align:center', html:
        '<span class="num" style="font-size:22px;letter-spacing:0.3em;color:var(--muted)">SHOTLOOP</span>' +
        '<span class="sub" style="font-size:22px;margin-left:10px">EXAMPLE</span>' }) +
      block({ y: 966, p: rise(t, 0.7), cls: 'sub', style: 'text-align:center;font-size:20px;color:var(--dim)',
        html: 'Sources: IAU 2012 AU · SI speed of light · NASA' })
  )
}
