// 03-down: 0.99 multiplied 365 times. The red curve sinks across the
// year while the counter falls from 1.000 to 0.026 (0.99^365 = 0.0255).
// Shot-local time: t = 0 is this shot's first frame.

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 3, start, foot: '每天 × 0.99', footR: '0.99³⁶⁵ ≈ 0.026' })
  kit.curveShot(t, {
    key: 'down',
    kicker: '每天退步 1%，连续 365 天',
    base: 0.99,
    color: 'red',
    y1: 1,
    yt: [0, 0.25, 0.5, 0.75, 1],
    yfmt: v => v.toFixed(2),
    digits: 3,
    counter: 'left:690px; top:164px',
    note: '一年后，只剩起点的 2.6%',
    // 0.99^69 = 0.4998
    mark: { day: 69, label: ['第 69 天', '只剩一半'] },
    draw: [0.4, 3.5]
  })
}
