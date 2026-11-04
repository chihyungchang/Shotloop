// The rules of a Shotloop video, their one source: the 2D prompts
// (agent/src/principles.ts) and the checklist every shot is reviewed
// against are both made from these lists. Three kinds:
//
// - FIXED: what makes a frame broken or a video untrue (nothing covered,
//   no broken frames, honest, sourced). On unless the person switches one
//   off; never edited or removed. A locked one (\`locked\`: what keeps a
//   film true, lawful or renderable) can't be switched off either.
// - TASTE: the house taste, set by Oliver with a viewer who watches a lot
//   of English short video (31 Oct 2026). Defaults: the person can reword
//   or remove any of them, restore it, and add their own.
// - TOOLS: the devices a plan picks from, each for the tracks it fits,
//   any of them switched off or on by the person
//   (`tracks`; a 2D device that can be staged in 3D says how in `text3d`).
//   The product group is for a product promo's screenshots (screens.js).
//   The built-in ones stay as they are (2D ones with an example still in
//   tools/<id>.jpg, 9:16; a product promo's 16:9, its frame); the person
//   can add their own, with a picture.
//
// What the person changed lives in their rules folder:
//
//   rules/rules.json   { fixedOff: [<id>], toolsOff: [<id>],
//                        taste: { <id>: { text } | { off: true } },
//                        mine: [{ id, text, track, created }],
//                        tools: [{ id, name, text, track, image, created }] }
//   rules/<id>.<ext>   a tool's picture
//
// A rule's `rule` is what the prompts say, its `check` what a review
// judges on the stills (a rule without one is only said). Tracks: '2d',
// '3d' or 'all'. A rule with a `kind` is for one part of the work only:
// 'promo' a product promo's shots (with the film's own), 'voice' a voiced
// film's shots, 'cover' the cover, 'sound' the sound pass; one without is
// for every film's shots.
// Prompts carry only mechanics (formats, tools, the material); what makes
// a film good is a rule here, where the person sees and sets it.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, safeId, writeJson } from './project/files.mjs'
import { pageLayout } from './data.mjs'
import { SIZES } from './project/project.mjs'

const RULES = process.env.SHOTLOOP_RULES ?? path.join(os.homedir(), '.shotloop', 'rules')
const FILE = path.join(RULES, 'rules.json')
const BAD = path.join(RULES, 'rules.json.bad')
const STILLS = fileURLToPath(new URL('tools', import.meta.url))
export const MAX_CHARS = 1500
const IMAGE = /\.(jpe?g|png|webp)$/i
const TRACKS = ['all', '2d', '3d']
const MAX_IMAGE_MB = 8

// The safe area of each frame, from the pages' own layout (looks.mjs), in
// the page's CSS px: what a check measures a shot against
const safeArea = size => {
  const { w, h, pad, safeTop, safeRight, safeBottom } = pageLayout(size)
  return `x ${pad}–${safeRight}, y ${safeTop}–${safeBottom} of ${w}×${h}`
}
const SAFE = `tall frames ${safeArea(SIZES.portrait)}, wide frames ${safeArea(SIZES.landscape)}`

const FIXED = [
  {
    id: 'caption-zone', track: 'all', name: 'Nothing covered',
    rule: 'Nothing covers what must be read or seen: caption, headline, picture and source line each keep their own band of the safe area, text never overlaps text, and with a voice-over nothing important sits in the subtitle band.',
    check: 'Nothing overlaps the headline: the subject stays clear of it, including whatever appears last. No text overlaps other text, and with a voice-over no text or key part of the subject sits in the subtitle band.'
  },
  {
    id: 'safe-area', track: 'all', name: 'Inside the safe area',
    rule: `Text and the subject stay inside the safe area (${SAFE}; 2D: the kit's PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM): in a tall frame the bottom 20% and the right edge carry the platforms' buttons. Backgrounds may fill the frame.`,
    check: `Text and the subject stay inside the safe area (${SAFE}; 2D: the kit's PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM); in a tall frame the bottom 20% and the right edge carry the platforms' buttons. Backgrounds may fill the frame, and a screen may run off its edge.`
  },
  {
    id: 'clean', track: 'all', locked: true, name: 'No broken frames',
    rule: 'Every frame is clean: nothing clipped, flickering or cut off by the frame or the camera, in a lit 3D scene nothing blown out but a light source, no text spilling out of its box or wrapping where it shouldn\'t, no blank or half-drawn frame, no placeholder left over, and nothing jittering: a piece at rest holds still to the pixel, a move runs smooth.',
    check: 'No clipping through geometry, no subject under the floor, no z-fighting or flicker, nothing cut off by the camera\'s clip range or the frame edge. 3D: nothing blown to flat white but a light source (the stills\' exposure check stripes such areas). No text overflowing or wrapping badly, no blank, half-drawn or placeholder frame, nothing shaking from frame to frame.'
  },
  {
    id: 'readable', track: 'all', locked: true, name: 'Readable',
    rule: 'The subject is big enough to read and inside the frame; text is large enough and stands out from its ground.',
    check: 'The subject is at least ~3% of the frame height and inside the frame, at the start, middle and end. Something tiny or at the edge of the frame does not read; text is legible against what is behind it.'
  },
  {
    id: 'sightline', track: '3d', name: 'Clear sightline',
    rule: 'Across the whole camera move, nothing stands between the camera and the subject.',
    check: 'Across the whole move, nothing stands between the camera and the subject. Furniture and buildings next to the path are the usual blockers.'
  },
  {
    id: 'read-time', track: '2d', name: 'Nobody pauses to read',
    rule: 'Fast content, not rushed: every line stays up long enough to read at full speed (1 s, plus 0.3 s per word or number, or 0.15 s per Chinese character; never less than a bar of the music). Time follows reading, not the bar grid.',
    check: 'From the shot\'s code: each caption holds still for the kit\'s readTime before it changes or leaves.'
  },
  {
    id: 'honest', track: '2d', locked: true, name: 'Honest while it moves',
    rule: 'An animation never implies more than the source says; condensed lines keep the source\'s meaning (and quoted words exactly); any arithmetic is "≈" on screen and spelled out in the source line; illustrations are labelled as such. In science, the picture is a model and says so: a stretched scale says "not to scale", slowed or sped time says by how much ("slowed ≈1,000,000×"), an analogy is labelled as one, and the law it follows is named in the source line. A diagram may shrink distances or stretch an effect to be seen, but a law is computed in real units at real scale and only its result is mapped to the screen. Never apply a law to the squeezed drawing: put the Moon 2.5 Earth radii away instead of 60 and the inverse square makes the far tidal bulge a third of the near one, when in truth they are within about 5% of each other. Stretch the result by one stated factor (labelled), so what the picture compares stays true: equal stays equal, bigger stays bigger by the true ratio or is labelled as exaggerated.',
    check: 'Nothing on screen implies more than the source; arithmetic is "≈" and spelled out; illustrations, stretched scales and sped time are labelled. A law is computed at real scale and what the picture compares keeps its true ratio, or is labelled exaggerated.'
  },
  {
    id: 'source', track: '2d', name: 'Sourced',
    rule: 'Every fact on screen has its source in a small source line under the picture, which keeps the source\'s own name and language (never translated).',
    check: 'When the shot states a fact, its source line is there, under the picture, in the source\'s own name and language.'
  },
  {
    id: 'sources-read', track: 'all', locked: true, name: 'Sources read, not remembered',
    rule: 'Every fact and number the film states comes from a page read while planning it (a product promo: from its page or repository), and its source names that page\'s address. A source from memory, a made-up title or a page never opened is not a source: find the fact on a real page, or leave it out.',
    check: 'Every fact\'s source names a page that was read for the plan; nothing on screen states a fact that has none.'
  },
  {
    id: 'code', track: '2d', locked: true, name: 'Renders frame by frame',
    rule: 'The shot\'s code follows the 2D code rules, so every frame draws the same whenever and in whatever order it is rendered.',
    check: 'From the shot\'s code: the 2D code rules.'
  },
  {
    id: 'real-people', track: 'all', locked: true, name: 'No real names unasked',
    rule: 'No real brand, company or person unless the idea (or, in a promo, the product itself) asks for them. A news story names only the companies, agencies and people its sources name, dates every event, and keeps "alleged" or "says" where its sources do.',
    check: 'No real brand, company or person appears that the idea or the product doesn\'t ask for; a news story names only whom its sources name, dates its events and keeps "alleged" where they do.'
  },
  {
    id: 'original', track: 'all', locked: true, name: 'Original designs',
    rule: 'Characters, mascots and designs are original: never a copy or a near copy of a known character, mascot, logo or brand design, unless it is the product\'s own in a promo.',
    check: 'No character, mascot or design copies a known one (the product\'s own aside, in a promo).'
  },
  {
    id: 'promo-real', track: 'all', kind: 'promo', locked: true, name: 'Only what the product has',
    rule: 'Screens come from the product\'s pictures and words from its page, quoted as it says them: never draw a feature, a number or a screen it doesn\'t have, and state a price only as the page does. A screen drawn for a beat the pictures don\'t cover stays plain and true to the real one.',
    check: 'Every screen shown comes from the product\'s pictures (or is plainly true to them), and every claim from its page.'
  },
  {
    id: 'promo-on-screen', track: 'all', kind: 'promo', locked: true, name: 'True to the screen it\'s on',
    rule: 'Whatever is drawn onto a product\'s screen (typed words, a caret, a highlight, its next state) sits exactly on the element it belongs to and looks as the product would draw it: its font, size and colour, typed words no bigger than the screen\'s own text in that field, nothing offset from its element or spilling past it. A highlight hugs the edges of the control it marks and stands out against the screen under it (the accent, or ink where the accent is close to the screen\'s own colours). All of it is drawn on the screen\'s picture (screens.js: a shot\'s or a window\'s draw, mark()), so it moves with the screen to the pixel and never shakes against it as the camera moves. Two pictures blend from one state to the next only where they line up; otherwise the beat cuts between them.',
    check: 'Everything drawn on a screen sits exactly on its element at the screen\'s own text size; no overlay is offset or oversized, a highlight hugs its control in a colour that stands out and moves with the screen, no blend shows two misaligned pages.'
  },
  {
    id: 'promo-logo', track: 'all', kind: 'promo', locked: true, name: 'The real logo',
    rule: 'The product\'s logo is its real one, the picture the project holds (repo/logo.png, site/logo.png or the person\'s), shown as it is: never drawn, redrawn or imitated in code, recoloured or cropped. With no logo among the pictures, the name alone, in the product\'s font.',
    check: 'Any logo shown is the product\'s own picture, unaltered; no drawn or imitated mark.'
  },
  {
    id: 'promo-open-close', track: 'all', kind: 'promo', locked: true, name: 'A title and an end card',
    rule: 'A promo opens on its title and closes on its end card. The title is the first thing seen, drawn with screens.js titleCard() and the end card with endCard(): the product\'s real logo and name (its one line may join them), held long enough to read, as a beat of its own or the first seconds of the first one, before the hook; the card stands alone, no headline or chapter label beside it. The end card is the last beat: the name, the line to remember and where to get it. Title and end card are beats like any other: every frame of them a finished design (promo-fill), never a small block of words on an empty frame.',
    check: 'The film\'s first frames show the product\'s logo and name, readable; its last beat is the end card with the name, the line and where to get it; both fill the frame as any beat must.'
  },
  {
    id: 'promo-aligned', track: 'all', kind: 'promo', locked: true, name: 'Aligned, nothing stray',
    rule: 'What belongs together lines up: a logo centred on its name\'s capitals, a lockup\'s name, rule and line on one left edge, labels and chips on a shared edge, a headline\'s lines on one left edge. Nothing stray: no leftover box, outline or shape the design doesn\'t use.',
    check: 'The logo sits centred on its name\'s capital height; parts of a group share an edge; no leftover box or outline anywhere.'
  },
  {
    id: 'promo-desktop', track: 'all', kind: 'promo', locked: true, name: 'Screens on a desktop',
    rule: 'Every screen of the product (a program, a website, an app) is shown in a window on a computer\'s desktop (screens.js desktop(): wallpaper, menu bar, Dock), never as a bare screenshot, a cut-out part or a window loose on the film\'s ground. A close-up is the desktop\'s camera moving in on the window; clicking, typing and dragging happen on the desktop. The film has one desktop, the same size and place in every beat (the same box, filling most of the frame), moved only by its own camera: it never shrinks to make room for words, and nothing outside it moves with it. It keeps a real screen\'s proportions (16:10), never squashed or stretched to fill a box, and where it sits follows the frame: beside the headline or under it, whichever shows it largest (screens.js layout(\'auto\')), chosen once for the film.',
    check: 'Every product screen sits in a window on the desktop, which has the same size and place in every beat, beside or under the headline as shows it largest, at a screen\'s 16:10 (never squashed), and fills most of the frame; none is a bare screenshot, a cut-out part or a loose window.'
  },
  {
    id: 'promo-fill', track: 'all', kind: 'promo', locked: true, name: 'Every frame designed',
    rule: 'Every frame of the film is a finished design, not only the one each beat settles on: from a beat\'s first frame to its last, through entrances, camera moves and wipes, the desktop takes at least half of the frame\'s height and more of it than anything else; a drawing (the problem\'s) keeps the proportions of what it shows (a film\'s frame drawn at the film\'s 9:16 or 16:9, screens.js row() aspect), never stretched to fill, yet is big enough to carry the beat (at least 60% of its box\'s width and 40% of its height, its pieces readable on a phone), balanced in its box, never stranded over an empty half; thin strips (a source line, a counter, a rule) never count as filling the frame, and headlines one size from beat to beat (layout()\'s size). Nothing touches: a gap of at least 5% of the frame\'s height between a headline and what is under or beside it, between pictures, and above the source line (its own band at the bottom), stacked as much as side by side; place pieces in the boxes screens.js layout() gives, set headlines with its headline() at layout()\'s size (never redrawn by hand, so lines never collide), and whatever goes under a headline at its words.under. A close-up frames whole things: the edge of the desktop or of the frame never cuts a line of the screen\'s text or a control in half.',
    check: 'At the start, middle and end of the beat alike: the desktop at least half the frame\'s height and the biggest thing, a drawing at least 60% of its box\'s width and 40% of its height, balanced in it (strips of text don\'t fill a frame), the headline the same size as in the other beats, a clear gap between every two pieces, and no line of text or control cut in half at an edge.'
  },
  {
    id: 'promo-crisp', track: 'all', kind: 'promo', locked: true, name: 'Always sharp',
    rule: 'Every screen stays sharp in every frame: never enlarged past its own pixels, nothing left blurred longer than a passing motion. For a close-up use the high-resolution captures.',
    check: 'No screen looks soft, pixelated or blurred once a move has ended.'
  },
  {
    id: 'promo-clear-words', track: 'all', kind: 'promo', locked: true, name: 'No words over busy screens',
    rule: 'Words sit on the film\'s ground beside or above the product, never over a busy screen where they would fight its own text.',
    check: 'No headline, label or caption lies over busy UI.'
  }
]

const TASTE = [
  {
    id: 'visual', track: 'all', name: 'Visual first',
    rule: 'A short video is not an info journal. Design each shot from "what does the viewer SEE?" before writing a word. If a fact can be shown, show it.',
    check: 'The point is carried by a picture (only the end card may be text first).'
  },
  {
    id: 'caption', track: '2d', name: 'The animation explains; the caption sums up',
    rule: 'One condensed line per shot: about 6 to 8 words plus the big number (Chinese: at most 14 characters plus the number). Cut every word the picture already says. Short labels inside the picture are fine.',
    check: 'One condensed line besides short labels.'
  },
  {
    id: 'full', track: '2d', name: 'Nothing sits still, and nothing is half empty',
    rule: 'Every shot moves for its whole length and fills the frame: a big number alone on a half-empty screen is a slide. A shot with nothing to animate gets shorter or gets cut.',
    check: 'The frame is full at the middle and end. A band of a third or more of the safe area holding only background (often the top half above a centred diagram) fails it.'
  },
  {
    id: 'alive', track: '2d', name: 'Always something new',
    rule: 'Something new every 1 to 2 s, with depth: background detail, the subject, labels.',
    check: 'Something new every 1 to 2 s, with depth (background detail, subject, labels).'
  },
  {
    id: 'motion', track: 'all', name: 'Motion you can follow',
    rule: 'Something moves that you can follow: things travelling, lines drawing in, a wave along a row. A change in glow alone reads as nothing happening.',
    check: 'Something moves that you can follow between the three stills: things travelling, lines drawing in, a wave along a row. Only a change in glow reads as nothing happening.'
  },
  {
    id: 'numbers', track: '2d', name: 'Every number moves',
    rule: 'Counters roll, charts grow, ratios become quantities, flows run.',
    check: 'Every number on screen moves.'
  },
  {
    id: 'hero', track: 'all', name: 'The point is the hero, seen square on',
    rule: 'The picture that carries the shot\'s point is its biggest, clearest part, not a panel in a corner under a decorative globe; and when the point is a shape or a proportion (an orbit that is almost a circle, a patch twice as wide), show it face-on, with no perspective that bends it: a true circle tilted into an ellipse looks like the myth it replaces. One idea per picture: don\'t layer seasons, night and labels on one sphere.',
    check: 'The picture that carries the point is the biggest part of the frame, and a shape or proportion it compares is seen face-on, not bent by perspective.'
  },
  {
    id: 'science', track: 'all', name: 'Science shows the principle working',
    rule: 'For a science subject (a mechanism, a law, a process), show the principle working, not a picture of the thing with a label on it. Ask what can\'t be seen (too small, too fast, too slow, invisible) and make that the shot. Draw a field over the whole object (arrows all round the Earth, along the whole wire), not at two or three sample points: where it pushes in matters as much as where it pulls out. The matter moves while the force acts on it (the water flowing round into the bulges as the arrows grow), never arrows first and then a cut to the result. Every key number on screen has its cause in the picture: if a time is 12 h 25 min rather than 12 h because the Moon moves on, the Moon moves on screen.',
    check: 'When the shot shows a law or mechanism: a field covers the whole object; the matter moves while the force acts; every key number has its cause in the picture.'
  },
  {
    id: 'sources-small', track: '2d', name: 'Sources English first, small and secondary',
    rule: 'Prefer English-language sources; only when no good English source exists, use one in the language of the person\'s idea. The source line sits under the picture for anyone who pauses and never competes with the caption.'
  },
  {
    id: 'color', track: '2d', name: 'Colors with a meaning',
    rule: 'The look sets only the ground and the type (background, text, headlines, the highlighted word, the source line). Pictures and data take the colors their subject needs, from the kit\'s C.hue: real-world colors (the sky blue, the sun gold, a leaf green) and colors with a meaning (one for what held or the good answer, another for what was lost or abused), never just the look\'s accents, always readable on its ground. Keep each meaning for the whole video.'
  },
  {
    id: 'rhythm', track: '2d', name: 'Rhythm across the video',
    rule: 'Alternate big-number shots with diagram shots; change the dominant color as the story turns.'
  },
  {
    id: 'continuity', track: '2d', name: 'A picture that comes back looks the same',
    rule: 'A picture that comes back in another shot keeps its design (same layout, colors and labels), so the viewer recognises it at once.',
    check: 'A picture that recurs across shots (the plan\'s recurring pictures, drawn from world/parts.js) keeps its layout, colors and labels; nothing mirrored or recolored between shots.'
  },
  {
    id: 'act-it-out', track: '3d', name: 'Act a story out',
    rule: '3D is for acting a story out, like a film at lower fidelity than real animation: something or someone does things, reacts and moves through a world, and the camera follows. One story with a beginning, a turn and an end, carried by the picture; the voice supports it. A small original character and a world you come back to give it heart and scale (the change seen there, not labelled).'
  },
  {
    id: 'only-3d', track: '3d', name: 'Every shot does what only 3D can',
    rule: 'A camera moving through space with foreground and parallax, a scale reveal, the view from the surface, riding along with the subject, orbiting round it, a crash zoom that matches into another scale. If 2D could do the shot as well, redo it.',
    check: 'The shot uses depth: the camera moves through space, or round, along or into the subject; it is not a flat picture a 2D page could draw.'
  },
  {
    id: 'first-frame', track: '3d', name: 'The first frame is the most beautiful',
    rule: 'Frame one is the hero image of the film, with the hook line over it: the subject big and lit, a striking composition, nothing still loading in.'
  },
  {
    id: 'animation', track: '3d', name: 'Animation principles',
    rule: 'Anticipation before a big move (the wind-up, the swell before a collapse), ease in and out, overlapping action after it, holds where the beat lands; cuts and hits in step with the music.'
  },
  {
    id: 'words-help', track: '3d', name: 'Words and numbers that help, off the subject',
    rule: 'A 3D short reads better with a little type: a headline per beat, a live number where it is the point (a timer, a counter, a distance), short labels pinned to things, an honesty tag ("not to scale", "time x48") and the source line. All of it in the type layer above the world, never over the subject: the picture still carries the story.',
    check: 'The text and numbers help the point and none of them covers the subject.'
  },
  {
    id: 'size-importance', track: '3d', name: 'Size equals importance',
    rule: 'What the beat is about is the largest, brightest, most contrasted thing in frame; change the shot size when importance moves, not for variety (Hitchcock\'s rule): a wide to place the viewer, closer as attention narrows.',
    check: 'What the beat is about is the largest, brightest thing in frame.'
  },
  {
    id: 'motivated-camera', track: '3d', name: 'Every move has a reason and held ends',
    rule: 'A move follows a subject, reveals something or expresses a feeling, never drifts for its own sake; it starts and ends on a composed frame held for a moment, one move per shot.',
    check: 'The camera move reveals, follows or approaches the subject, and starts and ends on a composed frame.'
  },
  {
    id: 'cause-effect', track: '3d', name: 'Cause before effect, one idea a shot',
    rule: 'Show the trigger (a lever, a spark, a push) before the result, never the result first; stage each shot so it reads with the sound off and from the silhouette alone (Disney\'s staging).'
  },
  {
    id: 'contrast-build', track: '3d', name: 'Contrast builds to the climax',
    rule: 'Plan contrast across the film: similar shapes, light and pace at the start, the strongest contrast of shape, light, speed and colour at the payoff, calm again at the end (Bruce Block\'s contrast and affinity).'
  },
  {
    id: 'cut-emotion', track: '3d', name: 'Cut for feeling and the eye',
    rule: 'Choose each cut for the feeling first, then hand the eye on: the next shot\'s subject where the eye already is at the end of the last (Walter Murch\'s rule of six, eye-trace).'
  },
  {
    id: 'geography', track: '3d', name: 'Keep the world\'s geography',
    rule: 'Things keep their screen direction (outbound left to right, the way back right to left) and a close-up comes after a view that shows where it is, so the viewer never loses the place (the 180° rule).'
  },
  {
    id: 'breathing-room', track: '3d', name: 'Let it breathe',
    rule: 'Cinema holds on a striking image: after a payoff hold the frame 0.5 to 1.5 s with nothing new so the point lands, and frame the subject with darkness and empty space.'
  },
  // A product promo's taste (kind: 'promo'): said and checked only for a
  // promo of the person's software, website or app, in either frame
  {
    id: 'promo-story', track: 'all', kind: 'promo', name: 'The problem first, then the product',
    rule: 'Tell the product\'s story from its makers\' own words (its repository and page): after the title, open on the problem the viewer knows, shown as a picture with a real number where the material has one (one shot is wrong, so 7 of 7 render again), then the product answering it on its own screen (only 1 of 7 renders); then three to five selling points, each its own chapter; end on the one thing to remember. A promo, not a tutorial: never walk through steps, pages or results the material doesn\'t show.',
    check: 'After its title the film shows a problem as a picture, answers it on the product\'s screen, and ends on one line to remember; no shot walks through a flow the material doesn\'t show.'
  },
  {
    id: 'promo-explain', track: 'all', kind: 'promo', name: 'The product shows it, not a drawing',
    rule: 'Whatever the product does is shown on the product itself: its own screens on the desktop, clicked, typed into, changing state (its answer, its features, its results). A drawing (a row of tiles, a counter, steps) may stand only for what lies outside the product, such as the problem or the old way before it, and never fills a beat that is about the product.',
    check: 'Every beat about what the product does shows its own screens; drawings appear only for the problem or the old way, outside the product.'
  },
  {
    id: 'promo-chapters', track: 'all', kind: 'promo', name: 'One chapter style, big headlines',
    rule: 'How a beat is labelled is the film\'s own choice (a numbered mono label over a rule, a plain word, no label at all), and once chosen it holds through the whole film: every beat, the first included, labelled the same way, in the same place, fonts and colours (numbered, then all of them, from 01). Headlines are big and heavy, the boldest thing in the frame after the product, one or two lines rising line by line (the second, the turn, muted).',
    check: 'Every beat, the first included, labels itself the same way as the others; the headline is big and bold, at most two lines.'
  },
  {
    id: 'promo-one-part', track: 'all', kind: 'promo', name: 'One part of the product, big',
    rule: 'Each beat puts one part of the product forward, big enough to read at phone size: the text on it at least about 1/40 of the frame\'s height. The desktop\'s camera comes close to the part a beat is about.',
    check: 'The product part the beat is about is readable at phone size.'
  },
  {
    id: 'promo-in-use', track: 'all', kind: 'promo', name: 'Show it in use',
    rule: 'A promo shows the product being used, not only looked at: its screen beats walk the product\'s real flow, each doing one task the way a person does it, step by step in order: the pointer glides to the control and clicks it while the desktop\'s camera comes in, words are typed only into the field just clicked, and what the click brought shows (the next screen, words typed, a panel that opens; screens.js act()). Never words appearing in a field no one clicked, nor a box drawn where an action should be. A screenshot only pushed in on is a picture of the product, not a demo of it.',
    check: 'At least one beat drives the product on the desktop: the cursor clicks a real control, the camera centres the click, and its result shows.'
  },
  {
    id: 'promo-motion', track: 'all', kind: 'promo', name: 'Calm, exact motion',
    rule: 'Things rise in short ease-outs (half a second at most), staggered 60 to 100 ms, with no bounce; a cut is a wipe (an ink panel crossing the frame in about 0.36 s) or the camera moving in; a screen that has landed keeps pushing in slowly (about 4% over its beat), so nothing sits frozen for more than a second. Never rush a transition.',
    check: 'Rises are short and unbouncy; cuts are wipes or camera moves; no frame sits frozen for more than a second.'
  },
  {
    id: 'promo-one-focus', track: 'all', kind: 'promo', name: 'One focus at a time, quietly marked',
    rule: 'Attention goes to one place at a time and can\'t be missed: the thing that matters is marked while the rest dims. A mark on the product\'s screen is quiet and rare: what the pointer clicks needs none (the click shows it), and a box is drawn only round a result the viewer must notice after an action, one at a time; a thin, crisp outline in a colour of the screen\'s own (its accent) or plain ink, never the film\'s loud brand colour, a glow or a fill over someone\'s UI; a label chip on it small and neutral. A pointer, when one is needed, is large, moves on a smooth curve and clicks visibly.',
    check: 'One clear focus at each moment; marks on the screen are thin and quiet in colour, no loud brand colour or glow over the UI.'
  },
  {
    id: 'promo-lockup', track: 'all', kind: 'promo', name: 'Logo and name as one',
    rule: 'Where the logo stands with the product\'s name (the title, the end card), it is as tall as the name\'s capitals and sits just before it, the two read as one mark; the name in the product\'s own font and weight.',
    check: 'The logo is as tall as the name\'s capitals, right before it, one mark.'
  },
  {
    id: 'promo-brand', track: 'all', kind: 'promo', name: 'The product\'s own visual system',
    rule: 'The film wears the product\'s system: its ground (paper or ink), its one accent, its fonts (the page\'s, from site/fonts.css), its corners and rules; one theme for the whole film. The end card is a field of the accent with the product\'s name huge, the line to remember and its address. Never generic neon, a rainbow gradient or a blurred grey copy of the app as a background.',
    check: 'Ground, accent, fonts and corners are the product\'s own, one theme throughout; no generic neon or blurred grey background.'
  },
  {
    id: 'promo-voice', track: 'all', kind: 'promo', name: 'A voice tells it',
    rule: 'A promo is narrated: the voice tells the story in one short line a chapter, the picture shows it, the headline sums it up in a few words; each chapter starts when its line does, with a music bed under the voice.'
  },
  {
    id: 'promo-words', track: 'all', kind: 'promo', name: 'Few words',
    rule: 'Headlines are a few words; labels and chips are short mono capitals; the product\'s screens say the rest.',
    check: 'Headlines and labels are short.'
  },
  {
    id: 'promo-vary', track: 'all', kind: 'promo', name: 'Each chapter its own picture',
    rule: 'Neighbouring chapters change their picture: a diagram, then a screen; the screen on the right, then a row below the headline. Never the same frame twice in a row.',
    check: 'No two chapters in a row share the same layout.'
  },
  // Moved out of the prompts (3 Nov 2026), so the person sees and sets them
  {
    id: 'shot-count', track: 'all', name: 'A handful of shots, hook first',
    rule: '4 to 8 shots, one idea each: the first is the hook (3 to 4 s), the last an end card (2 to 3 s).',
    check: 'The film has 4 to 8 shots, a short hook first and a short end card last.'
  },
  {
    id: 'length', track: 'all', name: 'No padding',
    rule: 'When the length is left to the plan, the film is as long as its content needs at the reading pace of these rules, no padding: usually 20 to 45 s.'
  },
  {
    id: 'type-natural', track: 'all', name: 'Type as it was drawn',
    rule: 'Text is set in normal-width faces (2D: the kit\'s FONT and HEAD_FONT), never squeezed or stretched by transforms or condensed widths to fit; shorten or wrap it instead.',
    check: 'No text is squeezed, stretched or condensed to fit.'
  },
  {
    id: 'subject-fills', track: '3d', name: 'The subject fills the frame',
    rule: 'The subject the shot is about fills the frame between the caption and the subtitle band, at least half the frame\'s width, and the thing the line talks about (the gap under the car, the fan) is plainly visible.',
    check: 'The subject spans at least half the frame\'s width, and what the line talks about is plainly visible.'
  },
  {
    id: 'lens', track: '3d', name: 'Lens and angle',
    rule: 'A lens from 24 mm (places) to 100 mm (close-ups); position, aim and lens never all change at once. Vary the camera from the shots around it (closer, lower, a three-quarter view), never the same side view twice in a row.',
    check: 'The camera differs from the shots next to it; never the same side view twice in a row.'
  },
  {
    id: 'light', track: '3d', name: 'Light reads as light',
    rule: 'One key light and a rim, the studio\'s reflections on metal and glass, glowing parts kept in check, backgrounds dim, bloom only on what is brighter than white.',
    check: 'The subject is lit by a key and a rim; nothing glows flat white but a light source.'
  },
  {
    id: 'cover-message', track: 'all', kind: 'cover', name: 'One message, read at thumbnail size',
    rule: 'A headline that makes someone want to watch, from the hook or the payoff: about 4 to 12 words (Chinese or Japanese: 6 to 14 characters), at most one short supporting line or one big number. Headline 120 to 200 px, heavy, one or two words in the accent color, strong contrast (darken or blur a busy frame under it); one focal point, generous margins, nothing small.'
  },
  {
    id: 'cover-fresh', track: 'all', kind: 'cover', name: 'A cover, not a frame',
    rule: 'The cover is composed fresh in the video\'s style (its palette, type and a strong frame of it as a picture), never a copy of the first shot.'
  },
  {
    id: 'sound-sparse', track: 'all', kind: 'sound', name: 'Few sounds, exactly placed',
    rule: 'Only the beats that matter get a sound (a gear locking, a part landing, a crash zoom, a smash cut), at most one clear effect every 2 to 3 seconds; silence makes the next one count. With a voice-over the voice comes first: loud effects sit in the pauses between sentences, quiet ones may sit under a word.'
  },
  {
    id: 'voice-roles', track: 'all', kind: 'voice', name: 'The voice explains, the screen sums up',
    rule: 'With a voice-over, the voice explains, the picture shows and the screen sums up: a shot\'s on-screen text shrinks to the big number or a label of 1 to 4 words, never the sentence being spoken.',
    check: 'With a voice-over, on-screen text is a number or a label of 1 to 4 words, never the spoken sentence.'
  },
  {
    id: 'voice-lines', track: 'all', kind: 'voice', name: 'Short lines, said like talk',
    rule: 'Each shot\'s spoken line is one or two short sentences, plain and conversational: about 8 to 25 words (Chinese or Japanese: 15 to 45 characters). The first line hooks in its first words; the last can be a short sign-off or nothing.'
  },
  {
    id: 'voice-lands', track: 'all', kind: 'voice', name: 'The picture lands on the words',
    rule: 'The picture moves with the voice: a number rolls in, an object appears or a chart turns as the voice says it, and nothing important appears after the last sentence ends.',
    check: 'What the voice names appears as it is said; nothing important arrives after the shot\'s last sentence.'
  }
]

export const TOOLS = [
  { id: 'rolling-counter', group: 'story', name: 'Rolling counter', text: 'the hook\'s big figure, rolling up and landing with a bounce.', tracks: ['2d'] },
  { id: 'draining-stock', group: 'story', name: 'Draining stock', text: 'an amount leaving while the counter rolls (items turning red and flying off, leaving empty slots).', tracks: ['2d', '3d'], text3d: 'real things leave the place that held them (coins lifting out of a vault, water draining from a tank), the empty space left behind lit.' },
  { id: 'breaking-banner', group: 'story', name: 'Breaking banner', text: 'a bar that wipes over a finished picture to say "this is big", a sourced line crawling under it.', tracks: ['2d'] },
  { id: 'bar-race', group: 'story', name: 'Bar race', text: '"biggest ever" and comparisons; bars grow in turn and one overtakes.', tracks: ['2d'] },
  { id: 'clock-particles', group: 'story', name: 'Clock and particles', text: 'speed; streams pouring out while a clock runs.', tracks: ['2d', '3d'], text3d: 'a physical stream pouring out (glowing pellets, water, sand) past a clock that stands in the set.' },
  { id: 'infection-fill', group: 'story', name: 'Infection fill', text: 'something being compromised, filling cell by cell (label it illustrative).', tracks: ['2d'] },
  { id: 'hop-path', group: 'story', name: 'Hop path', text: 'how something moves through a system, each box lighting as it is reached.', tracks: ['2d', '3d'], text3d: 'the camera follows one object through the real places it passes (a parcel through depots, a letter from hand to hand), each place lighting as it arrives.' },
  { id: 'untouched-object', group: 'story', name: 'Untouched object', text: 'what was NOT affected, glowing while the rest flows past.', tracks: ['2d', '3d'], text3d: 'a pool of light holds on what was spared while everything around it moves on or falls into shadow.' },
  { id: 'bypass', group: 'story', name: 'Bypass', text: 'a control that was skipped; the flow goes round the gate, an alarm border flashes.', tracks: ['2d', '3d'], text3d: 'the object takes a side route round a gate or a guard in the set, a warning light sweeping the scene.' },
  { id: 'routine-log', group: 'story', name: 'Routine log', text: '"it looked normal"; rows of checks scrolling while a total climbs (illustrative).', tracks: ['2d'] },
  { id: 'pulse-pattern', group: 'story', name: 'Pulse through a pattern', text: '"same playbook"; one pulse through two identical strips, ending on "=".', tracks: ['2d'] },
  { id: 'trace-stamp', group: 'story', name: 'Trace graph and stamp', text: 'attribution; lines branching out, a SUSPECTED stamp, NOT CONFIRMED typed.', tracks: ['2d'] },
  { id: 'split-bar', group: 'story', name: 'Split bar', text: 'part of a whole, splitting into its shares.', tracks: ['2d'] },
  { id: 'shared-timeline', group: 'story', name: 'Shared timeline', text: 'wildly different durations on one axis, a cursor running.', tracks: ['2d'] },
  { id: 'waffle', group: 'story', name: 'Waffle', text: 'a small share of a big total (1,000 squares, 32 lit).', tracks: ['2d'] },
  { id: 'drawn-fix', group: 'story', name: 'Drawn fix', text: 'the defence; a request travelling, a lock snapping shut.', tracks: ['2d', '3d'], text3d: 'the defence as a mechanism: a door swinging shut, a bolt sliding home, a shield closing just in time.' },
  { id: 'running-clock', group: 'story', name: 'Running clock', text: 'time pressure; a timestamp that keeps ticking while the event unfolds, red flashing on the hits.', tracks: ['2d'] },
  { id: 'money-trail', group: 'story', name: 'Money trail', text: 'funds splitting into ever more wallets, coins running down the branches (illustrative).', tracks: ['2d', '3d'], text3d: 'coins rolling down chutes that branch again and again.' },
  { id: 'event-timeline', group: 'story', name: 'Event timeline', text: 'the story\'s dates on one axis, landing in turn, the beat that matters glowing.', tracks: ['2d'] },
  { id: 'attributed-statement', group: 'story', name: 'Attributed statement', text: 'an agency badge, its words typed in exactly, the date under it.', tracks: ['2d'] },
  { id: 'driven-by-law', group: 'science', name: 'Driven by the law', text: 'the motion is computed from the real equation (an orbit by gravity, a decay by its half-life, scattering by 1/λ⁴), so what the viewer sees is the model\'s own result, not a cartoon of it.', tracks: ['2d', '3d'], text3d: 'objects move by the real equation, keyframed from it rather than by eye: a ball\'s arc, a pendulum, an orbit.' },
  { id: 'turn-one-knob', group: 'science', name: 'Turn one knob', text: 'one quantity changes on screen (wavelength, temperature, mass, angle) with its value rolling beside it, and the outcome follows by the law; the viewer sees the cause and the effect move together.', tracks: ['2d', '3d'], text3d: 'a real control in the set (a dial, a slider, a lever) turns and the scene answers by the law.' },
  { id: 'zoom-scales', group: 'science', name: 'Zoom across scales', text: 'from the everyday scene down into the mechanism (the sky, then the air, then one molecule), a scale bar rolling as the camera dives (1 m → 1 nm), and back out to the scene at the payoff.', tracks: ['2d', '3d'], text3d: 'one continuous camera dive from the everyday object into its mechanism and back, with a set for each scale.' },
  { id: 'slow-time', group: 'science', name: 'Slow time', text: 'an event too fast or too slow to see, replayed at a speed you can follow, the time factor ticking in a corner.', tracks: ['2d', '3d'], text3d: 'high-speed cinematography: the event at a slowed rate, the time factor on the caption layer.' },
  { id: 'cutaway', group: 'science', name: 'Cutaway', text: 'the outside fades or slices open to show the inside working (a cell, an engine, a star), the outline staying faint so the viewer knows where they are.', tracks: ['2d', '3d'], text3d: 'a true section cut through the model, the cut face lit, the rest kept whole so the viewer knows where they are.' },
  { id: 'invisible-visible', group: 'science', name: 'Invisible made visible', text: 'fields as lines and arrows, forces as arrows sized by their strength, heat as particle speed, pressure as particle hits, energy as a flowing quantity in a color kept for it.', tracks: ['2d', '3d'], text3d: 'fields and flows built as glowing tubes, ribbons or particles in the set, moving with the force.' },
  { id: 'with-without', group: 'science', name: 'With and without', text: 'the same setup twice, side by side, one difference between them, and the outcomes split apart.', tracks: ['2d', '3d'], text3d: 'two sets side by side, or one set played twice, a single difference between them and the outcomes splitting.' },
  { id: 'draws-its-graph', group: 'science', name: 'The thing draws its graph', text: 'the phenomenon traces its own curve beside it (a pendulum drawing a sine, a sample drawing its decay curve, a falling ball drawing its parabola), the axis labelled in real units.', tracks: ['2d'] },
  { id: 'conservation-ledger', group: 'science', name: 'Conservation ledger', text: 'the quantity that is kept (energy, charge, mass, momentum) as stacked bars that trade between their forms while the total never moves.', tracks: ['2d'] },
  { id: 'myth-mechanism', group: 'science', name: 'Myth, then mechanism', text: 'the common wrong picture first, stamped "wrong" in the color kept for it, then the real mechanism replacing it in the same layout.', tracks: ['2d', '3d'], text3d: 'the wrong version staged first, then the real one in the same set and camera, so the difference is all you see.' },
  { id: 'chapter', group: 'product', name: 'Chapter', text: 'a mono label over a rule ("01 — The problem", the product\'s name at the right) opening each beat (chapter).', tracks: ['2d'] },
  { id: 'rising-headline', group: 'product', name: 'Rising headline', text: 'one or two heavy lines rising out of their masks, the second muted for the turn of the sentence (headline).', tracks: ['2d'] },
  { id: 'state-row', group: 'product', name: 'A row of states', text: 'many things in a row (shots, files, pages), each with a chip, a progress sweep or a dim; the same row before and after shows what the product changes (row).', tracks: ['2d'] },
  { id: 'counter', group: 'product', name: 'Counter', text: 'a number in a footer over a rule that tells the result (7 / 7, then 1 / 7), red when it is the problem (counter).', tracks: ['2d'] },
  { id: 'steps', group: 'product', name: 'Steps lighting', text: 'the product\'s steps as bordered chips lighting one after another in the accent (steps).', tracks: ['2d'] },
  { id: 'request', group: 'product', name: 'A request typed', text: 'what a person asks the product for, typed into a dark bubble under their name (bubble).', tracks: ['2d'] },
  { id: 'before-after', group: 'product', name: 'Before and after', text: 'two pictures in one box, a divider in the accent sweeping across to uncover the after (compare).', tracks: ['2d'] },
  { id: 'dive', group: 'product', name: 'Dive to the action', text: 'on the desktop, the camera moves in to the part where the action is and centres it, the whole screen growing with it (desktop with camera).', tracks: ['2d'] },
  { id: 'cursor-action', group: 'product', name: 'Cursor action', text: 'a large pointer glides on a curve, presses and lets a soft ring go, while the desktop\'s camera moves in so the click sits in the middle of the screen (cursor with follow and desktopPoint).', tracks: ['2d'] },
  { id: 'highlight', group: 'product', name: 'Highlight a control', text: 'a thin outline hugging the control the beat is about, in ink or the screen\'s own accent, drawn on the screen\'s picture so it moves with it as the camera moves (mark() in a shot\'s or window\'s draw).', tracks: ['2d'] },
  { id: 'type-in', group: 'product', name: 'Type it in', text: 'words typed into a field of the product key by key, a caret blinking (typing on a live part, or field over a picture).', tracks: ['2d'] },
  { id: 'state-change', group: 'product', name: 'State change', text: 'the same screen before and after: what stays holds still, what changed blends in (shot with over).', tracks: ['2d'] },
  { id: 'wipe-cut', group: 'product', name: 'Wipe cut', text: 'an ink panel crossing the frame in about 0.36 s, half at the end of one beat and half at the start of the next (wipe).', tracks: ['2d'] },
  { id: 'logo-lockup', group: 'product', name: 'End card', text: 'a field of the accent: the product\'s name huge, the line to remember, its price or platform and address over a rule (endCard).', tracks: ['2d'] },
  { id: 'pull-back-reveal', group: 'camera', tracks: ['3d'], name: 'Pull-back reveal', text: 'start on a detail and pull or crane back until the whole situation is in view, so the wide is the punchline.' },
  { id: 'push-in', group: 'camera', tracks: ['3d'], name: 'Push-in on realisation', text: 'dolly slowly toward the subject while the key idea lands, so the viewer feels that this is the moment.' },
  { id: 'crane', group: 'camera', tracks: ['3d'], name: 'Crane up, crane down', text: 'rise above a situation to show its extent or end the film, sink into a place to begin; in a tall frame it replaces the pan.' },
  { id: 'hero-orbit', group: 'camera', tracks: ['3d'], name: 'Hero orbit', text: 'arc 30 to 90 degrees round a still subject and ease to a stop on its most readable angle, so its volume reads; once a film, for the main object.' },
  { id: 'tracking-foreground', group: 'camera', tracks: ['3d'], name: 'Tracking with foreground', text: 'travel alongside a moving subject while near things slide past faster, so speed and depth read through parallax.' },
  { id: 'dolly-zoom', group: 'camera', tracks: ['3d'], name: 'Dolly zoom', text: 'dolly in while widening the lens (or the reverse): the subject keeps its size while the world stretches round it; for shock or vertigo, once a film.' },
  { id: 'crash-zoom', group: 'camera', tracks: ['3d'], name: 'Crash zoom', text: 'a sudden, very fast push onto a detail for emphasis, often into a match cut on another scale (into the sun disc, cut to the Sun).' },
  { id: 'depth-staging', group: 'frame', tracks: ['3d'], name: 'Depth staging', text: 'something in the foreground, the subject in the middle, context behind, so the flat frame reads as space.' },
  { id: 'frame-in-frame', group: 'frame', tracks: ['3d'], name: 'Frame within a frame', text: 'the subject seen through a doorway, a ring or a gap between things, which isolates it and points at it without an arrow.' },
  { id: 'negative-space', group: 'frame', tracks: ['3d'], name: 'Negative space', text: 'a small subject in a large empty sky, floor or dark, for isolation, scale or calm; the empty part holds the type.' },
  { id: 'camera-height', group: 'frame', tracks: ['3d'], name: 'Camera height', text: 'look up to make a subject powerful or huge, down to make it small or part of a system, straight down to read movement as a map.' },
  { id: 'leading-lines', group: 'frame', tracks: ['3d'], name: 'Leading lines', text: 'roads, cables, rails or rows that converge on the subject; in a tall frame run them from the bottom up.' },
  { id: 'match-cut', group: 'cut', tracks: ['3d'], name: 'Match cut', text: 'cut between two shots that share a shape, motion, colour or screen place (a wheel to a planet, a drop to a ripple), so the cut states the comparison.' },
  { id: 'cut-on-action', group: 'cut', tracks: ['3d'], name: 'Cut on action', text: 'end a shot mid-motion and pick up the same motion in the next, so the cut disappears and the energy carries over.' },
  { id: 'eye-trace', group: 'cut', tracks: ['3d'], name: 'Eye-trace hand-off', text: 'put the next shot\'s subject where the eye already is at the end of the last; in a tall frame this matters more than direction.' },
  { id: 'smash-cut', group: 'cut', tracks: ['3d'], name: 'Smash cut', text: 'cut straight from calm to its opposite (silence to chaos, small to huge, "it\'s fine" to disaster), for surprise or a laugh.' },
  { id: 'cross-cut', group: 'cut', tracks: ['3d'], name: 'Cross-cut', text: 'alternate two things happening at once in short shots that converge, each side framed the same, for tension or a parallel.' },
  { id: 'anticipation-beat', group: 'staging', tracks: ['3d'], name: 'Anticipation beat', text: 'before a big action, a small opposite move or a pause (a crouch, a lean back, the camera settling), so the viewer knows something is coming.' },
  { id: 'reaction-shot', group: 'staging', tracks: ['3d'], name: 'Reaction shot', text: 'after an event, a character or object reacting simply (a flinch, a turn, a slump), so the viewer knows how to feel about it.' },
  { id: 'light-leads', group: 'light', tracks: ['3d'], name: 'Light leads the eye', text: 'the brightest, most contrasted area is the subject and the rest falls into shade; to move attention, move the light.' },
  { id: 'light-reveal', group: 'light', tracks: ['3d'], name: 'Light reveal', text: 'begin in darkness or silhouette and bring up a motivated light (a sunrise, a lamp, the object\'s own glow) to reveal the subject or the answer.' },
  { id: 'rim-light', group: 'light', tracks: ['3d'], name: 'Rim separation', text: 'a backlight outlines the subject against a dark or busy ground; pushed to silhouette, it hides the detail for mystery.' },
  { id: 'colour-shift', group: 'light', tracks: ['3d'], name: 'Colour shift', text: 'the key light changes colour when the story\'s state changes: warm to cold for danger, day to dusk for time, grey to colour for fixed.' },
  { id: 'exploded-view', group: 'explain', tracks: ['3d'], name: 'Exploded view', text: 'the parts move apart along their assembly axes, hold, then come back together, so the structure reads at a glance.' },
  { id: 'x-ray', group: 'explain', tracks: ['3d'], name: 'X-ray ghost', text: 'the outer shell fades to a faint wireframe or tint so the mechanism shows through, the part that matters solid and bright.' },
  { id: 'step-build', group: 'explain', tracks: ['3d'], name: 'Step-by-step build', text: 'the object (or the idea) assembles one piece per spoken clause, each landing with a small overshoot, so the order of parts is learnt.' },
  { id: 'scale-comparison', group: 'explain', tracks: ['3d'], name: 'Scale comparison', text: 'the unfamiliar beside something everyone knows (a person, a bus, a coin) at true scale, ideally sliding together.' }
]

const tasteById = id => TASTE.find(r => r.id === id)
const ruleId = s => safeId(s, 'a rule id')

// A file that can't be parsed is kept as rules.json.bad and the defaults
// apply; list() reports it until the rules are saved again
function load() {
  let saved
  try {
    saved = readJson(FILE, {})
  } catch (err) {
    if (err.code) throw err
    // Another process may have set it aside first
    try { fs.renameSync(FILE, BAD) } catch (e) { if (e.code !== 'ENOENT') throw e }
    saved = {}
  }
  return {
    fixedOff: Array.isArray(saved.fixedOff) ? saved.fixedOff.filter(id => FIXED.some(r => r.id === id)) : [],
    toolsOff: Array.isArray(saved.toolsOff) ? saved.toolsOff.map(String) : [],
    taste: saved.taste && typeof saved.taste === 'object' ? saved.taste : {},
    mine: Array.isArray(saved.mine) ? saved.mine.filter(r => r?.id && r.text) : [],
    tools: Array.isArray(saved.tools) ? saved.tools.filter(r => r?.id && r.name) : []
  }
}

// The person's own rules and tools are for 2D, 3D or both ('all'); older
// ones, saved before they could choose, are for both
const trackOf = t => (TRACKS.includes(t) ? t : 'all')
const tracksOf = t => (trackOf(t) === 'all' ? ['2d', '3d'] : [t])
function checkTrack(t) {
  if (!TRACKS.includes(t)) throw new Error(`track is one of ${TRACKS.join(', ')}`)
  return t
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

function cleanText(text, what) {
  text = String(text ?? '').trim().replace(/\s+/g, ' ')
  if (!text) throw new Error(`${what} needs some text`)
  if (text.length > MAX_CHARS) throw new Error(`${what} is at most ${MAX_CHARS} characters (this one has ${text.length}); say it shorter`)
  return text
}

// The rules as they stand: every fixed rule and every taste rule with the
// person's wording (off ones too, so they can be switched on or restored;
// `off` says so), and every tool with its picture (a file path, or null)
export function list() {
  const saved = load()
  const builtIn = TASTE.map(r => {
    const own = saved.taste[r.id] ?? {}
    return { ...r, builtIn: true, rule: own.text ?? r.rule, edited: own.text != null, off: !!own.off }
  })
  const mine = saved.mine.map(r => ({ id: r.id, track: trackOf(r.track), name: null, rule: r.text, check: r.text, builtIn: false, edited: false, off: false }))
  const still = id => path.join(STILLS, `${id}.jpg`)
  return {
    damaged: !fs.existsSync(FILE) && fs.existsSync(BAD) ? BAD : null,
    fixed: FIXED.map(r => ({ ...r, off: !r.locked && saved.fixedOff.includes(r.id) })),
    taste: [...builtIn, ...mine],
    tools: [
      ...TOOLS.map(t => ({ ...t, builtIn: true, off: saved.toolsOff.includes(t.id), image: fs.existsSync(still(t.id)) ? still(t.id) : null })),
      ...saved.tools.map(t => ({ id: t.id, group: 'mine', tracks: tracksOf(t.track), name: t.name, text: t.text ?? '', builtIn: false, off: saved.toolsOff.includes(t.id), image: t.image ? path.join(RULES, safeId(t.image, 'a picture')) : null }))
    ]
  }
}

// A taste rule that is on and still says what it said when it was set:
// what measures it (lintPlan's caption lengths) holds only then
export const asBuilt = id => {
  const own = load().taste[id]
  return !!tasteById(id) && !own
}

function save(change) {
  const saved = load()
  change(saved)
  writeJson(FILE, saved)
}

// Reword a taste rule, a built-in one or the person's own
export function edit(id, text) {
  text = cleanText(text, 'a rule')
  save(s => {
    if (tasteById(id)) s.taste[ruleId(id)] = { text }
    else {
      const own = s.mine.find(r => r.id === id)
      if (!own) throw new Error(`no rule ${id}`)
      own.text = text
    }
  })
  return list()
}

// A built-in taste rule is switched off (it can be restored); the
// person's own is deleted. Fixed rules can't be removed
export function remove(id) {
  if (FIXED.some(r => r.id === id)) throw new Error(`"${id}" is a fixed rule; it can't be removed`)
  save(s => {
    if (tasteById(id)) s.taste[ruleId(id)] = { off: true }
    else {
      if (!s.mine.some(r => r.id === id)) throw new Error(`no rule ${id}`)
      s.mine = s.mine.filter(r => r.id !== id)
    }
  })
  return list()
}

// A fixed rule or a tool (built-in or the person's) switched off or on
export function setOn(id, on) {
  if (FIXED.some(r => r.id === id && r.locked)) throw new Error(`"${id}" is a locked rule; it can't be switched off`)
  const flip = ids => (on ? ids.filter(x => x !== id) : [...new Set([...ids, id])])
  save(s => {
    if (FIXED.some(r => r.id === id)) s.fixedOff = flip(s.fixedOff)
    else if (TOOLS.some(t => t.id === id) || s.tools.some(t => t.id === id)) s.toolsOff = flip(s.toolsOff)
    else throw new Error(`no fixed rule or tool ${id}`)
  })
  return list()
}

// A built-in taste rule back to how it shipped
export function reset(id) {
  if (!tasteById(id)) throw new Error(`no built-in rule ${id}`)
  save(s => { delete s.taste[id] })
  return list()
}

export function add(text, track = 'all') {
  text = cleanText(text, 'a rule')
  track = checkTrack(track)
  save(s => { s.mine.push({ id: newId(), text, track, created: new Date().toISOString() }) })
  return list()
}

// A tool of the person's, with a picture copied in beside the rules
export function addTool({ name, text, image, track = 'all' }) {
  name = cleanText(name, 'a tool\'s name')
  text = text ? cleanText(text, 'a tool') : ''
  track = checkTrack(track)
  const id = newId()
  let file = null
  if (image) {
    if (!IMAGE.test(image)) throw new Error('a tool\'s picture is a JPEG, PNG or WebP image')
    if (fs.statSync(image).size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`a tool's picture is at most ${MAX_IMAGE_MB} MB`)
    file = `${id}${path.extname(image).toLowerCase()}`
    fs.mkdirSync(RULES, { recursive: true })
    fs.copyFileSync(image, path.join(RULES, file))
  }
  save(s => { s.tools.push({ id, name, text, track, image: file, created: new Date().toISOString() }) })
  return list()
}

export function removeTool(id) {
  if (TOOLS.some(t => t.id === id)) throw new Error(`"${id}" is a built-in tool; it can't be removed`)
  let image = null
  save(s => {
    const tool = s.tools.find(t => t.id === id)
    if (!tool) throw new Error(`no tool ${id}`)
    image = tool.image
    s.tools = s.tools.filter(t => t.id !== id)
    s.toolsOff = s.toolsOff.filter(x => x !== id)
  })
  if (image) fs.rmSync(path.join(RULES, safeId(image, 'a picture')), { force: true })
  return list()
}

const forTrack = track => r => r.track === 'all' || r.track === track
// The rules of the kinds given ('' for every film's shots)
export const ofKinds = kinds => r => kinds.includes(r.kind ?? '')

// The checklist a review reports against: the fixed rules that are on,
// then the person's taste as it stands, each with its id. A project's own
// checklist (shotloop.json "checklist") takes the taste's place; the
// fixed rules stay. promo: a product promo, voice: a voiced film, whose
// own rules join in
export function checklist(track, own = null, { promo = false, voice = false } = {}) {
  const { fixed, taste } = list()
  const line = r => `- **${r.id}**${r.track === 'all' ? '' : ` (${r.track.toUpperCase()})`}: ${r.check}`
  const kinds = ['', ...(promo ? ['promo'] : []), ...(voice ? ['voice'] : [])]
  const on = taste.filter(r => !r.off && r.check && forTrack(track)(r) && ofKinds(kinds)(r)).map(r => ({ ...r, check: r.edited ? r.rule : r.check }))
  const rest = own != null
    ? `This project's own checklist:\n${own.trim()}`
    : `The person's taste (as they set it):\n${on.length ? on.map(line).join('\n') : '(none)'}`
  return `# Shot checklist

The rules every shot must pass, checked on the stills at the start, middle and end of the shot. Report against each rule's id.

Fixed rules:
${fixed.filter(r => !r.off && forTrack(track)(r) && ofKinds(kinds)(r)).map(line).join('\n') || '(none)'}

${rest}
`
}
