// 02-white-light: sunlight is every colour at once. A white beam (seven
// colours bundled tight) enters a glass prism and fans out into the
// spectrum, red (700 nm) bending least, violet (400 nm) most.
// Shot-local time: t = 0 is this shot's first frame.

const SUN = [84, 738]
const APEX = [330, 556], BL = [186, 806], BR = [474, 806]
const IN = [260, 680], OUT = [409, 697] // where the beam meets each face
const END_X = 540

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C, SPECTRUM, lerp } = kit
  kit.sky('#e6f1fd', '#f5f9ff', '#fdfbf7')
  kit.chapters(1, 7, t / duration)
  kit.head(t, {
    kicker: '01 · 阳光',
    lines: ['阳光其实是', '<b>所有颜色</b>的混合'],
    sub: '让它穿过棱镜，就分成一道彩虹。'
  })

  const prism = kit.pop(t, 0.2, 0.8)
  const beam = kit.glide(t, 0.6, 0.9)
  const inside = kit.rise(t, 1.4, 0.35)
  const fan = kit.glide(t, 1.6, 1.3)
  const tags = kit.rise(t, 2.7, 0.5)

  // Incoming beam: a white core with the seven colours packed into it
  const bx = lerp(SUN[0], IN[0], beam), by = lerp(SUN[1], IN[1], beam)
  const bundle = SPECTRUM.map(([c], i) => {
    const o = (i - 3) * 1.7
    return `<line x1="${SUN[0]}" y1="${SUN[1] + o}" x2="${bx}" y2="${by + o}" stroke="${c}" stroke-width="1.6" opacity="0.9" />`
  }).join('')

  // Outgoing fan: one wedge per colour, red on top
  const ex = lerp(OUT[0], END_X, fan)
  const top = 700, step = 30
  const wedges = SPECTRUM.map(([c], i) => {
    const y0 = lerp(OUT[1] + i * 1.2, top + i * step + i * i * 0.9, fan)
    const y1 = lerp(OUT[1] + (i + 1) * 1.2, top + (i + 1) * step + i * i * 0.9, fan)
    return `<path d="M${OUT[0]},${OUT[1] + i * 1.2} L${ex},${y0} L${ex},${y1} L${OUT[0]},${OUT[1] + (i + 1) * 1.2} Z" fill="${c}" opacity="0.92" />`
  }).join('')
  const endY = i => top + i * step + i * i * 0.9 + step / 2

  // A sweep of light across the glass
  const sweep = ((t * 0.5) % 1) * 1.6 - 0.3
  const s = (k, a, b) => lerp(a, b, k)

  kit.art(`
    ${kit.sun(SUN[0], SUN[1], 30, kit.rise(t, 0, 0.6))}
    <g opacity="${beam > 0 ? 1 : 0}">
      <line x1="${SUN[0]}" y1="${SUN[1]}" x2="${bx}" y2="${by}" stroke="${C.ink}" stroke-opacity="0.08" stroke-width="20" stroke-linecap="round" />
      <line x1="${SUN[0]}" y1="${SUN[1]}" x2="${bx}" y2="${by}" stroke="#fff" stroke-width="16" stroke-linecap="round" /></g>
    ${beam > 0 ? bundle : ''}
    <g opacity="${fan > 0 ? 1 : 0}">${wedges}</g>
    <g transform="translate(${APEX[0]} 720) scale(${prism}) translate(${-APEX[0]} -720)">
      <path d="M${APEX} L${BR} L${BL} Z" fill="#ffffff" fill-opacity="0.55" stroke="${C.ink}" stroke-opacity="0.22" stroke-width="2" stroke-linejoin="round" filter="url(#shadow)" />
      <path d="M${IN} L${OUT}" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity="${inside * 0.95}" />
      <path d="M${IN} L${OUT}" stroke="url(#rainbow)" stroke-width="6" stroke-linecap="round" opacity="${inside * 0.5}" />
      <line x1="${s(sweep, BL[0], APEX[0])}" y1="${s(sweep, BL[1], APEX[1])}" x2="${s(sweep, BR[0], APEX[0]) + 0}" y2="${s(sweep, BR[1], BR[1])}"
        stroke="#fff" stroke-width="10" opacity="${sweep > 0 && sweep < 1 ? 0.35 : 0}" clip-path="url(#glass)" />
    </g>
    <defs>
      <clipPath id="glass"><path d="M${APEX} L${BR} L${BL} Z" /></clipPath>
      <linearGradient id="rainbow" x1="0" x2="1">${SPECTRUM.map(([c], i) => `<stop offset="${i / 6}" stop-color="${c}" />`).join('')}</linearGradient>
    </defs>
    ${kit.label(104, 668, '白光', { chip: true, a: kit.rise(t, 1.0, 0.5), color: C.ink, size: 17 })}
    ${kit.label(552, endY(0) + 6, '700 nm', { color: SPECTRUM[0][0], a: tags })}
    ${kit.label(552, endY(6) + 6, '400 nm', { color: SPECTRUM[6][0], a: tags })}
    ${kit.label(APEX[0], 870, '一束白光 = 七种颜色', { color: C.muted, a: tags, size: 16, anchor: 'middle' })}
  `)
}
