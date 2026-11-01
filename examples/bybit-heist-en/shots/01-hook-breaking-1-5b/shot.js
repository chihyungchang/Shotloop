// 01-hook-breaking-1-5b: Hook: breaking, $1.5B gone.
// On the voice: the BREAKING banner wipes in with "Breaking", a red counter
// rolls up and slams down on "dollars" with an alarm flash and a shake,
// "stolen in a single hack" lands with its words, while ETH coins rain past.
// Shot-local time: t = 0 is this shot's first frame.
import { sourceLine, when, FILM } from '../../world/parts.js'

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { C, W, rise, ease, clamp, hash, HEAD_FONT } = kit
  const LAND = when(voice, 'dollars', 1.3)
  const HACK = when(voice, 'single hack', 2.6)
  kit.frame({ progress: (start + t) / FILM })

  // coins raining down behind everything, faster after the hit
  let rain = ''
  for (let i = 0; i < 26; i++) {
    const speed = 160 + 140 * hash(i, 1) + (t > LAND ? 120 : 0)
    const y = ((t * speed + hash(i, 2) * 1500) % 1500) - 100
    rain += '<g opacity="' + (0.12 + 0.18 * hash(i, 3)) + '">' + kit.icon('eth', 30 + hash(i, 4) * (W - 60), y, 26 + 34 * hash(i, 5)) + '</g>'
  }

  // the counter rolls, lands hard, glows
  const roll = ease(clamp((t - 0.2) / (LAND - 0.2)))
  const [dx, dy] = kit.shake(t, LAND, { amp: 14 })
  const hit = t > LAND ? 1 + 0.18 * Math.exp(-(t - LAND) * 7) : 0.9 + 0.1 * rise(t, 0, 0.3)
  const num = '$' + (1.5 * roll).toFixed(1) + 'B'
  const counter = '<g transform="translate(' + (360 + dx) + ' ' + (520 + dy) + ') scale(' + hit + ')">' +
    '<text text-anchor="middle" font-family="' + HEAD_FONT + '" font-size="190" font-weight="900" fill="' + C.hue.red + '" filter="url(#glow)" opacity="' + 0.6 * rise(t, LAND, 0.2) + '">' + num + '</text>' +
    '<text text-anchor="middle" font-family="' + HEAD_FONT + '" font-size="190" font-weight="900" fill="' + C.hue.red + '" style="font-variant-numeric: tabular-nums">' + num + '</text></g>'

  kit.stage(
    '<defs><filter id="glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="18"/></filter></defs>' +
    rain +
    kit.live(t, { x: 40, y: 190, time: '21 FEB 2025' }) +
    kit.breaking({ text: 'Crypto exchange Bybit hacked', y: 238, p: rise(t, 0.15, 0.7) }) +
    counter +
    '<text x="360" y="596" text-anchor="middle" font-family="' + HEAD_FONT + '" font-size="40" font-weight="800" fill="' + C.text + '" opacity="' + rise(t, HACK, 0.35) + '">' +
    '<tspan fill="' + C.hue.red + '">stolen</tspan> in a single hack</text>' +
    kit.icon('hacker', 360, 740, 170, { color: C.text, p: rise(t, HACK + 0.2, 0.5) }) +
    sourceLine(kit, 'FBI PSA I-022625-PSA, 26 Feb 2025') +
    kit.alarm(t, LAND)
  )
}
