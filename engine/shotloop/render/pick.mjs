// The element picker's map: what the person can point at on each of a
// 2D shot's three review stills, for the agent to change. The shot is
// drawn at each still's moment in its own page (no frame captured) and
// the frame is hit-tested on a grid, so the app answers every click and
// hover from the map at once instead of drawing the shot again. A cell
// holds:
//
//   - a DOM or SVG element: the nearest one with a name (data-name,
//     data-keep or id) around what was hit, else what was hit, with its
//     text and its place in the page,
//   - the shot's three.js scene (a WebGL canvas): the scene as a whole,
//   - a 2D canvas: the smallest region named there this frame, with
//     window.picker?.part(x, y, w, h, 'name') (a canvas part, defined only
//     while the map is made, so it costs a render nothing) or with
//     subtitles.keep (a subject); else the drawing (box null: the app
//     outlines the point clicked, in page CSS px, the space canvas code
//     draws in),
//   - nothing (-1): only the background.
//
// Frame-sized containers (the page, the SVG stage) are seen through, so a
// point on the empty stage reaches the scene behind it, or nothing.

import { cssSize } from '../data.mjs'
import { openShot } from './render2d.mjs'
import { stillFrames } from './render.mjs'

const MIN_OPACITY = 0.05
// A box covering this much of the frame is a container, not a thing
const BIG = 0.9
// The grid's cell, page CSS px: fine enough for a line of small text
const CELL = 8

// Runs in the shot's page: the frame's grid of what is where
const MAP = `(() => {
  const W = innerWidth, H = innerHeight
  const big = r => r.width * r.height >= ${BIG} * W * H
  // Visibility and descriptions are asked of the same elements again and
  // again across the grid: worked out once per element
  const once = f => { const memo = new Map(); return el => (memo.has(el) ? memo.get(el) : (memo.set(el, f(el)), memo.get(el))) }
  const seen = once(el => {
    let a = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 0
      a *= parseFloat(cs.opacity)
    }
    return a
  })
  // Text written straight into a container counts as the container's own
  const ownTextAt = (el, x, y) => [...el.childNodes].some(n => {
    if (n.nodeType !== 3 || !n.textContent.trim()) return false
    const range = document.createRange()
    range.selectNodeContents(n)
    return [...range.getClientRects()].some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
  })
  // A canvas with a WebGL context has no 2D one (asking a canvas of this
  // throwaway page for one is harmless)
  const webgl = once(el => el.getContext('2d') === null)
  const nameOf = el => el.getAttribute('data-name') || el.getAttribute('data-keep') || el.id || null
  const box = r => ({ x: r.left / W, y: r.top / H, w: r.width / W, h: r.height / H })
  const where = el => {
    const parts = []
    for (let e = el; e && e !== document.body && e.nodeType === 1; e = e.parentElement) {
      const tag = e.tagName.toLowerCase()
      if (e.id) { parts.unshift(tag + '#' + e.id); break }
      const same = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : []
      parts.unshift(same.length > 1 ? tag + ':nth-of-type(' + (same.indexOf(e) + 1) + ')' : tag)
    }
    return parts.join(' > ')
  }
  // The named thing an element is part of, unless that is the whole frame
  const described = once(el => {
    let target = el
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (nameOf(e)) { if (!big(e.getBoundingClientRect())) target = e; break }
    }
    // Text nodes joined by spaces: SVG text elements carry none between them
    const walk = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
    const words = []
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent.trim()) words.push(n.textContent.trim())
    const text = words.join(' ').replace(/\\s+/g, ' ')
    return { kind: 'dom', name: nameOf(target), tag: target.tagName.toLowerCase(), text: text ? text.slice(0, 80) : null,
      path: where(target), box: box(target.getBoundingClientRect()) }
  })
  const kept = [...window.picker.parts, ...(window.subtitles?.kept ?? [])]

  const hit = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === document.documentElement || el === document.body || el.id?.startsWith('__sl_')) continue
      if (seen(el) < ${MIN_OPACITY}) continue
      if (el instanceof HTMLCanvasElement) {
        if (webgl(el)) return { kind: 'three', name: nameOf(el), tag: 'canvas', text: null, path: where(el), box: box(el.getBoundingClientRect()) }
        // The smallest region named around the point, else the drawing
        const k = kept.filter(k => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h).sort((a, b) => a.w * a.h - b.w * b.h)[0]
        return { kind: 'canvas', name: k?.name || null, tag: 'canvas', text: null, path: where(el),
          box: k ? box({ left: k.x, top: k.y, width: k.w, height: k.h }) : null }
      }
      if (big(el.getBoundingClientRect()) && !ownTextAt(el, x, y)) continue
      return described(el)
    }
    return null
  }

  const cols = Math.ceil(W / ${CELL}), rows = Math.ceil(H / ${CELL})
  const targets = [], index = new Map(), cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const found = hit((c + 0.5) * ${CELL}, (r + 0.5) * ${CELL})
      if (!found) { cells.push(-1); continue }
      const key = JSON.stringify(found)
      if (!index.has(key)) { index.set(key, targets.length); targets.push(found) }
      cells.push(index.get(key))
    }
  }
  return { cols, rows, targets, cells }
})()`

// The map of each review still (0 start, 1 middle, 2 end), with its time
// in the shot, and the page's CSS size the points are in
export async function pickMap(project, shot) {
  // The page is laid out the same in every mode: the draft's is lighter
  const s = await openShot(project, shot, 'draft')
  try {
    // Canvas parts are named per frame: emptied before each draw
    await s.page.evaluate(`window.picker = { parts: [], part(x, y, w, h, name = '') { this.parts.push({ x, y, w, h, name: String(name) }) } }`)
    const stills = []
    for (const frame of stillFrames(project, shot)) {
      const t = (frame - 1) / project.fps
      await s.page.evaluate('window.picker.parts = []')
      await s.draw(t)
      stills.push({ t: Math.round(t * 100) / 100, ...(await s.page.evaluate(MAP)) })
    }
    return { size: cssSize(project.size), stills }
  } finally {
    await s.close()
  }
}
