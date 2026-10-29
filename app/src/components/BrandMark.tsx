// The Shotloop mark (design/logo/mark.svg): an S built from six shots
// and turns, mint to sky to violet. Fixed colours, the same in both themes.
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="34 34 132 132" aria-hidden>
      <rect x="100" y="40" width="40" height="40" rx="6" fill="#a7f3d0" transform="translate(120 60) scale(.875) translate(-120 -60)" />
      <path d="M100 80 L60 80 A40 40 0 0 1 100 40 Z" fill="#5eead4" transform="translate(80 60) scale(.875) translate(-80 -60)" />
      <path d="M100 80 L60 80 A40 40 0 0 0 100 120 Z" fill="#38bdf8" transform="translate(80 100) scale(.875) translate(-80 -100)" />
      <path d="M100 120 L140 120 A40 40 0 0 0 100 80 Z" fill="#60a5fa" transform="translate(120 100) scale(.875) translate(-120 -100)" />
      <path d="M100 120 L140 120 A40 40 0 0 1 100 160 Z" fill="#818cf8" transform="translate(120 140) scale(.875) translate(-120 -140)" />
      <rect x="60" y="120" width="40" height="40" rx="6" fill="#a78bfa" transform="translate(80 140) scale(.875) translate(-80 -140)" />
    </svg>
  )
}
