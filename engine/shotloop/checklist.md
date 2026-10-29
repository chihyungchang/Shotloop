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
- **caption-zone**: Captions own the top ~40% of the frame (y 110–520 of
  720×1280). The whole subject sits in the lower 60%, including whatever
  appears last.
- **motion**: Something moves that you can follow between the three
  stills: things travelling, lines drawing in, a wave along a row. Only a
  change in glow reads as nothing happening.
- **clean**: No clipping through geometry, no subject under the floor, no
  z-fighting or flicker, nothing cut off by the camera's clip range.
- **safe-area** (2D and end cards): text stays inside x 40–620 and
  y 110–1030 of 720×1280; the bottom ~250 px and the right edge carry the
  platforms' buttons.
