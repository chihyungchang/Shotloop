// 04-gap: both curves on one log-scale chart, where they are straight
// lines pulling apart, and the gap at day 365:
// 1.01^365 / 0.99^365 = (1.01 / 0.99)^365 = 1,480.66 ≈ 1,481.
// Shot-local time: t = 0 is this shot's first frame.

const UP = d => Math.pow(1.01, d)
const DOWN = d => Math.pow(0.99, d)
const GAP = Math.pow(1.01 / 0.99, 365)

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 4, start, foot: '对数刻度：每格 ×10', footR: '(1.01 ÷ 0.99)³⁶⁵ ≈ 1,481' })
  const c = kit.chart({ x: 150, y: 150, w: 590, h: 430, y0: 0.01, y1: 100, log: true })
  const s = kit.scene('gap', `
    <div class="abs mono" id="kick" style="left:80px; top:100px">放在一起看 · 对数刻度</div>
    <svg class="plot" viewBox="0 0 1280 720">
      <g id="grid">${c.axes({ xt: [0, 100, 200, 300, 365], yt: [0.01, 0.1, 1, 10, 100], yfmt: v => String(v), xlabel: '天数 →' })}</g>
      <line x1="${c.x}" x2="${c.x + c.w}" y1="${c.sy(1)}" y2="${c.sy(1)}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" opacity="0.5" />
      <text x="${c.x + c.w - 4}" y="${c.sy(1) - 8}" text-anchor="end">起点 = 1</text>
      <path id="up" fill="none" stroke="var(--green)" stroke-width="3.5" stroke-linecap="round" />
      <path id="down" fill="none" stroke="var(--red)" stroke-width="3.5" stroke-linecap="round" />
      <g id="ends"></g>
      <g id="bracket"></g>
    </svg>
    <div class="abs" id="panel" style="left:900px; top:178px; width:300px">
      <div class="mono">一年后的差距</div>
      <div style="display:flex; align-items:baseline; gap:10px; margin-top:10px">
        <span class="num" id="gap" style="font-size:104px; font-weight:700; line-height:1"></span>
        <span style="font-size:36px; font-weight:800">倍</span>
      </div>
      <div id="eq" class="num" style="font-size:22px; font-weight:600; margin-top:22px; line-height:1.6">
        <span class="green">37.78</span> <span class="muted">÷</span> <span class="red">0.0255</span>
      </div>
      <div id="why" style="font-size:20px; font-weight:600; line-height:1.55; margin-top:26px; padding-top:20px; border-top:1px solid var(--rule)">
        每天只差 0.02，<br>一年后差了一千多倍。
      </div>
    </div>`)
  const $ = sel => s.querySelector(sel)

  kit.lift($('#kick'), kit.rise(t, -0.15, 0.5), 10)
  kit.wipe($('#grid'), kit.rise(t, -0.3, 1, kit.ease.out))

  // Both lines draw together, then the gap opens at day 365
  const day = 365 * kit.ease.inOut((t - 0.3) / 2.2)
  $('#up').setAttribute('d', day > 0.5 ? c.path(UP, day, 60) : '')
  $('#down').setAttribute('d', day > 0.5 ? c.path(DOWN, day, 60) : '')
  const X = c.sx(day)
  const on = kit.clamp((t - 0.3) / 0.2)
  $('#ends').innerHTML = [[UP, 'green', 2], [DOWN, 'red', 3]].map(([f, col, dp]) => `
    <circle cx="${X}" cy="${c.sy(f(day))}" r="5.5" fill="var(--${col})" stroke="var(--paper)" stroke-width="2" opacity="${on}" />
    <text x="${X + 14}" y="${c.sy(f(day)) + 6}" style="fill:var(--${col}); font-family:var(--num); font-size:18px; font-weight:700; letter-spacing:0" opacity="${on}">${kit.fmt(f(day), dp)}</text>`).join('')

  const bp = kit.rise(t, 2.5, 0.7, kit.ease.out)
  const bx = c.sx(365) + 92, y1 = c.sy(UP(365)), y2 = c.sy(DOWN(365))
  const ym = (y1 + y2) / 2, half = ((y2 - y1) / 2) * bp
  $('#bracket').innerHTML = bp <= 0 ? '' : `
    <path d="M${bx - 8},${ym - half} H${bx} V${ym + half} H${bx - 8}" fill="none" stroke="var(--ink)" stroke-width="1.5" />
    <line x1="${bx}" x2="${bx + 22}" y1="${ym}" y2="${ym}" stroke="var(--ink)" stroke-width="1.5" opacity="${bp}" />`

  kit.lift($('#panel'), kit.rise(t, 0.1, 0.7), 20)
  // The multiple counts up geometrically so each digit gets its moment
  const g = Math.pow(GAP, kit.ease.inOut((t - 2.6) / 1.3))
  $('#gap').textContent = kit.fmt(g, 0)
  $('#gap').style.color = t > 2.6 ? 'var(--ink)' : 'var(--faint)'
  kit.lift($('#eq'), kit.rise(t, 2.8, 0.6), 10)
  kit.lift($('#why'), kit.rise(t, 3.4, 0.6), 10)
}
