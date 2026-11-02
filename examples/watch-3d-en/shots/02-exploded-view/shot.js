// 02-exploded-view: the watch flies apart along its vertical axis while the
// camera rises and pulls back to show the whole stack, each layer labelled.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildWatch, BPS } from '../../world/watch.js'

let kit, w, start = 0

// Labelled layers, top to bottom; side alternates so chips never touch
const LABELS = [
  ['crystal', 'Crystal'], ['hands', 'Hands'], ['dial', 'Dial'], ['train', 'Gear train'],
  ['barrel', 'Mainspring'], ['escapement', 'Escapement'], ['balance', 'Balance wheel'], ['mainplate', 'Mainplate']
]

// Camera: low and close on the assembled watch, then up and back over the stack
const CAM = {
  from0: [0.012, 0.078, 0.215], at0: [0.012, 0.02, 0],
  from1: [0.012, 0.247, 0.364], at1: [0.012, 0.08, 0], mm: 50
}

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  start = ctx.start || 0
  // Less bloom than the world's: the polished lugs and the dial glare up close
  setLook(kit, { bloom: 0.1 })
  w = buildWatch(kit)
}

export default function render(t, ctx) {
  const { ease, clamp, rise, mix } = kit
  kit.begin(t)

  // Watch lies dial up, slightly turned so the crown reads at the left
  w.root.rotation.set(0, 0.25, 0)
  const explode = clamp((t - 0.5) / 2.9)
  w.pose({ beats: ((ctx?.start ?? start) + t) * BPS, explode, gap: 0.011, glow: rise(t, 1.8, 1.4) })

  // One move: rise and pull back, tilting down a little
  const p = ease((t - 0.2) / 3.5)
  kit.look(mix(CAM.from0, CAM.from1, p), mix(CAM.at0, CAM.at1, p), CAM.mm)

  kit.caption({ head: ['Inside: a *spring*,', 'gears and a', 'beating wheel'], size: 52, p: rise(t, -0.2, 0.5) })

  // Floating labels, each fading in once its layer has lifted clear
  const cx = kit.screen(w.at('watch'))
  LABELS.forEach(([name, text], i) => {
    const s = kit.screen(w.at(name))
    if (!s || !cx) return
    const lp = ease(w.state.explodeP[name] * 2 - 1)
    if (lp <= 0) return
    const right = i % 2 === 0
    const style = 'width:auto;white-space:nowrap;font-size:20px;transform:translateY(-50%);' +
      (right ? 'left:436px' : 'right:' + (720 - 206) + 'px;left:auto')
    kit.block({ x: right ? 436 : 0, y: s[1], w: 0, p: lp, dy: 10, cls: 'chip', html: text, style })
  })

  kit.keep(w.root, 'watch')
  kit.frame()
}
