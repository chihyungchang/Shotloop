// world/screens.js: a product promo's shots, the product shown on its own
// screens on a simulated Mac desktop. It is the engine's
// (engine/shotloop/kits/screens.js), kept current in every promo's world
// before each command: never edit it here; a promo's own pieces go in
// world/*.js modules beside it. The rules it serves are the promo's
// (Settings → Rules, kind promo); use these pieces rather than drawing
// your own, so the rules hold by construction.
//
// Take a piece's HTML as it comes: never rewrite it (a string replaced in
// it breaks when the kit changes). A piece that doesn't fit says so in
// its options; ask for the size you need there.
//
// The pieces live in world/screens/, a file a job: base.js (material,
// the frames, sizes, colours), motion.js (springs, the camera, typing),
// screen.js (shots, the desktop, fields, mark), cursor.js, words.js (the
// drawn pieces) and cards.js (title, end card). Each piece is documented
// where it is defined: read that file for a detail, not this whole kit.
//
// What there is, by job:
//   material   load(...files) in setup; url(file)
//   layout     frame(): this beat's boxes as the plan set them (words,
//              the film's one desktop or a drawing's picture box, steps,
//              source line; a card for the title and the end), the same
//              as the plan's wireframes. layout() works one out by hand
//              (world/promo-layout.js, which also lays out the cards);
//              screenBox(box) the 16:10 screen in a box
//   the screen desktop({ box, windows, view, app, dock }) one Mac desktop,
//              the same box every beat; a window { file, width, height,
//              x, y, w, title, over, draw }; desktopPoint() a picture
//              point for the camera. shot() a picture without a desktop
//              (only for what isn't a product screen)
//   on it      draw: HTML in the picture's own px, moving with it to the
//              pixel: mark({ region }) a highlight, field() typed words.
//              Find a control's region with the find_text tool, never by
//              eye. Never lay anything over the desktop from outside it:
//              it shakes as the camera moves
//   camera     camera(t, keys), follow(t, clicks), drift() for a landed
//              screen; cursor(t, { path, clicks }) on kit.stage
//   words      chapter(), headline() (always: its size from layout()),
//              steps(), bubble(), counter(), row(), compare(), source()
//   cuts, ends wipe(); titleCard() first, endCard() last, both with the
//              product's real logo (rule: promo-open-close)
//
// Two layers, both drawn the same at any t:
// - depth(...html) sets the depth layer for this frame (call it every
//   frame), later parts over earlier ones: the desktop first, the words
//   (chapter, headline…) and wipe() last. It returns the layer, so a live
//   part's field can be filled after.
// - kit.stage(svg) above it: cursor().
//
// Material, named by its place in the project: "images/…" (the person's),
// "repo/pictures/…" and "repo/logo.png" (the repository's), "site/…" (the
// page's: hero.png, framed/, parts/, live/NN-name.json, fonts.css with
// --brand-head and --brand-mono for the words), each with its size in
// pixels (the brief lists them).
//
// The camera moves (in to a click, along to the next, a window dragged)
// happen on the desktop, so nothing else in the frame moves, and what it
// follows sits in its middle. A view never goes closer than the picture's
// own pixels allow (it would blur). The engine measures every render
// (render_stills says what it found): text over text, text cut off, the
// desktop's size and place, empty bands, anything laid over the screen.

export { screenBox } from './promo-layout.js'
export { frame, layout, load, url } from './screens/base.js'
export { endCard, titleCard } from './screens/cards.js'
export { cursor } from './screens/cursor.js'
export { SPRINGS, arrive, camera, drift, follow, springTo, typing } from './screens/motion.js'
export { depth, desktop, desktopPoint, field, fill, livePart, mark, shot, stageBox } from './screens/screen.js'
export { bubble, chapter, compare, counter, headline, row, source, steps, wipe } from './screens/words.js'
