// 06-end-card-the-timeline: End card: the timeline.
// The two dates land on a timeline drawing down, the hack glowing red; on
// "five days" the gap between them counts up; a news ticker crawls under
// it with the story's facts.
// Shot-local time: t = 0 is this shot's first frame.
import { sourceLine, when, FILM } from '../../world/parts.js'

const NEWS = [
  'Bybit: about $1.5B in crypto stolen on 21 Feb 2025',
  'FBI attributes the hack to North Korea (TraderTraitor)',
  'Stolen funds dispersed across thousands of addresses'
]

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { C, rise, clamp, float } = kit
  const DAYS = when(voice, 'five days', 1.4)
  kit.frame({ progress: (start + t) / FILM })

  kit.stage(
    kit.timeline({ x: 130, y: 260, len: 380, p: clamp((t - 0.1) / 1.4), focus: 0, events: [
      { date: '21 FEB 2025', label: '$1.5B drained from Bybit', icon: 'eth' },
      { date: '26 FEB 2025', label: 'FBI: North Korea did it', icon: 'shield', color: C.hue.blue }
    ] }) +
    // the gap between the dates, counted in days
    '<g transform="translate(0 ' + float(t, 3, 3) + ')" opacity="' + rise(t, DAYS - 0.2, 0.4) + '">' +
    kit.icon('clock', 210, 450, 60, { color: C.muted }) +
    '<text x="256" y="474" font-family="' + kit.HEAD_FONT + '" font-size="72" font-weight="800" fill="' + C.text + '"><tspan fill="' + C.accent + '">' +
    Math.round(5 * clamp((t - DAYS) / 0.6)) + '</tspan> days</text></g>' +
    kit.ticker(t, NEWS, { y: 800, label: 'LATEST' }) +
    sourceLine(kit, 'FBI PSA I-022625-PSA, 26 Feb 2025 · Elliptic, 21 Feb 2025')
  )
}
