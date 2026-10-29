// 06-end: end card. The two results, a small echo of the log chart and
// the takeaway; no links or personal branding.
// Shot-local time: t = 0 is this shot's first frame.

const row = (id, base, value, color) => `
  <div class="abs num" id="${id}" style="left:80px; top:${id === 'r1' ? 196 : 306}px; font-size:84px; font-weight:700; line-height:1; color:var(--${color})">
    ${base}<sup class="exp">365</sup><span class="muted" style="font-weight:400; margin:0 22px 0 18px">≈</span>${value}
  </div>`

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 6, start, foot: '计算：(1 ± 0.01)³⁶⁵', footR: 'Shotloop 示例' })
  const c = kit.chart({ x: 900, y: 200, w: 300, h: 190, y0: 0.01, y1: 100, log: true })
  const s = kit.scene('end', `
    <div class="abs mono" id="kick" style="left:80px; top:100px">一年之后</div>
    ${row('r1', '1.01', '37.78', 'green')}
    ${row('r2', '0.99', '0.026', 'red')}
    <svg class="plot" viewBox="0 0 1280 720">
      <g id="mini">
        <line x1="${c.x}" x2="${c.x + c.w}" y1="${c.sy(1)}" y2="${c.sy(1)}" stroke="var(--ink)" stroke-dasharray="3 4" opacity="0.4" />
        <line x1="${c.x}" x2="${c.x + c.w}" y1="${c.y + c.h}" y2="${c.y + c.h}" stroke="var(--ink)" stroke-width="1.2" />
        <text x="${c.x}" y="${c.y + c.h + 22}">第 0 天</text>
        <text x="${c.x + c.w}" y="${c.y + c.h + 22}" text-anchor="end">第 365 天</text>
      </g>
      <path id="up" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" />
      <path id="down" fill="none" stroke="var(--red)" stroke-width="3" stroke-linecap="round" />
    </svg>
    <div class="abs" id="rule" style="left:80px; right:80px; top:470px; height:1px; background:var(--ink)"></div>
    <div class="abs headline" id="take" style="left:80px; top:502px; font-size:46px">差距不在某一天，而在每一天。</div>`)
  const $ = sel => s.querySelector(sel)

  kit.lift($('#kick'), kit.rise(t, -0.15, 0.5), 10)
  kit.lift($('#r1'), kit.rise(t, 0, 0.7), 24)
  kit.lift($('#r2'), kit.rise(t, 0.15, 0.7), 24)
  $('#mini').style.opacity = kit.rise(t, 0.1, 0.5)
  const day = 365 * kit.ease.inOut((t - 0.2) / 1.1)
  $('#up').setAttribute('d', day > 0.5 ? c.path(d => Math.pow(1.01, d), day, 40) : '')
  $('#down').setAttribute('d', day > 0.5 ? c.path(d => Math.pow(0.99, d), day, 40) : '')
  $('#rule').style.transformOrigin = 'left'
  $('#rule').style.transform = `scaleX(${kit.rise(t, 0.5, 0.8, kit.ease.out)})`
  kit.lift($('#take'), kit.rise(t, 0.7, 0.7), 16)
}
