# Shot checklist

The rules every shot must pass, checked on the stills at the start,
middle and end of the shot (docs/PRD.md §7.6). Seeded from the mistakes
of ep02 (engine/video/explainers/3d/README.md, "Checking a shot"). A
project can replace this list with its own `checklist.md` (shotloop.json
`checklist`).

Each rule has an id the checks report against.

- **sightline**: Across the whole move, nothing stands between the
  camera and the subject. Furniture and buildings next to the path are
  the usual blockers.
- **readable**: The subject is at least ~3% of the frame height and
  inside the frame, at the start, middle and end. Something tiny or at
  the edge of the frame does not read.
- **caption-zone**: With a caption layer (captions.html in shotloop.json),
  captions own the top ~40% of the frame (y 110–520 of 720×1280) and the
  whole subject sits in the lower 60%, including whatever appears last.
  Without one (2D pages that draw their own headline), nothing may
  overlap the headline: the subject stays clear of it.
- **motion**: Something moves that you can follow between the three
  stills: things travelling, lines drawing in, a wave along a row. Only a
  change in glow reads as nothing happening.
- **clean**: No clipping through geometry, no subject under the floor, no
  z-fighting or flicker, nothing cut off by the camera's clip range.
- **safe-area** (2D and end cards): text and the subject stay inside
  x 40–620 and y 110–1024 of 720×1280 (2D: the kit's PAD, SAFE_TOP,
  SAFE_RIGHT, SAFE_BOTTOM); the bottom 20% and the right edge carry the
  platforms' buttons. Backgrounds may fill the frame.
- **visual** (2D): the shot's point is carried by a picture (a chart,
  diagram, object, icon or visual metaphor), not by text alone; words
  only label it. Only the end card may be text first.
- **caption** (2D): one condensed line sums the shot up (about 6–8
  words, or 14 Chinese characters, plus the big number) besides short
  labels; nothing the picture already says, no sentence to read through.
- **full** (2D): the picture fills the frame at the middle and end; no
  big number or line alone on a half-empty screen (a slide).
- **numbers** (2D): every number on screen moves: it rolls, grows into
  a chart, becomes a quantity or a flow.
- **honest** (2D): the picture implies no more than the source line
  says; arithmetic shows "≈" and is spelled out in the source line;
  illustrations are labelled as such.
- **source** (2D, when the shot states a fact): a small source line
  sits under the picture, secondary to the caption, not overlapping it.
- **read-time** (2D, from the shot's code): every caption is fully on
  screen, still, for at least its reading time (the kit's readTime: 1 s,
  plus 0.3 s a word or number, or 0.15 s a Chinese character) before it
  changes or leaves.
- **code** (2D, from the shot's code): no CSS animations or transitions,
  timers or Math.random (the kit's hash instead).
- **continuity** (2D): a picture that recurs across shots (the plan's
  recurring pictures, drawn from world/parts.js) keeps its layout,
  colors and labels; nothing mirrored or recolored between shots.
- **alive** (2D): the frame has depth and keeps changing at a pace you
  can follow: something new every 1 to 2 s, layers (background detail,
  subject, labels), nothing frozen for long while the caption holds.
