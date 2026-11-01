# Shot checklist

The rules every shot must pass, checked on the stills at the start,
middle and end of the shot (docs/PRD.md §7.6). Seeded from the mistakes
of ep02 (engine/shotloop/blender/kit/README.md, "Checking a shot"). A
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

The 2D rules below are the 2D principles and code rules every 2D prompt
already carries (agent/src/principles.ts): the ids are what a check
reports against, and the principle each one checks is named.

- **visual** (2D): principle 1, the point is carried by a picture (only
  the end card may be text first).
- **caption** (2D): principle 2, one condensed line besides short labels.
- **full** (2D): principle 4, the frame is full at the middle and end.
- **numbers** (2D): principle 5, every number on screen moves.
- **honest** (2D): principle 6.
- **source** (2D, when the shot states a fact): principle 7.
- **read-time** (2D, from the shot's code): principle 3, each caption
  holds still for the kit's readTime before it changes or leaves.
- **code** (2D, from the shot's code): the 2D code rules.
- **continuity** (2D): a picture that recurs across shots (the plan's
  recurring pictures, drawn from world/parts.js) keeps its layout,
  colors and labels; nothing mirrored or recolored between shots.
- **alive** (2D): principle 4, something new every 1 to 2 s, with depth
  (background detail, subject, labels).