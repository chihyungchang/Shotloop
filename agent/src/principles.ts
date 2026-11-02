// The rules of a Shotloop video in every planning, building, fixing and
// checking prompt, made from their one source (engine/shotloop/rules.mjs)
// for the track: the fixed rules, the person's taste as they set it, and
// the toolbox with their own tools. A 2D plan is measured against them
// before anything is built (lintPlan). Within them, the AI makes each
// frame as rich to watch as it can.

import { AMBIENCE_NAMES, EFFECT_NAMES, readTime, rules, SUBTITLE_BAND, VOICE_HOLD, VOICE_LEAD, VOICE_TAIL, type Rule, type Tool } from './enginelib.ts'

type Track = '2d' | '3d'
const RULES = rules.list()
const said = (r: Rule) => (r.name ? `${r.name}. ${r.rule}` : r.rule)
const forTrack = (track: Track) => (r: Rule) => r.track === 'all' || r.track === track
const tools = (track: Track, group: Tool['group']) => RULES.tools
  .filter(t => !t.off && t.group === group && t.tracks.includes(track))
  .map(t => {
    const text = track === '3d' && t.text3d ? t.text3d : t.text
    return `- ${t.name}${text ? `: ${text}` : ''}`
  })

function rulesFor(track: Track) {
  const fixed = RULES.fixed.filter(r => !r.off && forTrack(track)(r) && r.rule)
  // The taste rules that are on, the person's own among them
  const taste = RULES.taste.filter(r => !r.off && forTrack(track)(r))
  const mine = tools(track, 'mine')
  const toolbox = track === '2d'
    ? `Within them, make it rich: aim for the richest, most dynamic picture the shot allows. A toolbox to pick from (and add to):
${tools('2d', 'story').join('\n')}
For a science subject (a mechanism, a law, a process):
${tools('2d', 'science').join('\n')}`
    : `Within them, make it cinematic: stage the point with objects, light and the camera, not with charts. A toolbox to pick from (and add to), from film and animation craft:
Camera moves:
${tools('3d', 'camera').join('\n')}
Composition:
${tools('3d', 'frame').join('\n')}
Editing and transitions:
${tools('3d', 'cut').join('\n')}
Staging and acting:
${tools('3d', 'staging').join('\n')}
Light and colour:
${tools('3d', 'light').join('\n')}
Explaining in 3D:
${tools('3d', 'explain').join('\n')}
Stories and science, staged in the set:
${[...tools('3d', 'story'), ...tools('3d', 'science')].join('\n')}`
  return `The ${track.toUpperCase()} rules.
Fixed (never broken, whatever else is asked):
${fixed.map(r => `- ${said(r)}`).join('\n')}

The person's taste (the house defaults as they kept, reworded or removed them, and their own; follow each as it stands):
${taste.length ? taste.map(r => `- ${said(r)}`).join('\n') : '(none: the fixed rules only)'}

${toolbox}${mine.length ? `\nThe person's own tools (they added these; reach for them where they fit):\n${mine.join('\n')}` : ''}`
}

export const PRINCIPLES_2D = rulesFor('2d')
export const PRINCIPLES_3D = rulesFor('3d')

// lintPlan and lintVoice measure caption lengths by the house caption
// rule: only while the person keeps it as it shipped
export const CAPTION_RULE = rules.asBuilt('caption')

// Where the subtitles sit (engine/shotloop/cues.mjs), as "68–79%"
const band = (k: 'portrait' | 'landscape') => `${SUBTITLE_BAND[k].map(x => Math.round(x * 100)).join('–')}%`

// How fast a line is spoken, for planning (words, or Chinese and Japanese
// characters, a second), and the silence its shot gets around it (the
// engine fits shots with the same). English: Kokoro across the seven
// voiced examples, 2.9 to 3.7 words a second
const WORDS_PER_S = 3.2
const CJK_PER_S = 4.5
const VOICE_PAD = VOICE_LEAD + VOICE_TAIL

// With a voice-over (when the person turns it on, engine/shotloop/voice.mjs) the
// voice carries the explanation: these rules change the caption and
// reading rules, and the rest stand
export const PRINCIPLES_VOICE = `The voice-over (this film has one; it changes the caption and reading rules, the rest stand):
- The voice explains, the picture shows, the screen sums up. Each shot has a spoken line ("say"): one or two short sentences, plain and conversational, about 8 to 25 words (Chinese or Japanese: 15 to 45 characters). The first shot's line hooks in its first words; the last can be a short sign-off or empty.
- The voice's words are subtitled automatically, in a band near the bottom (portrait: ${band('portrait')} of the frame height; landscape: ${band('landscape')}). The shot keeps its own text and anything important out of that band, and never repeats the spoken sentence on screen: ${CAPTION_RULE ? 'its on-screen text shrinks to the big number or a label of 1 to 4 words' : 'its on-screen text follows the person\'s caption rule'}.
- Time follows the voice: after planning, every line is spoken and its shot gets the line's length plus a breath. Write each line to fill its shot: about ${WORDS_PER_S} words a second (Chinese or Japanese: ${CJK_PER_S} characters a second) plus ${VOICE_PAD} s. A shot may hold up to ${VOICE_HOLD} s past its line; any longer and it is cut to the line, so a film whose lines are short comes out shorter than planned.
- The picture lands on the words: a number rolls in, an object appears or a chart turns as the voice says it (the shot's code gets each sentence's start and end).
- Lines are written to be heard: short words, no lists, no parentheses, no abbreviations a voice can't say (respell an unusual name the way it sounds). Numbers as they are said: digits are fine in English and Chinese; in other languages write numbers in words. Where the screen shows ≈ the voice says "about".`

// How a 2D shot's code stays renderable frame by frame
export const CODE_2D = `2D code rules:
- No CSS animations or transitions, no setTimeout or requestAnimationFrame: the recorder steps time, and render(t) sets every opacity and transform itself.
- Randomness comes from the kit's seeded hash(a, b), never Math.random(), so a frame always draws the same.
- Name each part a person might point at: data-name="headline", "wallet", "arrow" on its element or group (data-keep names it too). On a canvas, name it each frame where it is drawn with window.picker?.part(x, y, w, h, 'name') (page CSS px; it exists only while the picker maps the stills, so it costs a render nothing), best inside the kit's drawing helper so every shot gets it. The person can pick a part in the frame to ask for a change, and the picker reports it by that name, so name parts after what they show and keep the names when you rewrite the markup.
- Don't animate the CSS transform of an SVG element that has a transform attribute (the CSS one replaces it and the element jumps): wrap it in a <g> that holds the position.
- A clipPath's rectangle is in the user space of the element that uses it: clip the parent group, not rows that are themselves translated.
- Motion driven by a law (the science tools) is a pure function of t, since frames and stills are drawn in any order: use the closed-form solution when there is one (an orbit's angle, a decay's e^(−t/τ), a wave's sin(kx − ωt)); otherwise integrate with a fixed step from t = 0, keeping the states in a module-level array so each step is computed once, never from the time since the last call. Compute in real units (metres, seconds, the real constants), then map the result to the screen through one stated scale for the whole shot (px per metre, film seconds per real second, an exaggeration factor for an effect too small to see); the labels come from the real values, so a number on screen is the model's own.
- A little depth is fine with CSS 3D (perspective, transform-style: preserve-3d) on DOM elements.
- Only when a part can't be shown flat (gears that must mesh, a mechanism turning in space, motion seen from a frame that turns with it), draw that part with three.js; the rest of the shot stays DOM and SVG. const THREE = await ctx.three() in setup(), which also builds the scene once: a WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }) whose canvas sits behind the stage, sized to the frame. It only has to read clearly, never to look real: simple geometry built in code (boxes, cylinders, extruded shapes, lathes), no model files. render(t) sets every position, rotation and the camera from t, by the mechanism's own math (a gear turned by its ratio, a piston by its crank), then calls renderer.render. Shade it in the look's colors (flat shading, EdgesGeometry lines for a drawn look). Labels and text stay in SVG or the DOM, placed each frame by projecting a point of the part (vector.project(camera)); report the part's projected extent with subtitles.keep.
- Within a frame, keep caption, picture and source line from overlapping: give each its band of the safe area.`

// How a WebGL 3D shot's code stays renderable frame by frame and reads
// as film (after oliverzdev ep20's three.js cut)
export const CODE_WEBGL = `WebGL code rules:
- Every frame is a pure function of t: no Math.random (kit.hash, kit.prng), no clock, no state carried between frames; physics in closed form or stepped with fixed steps from t = 0 (in setup). Frames and stills are drawn in any order.
- Build in setup, pose in render: geometry, materials and models are made once in setup; render(t) only sets positions, rotations, scales, visibility and material values, in this order: kit.begin(t); objects; the camera (kit.look); type, labels and kit.keep(); kit.frame().
- Real sizes in metres, written down in the world module (a watch 0.04 m, a person 1.7 m), the same object the same size in every shot; to make something small readable, use a longer lens or a closer camera, never a bigger object between shots. A stretched size or time is said on screen ("not to scale").
- One camera move per shot, eased in and out, a lens from 24 mm (places) to 100 mm (close-ups); position, aim and lens never all change at once. Motivate the move: reveal, follow or come closer.
- Mechanisms by their own math: a gear turned by its ratio, a wheel by its circumference, an orbit by its period; things that touch keep touching.
- Light reads as light: one key light, a rim, the studio's reflections; emissive parts capped (kit.glow), backgrounds dim, bloom only on what is brighter than white. Metal and glass need the environment to look like metal and glass. Call kit.studio({ size }) with the subject's size in metres (0.05 for a watch), so its soft shadow and the floor fit it.
- The kit renders like an offline renderer: kit.frame() averages several sub-frames (antialiasing, soft shadows, ambient occlusion). For true motion blur on fast parts (gears, a throw), pass the pose: kit.frame(dt => pose(t + dt)), where pose sets every moving object and the camera for a time. For a shallow focus, kit.post({ fstop: 2.8, samples: 16 }) (it focuses on the last kit.look target). Keep exposure and tone at their defaults unless the shot needs a change (kit.post({ exposure, tone: 'neutral' }) for true product colours).
- No flicker: no coplanar faces (decals 1 mm proud), the near plane not too close (kit.look sets it from the subject's distance).
- Text is never in the 3D scene: headlines, numbers and labels are DOM type (kit.caption, kit.label, kit.block) above the world, inside the safe area. Mark the subject the viewer must see each frame with kit.keep(object, 'name') after the camera is set: the subtitle check and the element picker use it, and a person picks a part by that name.
- Characters (when the story has one): simple and original, built from rounded primitives in a joint hierarchy; poses as tables of joint angles mixed by eased keys; anticipation before a big move, overlapping action after it.`

// Sound effects and the ambience (engine/shotloop/sound.mjs), planned in
// words and written by the shot's builder where its animation lands
export const SOUND = `Sound:
- The film has an ambience under it (one of ${AMBIENCE_NAMES.join(', ')}, or none) and sound effects on the picture's beats, made by the engine from these names: ${EFFECT_NAMES.join(', ')} (riser ends on its beat; the others start on it).
- Few and exact: only the beats that matter get a sound (a gear locking, a part landing, a crash zoom, a smash cut), at most one clear effect every 2 to 3 seconds; silence makes the next one count.
- With a voice-over the voice comes first: put loud effects (thud, impact, whoosh, riser) in the pauses between sentences (ctx.voice gives their times); quiet ones (click, tick, pop, ding, glass, beep, hum) may sit under a word. The engine moves a loud one off a line by up to 0.3 s, else halves it.
- A shot's effects go in shots/<id>/sounds.json, written with its code so they land on its animation: [{ "at": <shot seconds>, "sound": "<name>", "gain": <0–2, default 1>, "pan": <-1 left … 1 right, default 0> }]. The person can switch any of them off.
- Sounds the person added from the asset library (listed with the project, when there are any) are real recordings: use one by its id as "sound" where it fits the beat better than a synth name. It plays from its start, up to 8 s, at the synth effects' peak, and is never moved off a word, so place a loud one in a pause yourself. The person may also choose one as the ambience.`

// The voice-over in a shot's code
export const CODE_VOICE = `Voice-over in code:
- ctx.voice is the shot's spoken line, one { text, at, end } per sentence in shot seconds (empty when the shot says nothing). Time reveals to it: a number lands at the moment its sentence says it (estimate within a sentence by its share of the words), and nothing important appears after the last sentence ends.
- Keep text and key parts of the picture out of the subtitle band (portrait: y ${band('portrait')} of H; landscape: ${band('landscape')}); backgrounds and motion may pass behind it.
- A subtitle check runs before every render of the shot and reports, with times, what the subtitles would cover: text in the DOM or SVG, elements marked data-keep="name", and canvas regions the shot reports each frame with window.subtitles.keep(x, y, w, h, 'name') (page CSS px). It can't see unreported canvas shapes, text drawn on a canvas or 3D, so: write on-screen text in the DOM or SVG, never on a canvas; mark the subject the viewer must see (a satellite, a zipper) with data-keep, or report it with subtitles.keep when it is drawn on a canvas; leave big backgrounds (a globe, a grid, a glow) unmarked, they may pass under the subtitles.
- The on-screen text is ${CAPTION_RULE ? 'the number or a short label, ' : ''}never the spoken sentence.`

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu

// Chinese (and Japanese, Korean) characters, words and numbers in a text
function units(text: string) {
  const cjk = (text.match(CJK) ?? []).length
  const tokens = text.replace(CJK, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w))
  const words = tokens.filter(w => /\p{L}/u.test(w)).length
  return { cjk, words, numbers: tokens.length - words }
}


// A shot's captions: its on-screen text, one caption per line
const captions = (text: string) => text.split(/\n+/).map(s => s.trim()).filter(Boolean)

// Seconds a shot spends entering before its caption reads
const ANIMATION = 0.5

// A voiced plan's breaks that can be measured: lines too long or
// missing, on-screen text too long (while the caption rule stands), a
// duration far from what the line needs (fitted later, but the plan
// should be close)
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
    const need = (words + numbers) / WORDS_PER_S + cjk / CJK_PER_S + VOICE_PAD
    if (s.duration + 1.5 < need) issues.push(`${name}: ${s.duration} s is short for its line (about ${need.toFixed(1)} s spoken); give it the time or cut the line`)
    // A line far shorter than its shot: the shot would be cut to the line
    else if (s.duration > need + VOICE_HOLD) {
      const more = (s.duration - VOICE_HOLD - need) * (cjk ? CJK_PER_S : WORDS_PER_S)
      issues.push(`${name}: its line (about ${need.toFixed(1)} s spoken) is short for ${s.duration} s and the shot would be cut to it; write about ${Math.ceil(more)} more ${cjk ? 'characters' : 'words'}, or shorten the shot`)
    }
    if (CAPTION_RULE) for (const c of captions(s.text ?? '')) {
      const u = units(c)
      if (u.words > 6 || u.cjk > 12) issues.push(`${name}: the on-screen text "${c}" is long for a voiced film; the voice says it, the screen shows the number or a label of 1 to 4 words`)
    }
  })
  return issues
}

// The plan's breaks of the rules that can be measured: captions too long
// (the big number aside; while the caption rule stands as it shipped),
// shots too short to read their captions, a caption up for less than a
// bar of the music (bar: seconds)
export function lintPlan(shots: { title?: string; duration: number; text?: string }[], bar = 0) {
  const issues: string[] = []
  shots.forEach((s, i) => {
    const name = `shot ${i + 1}${s.title ? ` (${s.title})` : ''}`
    const list = captions(s.text ?? '')
    if (CAPTION_RULE) for (const c of list) {
      const { cjk, words } = units(c)
      if (words / 8 + cjk / 14 > 1) issues.push(`${name}: the caption "${c}" is too long (about 6 to 8 words, or 14 Chinese characters, plus the number); cut what the picture already says`)
    }
    const need = list.reduce((n, c) => n + Math.max(readTime(c), bar), 0) + (list.length ? ANIMATION : 0)
    if (s.duration + 0.05 < need) {
      issues.push(`${name}: ${s.duration} s is too short to read its ${list.length > 1 ? `${list.length} captions` : 'caption'} (needs ${need.toFixed(1)} s); shorten or drop text, or give the shot more time`)
    }
  })
  return issues
}
