// 03-eight-slot-machine: 3D: eight slot-machine drums of a–z spinning, then locking left to right.
// Shot-local time: t = 0 is this shot's first frame.
//
// Converted from the legacy episode: the drawing still lives in
// world/page.html, which is drawn here at the shot's film time. Move this
// shot's drawing in here to edit it without touching the other shots.

export default function render(t, { world, start }) {
  world(start + t)
}
