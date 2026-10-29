// 01-hook: the question, and 1.01 against 0.99 side by side.
// Shot-local time: t = 0 is this shot's first frame. The middle frame
// (t ≈ 2.25) is the gallery poster: everything is in by then.

const side = (id, x, color, label, value, note) => `
  <div class="abs" id="${id}" style="left:${x}px; top:258px; width:500px">
    <div class="mono ${color}" style="font-weight:600">${label}</div>
    <div class="num ${color}" style="font-size:180px; font-weight:700; line-height:1; margin-top:14px">${value}<sup class="exp" id="${id}Exp">365</sup></div>
    <div id="${id}Rule" style="height:2px; width:420px; margin-top:22px; background:var(--${color})"></div>
    <div style="font-size:22px; font-weight:600; margin-top:14px">${note}</div>
  </div>`

const HTML = `
  <div class="abs mono" id="kick" style="left:80px; top:104px">一个问题</div>
  <h1 class="abs headline" id="q" style="left:80px; top:128px; font-size:64px">每天进步 <span class="num">1%</span>，一年后是多少？</h1>
  <div class="abs" id="divider" style="left:640px; top:256px; width:1px; height:272px; background:var(--rule); transform-origin:top"></div>
  <div class="abs mono" id="vs" style="left:640px; top:378px; transform:translateX(-50%); background:var(--paper); padding:6px 0">vs</div>
  ${side('up', 80, 'green', '每天多做一点', '1.01', '比昨天好 1%')}
  ${side('down', 700, 'red', '每天少做一点', '0.99', '比昨天差 1%')}
  <div class="abs" id="diff" style="left:80px; right:80px; top:584px; display:flex; align-items:baseline; gap:18px">
    <span class="mono" style="color:var(--ink)">每天只差</span>
    <span class="num" style="font-size:30px; font-weight:700">0.02</span>
    <span class="mono">· 把它连乘 365 天</span>
  </div>`

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 1, start, foot: '1% 的差别', footR: 'Shotloop 示例' })
  const s = kit.scene('hook', HTML)
  const $ = sel => s.querySelector(sel)

  kit.lift($('#kick'), kit.rise(t, -0.2, 0.5), 10)
  kit.lift($('#q'), kit.rise(t, -0.1, 0.8), 26)
  kit.lift($('#up'), kit.rise(t, 0.6, 0.8), 34)
  kit.lift($('#down'), kit.rise(t, 0.8, 0.8), 34)
  $('#divider').style.transform = `scaleY(${kit.rise(t, 0.7, 0.9)})`
  $('#vs').style.opacity = kit.rise(t, 1.0, 0.5)
  kit.wipe($('#upRule'), kit.rise(t, 1.0, 0.8))
  kit.wipe($('#downRule'), kit.rise(t, 1.15, 0.8))

  // The exponent drops in: what a year of it does
  for (const [id, a] of [['#upExp', 1.35], ['#downExp', 1.5]]) {
    const p = kit.rise(t, a, 0.5)
    $(id).style.opacity = p
    $(id).style.top = `${0.12 - (1 - p) * 0.3}em`
  }
  kit.lift($('#diff'), kit.rise(t, 1.7, 0.6), 12)

  // A slow push over the whole shot keeps the hold alive
  s.style.transformOrigin = '50% 45%'
  s.style.transform = `scale(${1 + 0.015 * kit.ease.inOut(t / 4.5)})`
}
