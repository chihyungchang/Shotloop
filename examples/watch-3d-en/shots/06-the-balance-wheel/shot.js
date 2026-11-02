// 06-the-balance-wheel: the gold balance and its blue hairspring swing,
// nudging the pallet fork, while the beat count rolls up to a day.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildWatch, BPS } from '../../world/watch.js'

let kit, w
const SLOW = 8 // shown at 1/8 speed, said on screen

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  setLook(kit)
  w = buildWatch(kit)
  // Open from the dial side: the balance and fork lie under the dial
  for (const n of ['dial', 'hands', 'crystal']) w.layers[n].visible = false
}

export default function render(t) {
  const k = kit
  k.begin(t)

  // Balance, hairspring, fork and escape wheel by their real kinematics, slowed
  const beats = 0.35 + t * BPS / SLOW
  w.pose({ beats })
  w.pose({ beats, glow: 0.9 * Math.exp(-w.state.sinceTick * 5) })

  // One move: a slow 30° orbit from above round the balance, held at both ends
  const bal = w.at('balance'), fork = w.at('fork')
  const at = k.mix(bal, fork, 0.12)
  // (away from the key light's mirror angle near 214°, which glares the plate)
  const deg = k.lerp(180, 150, k.ease((t - 0.2) / 4.4))
  k.look(k.orbit(at, 0.034, deg, 0.049), at, 100)

  // A dark band behind the headline so it reads over the polished case
  k.block({ x: 0, y: 0, w: 720, html: '', style: 'height:470px;background:linear-gradient(rgba(6,8,13,0.82) 55%, rgba(6,8,13,0))' })

  // Headline with rolling numbers that land with a bounce
  const n1 = Math.round(8 * k.ease((t - 0.3) / 0.9))
  const s1 = 0.8 + 0.2 * k.pop(t, 1.15, 0.5)
  const n2 = Math.round(691200 * k.ease((t - 1.5) / 1.5))
  const s2 = 0.8 + 0.2 * k.pop(t, 2.95, 0.5)
  const num = (v, s, w0) => '<b style="display:inline-block;min-width:' + w0 + 'px;text-align:right;font-variant-numeric:tabular-nums;transform:scale(' + s.toFixed(3) + ');transform-origin:50% 70%">' + v + '</b>'
  k.block({ y: 150, p: k.rise(t, 0.1, 0.5), cls: 'head', html: num(n1, s1, 0) + ' beats a second,' })
  k.block({ y: 222, p: k.rise(t, 1.3, 0.5), cls: 'head', html: '≈' + num(k.fmt(n2), s2, 232) + ' a day' })

  k.block({ x: 0, y: 880, w: 720, html: '', style: 'height:400px;background:linear-gradient(rgba(6,8,13,0), rgba(6,8,13,0.75) 30%)' })
  k.block({ y: 926, w: 0, p: k.rise(t, 0.6, 0.5), cls: 'chip', style: 'width:auto;white-space:nowrap', html: 'slowed 8×' })
  k.source('28,800 beats/hour (common rate) × 24 h ≈ 691,200', k.rise(t, 0.8, 0.5))

  k.keep(w.parts.balance, 'balance wheel')
  k.keep(w.parts.hairspring, 'hairspring')
  k.frame()
}
