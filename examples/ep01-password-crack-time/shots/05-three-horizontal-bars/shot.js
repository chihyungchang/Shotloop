// 05-three-horizontal-bars: Three horizontal bars for 2024 / 2025 / 2026 shrinking 225 → 164 → 132.
// Shot-local time: t = 0 is this shot's first frame.
//
// Converted from the legacy episode: the drawing still lives in
// world/page.html, which is drawn here at the shot's film time. Move this
// shot's drawing in here to edit it without touching the other shots.

export default function render(t, { world, start }) {
  world(start + t)
}
