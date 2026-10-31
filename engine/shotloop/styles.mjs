// Visual styles: how a video shows its subject, picked by the AI from the
// idea when it plans (and changeable on the plan page). A style decides
// what the frames are made of; a look (looks.mjs) then gives a 2D style
// its palette and type. Each style has reference stills (styles/<id>/*.jpg,
// from the bundled examples) that the AI looks at before it chooses and
// while it builds.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOOKS } from './looks.mjs'

export const STYLES = [
  {
    id: 'scene',
    track: '2d',
    name: { en: 'Cinematic scene', 'zh-CN': '电影感场景', 'pt-BR': 'Cena cinematográfica' },
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
    name: { en: 'Infographic', 'zh-CN': '信息图', 'pt-BR': 'Infográfico' },
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
    name: { en: 'Map', 'zh-CN': '地图', 'pt-BR': 'Mapa' },
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
    name: { en: 'Interface demo', 'zh-CN': '界面演示', 'pt-BR': 'Demonstração de interface' },
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
    name: { en: 'Blueprint', 'zh-CN': '剖面图纸', 'pt-BR': 'Planta técnica' },
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
    name: { en: 'Kinetic type', 'zh-CN': '动态排版', 'pt-BR': 'Tipografia cinética' },
    when: 'The subject is words themselves: a quote, a word and where it comes from, a myth to debunk, a rule of language, a slogan. The text IS the thing being explained.',
    avoid: 'Anything that can be shown as a picture: a fact with an object, a number with a chart. Kinetic type is the strictest pick, never a fallback.',
    frames: 'Big type filling the frame, word by word: words rise, pop or slide in, a marker sweeps under the key word, a wrong word is struck through or rolls into the right one, a stamp lands.',
    example: 'chinese-words-en',
    why: 'Words born in Chinese: KETCHUP, TYCOON, TYPHOON and KOWTOW fill the frame in huge type, each one opening into its Chinese characters and first meaning, a marker under the key words, a FROM CHINESE stamp at the end.',
    looks: LOOKS.map(l => l.id)
  },
  {
    id: '3d',
    track: '3d',
    name: { en: '3D', 'zh-CN': '3D', 'pt-BR': '3D' },
    when: 'The idea needs real geometry, light or a camera moving through space: an object taken apart layer by layer, a room or a building, a mechanism seen from changing angles.',
    avoid: 'Numbers, charts and anything flat; and machines without Blender.',
    frames: 'A Blender scene: real materials and light, one camera move per shot, captions over it.',
    example: 'phone-teardown-en',
    why: 'Phone teardown: the phone floats in a dark studio, its layers fly apart into an exploded view, each part lit and labelled.',
    looks: []
  }
]

export const styleById = id => STYLES.find(s => s.id === id) ?? null

const DIR = fileURLToPath(new URL('styles', import.meta.url))

// The reference stills of a style, as files
export function styleStills(id) {
  const dir = path.join(DIR, id)
  if (!styleById(id) || !fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => /\.(jpe?g|png)$/i.test(f)).sort().map(f => path.join(dir, f))
}
