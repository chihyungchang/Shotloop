// world/screens/words.js: the drawn pieces that explain: the source line, chapter, headline, a row of tiles, a counter, steps, a bubble, before and after, the wipe. Part of the screens kit (world/screens.js, which documents it and re-exports its pieces); the engine's, never edited here.
import { HEAD, MONO, RULE, esc, kit, lin, margin, n, onAccent, paper, rise, unit, url } from './base.js'
import { typing } from './motion.js'

// ---- Explaining: drawn pieces in the product's own system ----
//
// A promo shows the product itself and draws only what no screen of it
// can show (taste: promo-explain): these pieces draw in the film's colours (kit.C: ground,
// ink, muted, the one accent) and the product's own fonts once
// site/fonts.css is loaded (--brand-head, --brand-mono), an editorial
// system after oliverz.dev's product films: numbered chapters over a rule,
// big heavy headlines rising line by line, square corners and 2 px rules.

// A source line in its own band at the bottom: small mono, muted
export function source(t, { text, y, at = 0 }) {
  const { W, H, C } = kit()
  const u = unit(), m = margin()
  return `<div style="position:absolute;left:${n(m)}px;top:${n(y ?? H - 40 * u)}px;width:${n(W - 2 * m)}px;font:400 ${n(12 * u)}px/1.3 ${MONO()};color:${C.muted};` +
    `opacity:${n(rise(t, at, 0.4) * 0.85)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(text)}</div>`
}

// A chapter's label over a rule: "01 — The problem" at the left, the
// product's name at the right, both in mono capitals
export function chapter(t, { number, title, name = '', at = 0, color }) {
  const { W, C } = kit()
  const u = unit(), m = margin()
  const q = rise(t, at, 0.4)
  const ink = color ?? C.text
  return `<div data-kit="chapter" style="position:absolute;left:${n(m)}px;top:${n(40 * u)}px;width:${n(W - 2 * m)}px;display:flex;justify-content:space-between;` +
    `padding-bottom:${n(12 * u)}px;border-bottom:${n(RULE())}px solid ${ink};clip-path:inset(0 ${n((1 - q) * 100)}% 0 0);` +
    `font:500 ${n(15 * u)}px/1 ${MONO()};letter-spacing:.08em;text-transform:uppercase;color:${ink}">` +
    `<span>${String(number).padStart(2, '0')} — ${esc(title)}</span><span>${esc(name)}</span></div>`
}

// A headline of one or two lines, each rising out of its own mask; the
// second muted (the turn of the sentence). size: its height, about 8% of
// the frame's shorter side
export function headline(t, { lines, x, y, at = 0, size, width, color, step = 0.4 }) {
  const { W, H, C } = kit()
  const fs = size ?? Math.min(W, H) * 0.083
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean)
  const html = list.map((line, i) => {
    const q = rise(t, at + i * step, 0.5)
    // A line is the plan's: never wrapped here, so one too long shows as
    // such (the layout check says it) instead of hiding its second half
    return `<span style="display:block;overflow:hidden;padding-bottom:.08em;white-space:nowrap"><span style="display:block;transform:translateY(${n((1 - q) * 110)}%);color:${i ? C.muted : color ?? C.text}">` +
      `${esc(line).replace(/\*(.+?)\*/g, `<span style="color:${C.accent}">$1</span>`)}</span></span>`
  }).join('')
  return `<div data-kit="headline" style="position:absolute;left:${n(x ?? margin())}px;top:${n(y)}px;${width ? `width:${n(width)}px;` : `width:${n(W - 2 * margin())}px;`}` +
    `font:900 ${n(fs)}px/0.98 ${HEAD()};letter-spacing:-0.035em">${html}</div>`
}

// A row of tiles (frames, cards, pages) with a state each: the diagram of
// what happens to many things at once, before and after (the old way: all
// render again; the product's: one does). tiles: [{ file, label? }];
// state(i) → { chip, kind: 'wrong'|'accent'|'muted', dim 0–1, sweep 0–1,
// mark: true } at this t. box: { x, y, w, h } for the row
export function row(t, { tiles, box, at = 0, gap, state = () => ({}) }) {
  const { C } = kit()
  const u = unit()
  const g = gap ?? 16 * u
  const w = (box.w - g * (tiles.length - 1)) / tiles.length
  const red = '#e5484d'
  return tiles.map((tile, i) => {
    const q = rise(t, at + i * 0.08, 0.35)
    const s = state(i) ?? {}
    const outline = s.mark ? `${n(4 * u)}px solid ${s.kind === 'wrong' ? red : C.accent}` : `${n(RULE())}px solid ${C.text}`
    const chip = s.chip
      ? `<span style="position:absolute;left:50%;bottom:${n(-34 * u)}px;transform:translateX(-50%);white-space:nowrap;font:500 ${n(12 * u)}px/1 ${MONO()};letter-spacing:.06em;padding:${n(5 * u)}px ${n(8 * u)}px;` +
        (s.kind === 'wrong' ? `background:${red};color:#fff` : s.kind === 'accent' ? `background:${C.accent};color:${onAccent()}` : `border:1px solid ${C.muted};color:${C.muted}`) +
        `;opacity:${n(s.chipIn ?? 1)}">${esc(s.chip)}</span>`
      : ''
    return `<div style="position:absolute;left:${n(box.x + i * (w + g))}px;top:${n(box.y)}px;width:${n(w)}px;height:${n(box.h)}px;outline:${outline};background:${C.text};` +
      `opacity:${n(q)};transform:translateY(${n((1 - q) * 30 * u)}px)">` +
      (tile.file ? `<div style="position:absolute;inset:0;background:url(${url(tile.file)}) center/cover no-repeat"></div>` : '') +
      `<div style="position:absolute;inset:0;background:${paper()};opacity:${n(s.dim ?? 0)}"></div>` +
      `<div style="position:absolute;left:0;bottom:0;height:${n(8 * u)}px;width:${n((s.sweep ?? 0) * 100)}%;background:${C.accent}"></div>` +
      `<span style="position:absolute;top:${n(6 * u)}px;left:${n(6 * u)}px;font:500 ${n(12 * u)}px/1 ${MONO()};color:#fff;background:rgba(0,0,0,.55);padding:1px ${n(5 * u)}px">${esc(tile.label ?? String(i + 1).padStart(2, '0'))}</span>` +
      chip + '</div>'
  }).join('')
}

// A count in a footer over a rule: a label at the left, the number at the
// right in mono ("7 / 7"), in the accent or a warning colour when it says so
export function counter(t, { label, value, at = 0, tone = '' }) {
  const { W, C } = kit()
  const u = unit(), m = margin()
  const q = rise(t, at, 0.4)
  const color = tone === 'wrong' ? '#e5484d' : tone === 'accent' ? C.accent : C.text
  return `<div style="position:absolute;left:${n(m)}px;bottom:${n(44 * u)}px;width:${n(W - 2 * m)}px;display:flex;justify-content:space-between;align-items:baseline;` +
    `padding-top:${n(12 * u)}px;border-top:${n(RULE())}px solid ${C.text};opacity:${n(q)};color:${C.text}">` +
    `<span style="font:500 ${n(14 * u)}px/1 ${MONO()};letter-spacing:.08em;text-transform:uppercase">${esc(label)}</span>` +
    `<span style="font:500 ${n(28 * u)}px/1 ${MONO()};color:${color}">${esc(value)}</span></div>`
}

// Steps that light one after another (Generate → Render → Check → Fix):
// bordered mono chips in a column (or a row), the lit ones in the accent
export function steps(t, { items, x, y, at = 0, step = 0.5, across = false, width }) {
  const { C } = kit()
  const u = unit()
  return `<div style="position:absolute;left:${n(x)}px;top:${n(y)}px;display:flex;flex-direction:${across ? 'row' : 'column'};align-items:flex-start;gap:${n(16 * u)}px;${width ? `width:${n(width)}px;` : ''}">` +
    items.map((item, i) => {
      const q = rise(t, at + i * 0.08, 0.35)
      const lit = t >= at + 0.4 + i * step
      return `<span style="display:flex;align-items:center;gap:${n(12 * u)}px;padding:${n(12 * u)}px ${n(18 * u)}px;border:${n(RULE())}px solid ${C.text};` +
        `background:${lit ? C.accent : 'transparent'};opacity:${n(q)};transform:translateX(${n((1 - q) * -20 * u)}px);font:500 ${n(20 * u)}px/1 ${MONO()};letter-spacing:.04em;color:${lit ? onAccent() : C.text}">` +
        `<b style="font-weight:500;font-size:${n(14 * u)}px;color:${lit ? onAccent() : C.muted}">${String(i + 1).padStart(2, '0')}</b>${esc(item)}</span>`
    }).join('') + '</div>'
}

// A request typed into a dark bubble, its sender above it in the accent
// ("YOU · SHOT 01"): what a person asks the product for, in their words
export function bubble(t, { who, text, x, y, w, at = 0, cps = 22 }) {
  const { C } = kit()
  const u = unit()
  const q = rise(t, at, 0.4)
  const typed = typing(t, { text, at: at + 0.4, cps })
  return `<div style="position:absolute;left:${n(x)}px;top:${n(y)}px;width:${n(w)}px;min-height:${n(110 * u)}px;padding:${n(22 * u)}px ${n(24 * u)}px;background:${C.text};color:${paper()};` +
    `opacity:${n(q)};transform:translateY(${n((1 - q) * 20 * u)}px);font:700 ${n(26 * u)}px/1.3 ${HEAD()};box-sizing:border-box">` +
    `<span style="display:block;margin-bottom:${n(10 * u)}px;font:500 ${n(13 * u)}px/1 ${MONO()};letter-spacing:.08em;color:${C.accent}">${esc(who)}</span>` +
    `${esc(typed.text)}<span style="display:inline-block;width:.5em;height:1em;vertical-align:-.12em;background:${paper()};opacity:${typed.caret ? 1 : 0}"></span></div>`
}

// Before and after in one box: the after uncovered by a divider in the
// accent sweeping from left to right from `at` over `d` seconds, each side
// tagged. before, after: { file } (pictures of the same size)
export function compare(t, { before, after, box, at = 0, d = 1.2, labels = ['BEFORE', 'AFTER'] }) {
  const { C } = kit()
  const u = unit()
  const q = rise(t, at - 0.5, 0.45)
  const split = 100 - 50 * (1 - (1 - lin(t, at, d)) ** 2)
  const tag = (text, side) => `<span style="position:absolute;top:${n(12 * u)}px;${side}:${n(12 * u)}px;font:500 ${n(13 * u)}px/1 ${MONO()};letter-spacing:.08em;padding:${n(5 * u)}px ${n(8 * u)}px;background:${C.text};color:${paper()}">${esc(text)}</span>`
  return `<div style="position:absolute;left:${n(box.x)}px;top:${n(box.y)}px;width:${n(box.w)}px;height:${n(box.h)}px;outline:${n(RULE())}px solid ${C.text};overflow:hidden;background:${C.text};opacity:${n(q)}">` +
    `<div style="position:absolute;inset:0;background:url(${url(before.file)}) center/cover no-repeat"></div>` +
    `<div style="position:absolute;inset:0;background:url(${url(after.file)}) center/cover no-repeat;clip-path:inset(0 0 0 ${n(split)}%)"></div>` +
    `<div style="position:absolute;top:0;bottom:0;left:${n(split)}%;width:${n(3 * u)}px;margin-left:${n(-1.5 * u)}px;background:${C.accent}"></div>` +
    tag(labels[0], 'left') + (split < 99 ? tag(labels[1], 'right') : '') + '</div>'
}

// The cut between two shots: an ink panel crossing the frame in 0.36 s,
// half at the end of a shot and half at the start of the next. Give the
// shot's length; draw it last. The film's first shot doesn't enter by
// one (enter: false), nor its last leave by one (leave: false)
export function wipe(t, { duration, color, half = 0.18, enter = true, leave = true }) {
  const { W, H, C } = kit()
  let p = null
  if (enter && t < half) p = 0.5 + t / (2 * half)
  else if (leave && t > duration - half) p = (t - (duration - half)) / (2 * half)
  if (p === null) return ''
  return `<div style="position:absolute;top:0;left:${n((1 - p * 2) * W)}px;width:${n(W)}px;height:${n(H)}px;background:${color ?? C.text}"></div>`
}
