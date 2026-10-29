// 03-down: 0.99 multiplied 365 times. The red curve sinks across the
// year while the counter falls from 1.000 to 0.026 (0.99^365 = 0.0255).
// Shot-local time: t = 0 is this shot's first frame.

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 3, start, foot: '× 0.99 every day', footR: '0.99³⁶⁵ ≈ 0.026' })
  kit.curveShot(t, {
    key: 'down',
    kicker: '1% worse every day, for 365 days',
    base: 0.99,
    color: 'red',
    y1: 1,
    yt: [0, 0.25, 0.5, 0.75, 1],
    yfmt: v => v.toFixed(2),
    digits: 3,
    counter: 'left:690px; top:164px',
    note: 'After a year: just 2.6% of where you started',
    // 0.99^69 = 0.4998
    mark: { day: 69, label: ['Day 69', 'half gone'] },
    draw: [0.4, 3.5]
  })
}
