// The rules of a Shotloop video, their one source: the 2D prompts
// (agent/src/principles.ts) and the checklist every shot is reviewed
// against are both made from these lists. Three kinds:
//
// - FIXED: what makes a frame broken or a video untrue (nothing covered,
//   no broken frames, honest, sourced). On unless the person switches one
//   off; never edited or removed.
// - TASTE: the house taste, set by Oliver with a viewer who watches a lot
//   of English short video (31 Oct 2026). Defaults: the person can reword
//   or remove any of them, restore it, and add their own.
// - TOOLS: the devices a plan picks from, each for the tracks it fits,
//   any of them switched off or on by the person
//   (`tracks`; a 2D device that can be staged in 3D says how in `text3d`).
//   The built-in ones stay as they are (2D ones with an example still in
//   tools/<id>.jpg); the person can add their own, with a picture.
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
// '3d' or 'all'.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, safeId, writeJson } from './files.mjs'

const RULES = process.env.SHOTLOOP_RULES ?? path.join(os.homedir(), '.shotloop', 'rules')
const FILE = path.join(RULES, 'rules.json')
const BAD = path.join(RULES, 'rules.json.bad')
const STILLS = fileURLToPath(new URL('tools', import.meta.url))
export const MAX_CHARS = 1500
const IMAGE = /\.(jpe?g|png|webp)$/i
const TRACKS = ['all', '2d', '3d']
const MAX_IMAGE_MB = 8

const FIXED = [
  {
    id: 'caption-zone', track: 'all', name: 'Nothing covered',
    rule: 'Nothing covers what must be read or seen: caption, headline, picture and source line each keep their own band of the safe area, text never overlaps text, and with a voice-over nothing important sits in the subtitle band.',
    check: 'Nothing overlaps the headline: the subject stays clear of it, including whatever appears last. No text overlaps other text, and with a voice-over no text or key part of the subject sits in the subtitle band.'
  },
  {
    id: 'safe-area', track: 'all', name: 'Inside the safe area',
    rule: 'Text and the subject stay inside the safe area (2D: the kit\'s PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM): the bottom 20% and the right edge carry the platforms\' buttons. Backgrounds may fill the frame.',
    check: 'Text and the subject stay inside x 40–620 and y 110–1024 of 720×1280 (2D: the kit\'s PAD, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM); the bottom 20% and the right edge carry the platforms\' buttons. Backgrounds may fill the frame.'
  },
  {
    id: 'clean', track: 'all', name: 'No broken frames',
    rule: 'Every frame is clean: nothing clipped, flickering or cut off by the frame or the camera, no text spilling out of its box or wrapping where it shouldn\'t, no blank or half-drawn frame, no placeholder left over.',
    check: 'No clipping through geometry, no subject under the floor, no z-fighting or flicker, nothing cut off by the camera\'s clip range or the frame edge. No text overflowing or wrapping badly, no blank, half-drawn or placeholder frame.'
  },
  {
    id: 'readable', track: 'all', name: 'Readable',
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
    id: 'honest', track: '2d', name: 'Honest while it moves',
    rule: 'An animation never implies more than the source says; condensed lines keep the source\'s meaning (and quoted words exactly); any arithmetic is "≈" on screen and spelled out in the source line; illustrations are labelled as such. In science, the picture is a model and says so: a stretched scale says "not to scale", slowed or sped time says by how much ("slowed ≈1,000,000×"), an analogy is labelled as one, and the law it follows is named in the source line. A diagram may shrink distances or stretch an effect to be seen, but a law is computed in real units at real scale and only its result is mapped to the screen. Never apply a law to the squeezed drawing: put the Moon 2.5 Earth radii away instead of 60 and the inverse square makes the far tidal bulge a third of the near one, when in truth they are within about 5% of each other. Stretch the result by one stated factor (labelled), so what the picture compares stays true: equal stays equal, bigger stays bigger by the true ratio or is labelled as exaggerated.',
    check: 'Nothing on screen implies more than the source; arithmetic is "≈" and spelled out; illustrations, stretched scales and sped time are labelled. A law is computed at real scale and what the picture compares keeps its true ratio, or is labelled exaggerated.'
  },
  {
    id: 'source', track: '2d', name: 'Sourced',
    rule: 'Every fact on screen has its source in a small source line under the picture, which keeps the source\'s own name and language (never translated).',
    check: 'When the shot states a fact, its source line is there, under the picture, in the source\'s own name and language.'
  },
  {
    id: 'code', track: '2d', name: 'Renders frame by frame',
    rule: 'The shot\'s code follows the 2D code rules, so every frame draws the same whenever and in whatever order it is rendered.',
    check: 'From the shot\'s code: the 2D code rules.'
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
    fixed: FIXED.map(r => ({ ...r, off: saved.fixedOff.includes(r.id) })),
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

// The checklist a review reports against: the fixed rules that are on,
// then the person's taste as it stands, each with its id. A project's own
// checklist (shotloop.json "checklist") takes the taste's place; the
// fixed rules stay
export function checklist(track, own = null) {
  const { fixed, taste } = list()
  const line = r => `- **${r.id}**${r.track === 'all' ? '' : ` (${r.track.toUpperCase()})`}: ${r.check}`
  const on = taste.filter(r => !r.off && r.check && forTrack(track)(r)).map(r => ({ ...r, check: r.edited ? r.rule : r.check }))
  const rest = own != null
    ? `This project's own checklist:\n${own.trim()}`
    : `The person's taste (as they set it):\n${on.length ? on.map(line).join('\n') : '(none)'}`
  return `# Shot checklist

The rules every shot must pass, checked on the stills at the start, middle and end of the shot. Report against each rule's id.

Fixed rules:
${fixed.filter(r => !r.off && forTrack(track)(r)).map(line).join('\n') || '(none)'}

${rest}
`
}
