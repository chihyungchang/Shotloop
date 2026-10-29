// 02-up: 1.01 multiplied 365 times. The green curve draws across the year
// while the counter climbs from 1.00 to 37.78 (1.01^365 = 37.783).
// Shot-local time: t = 0 is this shot's first frame.

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 2, start, foot: '每天 × 1.01', footR: '1.01³⁶⁵ ≈ 37.78' })
  kit.curveShot(t, {
    key: 'up',
    kicker: '每天进步 1%，连续 365 天',
    base: 1.01,
    color: 'green',
    y1: 40,
    yt: [0, 10, 20, 30, 40],
    yfmt: v => v,
    digits: 2,
    counter: 'left:190px; top:164px',
    note: '一年后，是起点的 37.78 倍',
    // 1.01^70 = 2.007
    mark: { day: 70, label: ['第 70 天', '翻了一倍'] },
    draw: [0.5, 3.9]
  })
}
