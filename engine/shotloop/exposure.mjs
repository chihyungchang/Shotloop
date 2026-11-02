// The exposure check on a 3D shot's stills, a camera's zebra: areas blown to
// white are found and striped, so whoever reviews the stills sees them
// before the shot is rendered whole. Whether an area may clip is judged by
// eye (a lamp, the sun or a glint may; a lit surface, skin, paper or the
// subject may not), so the check reports and marks, and decides nothing.
//
// A still is looked at in 16 px blocks (averaged), so thin bright strokes
// such as a white headline average away and only areas of some size count.

import fs from 'node:fs'
import { emit, ffmpeg } from './compose.mjs'

const BLOCK = 16
// A block is blown when even its darkest channel is this bright (0–255)
const CLIP = 235
// The smallest area reported, in blocks (about 100 px across in a 1080 px frame)
const MIN_BLOCKS = 6

// A still as a grid of blocks: [r, g, b] each, from ffmpeg's PPM
async function blocks(still) {
  const ppm = `${still}.${process.pid}.ppm`
  try {
    await ffmpeg(['-i', still, '-vf', `scale=trunc(iw/${BLOCK}):trunc(ih/${BLOCK}):flags=area`, '-f', 'image2', '-c:v', 'ppm', ppm])
    const buf = fs.readFileSync(ppm)
    // P6 <w> <h> <max> then the pixels
    const [, w, h] = buf.toString('latin1', 0, 32).split(/\s+/).map(Number)
    const start = buf.length - w * h * 3
    return { w, h, px: i => [buf[start + 3 * i], buf[start + 3 * i + 1], buf[start + 3 * i + 2]] }
  } finally {
    fs.rmSync(ppm, { force: true })
  }
}

// The blown-out areas of a still: each as a box in the still's pixels and
// its share of the frame, largest first
export async function blownAreas(still) {
  const { w, h, px } = await blocks(still)
  const blown = Array.from({ length: w * h }, (_, i) => Math.min(...px(i)) >= CLIP)
  const seen = new Uint8Array(w * h)
  const areas = []
  for (let i = 0; i < w * h; i++) {
    if (!blown[i] || seen[i]) continue
    // The connected area this block starts (4 neighbours)
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0
    const stack = [i]
    seen[i] = 1
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = Math.floor(j / w)
      n++
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      for (const k of [x > 0 && j - 1, x < w - 1 && j + 1, y > 0 && j - w, y < h - 1 && j + w]) {
        if (k !== false && blown[k] && !seen[k]) { seen[k] = 1; stack.push(k) }
      }
    }
    if (n >= MIN_BLOCKS) areas.push({ x: x0 * BLOCK, y: y0 * BLOCK, w: (x1 - x0 + 1) * BLOCK, h: (y1 - y0 + 1) * BLOCK, share: n / (w * h) })
  }
  return areas.sort((a, b) => b.share - a.share)
}

// The still with its blown areas striped red (zebra) and boxed, for the
// reviewer to look at beside the still itself; written under a name of its
// own first, since the stills sit in the shared render cache
export async function zebra(still, areas, out) {
  const inside = areas.map(a => `between(X,${a.x},${a.x + a.w})*between(Y,${a.y},${a.y + a.h})`).join('+')
  const hit = `gte(min(min(r(X,Y),g(X,Y)),b(X,Y)),${CLIP})*(${inside})*lt(mod(X+Y,24),12)`
  const boxes = areas.map(a => `drawbox=x=${a.x}:y=${a.y}:w=${a.w}:h=${a.h}:color=red@0.9:t=4`).join(',')
  const part = out.replace(/\.jpg$/, `.${process.pid}.part.jpg`)
  try {
    await ffmpeg(['-i', still, '-vf', `format=gbrp,geq=r='if(${hit},255,r(X,Y))':g='if(${hit},40,g(X,Y))':b='if(${hit},40,b(X,Y))',format=yuvj444p,${boxes}`, '-q:v', '3', part])
    fs.renameSync(part, out)
  } finally {
    fs.rmSync(part, { force: true })
  }
}

// The exposure of a shot's stills: per still, its blown areas and, when
// there are any, the zebra copy beside it (<still>.zebra.jpg, made once:
// the stills of a cache entry never change). A check that can't run is
// said and left out (null), never the render's failure
export async function exposure(stills) {
  try {
    return await Promise.all(stills.map(async still => {
      const areas = await blownAreas(still)
      const marked = still.replace(/(\.\w+)$/, '.zebra.jpg')
      if (areas.length && !fs.existsSync(marked)) await zebra(still, areas, marked)
      return { still, areas, zebra: areas.length ? marked : null }
    }))
  } catch (err) {
    emit({ type: 'log', message: `exposure check skipped: ${err.message}` })
    return null
  }
}
