# 3D explainers

For spatial subjects: a journey (a request crossing the world), objects
you turn around, the inside of a machine. Rendered in **Blender** from a
Python script, captions composited from HTML, music from `music.mjs`.

Steps and shared rules: [../README.md](../README.md). Start from
[`_template/`](_template/).

## Why Blender

ep02's three.js cuts showed the ceiling of hand-built boxes in WebGL:
flicker where faces overlap, flat light, blown-out glows, crude props,
no lens. Blender gives real assets, global illumination and ambient
occlusion, a real camera (focal length, depth of field, motion blur)
and F-curve easing, and still renders the same frames every time from
a script. The cost is render time (tens of minutes per episode).

## Pipeline

| # | Step | File | Notes |
| --- | --- | --- | --- |
| 1–3 | Copy, script, storyboard | `copy.md`, `script.md`, `storyboard.md` | As in ../README.md. |
| 3½ | Scene | `scene.md` | Literal check, locations, **shot list** (lens, move, duration per shot), lights, scale table. |
| 4a | Scene code | `scene.py` | Builds the world and cameras in Blender from `scene.md`. Uses `lib/kit.py`. |
| 4b | Captions | `captions.html` | Only the caption layer, transparent; same `render(t)` contract as 2D. |
| 4c | Music | `music.json` | `engine/video/music.mjs`. |
| 5 | Render | `out/frames/`, `out/*.mp4` | `node engine/video/blender.mjs <episode>`: renders frames, captions, composites, muxes. Iterate with `--stills` (a few frames) and `--draft` (half resolution, ~0.3 s a frame: a 48 s preview in ~7 min); the full render (~1.7–4 s a frame, about an hour) runs once, in the background. |
| 6 | Publish | `thumb.html` → `out/thumbnail.png`, `publish.md` | As in ../README.md: the cover (a raw frame from `out/frames/` under the hook) and the post for each platform. |

## Make it literal

A 3D explainer earns its 3D by showing **things you could point at**: a
person at a desk, the cable out of the wall, the provider's building,
the cable on the seabed, the data centre, the chips.

- **Every step of the story gets a physical stand-in**, written in
  `scene.md`'s literal check before any code. No object, no step.
- **Follow the real path, in order**, so the viewer could retell it.
- **People make scale and stakes**: show who types, presses, approves.
- **Abstraction only on top of a literal base**: a glow on the real
  cable, the model drawn inside the real server.

## Professional subjects are drawn the way experts draw them

When the subject has a real structure (a transformer, a network stack,
a CPU), the picture follows that structure, simplified but not wrong:

- A language model: tokens → embedding vectors → a stack of blocks,
  each with **attention** (lines between token positions, weight as
  thickness) and an **MLP** (a wide layer of units), joined by the
  residual stream → a probability bar chart over next tokens → one
  token chosen. Label it "simplified" in the script.
- Draw networks the way people recognise them: a column of neurons per
  layer on a translucent panel, dense wiring between columns, a grid
  floor, seen in perspective (not flat, side by side). Show the signal
  crossing gap by gap (wires light and grow, the neurons they reach
  light up), with the camera travelling along with it.
- A data centre: hot and cold aisles, racks with servers, cable trays,
  cooling on the roof. A chip: package, die, memory stacks beside it,
  heat sink.
- Check the drawing against a reference (a paper figure, a vendor
  photo) and name the reference in `scene.md`.

## Look

- **Style**: a clean stylised diorama (tidy low-poly or voxel), built
  from CC0 asset packs plus our own modelling, with bevelled edges and
  proper materials. Coherent: one family of packs per episode. No
  characters, logos or UI from any existing game.
- **Light**: an HDRI for sky and fill, one key sun, ambient occlusion,
  soft shadows. Underwater and interiors get their own HDRI or world.
- **Colour management**: AgX view transform. Emission strength capped
  (≤ 4 for glowing props, ≤ 1.5 for screens) and bloom from the
  compositor's Glare node, threshold ≥ 1: glows read as light, never as
  a white blob.
- **Story colours are reserved**: the accent (the thing we follow) and
  the warning colour appear nowhere else in the world.

## Scale

Everything in real metres, written in `scene.md`'s scale table, and the
same object keeps its size for the whole episode. When a traveller (a
data packet) must be readable from far away, show it with a light
trail or a glow on the cable, not by inflating the object between
shots.

## No flicker, no clipping

- No coplanar faces: decals and signs sit ≥ 1 cm proud of the surface
  they're on; boxes that touch share no face.
- Clip start ≥ 5 cm, and keep the clip range tight per shot (far ≤
  2,000 × near): depth precision is what makes distant faces shimmer.
- Bevel hard edges (2–5 mm at prop scale): bevels catch light and hide
  shading seams.
- Characters are posed or animated so limbs never pass through furniture;
  check the contact frames (hands on keys, feet on floor).

## Camera

Each shot is written in `scene.md` as lens, move, duration:

- **One move per shot**: dolly, truck, pedestal, orbit, or crane; or a
  locked-off frame. Never position, aim and focal length changing at
  once.
- **Ease in and out** (Bézier F-curves). Start moving after a short hold,
  settle before the cut.
- **Lenses**: 24–35 mm for places, 50 mm for people, 85–100 mm for
  close-ups. Depth of field on close-ups (f/2.8–4), none on wides.
- **Screen direction**: outbound travel moves left → right, the way back
  right → left. Keep it across cuts.
- **Cuts**: on the music's bar lines; match on action or on the travelling
  object's position where possible; 0.4 s hold before a cut.
- **Motion blur** on (shutter 0.5).
- Text-safe framing: the subject in the middle band, captions own the
  top (y 110–520 CSS px of 720×1280).

## Checking a shot

Each of these went wrong once (ep02). Check them before showing a
draft:

- **Stills at the start, middle and end of every shot**, not one still in
  the middle. A traveller can be in view at mid-shot and hidden at the
  end. Iterate on one shot with `--draft --range a-b`.
- **Sightline**: across the whole move, nothing stands between the camera
  and the subject. Furniture and buildings next to the path are the
  usual blockers: move the prop, or move the camera, before adding more.
- **Readable size**: the subject is at least ~3% of the frame height in
  the draft (a 4 cm packet at 2.5 m is a few pixels: get closer, or use
  a longer lens). A small amber lamp riding with it lights its
  surroundings, so it reads even when it is small.
- **Caption zone**: captions own the top ~40% of the frame. The whole
  subject sits in the lower 60%, including whatever appears last (the
  probability bars at the top of the model ended up behind the caption).
- **Something moves**: a process (the model computing) must show motion
  you can follow: things travelling, lines drawing in
  (`bevel_factor_end`), a wave along a row. Changing only how strongly
  something glows reads as nothing happening.
- **Overviews need a leading line**: a flat top-down map is dull. Look
  along the route into depth, at dusk, with a light trail running on it.

## Blender pitfalls

- **Surfaces are not at z 0.** Asset floors, roads and terrain have
  thickness: measure the top with `bounds()` and place props on it (the
  router and its cable sat under the floor tiles, invisible).
- **Bézier cables overshoot.** With AUTO handles, a cable that drops
  steeply and then runs flat dips below the flat part, under the seabed
  or the floor. Use `kit.curve(..., smooth=True)` (a NURBS that stays
  inside its control points) for any cable resting on a surface.
- **Follow Path needs `curve.use_path`**, which is off for curves made
  through `bpy.data` (`kit.curve` sets it). Without it the object stays
  at the origin, silently.
- **Keys tween by default.** A light switched at 21.6 s, keyed only there
  and at 0 s, fades over the whole 21 s. Make step changes `CONSTANT`
  (`constant()` in ep02's scene.py), and only on the F-curve you mean:
  setting every curve of an action to constant also freezes its motion.
- **Moving subject, moving camera**: an eased camera and an eased
  traveller with different key times drift apart (the seabed pulse was
  25 m ahead of the camera). Give the traveller linear timing and let the
  camera keep pace (`track()` in ep02).
- **Bounds**: call `view_layer.update()` before reading `matrix_world`,
  and use the evaluated mesh for posed characters (`bound_box` is the
  rest pose).
- **Through the water surface** a camera sees a white sheet. Keep the
  crane above the water and cut to an underwater shot, which gets its
  own world (deep blue) and a volume.
- **Stale outputs**: an interrupted or earlier render leaves its mp4 in
  `out/` under the same name. Before sharing a file, check its time is
  after the last change to `scene.py`.
- **Text** extrudes to both sides of its plane: offset it from a panel by
  the extrude plus 1 cm.
- **Many thin glowing lines add up** to a white wall: keep the base
  emission of dense wiring low (~0.1), and build many lines as one curve
  object with one spline each, not thousands of objects.

## Captions

A separate page, `captions.html`: only the caption panel and the
progress bar on a transparent background, rendered by Chrome and
composited over the Blender frames. It uses the same `render(t)`
contract as the 2D track, so the type stays the site's.

## Assets

CC0 only (Kenney, Quaternius, Poly Haven, ambientCG, Poly Pizza CC0).
Downloads live in `engine/video/assets/` (not committed); what each
episode uses is listed in `engine/video/assets/README.md` with source
URL, licence and size, so a fresh checkout can fetch them again.

## Episodes

| # | Topic |
| --- | --- |
| [02](ep02-claude-code-enter/) | What happens when you press Enter in Claude Code? Being rebuilt in Blender. Earlier cuts (abstract three.js, then three.js voxels) are in git history. |
