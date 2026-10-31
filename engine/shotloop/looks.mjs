// Built-in looks for 2D projects: one page (world/page.html) with the same
// kit in every look, only the tokens differ (palette, type, background).
// The planner picks a look, the person can change it on the plan, and the
// build starts from it, so the AI writes shots instead of a design system.

export const LOOKS = [
  {
    id: 'midnight',
    name: { en: 'Midnight', 'zh-CN': '深夜蓝', 'pt-BR': 'Meia-noite' },
    about: 'dark navy, warm gold and teal accents; science and explainers',
    bg: 'radial-gradient(120% 80% at 50% 0%, #1b2d63 0%, #0d1736 55%, #080e24 100%)',
    text: '#f4f7ff', muted: '#9fb0d6', accent: '#ffb340', accent2: '#4fd1c5', accent3: '#ff6b8b',
    line: 'rgba(255, 255, 255, 0.16)', panel: 'rgba(255, 255, 255, 0.07)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 2px 18px rgba(6, 12, 34, 0.45)'
  },
  {
    id: 'paper',
    name: { en: 'Paper', 'zh-CN': '纸张', 'pt-BR': 'Papel' },
    about: 'warm off-white paper, black ink, blue and red accents; editorial and calm',
    bg: 'radial-gradient(130% 90% at 50% 30%, #f7f3ea 0%, #efe8da 70%, #e6dccb 100%)',
    text: '#1d1b17', muted: '#776f62', accent: '#2f6fed', accent2: '#e8553d', accent3: '#2a9d6f',
    line: 'rgba(29, 27, 23, 0.16)', panel: 'rgba(29, 27, 23, 0.05)',
    head: "'New York', 'Songti SC', Georgia, serif", headWeight: 700, glow: 'none'
  },
  {
    id: 'neon',
    name: { en: 'Neon', 'zh-CN': '霓虹', 'pt-BR': 'Neon' },
    about: 'black with glowing magenta and cyan; tech, games, bold hooks',
    bg: 'radial-gradient(90% 60% at 15% 10%, rgba(255, 61, 154, 0.28), transparent 60%), radial-gradient(90% 60% at 90% 85%, rgba(46, 230, 255, 0.22), transparent 60%), #07070c',
    text: '#ffffff', muted: '#a7a7c7', accent: '#ff3d9a', accent2: '#2ee6ff', accent3: '#c4ff3d',
    line: 'rgba(255, 255, 255, 0.18)', panel: 'rgba(255, 255, 255, 0.06)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 0 24px rgba(255, 61, 154, 0.45)'
  },
  {
    id: 'pastel',
    name: { en: 'Pastel', 'zh-CN': '马卡龙', 'pt-BR': 'Pastel' },
    about: 'soft lavender and mint, rounded and friendly; lifestyle, kids, how-tos',
    bg: 'linear-gradient(165deg, #f7f0ff 0%, #f1f6ff 50%, #eaf8f2 100%)',
    text: '#2b2540', muted: '#7d7598', accent: '#7c5cff', accent2: '#ff8a65', accent3: '#21a99a',
    line: 'rgba(43, 37, 64, 0.14)', panel: 'rgba(124, 92, 255, 0.08)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: 'none'
  },
  {
    id: 'mono',
    name: { en: 'Swiss', 'zh-CN': '极简黑白', 'pt-BR': 'Suíço' },
    about: 'white, heavy black type, one red accent; data, facts, news',
    bg: '#ffffff',
    text: '#0a0a0a', muted: '#6b6b6b', accent: '#ff3b30', accent2: '#0a0a0a', accent3: '#8e8e93',
    line: 'rgba(10, 10, 10, 0.14)', panel: 'rgba(10, 10, 10, 0.05)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 900, glow: 'none'
  }
]

export const DEFAULT_LOOK = 'midnight'
export const lookById = id => LOOKS.find(l => l.id === id) ?? null

// The page for a look at the project's size. Its first comment documents
// the kit: the AI reads it before writing shots
export function lookPage(id, { width, height }) {
  const L = lookById(id) ?? lookById(DEFAULT_LOOK)
  const w = Math.round(width / 1.5)
  const h = Math.round(height / 1.5)
  const tall = h > w
  const pad = Math.round(w * (tall ? 0.056 : 0.045))
  // The safe area (engine/shotloop/checklist.md, safe-area): on a tall
  // frame the right edge and the bottom 20% carry the platforms' buttons
  const safeTop = Math.round(h * (tall ? 0.086 : 0.06))
  const safeRight = tall ? Math.round(w * 0.861) : w - pad
  const safeBottom = Math.round(h * (tall ? 0.8 : 0.85))
  const headSize = Math.round(tall ? w * 0.085 : h * 0.085)
  // The kicker sits 44 px above the headline, on the safe area's top edge
  const headTop = safeTop + 44
  const headWidth = Math.round(tall ? safeRight - pad : w * 0.62)
  return `<!doctype html>
<!--
  shotloop-look: ${L.id}
  World of a 2D Shotloop project in the "${L.name.en}" look: ${L.about}.
  ${w}×${h} CSS px, rendered at 1.5x. Every shot draws through window.kit;
  nothing animates on its own, every frame is a pure function of time.

  Layout: kicker and headline at the top (y ${headTop}…), the stage (an SVG
  covering the frame, viewBox 0 0 ${w} ${h}) for diagrams, numbers and icons.
  Keep text and the subject inside x ${pad}…${safeRight}, y ${safeTop}…${safeBottom} (the
  platforms' buttons cover the rest); backgrounds may fill the whole frame.

  kit:
    W, H                            frame size
    PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM   the safe area (x PAD…SAFE_RIGHT)
    C                               palette: bg-independent colors text, muted,
                                    accent, accent2, accent3, line, panel,
                                    series (list for charts)
    FONT, HEAD_FONT                 font stacks (normal widths; never squeeze text)
    clamp, lerp, ease(p), rise(t, a, d = 0.4), pop(t, a, d = 0.5)
                                    timing: rise is 0→1 over [a, a+d] eased out,
                                    pop overshoots a little (for things that land)
    frame({ kicker, head, typed = 1, sub, subIn = 1, progress, align, top })
                                    sets the top texts; head is a string or lines,
                                    *word* is highlighted in the accent; typed
                                    0→1 types it in; progress 0→1 fills the bar
    stage(svgMarkup) → q            replaces the stage's content, returns
                                    q(selector) for its elements
    set(el, { attr: value, style: { … } })
    drawOn(el, p)                   draws a stroked path/line/circle on, p 0→1
    count(p, from, to, digits = 0)  a number for counters
    stagger(t, i, a, step = 0.12, d = 0.4)   item i of a group revealed in turn
    hold(t, a, b, d = 0.3)          0→1→0: on screen from a to b, fading d
    float(t, amp = 4, period = 3, phase = 0)  gentle idle motion (px) for things at rest
    view({ x, y, s })               the stage's camera: zoom s around (x, y),
                                    after stage(); s = 1 is the whole frame
    readTime(text)                  seconds a caption must stay fully on screen
    hash(a, b = 0)                  seeded random 0…1, the same every frame
                                    (never Math.random)
    waffle({ x, y, w, n, cols, lit, color, p, litP })  SVG markup: n squares,
                                    revealed with p, the first lit lighting with litP
    arrow(x1, y1, x2, y2, { color, width })      SVG markup
    bars({ x, y, w, h, values, labels, colors, p }) SVG markup, bars grow with p
    card(t, { kicker, title, body, progress })  the starter title card
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --text: ${L.text}; --muted: ${L.muted}; --accent: ${L.accent}; --accent2: ${L.accent2}; --accent3: ${L.accent3};
        --line: ${L.line}; --panel: ${L.panel};
        --font: 'PingFang SC', -apple-system, sans-serif; --head: ${L.head};
      }
      * { box-sizing: border-box; margin: 0; }
      html, body { width: ${w}px; height: ${h}px; overflow: hidden; color: var(--text); font-family: var(--font); }
      body { background: ${L.bg}; }
      #stage { position: absolute; inset: 0; width: ${w}px; height: ${h}px; overflow: visible; }
      #progress { position: absolute; left: 0; top: 0; height: 6px; width: 0; background: var(--accent); }
      #kicker { position: absolute; left: ${pad}px; top: ${headTop - 44}px; width: ${headWidth}px; font: 600 ${Math.round(headSize * 0.32)}px var(--font);
        letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
      #head { position: absolute; left: ${pad}px; top: ${headTop}px; width: ${headWidth}px; font: ${L.headWeight} ${headSize}px/1.12 var(--head);
        letter-spacing: -0.01em; text-shadow: ${L.glow}; }
      #head b { color: var(--accent); font-weight: inherit; }
      #head .ghost { opacity: 0; }
      #sub { position: absolute; left: ${pad}px; width: ${headWidth}px; font: 500 ${Math.round(headSize * 0.42)}px/1.4 var(--font); color: var(--muted); }
    </style>
  </head>
  <body>
    <svg id="stage" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"></svg>
    <div id="progress"></div>
    <div id="kicker"></div>
    <div id="head"></div>
    <div id="sub"></div>
    <script>
      const $ = id => document.getElementById(id)
      const W = ${w}, H = ${h}, PAD = ${pad}, SAFE_TOP = ${safeTop}, SAFE_RIGHT = ${safeRight}, SAFE_BOTTOM = ${safeBottom}
      const C = {
        text: '${L.text}', muted: '${L.muted}', accent: '${L.accent}', accent2: '${L.accent2}', accent3: '${L.accent3}',
        line: '${L.line}', panel: '${L.panel}', series: ['${L.accent}', '${L.accent2}', '${L.accent3}', '${L.muted}']
      }
      const FONT = "'PingFang SC', -apple-system, sans-serif", HEAD_FONT = ${JSON.stringify(L.head)}
      const clamp = x => Math.min(1, Math.max(0, x))
      const lerp = (a, b, p) => a + (b - a) * p
      const ease = p => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2 }
      // 0 → 1 over [a, a + d], eased out
      const rise = (t, a, d = 0.4) => 1 - Math.pow(1 - clamp((t - a) / d), 3)
      // Eased out with a small overshoot, for things that land
      const pop = (t, a, d = 0.5) => {
        const p = clamp((t - a) / d), c = 1.7
        return p <= 0 ? 0 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
      }
      // Item i of a group, revealed step seconds after the one before
      const stagger = (t, i, a, step = 0.12, d = 0.4) => rise(t, a + i * step, d)
      // 0 → 1 → 0: on screen from a to b, fading in and out over d
      const hold = (t, a, b, d = 0.3) => Math.min(rise(t, a, d), 1 - rise(t, b - d, d))
      // Gentle idle motion (px) for things at rest
      const float = (t, amp = 4, period = 3, phase = 0) => amp * Math.sin((t / period + phase) * Math.PI * 2)
      // Seconds a caption must stay fully on screen: 1 s, plus 0.3 s per
      // word, 0.15 s per Chinese character (agent/src/principles.ts)
      function readTime(text) {
        const cjk = /[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]/gu
        const chars = (String(text).match(cjk) || []).length
        const words = String(text).replace(cjk, ' ').split(/\\s+/).filter(w => /[\\p{L}\\p{N}]/u.test(w)).length
        return chars + words ? 1 + 0.3 * words + 0.15 * chars : 0
      }
      // A seeded random number in [0, 1): the same for the same a and b
      function hash(a, b = 0) {
        let h = Math.imul(Math.round(a * 1000) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(b * 1000), 0xc2b2ae35)
        h ^= h >>> 13
        h = Math.imul(h, 0x27d4eb2f)
        h ^= h >>> 16
        return (h >>> 0) / 4294967296
      }
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

      // Headline lines typed in by character; untyped text keeps its place
      function typeLines(lines, typed) {
        const fmt = s => esc(s).replace(/\\*(.+?)\\*/g, '<b>$1</b>')
        const plain = lines.map(l => l.replace(/\\*/g, ''))
        const total = plain.reduce((n, l) => n + l.length, 0)
        let left = Math.round(clamp(typed) * total)
        return lines.map((line, i) => {
          const n = Math.min(left, plain[i].length)
          left -= n
          if (n >= plain[i].length) return '<div>' + fmt(line) + '</div>'
          return '<div>' + esc(plain[i].slice(0, n)) + '<span class="ghost">' + (esc(plain[i].slice(n)) || '&nbsp;') + '</span></div>'
        }).join('')
      }

      // The top texts for one frame
      function frame({ kicker = '', head = '', typed = 1, sub = '', subIn = 1, progress = 0, align = 'left', top = ${headTop} } = {}) {
        $('progress').style.width = clamp(progress) * 100 + '%'
        $('kicker').textContent = kicker
        const el = $('head')
        el.style.top = top + 'px'
        el.style.textAlign = align
        el.innerHTML = typeLines(Array.isArray(head) ? head : head ? [head] : [], typed)
        const s = $('sub')
        s.textContent = sub
        s.style.textAlign = align
        s.style.top = top + el.offsetHeight + 18 + 'px'
        s.style.opacity = clamp(subIn)
        s.style.transform = 'translateY(' + (1 - clamp(subIn)) * 16 + 'px)'
        $('kicker').style.textAlign = align
        return el
      }

      // The stage's content for this frame; q finds its elements
      function stage(markup) {
        const svg = $('stage')
        svg.innerHTML = markup
        // Every frame starts from the whole frame; view() moves in
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H)
        return sel => svg.querySelector(sel)
      }
      function set(el, props) {
        if (!el) return el
        for (const [k, v] of Object.entries(props)) {
          if (k === 'style') Object.assign(el.style, v)
          else if (k === 'text') el.textContent = v
          else el.setAttribute(k, v)
        }
        return el
      }
      // Stroke draw-on, p 0 → 1
      function drawOn(el, p) {
        if (!el) return el
        const len = el.getTotalLength ? el.getTotalLength() : 1000
        el.style.strokeDasharray = len
        el.style.strokeDashoffset = len * (1 - clamp(p))
        return el
      }
      const count = (p, from, to, digits = 0) => lerp(from, to, clamp(p)).toFixed(digits)
      // The stage's camera: zoom s around (x, y)
      function view({ x = W / 2, y = H / 2, s = 1 } = {}) {
        const vw = W / s, vh = H / s
        $('stage').setAttribute('viewBox', (x - vw / 2) + ' ' + (y - vh / 2) + ' ' + vw + ' ' + vh)
      }

      function arrow(x1, y1, x2, y2, { color = C.accent, width = 5 } = {}) {
        const a = Math.atan2(y2 - y1, x2 - x1), hl = width * 3.2
        const p = (r, s) => (x2 + Math.cos(a + r) * s).toFixed(1) + ',' + (y2 + Math.sin(a + r) * s).toFixed(1)
        return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + (x2 - Math.cos(a) * hl * 0.6) + '" y2="' + (y2 - Math.sin(a) * hl * 0.6) +
          '" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round"/>' +
          '<polygon points="' + x2 + ',' + y2 + ' ' + p(Math.PI - 0.45, hl) + ' ' + p(Math.PI + 0.45, hl) + '" fill="' + color + '"/>'
      }

      // A bar chart that grows with p (each bar a little after the last)
      function bars({ x = PAD, y = H * 0.72, w = SAFE_RIGHT - PAD, h = H * 0.3, values = [], labels = [], colors = C.series, p = 1 } = {}) {
        const max = Math.max(...values, 1), n = values.length, gap = w * 0.06, bw = (w - gap * (n - 1)) / n
        return values.map((v, i) => {
          const k = rise(p * (n * 0.25 + 1), i * 0.25, 1), bh = (v / max) * h * k, bx = x + i * (bw + gap)
          return '<rect x="' + bx + '" y="' + (y - bh) + '" width="' + bw + '" height="' + bh + '" rx="' + Math.min(10, bw / 6) +
            '" fill="' + colors[i % colors.length] + '"/>' +
            (labels[i] != null ? '<text x="' + (bx + bw / 2) + '" y="' + (y + 30) + '" text-anchor="middle" font-size="' + Math.round(${headSize} * 0.3) +
              '" fill="' + C.muted + '" font-family="' + FONT.replace(/"/g, '') + '">' + esc(labels[i]) + '</text>' : '')
        }).join('')
      }

      // A waffle: n squares in rows of cols, revealed in order with p; the
      // first lit of them light up in order with litP
      function waffle({ x = PAD, y = H * 0.45, w = SAFE_RIGHT - PAD, n = 100, cols = 10, lit = 0, color = C.accent, p = 1, litP = 1 } = {}) {
        const step = w / cols, size = step * 0.84
        const on = Math.round(lit * clamp(litP))
        let out = ''
        for (let k = 0; k < n; k++) {
          const show = clamp(p * n - k)
          if (show <= 0) break
          out += '<rect x="' + (x + (k % cols) * step) + '" y="' + (y + Math.floor(k / cols) * step) + '" width="' + size + '" height="' + size +
            '" rx="' + size * 0.18 + '" fill="' + (k < on ? color : C.panel) + '" stroke="' + C.line + '" opacity="' + show + '"/>'
        }
        return out
      }

      // The starter title card, until a shot gets its own design
      function card(t, { kicker, title, body, progress }) {
        stage('')
        frame({ kicker, head: title.replace(/<\\/?b>/g, '*'), typed: rise(t, 0.1, 0.6), sub: body, subIn: rise(t, 0.6), progress })
      }

      window.kit = { $, W, H, PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM, C, FONT, HEAD_FONT, clamp, lerp, ease, rise, pop, stagger, hold, float, readTime, hash, waffle,
        frame, stage, view, set, drawOn, count, arrow, bars, card }
      window.ready = document.fonts.ready
    </script>
  </body>
</html>
`
}

// A world page the AI hasn't changed: still exactly a look's template (or
// the old starter), so a new look may replace it
export function untouchedLook(text, size) {
  const id = text.match(/shotloop-look: ([a-z0-9-]+)/)?.[1]
  return !!id && text === lookPage(id, size)
}
