// 07-end: the end card. One line ties the two skies together over a
// round window (a bookend to shot 1) that sweeps from noon blue to
// sunset orange; the law and the sources underneath.
// Shot-local time: t = 0 is this shot's first frame.

const CX = 360, CY = 718, R = 168

export default function render(t, { window, duration }) {
  const { kit } = window
  const { C, mix } = kit
  kit.sky('#e3effc', '#fbf6f1', '#ffe6d2')
  kit.chapters(6, 7, t / duration)
  kit.head(t, {
    kicker: 'Shotloop 示例',
    lines: ['蓝天和红色的晚霞，', '是<b>同一个</b>原因。'],
    sub: '空气分子更容易散射短波长的光：<br />这就是瑞利散射。'
  })

  const open = kit.pop(t, 0.3, 0.8)
  const r = R * (0.6 + 0.4 * open)
  const day = kit.glide(t, 0.9, 1.6) // noon → sunset across the window
  const sunY = kit.lerp(CY - 70, CY + 6, day)
  const law = kit.rise(t, 1.1, 0.5)
  const src = kit.rise(t, 1.4, 0.5)

  kit.art(`
    <defs>
      <clipPath id="win7"><circle cx="${CX}" cy="${CY}" r="${r}" /></clipPath>
      <linearGradient id="sky7" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${mix('#1f6fdc', '#f2733a', day)}" /><stop offset="1" stop-color="${mix('#a9d2fb', '#ffd08f', day)}" />
      </linearGradient>
    </defs>
    <circle cx="${CX}" cy="${CY}" r="${r}" fill="#fff" filter="url(#shadow)" opacity="${open}" />
    <g clip-path="url(#win7)" opacity="${kit.clamp(open * 1.4)}">
      <rect x="${CX - R}" y="${CY - R}" width="${2 * R}" height="${2 * R}" fill="url(#sky7)" />
      ${kit.sun(CX + 40, sunY, 30, 1, mix('#ffd36b', '#ff9a4a', day))}
      <rect x="${CX - R}" y="${CY + 30}" width="${2 * R}" height="${R}" fill="${mix('#1d4f91', '#3a2a5a', day)}" />
      <rect x="${CX - R}" y="${CY + 30}" width="${2 * R}" height="2" fill="#fff" opacity="0.3" />
    </g>
    <circle cx="${CX}" cy="${CY}" r="${R + 34}" fill="none" stroke="${mix('#2a74e8', '#ea6a2a', day)}" stroke-opacity="${0.4 * open}" stroke-width="2"
      stroke-dasharray="2 10" stroke-linecap="round" transform="rotate(${t * 9} ${CX} ${CY})" />
    ${kit.label(CX, 982, 'I ∝ 1/λ⁴', { anchor: 'middle', chip: true, size: 20, weight: 700, a: law, color: C.ink })}
    ${kit.label(CX, 1018, '资料：Wikipedia · NASA Space Place', { anchor: 'middle', size: 12, a: src, color: C.faint, weight: 500 })}
  `)
}
