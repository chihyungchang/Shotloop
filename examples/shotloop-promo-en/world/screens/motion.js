// world/screens/motion.js: motion: springs, the camera (camera, follow, drift), words typed key by key. Part of the screens kit (world/screens.js, which documents it and re-exports its pieces); the engine's, never edited here.
import { clamp } from './base.js'

// ---- Springs: every move settles like a damped spring ----

// stiffness, damping, mass. focused: screen recorders' camera (settles in
// about half a second, no visible bounce), for anything read; whip: a quick
// travel between places; gentle: a slow arrival or return; pop: a small
// thing landing, with a touch of overshoot; glide: no spring but a
// minimum-jerk ease over `over` s (as the pointer's), for a camera on a
// screen: it starts and stops without a jolt, which a spring's sudden
// pull gives at 30 frames a second
export const SPRINGS = {
  focused: { stiffness: 200, damping: 40, mass: 2.25 },
  whip: { stiffness: 520, damping: 60, mass: 1.6 },
  gentle: { stiffness: 90, damping: 26, mass: 2.25 },
  pop: { stiffness: 380, damping: 22, mass: 1 },
  glide: { over: 1.3 }
}

// The spring's way from 0 to 1, t seconds after it was set off, and its speed
export function step(t, spring) {
  if (t <= 0) return [0, 0]
  const { stiffness: k, damping: c, mass: m, over } = typeof spring === 'string' ? SPRINGS[spring] : spring
  if (over) {
    const u = clamp(t / over)
    return [u * u * u * (10 - 15 * u + 6 * u * u), (30 * u * u * (1 - u) * (1 - u)) / over]
  }
  const w0 = Math.sqrt(k / m)
  const z = c / (2 * Math.sqrt(k * m))
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z)
    const e = Math.exp(-z * w0 * t)
    return [1 - e * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)), e * (w0 * w0 / wd) * Math.sin(wd * t)]
  }
  if (z === 1) {
    const e = Math.exp(-w0 * t)
    return [1 - e * (1 + w0 * t), w0 * w0 * t * e]
  }
  const r = Math.sqrt(z * z - 1)
  const r1 = -w0 * (z - r), r2 = -w0 * (z + r)
  const e1 = Math.exp(r1 * t), e2 = Math.exp(r2 * t)
  return [1 + (r2 * e1 - r1 * e2) / (r1 - r2), (r1 * r2 * (e1 - e2)) / (r1 - r2)]
}

// 0 → 1 from `at`, on a spring (for anything that arrives)
export const arrive = (t, at = 0, spring = 'focused') => step(t - at, spring)[0]

// A value through keys [{ at, v, spring }]: from the first key's v, each
// later key sets the spring off toward its v at its time (the moves add
// up, so a move set off before the last one settled blends into it)
export function springTo(t, keys, spring = 'focused') {
  let v = keys[0].v, speed = 0
  for (let i = 1; i < keys.length; i++) {
    const [x, dx] = step(t - keys[i].at, keys[i].spring ?? spring)
    v += (keys[i].v - keys[i - 1].v) * x
    speed += (keys[i].v - keys[i - 1].v) * dx
  }
  return { v, speed }
}

// The camera through keys [{ at, x, y, zoom, spring }]: x and y move
// straight, zoom in log space (a push-in keeps one speed). Speeds come
// along for the motion blur. A camera glides unless a key says otherwise
export function camera(t, keys, spring = 'glide') {
  const along = f => springTo(t, keys.map(k => ({ at: k.at, v: f(k), spring: k.spring })), spring)
  const x = along(k => k.x), y = along(k => k.y), z = along(k => Math.log(k.zoom))
  return { x: x.v, y: y.v, zoom: Math.exp(z.v), vx: x.speed, vy: y.speed, vz: z.speed }
}

// The camera keys of a screen recording's auto zoom, from clicks
// [{ at, x, y, zoom? }] (picture fractions): in to each click from `pre` s
// before it, held `post` s after; a click soon after another is panned to
// rather than zoomed out and back. base: the view between clicks
export function follow(clicks, { base = { x: 0.5, y: 0.5, zoom: 1 }, zoom = 1.6, pre = SPRINGS.glide.over, post = 2.5, spring = 'glide' } = {}) {
  const keys = [{ at: 0, ...base }]
  clicks.forEach((c, i) => {
    keys.push({ at: c.at - pre, x: c.x, y: c.y, zoom: c.zoom ?? zoom, spring })
    const next = clicks[i + 1]
    if (!next || next.at - c.at > post + pre) keys.push({ at: c.at + post, ...base, spring })
  })
  return keys
}

// A slow push while a result holds, so nothing stops dead: a zoom to
// multiply in, from `from` s on, easing in and out so it never jolts
export const drift = (t, from = 0, amount = 0.035, over = 4) => {
  const u = clamp((t - from) / over)
  return 1 + amount * u * u * (3 - 2 * u)
}


// ---- Words ----

// Text typed key by key from `at`, cps characters a second, a caret
// blinking while it types and a moment after: { text, caret, done }
export function typing(t, { text, at = 0, cps = 40 }) {
  const chars = [...String(text)]
  const shown = clamp(Math.floor((t - at) * cps), 0, chars.length)
  const end = at + chars.length / cps
  const caret = t >= at && t < end + 1.2 && (shown < chars.length || Math.floor((t - end) / 0.53) % 2 === 0)
  return { text: chars.slice(0, shown).join(''), caret, done: shown === chars.length }
}
