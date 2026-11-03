// A product promo's pictures: the person's own (images/, uploaded or
// pasted on Home), the repository's (repo/, repo.mjs) and the product
// page's (site/, site.mjs), each with its size in pixels, for the plan and the shots that show them
// (world/screens.js draws them at their own proportions).

import fs from 'node:fs'
import path from 'node:path'

export const IMAGES_DIR = 'images'
export const SITE_DIR = 'site'
// The repository's screenshots (repo.mjs, which imports this module)
const REPO_PICTURES = 'repo/pictures'
const PICTURE = /\.(png|jpe?g)$/i

// Width and height from a PNG's or JPEG's header; null for anything else
export function imageSize(file) {
  const b = fs.readFileSync(file)
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  if (b[0] === 0xff && b[1] === 0xd8) {
    // The first start-of-frame marker holds the size
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) }
      i += 2 + b.readUInt16BE(i + 2)
    }
  }
  return null
}

// The pictures in a folder of the project, by their place in it
function picturesIn(root, dir) {
  const abs = path.join(root, dir)
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs).filter(f => PICTURE.test(f)).sort().flatMap(f => {
    const size = imageSize(path.join(abs, f))
    return size ? [{ file: `${dir}/${f}`, ...size }] : []
  })
}

// The page's live parts (site/live/*.json, live.mjs): their size in CSS px
function liveIn(root) {
  const abs = path.join(root, SITE_DIR, 'live')
  if (!fs.existsSync(abs)) return []
  return fs.readdirSync(abs).filter(f => f.endsWith('.json')).sort().flatMap(f => {
    try {
      const { width, height, fields = [] } = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'))
      return [{ file: `${SITE_DIR}/live/${f}`, width, height, fields: fields.map(x => x.name).filter(x => x.startsWith('field-')) }]
    } catch {
      // Half-written by a reading cut short: not offered
      return []
    }
  })
}

// Everything a promo can show: the person's images, then the page's logo
// and its sections framed as windows, its parts on their own, and those
// parts live
export const promoImages = root => [
  ...picturesIn(root, IMAGES_DIR).map(i => ({ ...i, from: 'person' })),
  ...picturesIn(root, REPO_PICTURES).map(i => ({ ...i, from: 'repo' })),
  ...picturesIn(root, SITE_DIR).map(i => ({ ...i, from: 'site' })),
  ...picturesIn(root, `${SITE_DIR}/framed`).map(i => ({ ...i, from: 'site' })),
  ...picturesIn(root, `${SITE_DIR}/parts`).map(i => ({ ...i, from: 'site' })),
  ...liveIn(root).map(i => ({ ...i, from: 'site', live: true }))
]
