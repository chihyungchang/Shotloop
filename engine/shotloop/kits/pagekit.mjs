// The helpers every 2D world page's kit starts with, as page script: time
// and easing, reading time, seeded randomness, counters. The infographic
// page (looks.mjs) and the cinematic scene (scene.mjs) both embed this one
// copy, so rise(t, a) means the same on every page.

import { readTime } from '../data.mjs'

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

// The type layer of a page whose picture is a canvas (the cinematic scene,
// a WebGL film): glowing type in a DOM layer above it (#ui), built anew
// each frame. Its CSS, for a look L and the layout's headline size
export const typeCss = (L, headSize) => `      .kicker { font: 600 ${Math.round(headSize * 0.36)}px/1 var(--font); letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent);
        display: flex; align-items: center; gap: 14px; }
      .kicker::before { content: ''; width: 36px; height: 2px; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
      .head { font: ${L.headWeight} ${headSize}px/1.18 var(--head); letter-spacing: 0.01em; text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6); }
      .sub { font: 500 ${Math.round(headSize * 0.46)}px/1.5 var(--font); color: var(--muted); }
      .num { font-family: var(--mono); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
      .hl, .head b { color: var(--accent); font-weight: inherit; text-shadow: 0 0 24px var(--accent); }
      .muted { color: var(--muted); }
      .chip { font: 600 ${Math.round(headSize * 0.36)}px/1 var(--font); color: var(--muted); padding: 10px 16px; border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(0, 0, 0, 0.35); }
      .source { font: 500 ${Math.round(headSize * 0.3)}px/1.4 var(--font); color: var(--muted); opacity: 0.75; }
`

// Its helpers: show, block, setUI, caption, source. The page declares
// \`let parts = []\` and \`const ui\` (its #ui), and empties parts at the
// start of each frame
export const kitType = ({ headTop, headSize }) => `      // ---- Type ----
      const show = (p, dy = 26) => 'opacity:' + clamp(p).toFixed(3) + ';transform:translateY(' + ((1 - clamp(p)) * dy).toFixed(1) + 'px);filter:blur(' + ((1 - clamp(p)) * 8).toFixed(1) + 'px)'
      function add(html) {
        parts.push(html)
        ui.innerHTML = parts.join('')
      }
      const block = ({ x = PAD, y, w = SAFE_RIGHT - PAD, p = 1, dy, cls = '', html, style = '' }) =>
        add('<div class="' + cls + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;' + show(p, dy) + ';' + style + '">' + html + '</div>')
      const setUI = html => { parts = [html]; ui.innerHTML = html }
      function caption({ kicker = '', head = '', sub = '', p = 1, y = ${headTop}, align = 'left', size } = {}) {
        const fmtHead = s => esc(s).replace(/\\*(.+?)\\*/g, '<b>$1</b>')
        const lines = (Array.isArray(head) ? head : [head]).filter(Boolean).map(fmtHead).join('<br>')
        const style = 'text-align:' + align + (size ? ';font-size:' + size + 'px' : '')
        if (kicker) block({ y: y - 46, p: clamp(p * 1.4), cls: 'kicker', style: align === 'center' ? 'justify-content:center' : '', html: esc(kicker) })
        if (lines) block({ y, p, cls: 'head', style, html: lines })
        if (sub) block({ y: y + (size || ${headSize}) * 1.18 * (Array.isArray(head) ? head.length : 1) + 18, p: clamp(p * 1.2 - 0.2), cls: 'sub', style, html: esc(sub) })
      }
      const source = (text, p = 1) => block({ y: SAFE_BOTTOM - 36, p, dy: 8, cls: 'source', html: esc(text) })

`
