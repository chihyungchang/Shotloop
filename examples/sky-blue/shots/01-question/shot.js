// 01-question: the hook. The question as a big headline over a round
// window of sky: sun rising, clouds drifting, air molecules twinkling.
// Shot-local time: t = 0 is this shot's first frame.

const CX = 360, CY = 770, R = 222

// Deterministic "air molecules" inside the window
const DOTS = Array.from({ length: 34 }, (_, i) => {
  const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 34) * (R - 20)
  return [CX + Math.cos(a) * r, CY - 30 + Math.sin(a) * r * 0.8, i]
})

const cloud = (x, y, s, a) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${a}" fill="#fff">
  <ellipse cx="0" cy="0" rx="58" ry="20" /><circle cx="-18" cy="-14" r="22" /><circle cx="14" cy="-20" r="28" /><circle cx="40" cy="-6" r="18" /></g>`

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C } = kit
  kit.sky('#e3effc', '#f4f8fe', '#fbfdff')
  kit.chapters(0, 7, t / duration)
  kit.head(t, {
    kicker: 'Rayleigh · 一个日常问题',
    lines: ['为什么天空', '是<b>蓝色</b>的？'],
    sub: '答案藏在阳光和空气里。',
    size: 92
  })

  const open = kit.pop(t, 0.25, 0.9)
  const r = R * (0.6 + 0.4 * open)
  const sunY = kit.lerp(800, 676, kit.glide(t, 0.3, 1.4))
  const drift = t * 10
  const ring = kit.rise(t, 0.7, 0.8)
  const chip = kit.rise(t, 1.1, 0.5)

  const dots = DOTS.map(([x, y, i]) => {
    const tw = 0.35 + 0.35 * Math.sin(t * 3 + i * 1.7)
    return `<circle cx="${x}" cy="${y}" r="${2.2 + (i % 3) * 0.6}" fill="#fff" opacity="${tw * kit.rise(t, 0.9 + (i % 7) * 0.06, 0.4)}" />`
  }).join('')

  kit.art(`
    <defs>
      <clipPath id="win"><circle cx="${CX}" cy="${CY}" r="${r}" /></clipPath>
      <linearGradient id="win-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1f6fdc" /><stop offset="0.55" stop-color="#5aa6f2" /><stop offset="1" stop-color="#cfe6ff" />
      </linearGradient>
    </defs>
    <circle cx="${CX}" cy="${CY}" r="${r}" fill="#fff" filter="url(#shadow)" opacity="${open}" />
    <g clip-path="url(#win)" opacity="${kit.clamp(open * 1.4)}">
      <rect x="${CX - R}" y="${CY - R}" width="${2 * R}" height="${2 * R}" fill="url(#win-sky)" />
      ${window.kit.sun(448, sunY, 36)}
      ${dots}
      ${cloud(250 + drift, 700, 1, 0.95)}
      ${cloud(470 - drift * 0.6, 790, 0.7, 0.85)}
      <path d="M${CX - R},${CY + 120} C${CX - 120},${CY + 60} ${CX - 40},${CY + 90} ${CX + 40},${CY + 110} S${CX + 180},${CY + 70} ${CX + R},${CY + 100} V${CY + R} H${CX - R} Z" fill="#3a7fd0" />
      <path d="M${CX - R},${CY + 170} C${CX - 80},${CY + 120} ${CX + 60},${CY + 150} ${CX + R},${CY + 130} V${CY + R} H${CX - R} Z" fill="#1d4f91" />
    </g>
    <circle cx="${CX}" cy="${CY}" r="${R + 22}" fill="none" stroke="${C.ink}" stroke-opacity="${0.12 * ring}" stroke-width="1.5" />
    <circle cx="${CX}" cy="${CY}" r="${R + 44}" fill="none" stroke="${C.blue}" stroke-opacity="${0.35 * ring}" stroke-width="2"
      stroke-dasharray="2 10" stroke-linecap="round" transform="rotate(${t * 9} ${CX} ${CY})" />
    ${kit.label(CX - R - 4, CY - R + 34, 'λ ≈ 450 nm', { color: C.blue, chip: true, a: chip })}
    ${kit.label(CX + R + 6, CY + R - 30, '空气 · N₂ O₂', { color: C.ink, chip: true, a: kit.rise(t, 1.3, 0.5), anchor: 'end' })}
  `)
}
