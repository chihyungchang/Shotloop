// world/screens/cursor.js: the pointer on the stage above. Part of the screens kit (world/screens.js, which documents it and re-exports its pieces); the engine's, never edited here.
import { clamp, kit, n } from './base.js'

// ---- The pointer, on the stage above ----

// A pointer through keys [{ at, x, y }] (frame px), moving on a gentle arc
// with a minimum-jerk ease and leaning into its move; it presses at each
// time in clicks (0.8× for 0.13 s) and lets a soft ring go; it hides 2 s
// after its last move or click and is back 0.25 s before the next. size:
// its height, about 1/18 of the frame's shorter side
export function cursor(t, { path, clicks = [], p = 1, size }) {
  const { W, H, C } = kit()
  size ??= Math.min(W, H) / 18
  if (p <= 0 || !path.length) return ''
  const i = path.findIndex(k => k.at > t)
  let x, y, vx = 0
  if (i === 0 || path.length === 1) ({ x, y } = path[0])
  else if (i < 0) ({ x, y } = path.at(-1))
  else {
    const a = path[i - 1], b = path[i]
    const d = (b.at - a.at) || 1
    const u = clamp((t - a.at) / d)
    const e = u * u * u * (10 - 15 * u + 6 * u * u)
    // A hand's path bows a little to the side
    const bow = Math.sin(Math.PI * e) * 0.12
    x = a.x + (b.x - a.x) * e - (b.y - a.y) * bow
    y = a.y + (b.y - a.y) * e + (b.x - a.x) * bow
    vx = (b.x - a.x) * 30 * u * u * (1 - u) * (1 - u) / d
  }
  const events = [...path.map(k => k.at), ...clicks].sort((a, b) => a - b)
  const last = events.filter(e => e <= t).at(-1) ?? -Infinity
  const next = events.find(e => e > t) ?? Infinity
  const shown = Math.max(1 - clamp((t - last - 2) / 0.4), clamp(1 - (next - t) / 0.25))
  let press = 0, rings = ''
  for (const c of clicks) {
    const d = t - c
    if (Math.abs(d) < 0.13) press = Math.max(press, 1 - Math.abs(d) / 0.13)
    if (d >= 0 && d < 0.6) {
      const q = d / 0.6
      rings += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(size * (0.25 + 0.9 * (1 - (1 - q) ** 3)))}" fill="none" stroke="${C.accent}" stroke-width="${n(size / 10)}" opacity="${n(0.7 * (1 - q))}"/>`
    }
  }
  const o = clamp(p) * clamp(shown)
  if (o <= 0) return rings
  const k = (size / 24) * (1 - 0.2 * press)
  const lean = clamp(vx / (W * 2), -1, 1) * 8
  return rings + `<g data-kit="cursor" transform="translate(${n(x)} ${n(y)}) rotate(${n(lean)}) scale(${n(k)})" opacity="${n(o)}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">` +
    '<path d="M0 0L0 19.5L4.7 15.2L8 22.6L11.6 21L8.4 13.8L14.6 13.4Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></g>'
}
