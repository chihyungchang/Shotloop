// The helpers every 2D world page's kit starts with, as page script: time
// and easing, reading time, seeded randomness, counters. The infographic
// page (looks.mjs) and the cinematic scene (scene.mjs) both embed this one
// copy, so rise(t, a) means the same on every page.

import { readTime } from './data.mjs'

export const KIT_CORE = `      const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
      const lerp = (a, b, p) => a + (b - a) * p
      const ease = p => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2 }
      // 0 → 1 over [a, a + d], eased out
      const rise = (t, a, d = 0.4) => 1 - Math.pow(1 - clamp((t - a) / d), 3)
      // Eased out with a small overshoot, for things that land
      const pop = (t, a, d = 0.5) => {
        const p = clamp((t - a) / d), k = 1.7
        return p <= 0 ? 0 : 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2)
      }
      // Item i of a group, revealed step seconds after the one before
      const stagger = (t, i, a, step = 0.12, d = 0.4) => rise(t, a + i * step, d)
      // 0 → 1 → 0: on screen from a to b, fading in and out over d
      const hold = (t, a, b, d = 0.3) => Math.min(rise(t, a, d), 1 - rise(t, b - d, d))
      // Gentle idle motion (px) for things at rest
      const float = (t, amp = 4, period = 3, phase = 0) => amp * Math.sin((t / period + phase) * Math.PI * 2)
      // Seconds a caption must stay fully on screen (engine/shotloop/data.mjs)
      ${String(readTime).replace(/\n/g, '\n      ')}
      // A seeded random number in [0, 1): the same for the same a and b
      function hash(a, b = 0) {
        let h = Math.imul(Math.round(a * 1000) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(b * 1000), 0xc2b2ae35)
        h ^= h >>> 13
        h = Math.imul(h, 0x27d4eb2f)
        h ^= h >>> 16
        return (h >>> 0) / 4294967296
      }
      const count = (p, from, to, digits = 0) => lerp(from, to, clamp(p)).toFixed(digits)
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
`
