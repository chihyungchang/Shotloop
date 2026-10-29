// 05-habits: the honest caveat. Real progress is not a steady 1% a day;
// a year of small habits fills in like a calendar, with gaps and uneven
// days. The pattern is illustrative, seeded so every frame agrees.
// Shot-local time: t = 0 is this shot's first frame.

const COLS = 53, ROWS = 7, CELL = 16, GAP = 5, PITCH = CELL + GAP
const GX = 80 + (1120 - (COLS * PITCH - GAP)) / 2, GY = 344

// A stable pseudo-random number per day (0..1)
const rnd = i => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
// Done or skipped, and how much: misses thin out and days get fuller
// as the habit settles in over the year
const DAYS = Array.from({ length: 365 }, (_, i) => {
  const p = i / 364
  const done = rnd(i) > 0.32 - 0.18 * p
  return { done, level: done ? 0.3 + 0.7 * Math.min(1, rnd(i + 999) * 0.7 + p * 0.5) : 0 }
})
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

export default function render(t, { window, start }) {
  const { kit } = window
  kit.frame(t, { index: 5, start, foot: '图中的打卡记录为示意', footR: '1% 是比喻，不是规律' })
  const s = kit.scene('habits', `
    <div class="abs mono" id="kick" style="left:80px; top:100px">说句实话</div>
    <h1 class="abs headline" id="h" style="left:80px; top:124px; font-size:52px">现实里，没有恒定的 <span class="num">1%</span></h1>
    <p class="abs" id="sub" style="left:80px; top:200px; font-size:24px; font-weight:600; color:var(--muted); line-height:1.5">进步有快有慢，也会中断。真正在复利的，是每天一点的小习惯。</p>
    <svg class="plot" viewBox="0 0 1280 720">
      <g id="months">${MONTHS.map((m, i) => `<text x="${GX + Math.floor(MONTH_START[i] / 7) * PITCH}" y="${GY - 12}">${m}</text>`).join('')}</g>
      <g id="cells"></g>
    </svg>
    <div class="abs" id="tally" style="left:${GX}px; top:${GY + ROWS * PITCH + 22}px; display:flex; align-items:baseline; gap:12px">
      <span class="num green" id="count" style="font-size:56px; font-weight:700; line-height:1"></span>
      <span style="font-size:22px; font-weight:700">天做到了</span>
      <span class="mono" id="miss" style="margin-left:8px"></span>
    </div>
    <div class="abs mono" id="legend" style="right:${1280 - GX - COLS * PITCH + GAP}px; top:${GY + ROWS * PITCH + 40}px; display:flex; align-items:center; gap:6px">
      没做 ${[0, 0.35, 0.6, 0.85, 1].map(l => `<i style="display:inline-block; width:12px; height:12px; border-radius:3px; ${l ? `background:var(--green); opacity:${l}` : 'border:1px solid var(--rule)'}"></i>`).join('')} 做得多
    </div>`)
  const $ = sel => s.querySelector(sel)

  kit.lift($('#kick'), kit.rise(t, -0.15, 0.5), 10)
  kit.lift($('#h'), kit.rise(t, 0, 0.7), 20)
  kit.lift($('#sub'), kit.rise(t, 0.35, 0.7), 14)
  $('#months').style.opacity = kit.rise(t, 0.4, 0.6)
  kit.lift($('#tally'), kit.rise(t, 0.6, 0.6), 10)
  $('#legend').style.opacity = kit.rise(t, 0.8, 0.6)

  // The year fills in, week column by week column
  const now = 365 * kit.ease.inOut((t - 0.6) / 2.9)
  let cells = '', done = 0
  for (let i = 0; i < 365; i++) {
    const x = GX + Math.floor(i / 7) * PITCH, y = GY + (i % 7) * PITCH
    const d = DAYS[i]
    const age = kit.clamp((now - i) / 10) // 0 just reached → 1 settled
    if (i < now && d.done) done++
    if (i >= now || !d.done) {
      cells += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${CELL - 1}" height="${CELL - 1}" rx="3" fill="none" stroke="rgba(23,21,15,${i < now ? 0.22 : 0.1})" />`
    } else {
      const k = 0.6 + 0.4 * kit.ease.out(age), o = (CELL * (1 - k)) / 2
      cells += `<rect x="${x + o}" y="${y + o}" width="${CELL * k}" height="${CELL * k}" rx="3" fill="var(--green)" opacity="${d.level}" />`
    }
  }
  $('#cells').innerHTML = cells
  $('#count').textContent = done
  $('#miss').textContent = `/ 已过 ${Math.min(365, Math.ceil(now))} 天`
}
