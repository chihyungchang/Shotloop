// The principles of a 2D Shotloop video, set by Oliver with a viewer who
// watches a lot of English short video (31 Oct 2026; the same as
// engine/video/explainers/2d/README.md). They are fixed: every planning,
// building, fixing and checking prompt carries them, and a plan is
// measured against them before anything is built (lintPlan). Within them,
// the AI makes each frame as rich to watch as it can.

export const PRINCIPLES_2D = `The 2D principles (fixed; only how richly they are done changes):
1. Visual first. A short video is not an info journal. Design each shot from "what does the viewer SEE?" before writing a word. If a fact can be shown, show it.
2. The animation explains; the caption sums up. One condensed line per shot: about 6 to 8 words plus the big number (Chinese: at most 14 characters plus the number). Cut every word the picture already says. Short labels inside the picture are fine.
3. Nobody pauses to read. Fast content, not rushed: every line stays up long enough to read at full speed (1 s, plus 0.3 s per word or number, or 0.15 s per Chinese character; never less than a bar of the music). Time follows reading, not the bar grid.
4. Nothing sits still, and nothing is half empty. Every shot moves for its whole length and fills the frame: a big number alone on a half-empty screen is a slide. A shot with nothing to animate gets shorter or gets cut.
5. Every number moves. Counters roll, charts grow, ratios become quantities, flows run.
6. Honest while it moves. An animation never implies more than the source says; condensed lines keep the source's meaning (and quoted words exactly); any arithmetic is "≈" on screen and spelled out in the source line; illustrations are labelled as such.
7. Sources are English first, small and secondary on screen. Prefer English-language sources; only when no good English source exists, use one in the language of the person's idea. The source line keeps the source's own name and language (never translated), sits under the picture for anyone who pauses, and never competes with the caption.

Within them, make it rich: aim for the richest, most dynamic picture the shot allows. A toolbox to pick from (and add to):
- Rolling counter: the hook's big figure, rolling up and landing with a bounce.
- Draining stock: an amount leaving while the counter rolls (items turning red and flying off, leaving empty slots).
- Breaking banner: a bar that wipes over a finished picture to say "this is big", a sourced line crawling under it.
- Bar race: "biggest ever" and comparisons; bars grow in turn and one overtakes.
- Clock and particles: speed; streams pouring out while a clock runs.
- Infection fill: something being compromised, filling cell by cell (label it illustrative).
- Hop path: how something moves through a system, each box lighting as it is reached.
- Untouched object: what was NOT affected, glowing while the rest flows past.
- Bypass: a control that was skipped; the flow goes round the gate, an alarm border flashes.
- Routine log: "it looked normal"; rows of checks scrolling while a total climbs (illustrative).
- Pulse through a pattern: "same playbook"; one pulse through two identical strips, ending on "=".
- Trace graph and stamp: attribution; lines branching out, a SUSPECTED stamp, NOT CONFIRMED typed.
- Split bar: part of a whole, splitting into its shares.
- Shared timeline: wildly different durations on one axis, a cursor running.
- Waffle: a small share of a big total (1,000 squares, 32 lit).
- Drawn fix: the defence; a request travelling, a lock snapping shut.
- Running clock: time pressure; a timestamp that keeps ticking while the event unfolds, red flashing on the hits.
- Money trail: funds splitting into ever more wallets, coins running down the branches (illustrative).
- Event timeline: the story's dates on one axis, landing in turn, the beat that matters glowing.
- Attributed statement: an agency badge, its words typed in exactly, the date under it.
Color: the look sets only the ground and the type (background, text, headlines, the highlighted word, the source line). Pictures and data take the colors their subject needs, from the kit's C.hue: real-world colors (the sky blue, the sun gold, a leaf green) and colors with a meaning (one for what held or the good answer, another for what was lost or abused), never just the look's accents, always readable on its ground. Keep each meaning for the whole video.
Rhythm across the video: alternate big-number shots with diagram shots; change the dominant color as the story turns. A picture that comes back in another shot keeps its design (same layout, colors and labels), so the viewer recognises it at once.`

// Where the subtitles sit (engine/shotloop/cues.mjs), as "68–79%"
const { SUBTITLE_BAND } = await import(new URL('../../engine/shotloop/cues.mjs', import.meta.url).href) as
  { SUBTITLE_BAND: Record<'portrait' | 'landscape', [number, number]> }
const band = (k: 'portrait' | 'landscape') => `${SUBTITLE_BAND[k].map(x => Math.round(x * 100)).join('–')}%`

// With a voice-over (on for a new film, engine/shotloop/voice.mjs) the
// voice carries the explanation: these rules change principles 2 and 3,
// and the rest stand
export const PRINCIPLES_VOICE = `The voice-over (this film has one; it changes principles 2 and 3, the rest stand):
- The voice explains, the picture shows, the screen sums up. Each shot has a spoken line ("say"): one or two short sentences, plain and conversational, about 8 to 25 words (Chinese or Japanese: 15 to 45 characters). The first shot's line hooks in its first words; the last can be a short sign-off or empty.
- The voice's words are subtitled automatically, in a band near the bottom (portrait: ${band('portrait')} of the frame height; landscape: ${band('landscape')}). The shot keeps its own text and anything important out of that band, and never repeats the spoken sentence on screen: its on-screen text shrinks to the big number or a label of 1 to 4 words.
- Time follows the voice: after planning, every line is spoken and its shot gets the line's length plus a breath. Plan durations at about 2.7 words a second (Chinese or Japanese: 4.5 characters a second) plus 0.6 s.
- The picture lands on the words: a number rolls in, an object appears or a chart turns as the voice says it (the shot's code gets each sentence's start and end).
- Lines are written to be heard: short words, no lists, no parentheses, no abbreviations a voice can't say (respell an unusual name the way it sounds). Numbers as they are said: digits are fine in English and Chinese; in other languages write numbers in words. Where the screen shows ≈ the voice says "about".`

// How a 2D shot's code stays renderable frame by frame
export const CODE_2D = `2D code rules:
- No CSS animations or transitions, no setTimeout or requestAnimationFrame: the recorder steps time, and render(t) sets every opacity and transform itself.
- Randomness comes from the kit's seeded hash(a, b), never Math.random(), so a frame always draws the same.
- Don't animate the CSS transform of an SVG element that has a transform attribute (the CSS one replaces it and the element jumps): wrap it in a <g> that holds the position.
- A clipPath's rectangle is in the user space of the element that uses it: clip the parent group, not rows that are themselves translated.
- A little depth is fine with CSS 3D (perspective, transform-style: preserve-3d) on DOM elements; real geometry, light or a camera moving through space belongs in the 3D track.
- Within a frame, keep caption, picture and source line from overlapping: give each its band of the safe area.`

// The voice-over in a shot's code
export const CODE_VOICE = `Voice-over in code:
- ctx.voice is the shot's spoken line, one { text, at, end } per sentence in shot seconds (empty when the shot says nothing). Time reveals to it: a number lands at the moment its sentence says it (estimate within a sentence by its share of the words), and nothing important appears after the last sentence ends.
- Keep text and key parts of the picture out of the subtitle band (portrait: y ${band('portrait')} of H; landscape: ${band('landscape')}); backgrounds and motion may pass behind it.
- A subtitle check runs before every render of the shot and reports, with times, what the subtitles would cover: text in the DOM or SVG, elements marked data-keep="name", and canvas regions the shot reports each frame with window.subtitles.keep(x, y, w, h, 'name') (page CSS px). It can't see unreported canvas shapes, text drawn on a canvas or 3D, so: write on-screen text in the DOM or SVG, never on a canvas; mark the subject the viewer must see (a satellite, a zipper) with data-keep, or report it with subtitles.keep when it is drawn on a canvas; leave big backgrounds (a globe, a grid, a glow) unmarked, they may pass under the subtitles.
- The on-screen text is the number or a short label, never the spoken sentence.`

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu

// Chinese (and Japanese, Korean) characters, words and numbers in a text
function units(text: string) {
  const cjk = (text.match(CJK) ?? []).length
  const tokens = text.replace(CJK, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w))
  const words = tokens.filter(w => /\p{L}/u.test(w)).length
  return { cjk, words, numbers: tokens.length - words }
}

// Seconds a caption must stay fully on screen: about 3 words a second
// (slower than subtitle standards, since nobody should have to pause), a
// number read like a word. The same formula as the 2D kit's readTime
// (engine/shotloop/looks.mjs)
export function readingTime(text: string) {
  const { cjk, words, numbers } = units(text)
  return cjk + words + numbers ? 1 + 0.3 * (words + numbers) + 0.15 * cjk : 0
}

// A shot's captions: its on-screen text, one caption per line
const captions = (text: string) => text.split(/\n+/).map(s => s.trim()).filter(Boolean)

// Seconds a shot spends entering before its caption reads
const ANIMATION = 0.5

// A voiced plan's breaks that can be measured: lines too long or
// missing, on-screen text that repeats the line, a duration far from
// what the line needs (fitted later, but the plan should be close)
export function lintVoice(shots: { title?: string; duration: number; text?: string; say?: string }[]) {
  const issues: string[] = []
  shots.forEach((s, i) => {
    const name = `shot ${i + 1}${s.title ? ` (${s.title})` : ''}`
    const say = (s.say ?? '').trim()
    if (!say) {
      if (i < shots.length - 1) issues.push(`${name}: no spoken line ("say"); every shot but the end card says something`)
      return
    }
    const { cjk, words, numbers } = units(say)
    if (words + numbers > 30 || cjk > 55) issues.push(`${name}: the spoken line is too long (${cjk ? `${cjk} characters` : `${words + numbers} words`}); split the beat into two shots or cut it to about 25 words (45 characters)`)
    const need = (words + numbers) / 2.7 + cjk / 4.5 + 0.6
    if (s.duration + 1.5 < need) issues.push(`${name}: ${s.duration} s is short for its line (about ${need.toFixed(1)} s spoken); give it the time or cut the line`)
    for (const c of captions(s.text ?? '')) {
      const u = units(c)
      if (u.words > 6 || u.cjk > 12) issues.push(`${name}: the on-screen text "${c}" is long for a voiced film; the voice says it, the screen shows the number or a label of 1 to 4 words`)
    }
  })
  return issues
}

// The plan's breaks of the principles that can be measured: captions too
// long (the big number aside), shots too short to read their captions,
// a caption up for less than a bar of the music (bar: seconds)
export function lintPlan(shots: { title?: string; duration: number; text?: string }[], bar = 0) {
  const issues: string[] = []
  shots.forEach((s, i) => {
    const name = `shot ${i + 1}${s.title ? ` (${s.title})` : ''}`
    const list = captions(s.text ?? '')
    for (const c of list) {
      const { cjk, words } = units(c)
      if (words / 8 + cjk / 14 > 1) issues.push(`${name}: the caption "${c}" is too long (about 6 to 8 words, or 14 Chinese characters, plus the number); cut what the picture already says`)
    }
    const need = list.reduce((n, c) => n + Math.max(readingTime(c), bar), 0) + (list.length ? ANIMATION : 0)
    if (s.duration + 0.05 < need) {
      issues.push(`${name}: ${s.duration} s is too short to read its ${list.length > 1 ? `${list.length} captions` : 'caption'} (needs ${need.toFixed(1)} s); shorten or drop text, or give the shot more time`)
    }
  })
  return issues
}
