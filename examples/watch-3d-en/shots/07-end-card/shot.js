// 07-end-card: the exploded layers fly back together; the watch turns
// face-forward into the hero framing of shot 1, seconds hand sweeping.
// Shot-local time: t = 0 is this shot's first frame.
import { setLook, buildWatch, HERO, BPS } from '../../world/watch.js'

let kit, w, start = 0

export async function setup(ctx) {
  kit = await ctx.window.kit.init(ctx)
  setLook(kit)
  w = buildWatch(kit)
  start = ctx.start
}

// Exploded start pose: turned so the stack fans out sideways
const ROT0 = [Math.PI / 2 - 0.3, -0.8, 0]
const FROM0 = [0.012, 0.03, 0.31]
const GAP = 0.005
// HERO lowered 6 mm in both eye and aim so the lugs clear the bottom band
const LIFT = [0, -0.006, 0]
const FROM1 = HERO.from.map((v, i) => v + LIFT[i]), AT1 = HERO.at.map((v, i) => v + LIFT[i])

export default function render(t) {
  const { ease, clamp, mix, lerp } = kit
  kit.begin(t)

  // Anticipation: the stack breathes out a little, then flies together
  const swell = 0.06 * Math.sin(Math.PI * clamp(t / 0.45))
  const together = ease(clamp((t - 0.35) / 1.6))
  const explode = (1 - together) * (1 + swell)
  const turn = ease(clamp((t - 0.3) / 2.1))
  w.root.rotation.set(...mix(ROT0, HERO.rot, turn))
  w.pose({ beats: (start + t) * BPS, explode, gap: GAP })

  // Aim follows the stack's centre while it closes, then settles on HERO
  const a = w.at('caseback'), b = w.at('crystal')
  // Centre of the stack, nudged so the case clears the right-hand buttons
  const mid = mix(a, b, 0.5).map((v, i) => v + (i === 0 ? 0.003 : 0))
  const at = mix(mid, AT1, turn)
  const move = ease(clamp((t - 0.2) / 2.2))
  kit.look(mix(FROM0, FROM1, move), at, HERO.mm)

  kit.caption({ head: ['A spring, a wheel,', '*no battery*'], p: kit.rise(t, 0.15, 0.5), align: 'center' })
  kit.keep(w.root, 'watch')
  kit.frame()
}
