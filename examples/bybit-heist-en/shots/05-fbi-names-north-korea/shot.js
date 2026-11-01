// 05-fbi-names-north-korea: FBI names North Korea.
// The map closes in on the Korean peninsula; the FBI's badge pops in as
// the voice says "FBI", the announcement's headline types in as a quote
// with its date, and on "North Korea" the country lights red and an
// ATTRIBUTED stamp lands.
// Shot-local time: t = 0 is this shot's first frame.
import { sourceLine, when, FILM } from '../../world/parts.js'

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { C, W, rise, ease, clamp, lerp } = kit
  const FBI = when(voice, 'FBI', 1.2)
  const NK = when(voice, 'North Korea', 3.2)
  kit.frame({ head: 'FBI: *North Korea*', typed: rise(t, NK, 0.35), progress: (start + t) / FILM })

  // the camera: from the region to the peninsula, which sits low in the frame
  const zoom = lerp(4, 13, ease(clamp(t / NK)))
  const k = (W / 360) * zoom
  const land = kit.map({ center: [127.5, 40 + 60 / k], zoom, highlight: { 'North Korea': C.hue.red }, p: rise(t, NK, 0.4) })

  kit.stage(
    '<g opacity=".7">' + land + '</g>' +
    kit.badge(360, 330, 130, { label: 'FBI', sub: 'PUBLIC SERVICE ANNOUNCEMENT', p: rise(t, FBI - 0.1, 0.6) }) +
    kit.quote({ x: 60, y: 400, w: 600, text: 'North Korea Responsible for $1.5 Billion Bybit Hack', who: 'FBI, 26 Feb 2025', p: clamp((t - FBI - 0.2) / 1.8), size: 34 }) +
    sourceLine(kit, 'FBI PSA I-022625-PSA, 26 Feb 2025') +
    kit.alarm(t, NK + 0.3, { d: 0.5 })
  )
  const [dx, dy] = kit.shake(t, NK + 0.3, { amp: 8 })
  kit.stamp('ATTRIBUTED', rise(t, NK + 0.3, 0.25), { x: 380 + dx, y: 760 + dy, size: 36, rotate: -8 })
}
