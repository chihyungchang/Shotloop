// The visual styles' reference stills (styles/<id>/*.jpg, from the
// bundled examples), which the AI looks at before it chooses a style and
// while it builds. The styles themselves are data.mjs STYLES.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { styleById } from '../data.mjs'

export { STYLES, styleById } from '../data.mjs'

const DIR = fileURLToPath(new URL('styles', import.meta.url))

// The reference stills of a style, as files
export function styleStills(id) {
  const dir = path.join(DIR, id)
  if (!styleById(id) || !fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => /\.(jpe?g|png)$/i.test(f)).sort().map(f => path.join(dir, f))
}
