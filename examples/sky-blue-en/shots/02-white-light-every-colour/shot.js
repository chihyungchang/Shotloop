// 02-white-light-every-colour: White light, every colour. A white beam leaves the
// Sun, splits midway into its five colour strands rippling as waves (blue short,
// red long), and the nm labels count up at the strand ends.
// Shot-local time: t = 0 is this shot's first frame.
import { sunBeam } from '../../world/parts.js'

export default function render(t, { window }) {
  const kit = window.kit
  const { clamp, ease, rise, C } = kit

  // A slow push in, drifting along the beam
  kit.stage(t, { camera: { x: 360 + 6 * t, y: 640 + 4 * t, zoom: 1 + 0.02 * t }, drift: t * 14 })

  // Far dust behind the beam
  kit.depth(0.6, () => kit.particles(t, { n: 28, seed: 3, x: 0, y: 320, w: 720, h: 760, size: 1.4, color: C.rgb.cool, vx: 16, life: 4 }))

  sunBeam(kit, {
    t, x0: 130, y0: 470, sunR: 44, sun: 0.4 + 0.6 * rise(t, 0, 0.9),
    splitX: 290, splitY: 625, x1: 598, y1: 680, gap: 104,
    p: clamp((t - 0.1) / 1.1),
    split: [0, 1, 2, 3, 4].map(i => ease(clamp((t - 1.3 - i * 0.08) / 1.2))),
    labels: clamp((t - 2.4) / 0.8)
  })

  // Near motes drifting past the camera
  kit.depth(1.4, () => kit.particles(t, { n: 10, seed: 9, x: 0, y: 380, w: 720, h: 640, size: 2.2, color: C.rgb.light, vx: 26, vy: -6, life: 5 }))

  kit.caption({ head: ['Sunlight carries', '*every colour*'], p: rise(t, 0.15, 0.7) })
  kit.source("Source: NASA SciJinks, 'Why Is the Sky Blue?' · waves not to scale", rise(t, 2.2, 0.6))
}
