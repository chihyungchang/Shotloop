// 04-journey: distance ÷ speed. A light pulse leaves the Sun and crosses
// to Earth at constant speed while a timer runs 00:00 → 08:19.

const SECONDS = 149597870.7 / 299792.458 // 499.0 s

export default function render(t, { window, voice = [] }) {
  const { c, space, sun, planet, beam, glow, rise, clamp, lerp, block, setUI } = window.kit
  // Timed to the line: "499" lands near the end of the first sentence; the
  // pulse reaches Earth (timer 08:19) as the second says the minutes
  const s1 = voice[0] ?? { at: 0.2, end: 2.6 }
  const s2 = voice[1] ?? { at: 2.8, end: 5.0 }
  const LEAVE = 1.2 // shot time the pulse leaves the Sun
  const ARRIVE = Math.min(s2.end - 0.5, s2.at + 1.2) // and reaches Earth
  // Everything sits above the subtitle band (y 870–1011)
  const y = 520
  const x0 = 150
  const x1 = 600

  space(t, { drift: 90 + t * 5 })
  sun(t, 30, y, 112, { streak: 0.5 })

  // Constant speed: light does not ease
  const p = clamp((t - LEAVE) / (ARRIVE - LEAVE))
  const arrived = clamp((t - ARRIVE) / 0.25)
  // Quarter ticks along the path
  c.fillStyle = 'rgba(255, 200, 97, 0.35)'
  for (let i = 1; i < 4; i++) c.fillRect(lerp(x0, x1, i / 4) - 1, y - 7, 2, 14)
  beam(x0, y, x1 - 22, y, p, { tail: 0.4, width: 3, guide: 0.22, head: 1 - arrived })
  planet(t, x1, y, 20, { light: Math.PI })
  // Arrival flash on Earth, then a lit halo that stays
  const flash = t > ARRIVE ? Math.exp(-(t - ARRIVE) * 3) : 0
  glow(x1, y, 120, '255, 220, 150', 0.7 * flash)
  glow(x1, y, 56, '140, 190, 255', 0.25 + 0.2 * arrived)

  const s = Math.round(SECONDS * p)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  const done = rise(t, ARRIVE + 0.1, 0.5)

  setUI(
    block({ y: 150, p: rise(t, 0.05), cls: 'kicker', html: 'STEP 3 · DIVIDE' }) +
      block({ y: 196, p: rise(t, 0.15, 0.7), cls: 'head', style: 'font-size:32px;line-height:1.4;white-space:nowrap', html:
        `<span class="num">149.6</span> million km <span class="muted">÷</span> <span class="num">299,792</span> km/s` }) +
      block({ y: 250, p: rise(t, Math.max(0.5, s1.end - 1.6), 0.7), cls: 'head', html: `≈ <span class="num gold">499</span> s` }) +
      block({ x: x1 - 60, y: y + 34, w: 120, p: rise(t, 0.3), cls: 'sub', style: 'font-size:22px;text-align:center', html: 'Earth' }) +
      block({ y: 615, p: rise(t, 0.6), style: 'text-align:center', html:
        `<div class="num${t > ARRIVE ? ' gold' : ''}" style="font-size:130px;line-height:1">${mm}:${ss}</div>` +
        `<div class="sub" style="margin-top:12px;letter-spacing:0.5em;padding-left:0.5em">min · sec</div>` }) +
      block({ y: 812, p: done, style: 'text-align:center', html:
        `<span class="chip" style="color:var(--text);font-size:26px">Sunlight crosses 1 AU in <b class="gold">8 min 19 s</b></span>` })
  )
}
