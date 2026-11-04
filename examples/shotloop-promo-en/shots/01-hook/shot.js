// 01-hook: Title card. The lockup alone on the paper ground, a faint lime
// field breathing behind the logo. No wipe: shot 02's entering half carries the cut.
import { load, depth, titleCard, frame } from '../../world/screens.js'

export const setup = () => load('repo/logo.png')

export default function render(t, { window }) {
  const f = frame()
  const c = f.card || {}
  const lg = c.logo || { x: 58, y: 376, w: 143, h: 143 }

  // the lockup rises out of its mask and keeps drifting up ~1% over the beat
  const lift = -0.01 * 720 * Math.min(1, t / 3)

  // faint lime field behind the logo only, breathing (pure function of t)
  const breathe = 0.5 + 0.5 * Math.sin((t / 2.6) * Math.PI * 2)
  const r = lg.w * (0.95 + 0.07 * breathe)
  const op = (0.1 + 0.07 * breathe) * Math.min(1, Math.max(0, (t + 0.4) / 0.5))
  const field = `<div data-name="logo-field" style="position:absolute;left:${lg.x + lg.w / 2 - r}px;top:${lg.y + lg.h / 2 - r + lift}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:radial-gradient(circle,rgba(212,255,58,${op}) 0%,rgba(212,255,58,0) 70%)"></div>`

  // hairline ink rule on the lockup's left edge, drawing left to right
  const line = f.card?.line || { x: 58, y: 624 }
  const rp = Math.min(1, Math.max(0, (t - 0.35) / 0.4))
  const rw = (1 - Math.pow(1 - rp, 3)) * 1164
  const rule = `<div data-name="rule" style="position:absolute;left:${line.x}px;top:${lg.y + lg.h + 44 + lift}px;width:${rw}px;height:1px;background:#0a0a0a;opacity:.5"></div>`

  depth(
    field,
    rule,
    `<div data-name="lockup" style="position:absolute;inset:0;transform:translateY(${lift}px)">${
      titleCard(t, { name: 'SHOTLOOP', line: 'Short videos with AI — macOS', logo: 'repo/logo.png', at: -0.4 })
    }</div>`
  )
  window.kit.stage('')
}
