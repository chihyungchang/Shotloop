# 2D explainers

For flat subjects: numbers, comparisons, lists, text. The page is plain
DOM and CSS (and inline SVG); every property is set from `render(t)`.

Steps and shared rules: [../README.md](../README.md). Start from
[`_template/`](_template/). ep04 ("One laptop", not in this repo) is the
reference cut.

The Shotloop app builds 2D videos by these same principles: they are in
every 2D prompt ([agent/src/principles.ts](../../../../agent/src/principles.ts)),
the plan is measured against them, and the shot checklist
([engine/shotloop/checklist.md](../../../shotloop/checklist.md)) checks them.

## The principles (these don't change)

Set by Oliver and a viewer who watches a lot of English short video
(31 Oct 2026). Every 2D episode follows them; only how richly they're
done changes from one episode to the next.

1. **Visual first. A short video is not an info journal.** Design each
   shot from "what does the viewer SEE?" before writing a word. If a
   fact can be shown, show it.
2. **The animation explains; the caption sums up.** One condensed line
   per shot, about 6–8 words plus the big number. Cut every word the
   picture already says.
3. **Nobody pauses to read.** Fast content, not rushed: every line stays
   up long enough to read at full speed (about 3 words a second, never
   less than a bar). Time follows reading, not the bar grid.
4. **Nothing sits still, and nothing is half empty.** Every shot moves
   for its whole length and fills the frame: a big number alone on a
   half-empty screen is a slide (ep04's first hook). A shot with nothing
   to animate gets shorter or gets cut.
5. **Every number moves.** Counters roll, charts grow, ratios become
   quantities, flows run (see the toolbox).
6. **Honest while it moves.** An animation never implies more than the
   source says; condensed lines keep the source's meaning (and quoted
   words exactly); any arithmetic is "≈" on screen and spelled out in
   the source line; illustrations are labelled as such.
7. **Sources are English first**, small and secondary on screen: there
   for anyone who pauses. Prefer English-language sources; only when no
   good English source exists, use one in the language of the video's
   idea. The source line keeps the source's own name and language.

## Within them: make it rich

Aim for the richest, most dynamic picture the shot allows. Pick from
this toolbox (all used in ep04) and keep adding to it:

| Device | Use it for | ep04 example |
| --- | --- | --- |
| Rolling counter | the hook's big figure | $0 → $6,300,000,000, a bounce as it lands |
| Draining stock | an amount leaving, while the counter rolls | 63 gold bars ($100M each) turning red and flying off in step with the counter, leaving empty slots |
| Breaking-news banner | filling a frame once its picture is done, and saying "this is big" | a red BREAKING bar wipes over the emptied vault, LIVE blinking, a sourced headline crawling under it |
| Bar race | "biggest ever", comparisons | Ronin, Poly Network, Bybit grow in turn; Binance overtakes all |
| Clock + particles | speed | ten chains, streams pouring out while a clock runs to 20 minutes |
| Infection fill | something being compromised | a laptop screen filling cell by cell, scrolling code, a bug crawling (illustrative) |
| Hop path | how an attack moves | laptop → system → system → withdrawals, each box lighting as it's reached |
| Untouched object | what was NOT taken | the keys glowing in their case while money flows past |
| Bypass | a control that was skipped | transfers going round a "normal approval" gate, alarm border flashing |
| Routine log | "it looked normal" | rows of ✓ NORMAL scrolling while the total climbs (illustrative) |
| Pulse through a pattern | "same playbook" | one pulse through two identical strips, ending on "=" |
| Trace graph + stamp | attribution | lines branching out to "TraderTraitor?", SUSPECTED stamp, NOT CONFIRMED typed |
| Split bar | part of a whole | $6.3B splitting into ~$3B frozen and the rest still moving |
| Shared timeline | wildly different durations | 20 minutes as a sliver on a 45-day axis, a cursor running the days |
| Waffle | small share of a big total | 1,000 squares, 32 lit |
| Drawn fix | the defence | a request travelling to a phone; a lock snapping shut |

Rhythm across the episode: alternate big-number shots with diagram
shots, change the dominant colour as the story turns (gold = what
held or the good answer, red = what was taken or abused), and land
the cuts on the music's bar lines.

## Code (step 4)

- Layout in absolutely positioned scenes, one `<section>` per shot;
  `render(t)` shows the right one and sets every opacity and transform.
  Inside a shot, a flex column (line, picture, source) keeps text from
  overlapping.
- No CSS animations or transitions, no `setTimeout`, no
  `requestAnimationFrame` outside `?play`: the recorder steps time.
  Randomness comes from a seeded `hash(a, b)`, never `Math.random()`.
- SVG for diagrams. Don't animate the CSS `transform` of an element
  that has a `transform` attribute (the CSS one replaces it and the
  element jumps): wrap it in a `<g>` that holds the position.
- A clipPath's rectangle is in the user space of the element that uses
  it: clip the parent group, not rows that are themselves translated.
- A little depth is fine with CSS 3D (`perspective`,
  `transform-style: preserve-3d`), as in ep01's GPU rig and slot drums.
  When the idea needs real geometry, light or a camera moving through
  space, it belongs in the 3D track.
- Helpers in the template: `rise(t, start, duration)` for an eased
  0 → 1, `lift(el, p)` to fade and rise, `pop(el, p)` to stamp in.
- Give the page a `?bare` mode that hides the words, so `thumb.html`
  can use a frame as the cover's background.

## Changing the timing

Shots get longer or shorter as the cut improves (ep04's hook grew to
two bars, the laptop shrank to one, the fix grew to three). Every time:

- keep a mapping from the old bar numbers in `render(t)` (ep04's
  `b(n)`) rather than retyping every time;
- shift `music.json` (sections, hits, risers, duration) by the same
  amount, and regenerate the WAV;
- update `script.md`'s bar and time columns;
- re-pick the cover frame: `thumb.html` loads `index.html?t=…`, and
  that time moves too;
- update the length in `publish.md`.

## Checking a cut

Render a contact sheet of a frame from every shot before recording, and
look at it: overlaps, a still shot, a line too long to read. Then watch
the MP4 once at full speed with the sound off: if you wanted to pause
anywhere, fix that shot.

## Episodes

| # | Topic |
| --- | --- |
| [01](ep01-password-crack-time/) | How long would a hacker need to crack your password? |
