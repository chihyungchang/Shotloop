// world/promo-layout.js: where a product promo's pieces sit, in page px,
// and the one place this is worked out. The screens kit lays each beat
// out with it in the page (screens.js layout(), frame(), the cards); the
// engine writes the film's frames from its plan with it (promo/frames.mjs
// → world/frames.json); the app draws those frames as the plan's
// wireframes. Pure (no page, no Node), so all three run the same code.
// It is the engine's (engine/shotloop/kits/promo-layout.js), kept current
// in every promo's world: never edit it there.
//
// page: { W, H, PAD } (the page's size and edge margin, CSS px)

// A Mac's screen is 16:10: the desktop keeps it in any box it's given,
// the largest that fits, centred, never squashed into the box's shape
export const SCREEN = 16 / 10
export function screenBox(box) {
  const w = Math.min(box.w, box.h * SCREEN), h = w / SCREEN
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

// The page from data.mjs pageLayout()
export const pageOf = ({ w, h, pad }) => ({ W: w, H: h, PAD: pad })

// The plan's shots as beats: { id, beat, lines, steps }, or null when the
// plan doesn't say what each shot is (one planned before beats). Its
// "text" is the headline, a line each
const BEATS = ['title', 'problem', 'screen', 'end']
export function planBeats(shots, ids = shots.map((_, i) => String(i + 1))) {
  if (!shots.length || !shots.every(s => BEATS.includes(s.beat))) return null
  return shots.map((s, i) => {
    const lines = String(s.text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
    return {
      id: ids[i],
      beat: s.beat,
      lines: Math.min(3, Math.max(1, lines.length)),
      // The longest line's length, for a size every headline fits at
      chars: Math.max(0, ...lines.map(l => l.length)),
      steps: Math.max(0, Math.min(6, Math.round(Number(s.steps) || 0)))
    }
  })
}

// The size unit: 1 on a 720 px short side
const unitOf = page => Math.min(page.W, page.H) / 720

// Where a beat's pieces go, with room between them (rule: promo-fill):
//   'side'  the words in a left column, the picture right of them
//   'below' the words across the top, the picture under them
//   'auto'  whichever of the two shows a picture of aspect (width /
//           height; the desktop's 16:10 unless given) largest
// lines: the headline's lines. Gives back { kind, words: { x, y, width,
// size, under }, picture: { x, y, w, h }, source: { y } }: the words start
// under the chapter's rule, a gap of at least 5% of the frame's height
// parts words from picture, a band at the bottom is kept for the source
// line, and under is where steps or a bubble go below the headline,
// clear of its last line. bleed: the picture runs off the right and the
// bottom edges instead of stopping at the margin
export function layoutBoxes(page, kind = 'side', { lines = 2, size, bleed = false, aspect } = {}) {
  if (kind === 'auto') {
    aspect ??= SCREEN
    const shown = l => Math.min(l.picture.w, l.picture.h * aspect) ** 2 / aspect
    const side = layoutBoxes(page, 'side', { lines, size, bleed }), below = layoutBoxes(page, 'below', { lines, size, bleed })
    return shown(below) > shown(side) ? below : side
  }
  const { W, H } = page
  const u = unitOf(page), m = page.PAD ?? 56 * u
  const fs = size ?? Math.min(W, H) * (kind === 'side' ? 0.07 : 0.083)
  const gap = Math.max(40 * u, H * 0.05)
  const top = 104 * u
  const sourceBand = 44 * u
  const bottom = H - m * 0.6 - sourceBand
  const textH = lines * fs * 1.06
  const under = y => y + textH + Math.max(36 * u, fs * 0.7)
  if (kind === 'side') {
    const width = W * 0.27
    const x = m + width + gap
    return {
      kind,
      words: { x: m, y: top + 46 * u, width, size: fs, under: under(top + 46 * u) },
      picture: { x, y: top, w: bleed ? W - x + 40 * u : W - m - x, h: bleed ? H - top + 40 * u : bottom - gap * 0.5 - top },
      source: { y: H - m * 0.6 - sourceBand * 0.55 }
    }
  }
  const y = top + textH + gap
  return {
    kind,
    words: { x: m, y: top, width: W - 2 * m, size: fs, under: under(top) },
    picture: { x: m, y, w: bleed ? W - m + 40 * u : W - 2 * m, h: bleed ? H - y + 40 * u : bottom - gap * 0.5 - y },
    source: { y: H - m * 0.6 - sourceBand * 0.55 }
  }
}

// The height of n steps (screens.js steps(): a chip each, a gap between)
export const stepsHeight = (page, n) => {
  const u = unitOf(page)
  return n ? n * 44 * u + (n - 1) * 16 * u : 0
}

// A card's lockup (the title, the end card): the logo as tall as the
// name's capitals just before it (taste: promo-lockup), on their baseline
// (rule: promo-aligned), the line under, the meta row over a rule at the
// foot. The name is set as large as fits between the margins, a long
// one smaller (heavy capitals run about NAME_LETTER of their size wide);
// each box in page px
const NAME_LETTER = 0.72
export function cardBoxes(page, { logo = true, name = '' } = {}) {
  const { W, H } = page
  const u = unitOf(page), m = page.PAD ?? 56 * u
  const across = name.length * NAME_LETTER + (logo ? 0.72 + 0.22 : 0)
  const big = Math.min(W * 0.155, H * 0.28, across ? (W - 2 * m) / across : Infinity)
  // The name sits on a baseline at 72% of the frame's height; its
  // capitals are about 0.72 of its size tall
  const base = H * 0.72
  const cap = big * 0.72
  const mark = logo ? { x: m, y: base - cap, w: cap, h: cap } : null
  return {
    big,
    logo: mark,
    name: { x: mark ? m + cap + big * 0.22 : m, y: base - cap, h: cap, size: big },
    // the line's foot: under the name's descenders (a p, a g) and a gap
    line: { x: m, y: base + big * 0.34 + 38 * u, size: 38 * u },
    meta: { x: m, y: H - 48 * u - 34 * u, w: W - 2 * m, h: 34 * u }
  }
}

// The film's frames from its plan: one desktop for the whole film, its
// place chosen once (beside or under the headline, whichever shows it
// largest for the film's longest headline, rule: promo-desktop), then
// each beat's boxes. beats: [{ id, beat: 'title' | 'problem' | 'screen' |
// 'end', lines, steps }]
// A heavy headline's letters run about this wide for their size (a
// little over, so a line laid out to fit does)
const LETTER = 0.6

export function filmFrames(page, beats) {
  const worded = beats.filter(b => b.beat === 'screen' || b.beat === 'problem')
  const longest = Math.max(1, ...worded.map(b => b.lines || 1))
  const film = layoutBoxes(page, 'auto', { lines: longest })
  // One headline size for every beat (rule: promo-fill): the largest at
  // which each beat's longest line fits its column, but never under 80%
  // of the kit's, as headlines stay big; a line that still won't fit is
  // the plan's to split or cut (planIssues)
  const size = Math.max(film.words.size * 0.8, Math.min(film.words.size, ...worded.filter(b => b.chars).map(b => film.words.width / (b.chars * LETTER))))
  const fits = Math.floor(film.words.width / (size * LETTER))
  const desktop = screenBox(film.picture)
  return {
    page,
    kind: film.kind,
    desktop,
    fits,
    beats: beats.map(b => {
      if (b.beat === 'title' || b.beat === 'end') return { id: b.id, beat: b.beat, card: cardBoxes(page) }
      const own = layoutBoxes(page, film.kind, { lines: b.lines || 1, size })
      const steps = b.steps ? { x: own.words.x, y: own.words.under, w: own.words.width, h: stepsHeight(page, b.steps), n: b.steps } : null
      return {
        id: b.id,
        beat: b.beat === 'problem' ? 'problem' : 'screen',
        words: own.words,
        lines: b.lines || 1,
        steps,
        // A screen beat's desktop is the film's; a problem's drawing has
        // the picture's box to sit balanced in (rule: promo-fill)
        ...(b.beat === 'problem' ? { picture: film.picture } : { desktop }),
        source: own.source
      }
    })
  }
}

// What in a promo's plan its frames can't hold, as lines the planner
// reads: a shot without its beat, the ends out of place, a headline line
// longer than its column at the film's size
export function planIssues(page, shots) {
  const name = (s, i) => `shot ${i + 1}${s.title ? ` (${s.title})` : ''}`
  const beats = planBeats(shots)
  if (!beats) return ['every shot needs its "beat": "title", "problem", "screen" or "end"']
  const out = []
  if (beats[0].beat !== 'title') out.push(`${name(shots[0], 0)}: the first shot is the title ("beat": "title")`)
  if (beats.at(-1).beat !== 'end') out.push(`${name(shots.at(-1), shots.length - 1)}: the last shot is the end card ("beat": "end")`)
  const frames = filmFrames(page, beats)
  beats.forEach((b, i) => {
    if ((b.beat === 'screen' || b.beat === 'problem') && b.chars > frames.fits) {
      out.push(`${name(shots[i], i)}: a headline line of ${b.chars} letters is longer than its column holds at the film's size (${frames.fits}); split it into two lines or cut it`)
    }
  })
  return out
}

// One beat's frame as an SVG wireframe: grey bars for words, the desktop
// with its menu bar and Dock, a dashed box for a drawing, the card's
// lockup. Colours from currentColor, so the page showing it sets them
export function wireframe(frames, i) {
  const { W, H, PAD } = frames.page
  const f = frames.beats[i]
  const u = unitOf(frames.page)
  const r = (b, extra = '') => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" ${extra}/>`
  const bars = []
  const ink = 'fill="currentColor"'
  if (f.card) {
    const c = f.card
    if (c.logo) bars.push(r({ ...c.logo }, `rx="${c.logo.w * 0.22}" ${ink} opacity=".55"`))
    bars.push(r({ x: c.name.x, y: c.name.y, w: Math.min(W - PAD - c.name.x, c.big * 3.6), h: c.name.h }, `${ink} opacity=".75"`))
    bars.push(r({ x: c.line.x, y: c.line.y - c.line.size * 0.8, w: W * 0.42, h: c.line.size * 0.7 }, `${ink} opacity=".4"`))
    // The meta row over its rule: the end card's only
    if (f.beat === 'end') {
      bars.push(`<line x1="${c.meta.x}" y1="${c.meta.y}" x2="${c.meta.x + c.meta.w}" y2="${c.meta.y}" stroke="currentColor" opacity=".35"/>`)
      bars.push(r({ x: c.meta.x, y: c.meta.y + 10 * u, w: W * 0.3, h: 10 * u }, `${ink} opacity=".25"`))
    }
  } else {
    // The chapter's label over its rule
    bars.push(r({ x: PAD, y: 64 * u, w: 120 * u, h: 9 * u }, `${ink} opacity=".35"`))
    bars.push(`<line x1="${PAD}" y1="${82 * u}" x2="${W - PAD}" y2="${82 * u}" stroke="currentColor" opacity=".35"/>`)
    const w = f.words
    for (let l = 0; l < f.lines; l++) {
      bars.push(r({ x: w.x, y: w.y + l * w.size * 1.06 + w.size * 0.14, w: w.width * (l ? 0.7 : 0.92), h: w.size * 0.74 }, `${ink} opacity="${l ? '.4' : '.75'}"`))
    }
    if (f.steps) {
      const each = (f.steps.h - (f.steps.n - 1) * 16 * u) / f.steps.n
      for (let s = 0; s < f.steps.n; s++) bars.push(r({ x: f.steps.x, y: f.steps.y + s * (each + 16 * u), w: Math.min(f.steps.w, 190 * u), h: each }, `fill="none" stroke="currentColor" opacity=".55"`))
    }
    if (f.desktop) {
      const d = f.desktop
      bars.push(r(d, `rx="${12 * u}" fill="currentColor" opacity=".1" stroke="currentColor" stroke-opacity=".4"`))
      bars.push(r({ x: d.x, y: d.y, w: d.w, h: 22 * u * (d.w / 900) }, `${ink} opacity=".18"`))
      bars.push(r({ x: d.x + d.w * 0.07, y: d.y + d.h * 0.1, w: d.w * 0.86, h: d.h * 0.74 }, `rx="${8 * u}" fill="currentColor" opacity=".16"`))
      bars.push(r({ x: d.x + d.w * 0.3, y: d.y + d.h * 0.9, w: d.w * 0.4, h: d.h * 0.07 }, `rx="${6 * u}" ${ink} opacity=".22"`))
    }
    if (f.picture) bars.push(r(f.picture, `fill="none" stroke="currentColor" stroke-dasharray="${6 * u} ${5 * u}" opacity=".45"`))
    bars.push(r({ x: PAD, y: f.source.y, w: W * 0.32, h: 8 * u }, `${ink} opacity=".25"`))
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${bars.join('')}</svg>`
}
