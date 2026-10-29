import { useId } from 'react'

// The Shotloop mark (design/logo/mark.svg): a forward play and a back
// play woven like two links, in the accent and graphite (--logo-*).
// Ids are made unique so several marks can share a page.
const A = 'M48 48Q48 36 58.65 41.53L141.35 84.47Q152 90 141.35 95.53L58.65 138.47Q48 144 48 132Z'
const B = 'M152 68Q152 56 141.35 61.53L58.65 104.47Q48 110 58.65 115.53L141.35 158.47Q152 164 152 152Z'

export function BrandMark({ size = 22 }: { size?: number }) {
  const id = 'mk' + useId().replace(/[^\w-]/g, '')
  const ref = (name: string) => `url(#${id}-${name})`
  return (
    <svg width={size} height={size} viewBox="30 30 140 140" aria-hidden>
      <defs>
        <clipPath id={`${id}-left`}><rect width="100" height="200" /></clipPath>
        <clipPath id={`${id}-right`}><rect x="100" width="100" height="200" /></clipPath>
        {/* Over on the right, the back play cuts the forward one; over on the left, the other way round */}
        <mask id={`${id}-cutA`} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <rect width="200" height="200" fill="#fff" />
          <path clipPath={ref('right')} d={B} stroke="#000" strokeWidth="7" strokeLinejoin="round" />
        </mask>
        <mask id={`${id}-cutB`} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <rect width="200" height="200" fill="#fff" />
          <path clipPath={ref('left')} d={A} stroke="#000" strokeWidth="7" strokeLinejoin="round" />
        </mask>
      </defs>
      <path mask={ref('cutA')} fill="var(--logo-play)" d={A} />
      <path mask={ref('cutB')} fill="var(--logo-loop)" d={B} />
    </svg>
  )
}
