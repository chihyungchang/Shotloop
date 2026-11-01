import { lookById, lookSwatch } from '../looks'

// A look as a small disc: its background with its accent
export function LookSwatch({ id, size = 13 }: { id: string; size?: number }) {
  const l = lookById(id)
  if (!l) return null
  return <span className="look-swatch" style={{ width: size, height: size, background: `linear-gradient(135deg, ${lookSwatch(id)} 55%, ${l.accent} 55%)` }} aria-hidden />
}
