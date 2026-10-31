// Visual styles: how a video shows its subject, picked by the AI from the
// idea when it plans (and changeable on the plan page). A style decides
// what the frames are made of; a look (looks.mjs) then gives a 2D style
// its palette and type. Each style has reference stills (styles/<id>/*.jpg,
// from the bundled examples) that the AI looks at before it chooses and
// while it builds.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const STYLES = [
  {
    id: 'scene',
    track: '2d',
    name: { en: 'Cinematic scene', 'zh-CN': '电影感场景', 'pt-BR': 'Cena cinematográfica' },
    when: 'The subject is a real thing or process you could film: space, nature, physics, weather, the body, inside a machine or a cell. The explanation happens TO it on screen (light crossing to Earth, ions moving, a storm forming); the viewer remembers a picture.',
    avoid: 'Abstract numbers with no object to show (rankings, money, shares, trends): forcing them into a scene hides the comparison.',
    frames: 'One lit world for the whole video on a canvas: light sources that bloom, glowing objects with depth (lit spheres, beams, particles with parallax), a slowly drifting camera, a dark vignette. Numbers and captions float over it as glowing type; data, when needed, is drawn as light inside the scene.',
    example: 'sunlight',
    why: 'Sunlight: the Sun blooms with corona and lens streak, stars drift with parallax, a pulse of light actually travels to Earth while the timer runs. It feels 3D because there is light, depth and a moving camera, and the explanation is the event itself.',
    looks: ['midnight', 'neon']
  },
  {
    id: 'infographic',
    track: '2d',
    name: { en: 'Infographic', 'zh-CN': '信息图', 'pt-BR': 'Infográfico' },
    when: 'The subject is numbers and their relations: statistics, comparisons, rankings, shares, money, growth, trends over time. There is no single object to film; the point is a quantity or a difference.',
    avoid: 'A physical process or a place: a chart of it is weaker than showing it.',
    frames: 'Clean animated charts, counters, waffles, bars and diagrams in SVG on the look\'s ground, one idea per frame, the toolbox devices at full size.',
    example: 'one-percent',
    why: 'One percent: 1.01^365 and 0.99^365 roll up as big numbers, two curves split apart, 180 habit days fill a grid. Every number moves and the comparison is the picture.',
    looks: ['midnight', 'paper', 'neon', 'pastel', 'mono']
  },
  {
    id: '3d',
    track: '3d',
    name: { en: '3D', 'zh-CN': '3D', 'pt-BR': '3D' },
    when: 'The idea needs real geometry, light or a camera moving through space: an object taken apart layer by layer, a room or a building, a mechanism seen from changing angles.',
    avoid: 'Numbers, charts and anything flat; and machines without Blender.',
    frames: 'A Blender scene: real materials and light, one camera move per shot, captions over it.',
    example: 'phone-teardown',
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
