// The data the engine shares with the app's frontend and the agent: the
// looks, the visual styles, the music moods and the small rules they all
// follow. No Node imports here (nor of a module that has them), so the
// app's browser bundle can import this file as it is.

import { MOODS } from './score.mjs'

// Built-in looks for 2D projects (looks.mjs draws their pages): only the
// tokens differ (palette, type, background); the scene colors are for the
// cinematic scene style (scene.mjs)
export const LOOKS = [
  {
    id: 'midnight',
    name: { en: 'Midnight' },
    about: 'dark navy, warm gold and teal accents; science and explainers',
    bg: 'radial-gradient(120% 80% at 50% 0%, #1b2d63 0%, #0d1736 55%, #080e24 100%)',
    text: '#f4f7ff', muted: '#9fb0d6', accent: '#ffb340', accent2: '#4fd1c5', accent3: '#ff6b8b',
    line: 'rgba(255, 255, 255, 0.16)', panel: 'rgba(255, 255, 255, 0.07)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 2px 18px rgba(6, 12, 34, 0.45)',
    // The cinematic scene style (scene.mjs): deep space blue, warm gold light
    scene: { sky: ['#040714', '#060b1d', '#03050c'], clouds: [[0.83, 0.2, 0.72, '40, 70, 160', 0.16], [0.11, 0.84, 0.78, '90, 40, 120', 0.1]],
      specks: ['220, 232, 255', '255, 226, 190'], light: '255, 200, 120', cool: '120, 180, 255' }
  },
  {
    id: 'paper',
    name: { en: 'Paper' },
    about: 'warm off-white paper, black ink, blue and red accents; editorial and calm',
    bg: 'radial-gradient(130% 90% at 50% 30%, #f7f3ea 0%, #efe8da 70%, #e6dccb 100%)',
    text: '#1d1b17', muted: '#776f62', accent: '#2f6fed', accent2: '#e8553d', accent3: '#2a9d6f',
    line: 'rgba(29, 27, 23, 0.16)', panel: 'rgba(29, 27, 23, 0.05)',
    head: "'New York', 'Songti SC', Georgia, serif", headWeight: 700, glow: 'none'
  },
  {
    id: 'neon',
    name: { en: 'Neon' },
    about: 'black with glowing magenta and cyan; tech, games, bold hooks',
    bg: 'radial-gradient(90% 60% at 15% 10%, rgba(255, 61, 154, 0.28), transparent 60%), radial-gradient(90% 60% at 90% 85%, rgba(46, 230, 255, 0.22), transparent 60%), #07070c',
    text: '#ffffff', muted: '#a7a7c7', accent: '#ff3d9a', accent2: '#2ee6ff', accent3: '#c4ff3d',
    line: 'rgba(255, 255, 255, 0.18)', panel: 'rgba(255, 255, 255, 0.06)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 0 24px rgba(255, 61, 154, 0.45)',
    scene: { sky: ['#0a0612', '#07060f', '#030308'], clouds: [[0.15, 0.12, 0.7, '255, 61, 154', 0.16], [0.9, 0.85, 0.75, '46, 230, 255', 0.13]],
      specks: ['200, 240, 255', '255, 190, 230'], light: '255, 120, 200', cool: '46, 230, 255' }
  },
  {
    id: 'pastel',
    name: { en: 'Pastel' },
    about: 'soft lavender and mint, rounded and friendly; lifestyle, kids, how-tos',
    bg: 'linear-gradient(165deg, #f7f0ff 0%, #f1f6ff 50%, #eaf8f2 100%)',
    text: '#2b2540', muted: '#7d7598', accent: '#7c5cff', accent2: '#ff8a65', accent3: '#21a99a',
    line: 'rgba(43, 37, 64, 0.14)', panel: 'rgba(124, 92, 255, 0.08)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: 'none'
  },
  {
    id: 'mono',
    name: { en: 'Swiss' },
    about: 'white, heavy black type, one red accent; data, facts, news',
    bg: '#ffffff',
    text: '#0a0a0a', muted: '#6b6b6b', accent: '#ff3b30', accent2: '#0a0a0a', accent3: '#8e8e93',
    line: 'rgba(10, 10, 10, 0.14)', panel: 'rgba(10, 10, 10, 0.05)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 900, glow: 'none'
  },
  {
    id: 'ocean',
    name: { en: 'Ocean' },
    about: 'deep sea blue-green, aqua and coral; nature, water, biology',
    bg: 'radial-gradient(120% 80% at 50% 0%, #0d4a5c 0%, #072a3a 55%, #041822 100%)',
    text: '#eefcff', muted: '#8fbac6', accent: '#3ee0d0', accent2: '#ff8a6b', accent3: '#ffd166',
    line: 'rgba(255, 255, 255, 0.16)', panel: 'rgba(255, 255, 255, 0.07)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 2px 18px rgba(2, 20, 28, 0.5)',
    scene: { sky: ['#03202b', '#04151f', '#020b12'], clouds: [[0.8, 0.18, 0.75, '30, 140, 160', 0.18], [0.12, 0.86, 0.8, '20, 70, 120', 0.14]],
      specks: ['180, 240, 255', '160, 255, 230'], light: '120, 240, 230', cool: '62, 224, 208' }
  },
  {
    id: 'ember',
    name: { en: 'Ember' },
    about: 'warm black with fire orange and red; history, drama, energy, danger',
    bg: 'radial-gradient(110% 80% at 50% 100%, #3a120a 0%, #1a0907 55%, #0c0505 100%)',
    text: '#fff4ec', muted: '#c79a86', accent: '#ff7a2f', accent2: '#ffc65c', accent3: '#ff3d3d',
    line: 'rgba(255, 255, 255, 0.15)', panel: 'rgba(255, 200, 160, 0.07)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 0 22px rgba(255, 110, 40, 0.35)',
    scene: { sky: ['#0d0604', '#140806', '#070303'], clouds: [[0.2, 0.85, 0.8, '200, 70, 20', 0.18], [0.85, 0.15, 0.6, '120, 30, 20', 0.12]],
      specks: ['255, 220, 190', '255, 170, 110'], light: '255, 150, 70', cool: '255, 198, 92' }
  },
  {
    id: 'forest',
    name: { en: 'Forest' },
    about: 'deep green with leaf lime and sun amber; nature, plants, climate, health',
    bg: 'radial-gradient(120% 80% at 50% 0%, #1d4a2c 0%, #0f2a19 55%, #08170e 100%)',
    text: '#f1fbf0', muted: '#9dbea1', accent: '#a8e05f', accent2: '#ffc94d', accent3: '#5fd0b8',
    line: 'rgba(255, 255, 255, 0.15)', panel: 'rgba(255, 255, 255, 0.06)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: '0 2px 18px rgba(4, 20, 10, 0.5)',
    scene: { sky: ['#06160c', '#081a10', '#030b06'], clouds: [[0.82, 0.2, 0.7, '70, 140, 60', 0.15], [0.1, 0.85, 0.75, '40, 90, 70', 0.12]],
      specks: ['220, 255, 210', '255, 240, 180'], light: '255, 220, 120', cool: '168, 224, 95' }
  },
  {
    id: 'graphite',
    name: { en: 'Graphite' },
    about: 'neutral graphite with electric blue; tech, products, engineering',
    bg: 'radial-gradient(120% 80% at 50% 0%, #2b2f36 0%, #1a1d22 55%, #101215 100%)',
    text: '#f5f7fa', muted: '#a3aab5', accent: '#4c9dff', accent2: '#f5f7fa', accent3: '#ffb547',
    line: 'rgba(255, 255, 255, 0.14)', panel: 'rgba(255, 255, 255, 0.06)',
    head: "'PingFang SC', -apple-system, sans-serif", headWeight: 800, glow: 'none',
    scene: { sky: ['#14161a', '#101215', '#08090b'], clouds: [[0.8, 0.2, 0.7, '76, 157, 255', 0.12], [0.15, 0.85, 0.7, '120, 130, 150', 0.1]],
      specks: ['220, 230, 245', '200, 215, 240'], light: '160, 200, 255', cool: '76, 157, 255' }
  },
  {
    id: 'sand',
    name: { en: 'Sand' },
    about: 'warm sand with terracotta and teal; travel, culture, food, history',
    bg: 'radial-gradient(130% 90% at 50% 30%, #f6ead6 0%, #eedcc0 70%, #e4ceab 100%)',
    text: '#2a2118', muted: '#86715a', accent: '#d2582f', accent2: '#1f8a83', accent3: '#e3a23b',
    line: 'rgba(42, 33, 24, 0.16)', panel: 'rgba(42, 33, 24, 0.05)',
    head: "'New York', 'Songti SC', Georgia, serif", headWeight: 700, glow: 'none'
  }
]

export const DEFAULT_LOOK = 'midnight'

// Content colors: pictures and data are drawn in the colors their subject
// needs (real-world colors, colors with a meaning), the same in every
// look; a look only sets the ground and the type. One set reads on dark
// grounds, one on light ones
export const HUES = {
  dark: { red: '#ff5a5f', orange: '#ff9f40', yellow: '#ffd23f', green: '#4ade80', teal: '#2dd4bf', blue: '#4da3ff', violet: '#a78bfa', pink: '#f472b6', gray: '#9aa4b2' },
  light: { red: '#d93a3a', orange: '#e0731a', yellow: '#c99a06', green: '#1f9d55', teal: '#0f9488', blue: '#2563eb', violet: '#7c3aed', pink: '#db2777', gray: '#6b7280' }
}

export const lookById = id => LOOKS.find(l => l.id === id) ?? null

// Visual styles: how a video shows its subject, picked by the AI from the
// idea when it plans (and changeable on the plan page). A style decides
// what the frames are made of; a look then gives a 2D style its palette
// and type. Each style has reference stills (styles/<id>/*.jpg, from the
// bundled examples) that the AI looks at before it chooses and while it
// builds (styles.mjs)
export const STYLES = [
  {
    id: 'scene',
    track: '2d',
    name: { en: 'Cinematic scene' },
    when: 'The subject is a real thing or process you could film: space, nature, physics, weather, the body, inside a machine or a cell. The explanation happens TO it on screen (light crossing to Earth, ions moving, a storm forming); the viewer remembers a picture.',
    avoid: 'Abstract numbers with no object to show (rankings, money, shares, trends): forcing them into a scene hides the comparison.',
    frames: 'One lit world for the whole video on a canvas: light sources that bloom, glowing objects with depth (lit spheres, beams, particles with parallax), a slowly drifting camera, a dark vignette. Numbers and captions float over it as glowing type; data, when needed, is drawn as light inside the scene.',
    example: 'sunlight-en',
    why: 'Sunlight: the Sun blooms with corona and lens streak, stars drift with parallax, a pulse of light actually travels to Earth while the timer runs. It feels 3D because there is light, depth and a moving camera, and the explanation is the event itself.',
    looks: LOOKS.filter(l => l.scene).map(l => l.id)
  },
  {
    id: 'infographic',
    track: '2d',
    name: { en: 'Infographic' },
    when: 'The subject is numbers and their relations: statistics, comparisons, rankings, shares, money, growth, trends over time. There is no single object to film; the point is a quantity or a difference.',
    avoid: 'A physical process or a place: a chart of it is weaker than showing it.',
    frames: 'Clean animated charts, counters, waffles, bars and diagrams in SVG on the look\'s ground, one idea per frame, the toolbox devices at full size.',
    example: 'solar-share-en',
    why: 'Solar share: 6.9% rolls up beside a world-power bar, coal\'s 34% towers over solar in a stacked column, a +29% year grows as two bars with the 474 TWh added marked, a doubling stacks into ×2. Every number moves and the comparison is the picture.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: 'map',
    track: '2d',
    name: { en: 'Map' },
    when: 'The subject is about places: where things are, how they move between them, how something spreads or differs by country (trade, travel, migration, disasters, history, records by country).',
    avoid: 'Anything without geography; one place only, where a scene of it shows more.',
    frames: 'The world map on the stage: the camera moves from the globe to the region that matters, countries light up in meaning colors, routes draw on as arcs, pins drop, numbers sit beside the places.',
    example: 'coffee-map-en',
    why: 'Coffee map: the globe turns to the coffee belt, the growers light up green one by one (Brazil about 1 in 3 bags), Ethiopia glows as where arabica began, and routes arc north to Europe and the US; every number sits on its place.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: 'ui',
    track: '2d',
    name: { en: 'Interface demo' },
    when: 'The subject happens on a screen: an app trick, a setting, how a scam or a phishing message works, what a feature does, security and privacy.',
    avoid: 'Anything that does not happen on a screen.',
    frames: 'A large phone or browser on the stage showing what happens step by step: messages arrive, a notification drops, a field fills in, a finger taps, a warning appears; the caption above sums up each step.',
    example: 'fake-parcel-text-en',
    why: 'Fake parcel text: a phone fills the frame, a fake delivery text arrives, a finger taps the link, the page asks for the card number; each step lands with a tap and a short caption.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: 'blueprint',
    track: '2d',
    name: { en: 'Blueprint' },
    when: 'The subject is how a thing works inside: a machine, a mechanism, a device, a building, a tool; its parts and how they move.',
    avoid: 'Numbers and comparisons; things where the look of the real object matters more than its parts (a cinematic scene or 3D).',
    frames: 'Technical line art on a grid: the object drawn on stroke by stroke, cut open, parts separating into an exploded view, gears turning, every part labelled with a callout and a dimension where it helps.',
    example: 'zipper-blueprint-en',
    why: 'Zipper blueprint: the zipper draws itself on a grid, one tooth is cut open (bump above, hollow below), the two rows interlock half a tooth apart, the slider\'s Y-channel tilts each tooth into the next, and every part is labelled.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: 'kinetic',
    track: '2d',
    name: { en: 'Kinetic type' },
    when: 'The subject is words themselves: a quote, a word and where it comes from, a myth to debunk, a rule of language, a slogan. The text IS the thing being explained.',
    avoid: 'Anything that can be shown as a picture: a fact with an object, a number with a chart. Kinetic type is the strictest pick, never a fallback.',
    frames: 'Big type filling the frame, word by word: words rise, pop or slide in, a marker sweeps under the key word, a wrong word is struck through or rolls into the right one, a stamp lands.',
    example: 'chinese-words-en',
    why: 'Words born in Chinese: KETCHUP, TYCOON, TYPHOON and KOWTOW fill the frame in huge type, each one opening into its Chinese characters and first meaning, a marker under the key words, a FROM CHINESE stamp at the end.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: 'news',
    track: '2d',
    name: { en: 'News story' },
    when: 'The subject is an event that happened: a hack or a heist, a crash, a raid, an arrest, a ruling, a collapse, a scandal; told as a story with dates, actors, money and consequences (who did what, when, how it unfolded, what happens next).',
    avoid: 'Timeless explanations with no event (how something works, why the sky is blue); a single statistic with no story, which an infographic shows better.',
    frames: 'A broadcast with tension: a BREAKING banner wipes in, a clock or timestamp keeps running, the story moves along a timeline; money drains from a wallet, splits down a trail into thousands of wallets and swirls through a mixer; agencies appear as badges, statements as typed quotes, headlines as clipped cards, documents with redactions lifting; a stamp lands on what is confirmed or alleged; red flashes and a shake on the hits, a beat of quiet before the reveal.',
    example: 'bybit-heist-en',
    why: 'Bybit heist: a BREAKING banner over a counter rolling to $1.5B, the cold wallet draining while a clock runs, the biggest crypto thefts as a bar race, the money splitting down a trail and swirling through a mixer into bitcoin, the FBI badge with its statement typed in and an ATTRIBUTED stamp; every beat has its date.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: '3d',
    track: '3d',
    name: { en: '3D' },
    when: 'The idea needs real geometry, light or a camera moving through space: an object taken apart layer by layer, a room or a building, a mechanism seen from changing angles.',
    avoid: 'Numbers, charts and anything flat; and machines without Blender.',
    frames: 'A Blender scene: real materials and light, one camera move per shot, captions over it.',
    example: 'phone-teardown-en',
    why: 'Phone teardown: the phone floats in a dark studio, its layers fly apart into an exploded view, each part lit and labelled.',
    looks: []
  }
]

// A 2D project's style when nobody picked one
export const DEFAULT_STYLE = 'infographic'

export const styleById = id => STYLES.find(s => s.id === id) ?? null

// The moods a synthesized music bed is composed in (score.mjs)
export const MUSIC_MOODS = Object.keys(MOODS)

// Poly Pizza's categories, in the order of its API's numbers (library.mjs)
export const POLY_CATEGORIES = ['food', 'clutter', 'weapons', 'transport', 'furniture', 'objects', 'nature', 'animals', 'buildings', 'people', 'scenes', 'other']

// 3D final quality: EEVEE render samples per frame. 24 looks the same as
// 64 on these scenes (SSIM 0.9999) at well under half the time; more
// helps fine glossy detail and fast motion blur
export const DEFAULT_SAMPLES = 24

// The idea's first sentence as a title, at most 60 characters, cut at a
// word (an ellipsis marks the cut) so no word is left half-written
export function firstLine(idea, max = 60) {
  const t = String(idea).split(/[.?!\n。？！]/)[0].trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, '') + '…'
}

// Seconds a caption must stay fully on screen: 1 s, plus 0.3 s per word,
// 0.15 s per Chinese character (the 2D principles, agent/src/principles.ts).
// It uses nothing outside itself: the kit pages carry its source
export function readTime(text) {
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
  const chars = (String(text).match(cjk) || []).length
  const words = String(text).replace(cjk, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length
  return chars + words ? 1 + 0.3 * words + 0.15 * chars : 0
}
