// 01-hook: the question, and 1.01 against 0.99 side by side.
// Shot-local time: t = 0 is this shot's first frame. Timed to the
// voice-over (ctx.voice): the numerals and the 0.02 line land on "sounds
// tiny", each rule wipes as its side is named, the exponents drop on
// "a whole year". Everything sits above the subtitle band (y 518).

const side = (id, x, color, label, value, note) => `
  <div class="abs" id="${id}" style="left:${x}px; top:214px; width:500px">
    <div class="mono ${color}" style="font-weight:600">${label}</div>
    <div class="num ${color}" style="font-size:150px; font-weight:700; line-height:1; margin-top:14px">${value}<sup class="exp" id="${id}Exp">365</sup></div>
    <div id="${id}Rule" style="height:2px; width:420px; margin-top:22px; background:var(--${color})"></div>
    <div style="font-size:22px; font-weight:600; margin-top:14px">${note}</div>
  </div>`

const HTML = `
  <div class="abs mono" id="kick" style="left:80px; top:104px">A question</div>
  <h1 class="abs headline" id="q" style="left:80px; top:128px; font-size:56px"><span class="num">1%</span> better every day: what's a year worth?</h1>
  <div class="abs" id="divider" style="left:640px; top:212px; width:1px; height:250px; background:var(--rule); transform-origin:top"></div>
  <div class="abs mono" id="vs" style="left:640px; top:322px; transform:translateX(-50%); background:var(--paper); padding:6px 0">vs</div>
  ${side('up', 80, 'green', 'A little more each day', '1.01', '1% better than yesterday')}
  ${side('down', 700, 'red', 'A little less each day', '0.99', '1% worse than yesterday')}
  <div class="abs" id="diff" style="left:80px; right:80px; top:480px; display:flex; align-items:baseline; gap:18px">
    <span class="mono" style="color:var(--ink)">Just</span>
    <span class="num" style="font-size:30px; font-weight:700">0.02</span>
    <span class="mono">apart each day · now compound it for 365 days</span>
  </div>`

export default function render(t, { window, start, duration = 5.9, voice = [] }) {
  const { kit } = window
  kit.frame(t, { index: 1, start, foot: 'A 1% difference', footR: 'A Shotloop example' })
  const s = kit.scene('hook', HTML)
  const $ = sel => s.querySelector(sel)

  kit.lift($('#kick'), kit.rise(t, -0.2, 0.5), 10)
  kit.lift($('#q'), kit.rise(t, -0.1, 0.8), 26)
  kit.lift($('#up'), kit.rise(t, 0.6, 0.8), 34)
  kit.lift($('#down'), kit.rise(t, 0.8, 0.8), 34)
  $('#divider').style.transform = `scaleY(${kit.rise(t, 0.7, 0.9)})`
  $('#vs').style.opacity = kit.rise(t, 1.0, 0.5)
  // Sentence 2: "But what happens if you keep it up, or let it slip, for a
  // whole year?" (times by the share of its words)
  const [s1, s2] = [voice[0] ?? { at: 0.2, end: 2.1 }, voice[1] ?? { at: 2.35, end: 5.36 }]
  const w = k => s2.at + (s2.end - s2.at) * k
  kit.wipe($('#upRule'), kit.rise(t, w(0.3), 0.8))
  kit.wipe($('#downRule'), kit.rise(t, w(0.55), 0.8))

  // The exponent drops in on "a whole year": what a year of it does
  for (const [id, a] of [['#upExp', w(0.8)], ['#downExp', w(0.8) + 0.15]]) {
    const p = kit.rise(t, a, 0.5)
    $(id).style.opacity = p
    $(id).style.top = `${0.12 - (1 - p) * 0.3}em`
  }
  kit.lift($('#diff'), kit.rise(t, s1.end - 0.6, 0.6), 12)

  // A slow push over the whole shot keeps the hold alive
  s.style.transformOrigin = '50% 45%'
  s.style.transform = `scale(${1 + 0.015 * kit.ease.inOut(t / duration)})`
}
