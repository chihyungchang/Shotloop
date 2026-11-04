// The layout check: what the review stills can't be trusted to show,
// measured in the shot's own page instead of judged by eye. The shot is
// drawn every 0.1 s (no frames captured, so it takes seconds) and its
// boxes are read from the page:
//
//   - text over text (caption-zone), text cut by the frame or by a box
//     that clips it (clean);
//   - the desktop under half the frame's height and
//     an empty band over a quarter of it (promo-fill), something laid on
//     the desktop from outside its picture, which shakes as the camera
//     moves (promo-on-screen), words over the screen (promo-clear-words),
//     a frame that stands still for a second (promo-motion), and, against
//     the film's other shots, a headline of another size or a desktop in
//     another place (promo-fill, promo-desktop).
//
// Product promos only for now: their pieces come from one kit and are
// found by its marks (screens.js data-kit). An explainer's kits layer
// whole screens over each other (a phone's next message over the last),
// which the page's boxes alone can't tell from a fault. What it can't
// see: shapes drawn on a canvas. A fault has to last (a wipe or an
// entrance crossing the frame is not one).
//
// Each shot's facts (its headline's size, its desktop's box) are kept in
// .shotloop/shots/<id>/layout.json for the other shots to be held to.
//
// A rendered clip, of any film, is measured too, by ffmpeg's own
// detectors (measureClip): black frames (clean), a picture that stands
// still for a second (alive, or promo-motion), and in a promo a picture
// left soft once a move has ended (promo-crisp).

import path from 'node:path'
import { readJson, writeJson } from '../project/files.mjs'
import { list as listRules } from '../rules.mjs'
import { ffmpeg } from './compose.mjs'
import { openShot } from './render2d.mjs'

const STEP = 0.1
// How long a fault must last to count, by kind (s)
const LASTS = { card: 0.5, overlap: 0.5, cut: 1.0, band: 0.5, small: 0.5, outside: 0.3, words: 0.5, still: 1.0 }

// Runs in the shot's page: this moment's boxes and what is wrong with them
const LOOK = `((promo, beat) => {
  const W = innerWidth, H = innerHeight
  const seen = el => {
    let a = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0
      a *= parseFloat(cs.opacity)
    }
    return a
  }
  const meet = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) })
  const area = r => Math.max(0, r.r - r.l) * Math.max(0, r.b - r.t)
  const box = r => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })
  // An SVG clip path's or mask's region on screen: its shapes' boxes in
  // the user space of the element it cuts; null when it can't be read
  // (shapes sized by the element's own box)
  const clipRegion = (e, ref) => {
    const cp = document.getElementById(ref)
    if (!cp || cp.getAttribute('clipPathUnits') === 'objectBoundingBox' || cp.getAttribute('maskContentUnits') === 'objectBoundingBox' || !e.getScreenCTM) return null
    const m = e.getScreenCTM()
    let r = null
    for (const shape of cp.querySelectorAll('*')) {
      if (!shape.getBBox) continue
      const b = shape.getBBox()
      const own = shape.transform?.baseVal.consolidate()?.matrix
      const at = (x, y) => {
        let p = new DOMPoint(x, y)
        if (own) p = p.matrixTransform(own)
        return p.matrixTransform(m)
      }
      const pts = [at(b.x, b.y), at(b.x + b.width, b.y), at(b.x, b.y + b.height), at(b.x + b.width, b.y + b.height)]
      const s = { l: Math.min(...pts.map(p => p.x)), t: Math.min(...pts.map(p => p.y)), r: Math.max(...pts.map(p => p.x)), b: Math.max(...pts.map(p => p.y)) }
      r = r ? { l: Math.min(r.l, s.l), t: Math.min(r.t, s.t), r: Math.max(r.r, s.r), b: Math.max(r.b, s.b) } : s
    }
    return r
  }
  // What an element can show of itself: the frame, cut by itself and every
  // ancestor that clips (overflow, clip paths, SVG masks); null when a cut
  // can't be read
  const room = el => {
    let r = { l: 0, t: 0, r: W, b: H }
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      const ref = [e.getAttribute('clip-path'), cs.clipPath, e.getAttribute('mask'), cs.maskImage].map(v => v?.match(/url\\(["']?#([^"')]+)/)?.[1]).find(Boolean)
      if (ref) {
        const c = clipRegion(e, ref)
        if (!c) return null
        r = meet(r, c)
      } else if (e !== el && (cs.overflow !== 'visible' || cs.clipPath !== 'none')) r = meet(r, box(e.getBoundingClientRect()))
    }
    return r
  }
  // A box that is drawn: a border, an outline or a fill of its own
  const drawn = el => {
    const cs = getComputedStyle(el)
    return parseFloat(cs.borderTopWidth) > 0 || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor)
  }
  const name = s => '"' + s.trim().replace(/\\s+/g, ' ').slice(0, 32) + '"'
  const out = []

  // Words: each text node's box, what of it shows, and how big it is set
  const words = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement
    if (!n.textContent.trim() || !el || /^(SCRIPT|STYLE|TITLE)$/.test(el.tagName) || seen(el) < 0.05) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    const r = box(range.getBoundingClientRect())
    const space = room(el)
    if (area(r) < 4 || !space) continue
    const shows = meet(r, space)
    // Cut: part of its ink shows, part is lost (the box less the leading
    // above and below, which a line's mask may trim without touching a
    // letter). A sliver showing is a clip hiding it on purpose (an
    // odometer's next digit, a line yet to rise)
    const lead = (r.b - r.t) * 0.12
    const ink = { l: r.l, t: r.t + lead, r: r.r, b: r.b - lead }
    const part = area(meet(ink, space)) / area(ink)
    if (part < 0.2) continue
    words.push({ el, text: n.textContent, r: shows, whole: r, cut: part < 0.8 })
  }
  for (const w of words) if (w.cut) out.push({ kind: 'cut', rule: 'clean', what: 'text ' + name(w.text) + ' is cut off by the edge of the frame or of its box' })
  // Whether an element is seen at a point: reached from the top before
  // anything drawn and opaque covers it (a phone's next screen laid over
  // the last)
  const onTop = (el, x, y) => {
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === el || el.contains(e) || e.contains(el)) return true
      if (drawn(e) && seen(e) > 0.9 && !/rgba\\([^)]*, 0\\.\\d+\\)/.test(getComputedStyle(e).backgroundColor)) return false
    }
    return true
  }
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const a = words[i], b = words[j]
      // The same words twice is a glow or a shadow, set on purpose
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el) || a.text.trim() === b.text.trim()) continue
      // A line's box holds its leading too: lines set tight, or a small
      // caption under a big word, touch boxes by a fifth of the bigger
      // one's height without touching ink
      const o = meet(a.r, b.r), w = meet(a.whole, b.whole)
      const cx = (o.l + o.r) / 2, cy = (o.t + o.b) / 2
      if (o.r - o.l > 3 && o.b - o.t > 3 && w.b - w.t > 0.25 * Math.max(a.whole.b - a.whole.t, b.whole.b - b.whole.t) && onTop(a.el, cx, cy) && onTop(b.el, cx, cy)) {
        out.push({ kind: 'overlap', rule: 'caption-zone', what: 'text ' + name(a.text) + ' overlaps text ' + name(b.text) })
      }
    }
  }
  if (!promo) return { faults: out, sign: '' }

  const desk = document.querySelector('[data-kit="desktop"]')
  const deskBox = desk && seen(desk) > 0.5 ? box(desk.getBoundingClientRect()) : null
  const headline = document.querySelector('[data-kit="headline"]')
  const facts = {
    headline: headline ? parseFloat(getComputedStyle(headline).fontSize) : null,
    desktop: deskBox ? [deskBox.l, deskBox.t, deskBox.r - deskBox.l, deskBox.b - deskBox.t].map(v => Math.round(v)) : null
  }
  // The beat the plan made it: its cards from the kit, its drawing big
  // enough for its box
  if (beat && (beat.beat === 'title' || beat.beat === 'end') && document.querySelector('[data-kit="card"]') && document.querySelector('[data-kit="headline"], [data-kit="chapter"]')) {
    out.push({ kind: 'card', rule: 'promo-open-close', what: 'the ' + (beat.beat === 'title' ? 'title' : 'end card') + ' has a headline or a chapter label besides its card: a card stands alone' })
  }
  if (beat && (beat.beat === 'title' || beat.beat === 'end') && !document.querySelector('[data-kit="card"]')) {
    out.push({ kind: 'card', rule: 'promo-open-close', what: 'the ' + (beat.beat === 'title' ? 'title' : 'end card') + ' is not drawn with the kit\\'s ' + (beat.beat === 'title' ? 'titleCard()' : 'endCard()') + ', which sets the logo and name as one mark at a size that fits' })
  }
  if (beat?.picture) {
    const p = beat.picture
    const pbox = { l: p.x, t: p.y, r: p.x + p.w, b: p.y + p.h }
    let ext = null
    for (const el of document.body.querySelectorAll('*')) {
      if (seen(el) < 0.05 || el.closest('[data-kit="headline"]')) continue
      const shape = /^(rect|path|circle|ellipse|polygon|image|use|IMG|CANVAS)$/.test(el.tagName)
      if (!shape && !drawn(el)) continue
      const r = meet(box(el.getBoundingClientRect()), pbox)
      if (area(r) <= 0 || area(r) > area(pbox) * 0.98) continue
      ext = ext ? { l: Math.min(ext.l, r.l), t: Math.min(ext.t, r.t), r: Math.max(ext.r, r.r), b: Math.max(ext.b, r.b) } : r
    }
    const w = ext ? (ext.r - ext.l) / p.w : 0, h = ext ? (ext.b - ext.t) / p.h : 0
    if (w < 0.6 || h < 0.4) out.push({ kind: 'small', rule: 'promo-fill', what: 'the drawing takes ' + Math.round(w * 100) + '% of its box\\'s width and ' + Math.round(h * 100) + '% of its height (at least 60% and 40%)' })
  }
  if (deskBox && deskBox.b - deskBox.t < H * 0.5) out.push({ kind: 'small', rule: 'promo-fill', what: 'the desktop is ' + Math.round((deskBox.b - deskBox.t) / H * 100) + '% of the frame\\'s height, under half' })

  // Laid on the desktop from outside its picture: a box drawn over it
  // (a border, an outline, a fill), or words over the screen
  if (deskBox) {
    const kit = el => el.closest('[data-kit="cursor"]')
    for (const el of document.body.querySelectorAll('*')) {
      if (desk.contains(el) || el.contains(desk) || kit(el) || seen(el) < 0.05) continue
      const r = box(el.getBoundingClientRect())
      if (area(r) < 16 || area(r) > area(deskBox) * 0.6 || area(meet(r, deskBox)) < area(r) * 0.8) continue
      if (drawn(el)) out.push({ kind: 'outside', rule: 'promo-on-screen', what: (el.getAttribute('data-name') || el.tagName.toLowerCase()) + ' is drawn over the desktop from outside its picture (it shakes as the camera moves: draw it with the window\\'s draw, mark())' })
    }
    for (const w of words) {
      if (!desk.contains(w.el) && area(meet(w.r, deskBox)) > area(w.r) * 0.5) out.push({ kind: 'words', rule: 'promo-clear-words', what: 'text ' + name(w.text) + ' lies over the screen' })
    }
  }

  // The frame's mass, top to bottom: pictures, the desktop, drawings and
  // big words; thin strips (a source line, a rule, a label) and grounds
  // (anything near the whole frame) don't fill it
  const spans = []
  const mass = r => r.b - r.t >= H * 0.06 && area(r) < W * H * 0.85 && area(meet(r, { l: 0, t: 0, r: W, b: H })) > 0
  if (deskBox) spans.push([deskBox.t, deskBox.b])
  for (const el of document.body.querySelectorAll('*')) {
    if ((desk && desk.contains(el) && el !== desk) || seen(el) < 0.05) continue
    const shape = /^(rect|path|circle|ellipse|polygon|image|use)$/.test(el.tagName)
    if (!shape && !/^(IMG|svg|CANVAS|VIDEO)$/.test(el.tagName) && !drawn(el) && !getComputedStyle(el).backgroundImage.startsWith('url(')) continue
    const space = room(el)
    const r = space ? meet(box(el.getBoundingClientRect()), space) : box(el.getBoundingClientRect())
    if (mass(r)) spans.push([r.t, r.b])
  }
  for (const w of words) if (mass(w.r) || w.r.b - w.r.t >= H * 0.035) spans.push([w.r.t, w.r.b])
  spans.sort((a, b) => a[0] - b[0])
  let y = spans.length ? Math.max(0, spans[0][1]) : 0, gap = { from: 0, to: 0 }
  for (const [t, b] of spans) {
    if (t - y > gap.to - gap.from) gap = { from: y, to: t }
    y = Math.max(y, b)
  }
  if (H - y > gap.to - gap.from) gap = { from: y, to: H }
  if (spans.length && gap.to - gap.from > H * 0.25) out.push({ kind: 'band', rule: 'promo-fill', what: 'an empty band of ' + Math.round((gap.to - gap.from) / H * 100) + '% of the frame\\'s height (y ' + Math.round(gap.from) + '–' + Math.round(gap.to) + ' px)' })

  // A frame's look in a line, to find one that stands still: places and
  // sizes, and what moves without moving a box (a fade, a colour, a line
  // drawing on, a shape's own attributes)
  const sign = [...document.body.querySelectorAll('*')].filter(el => seen(el) >= 0.05).map(el => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const svg = el instanceof SVGElement ? [...el.attributes].map(a => a.value).join(' ') : ''
    return Math.round(r.left * 2) + ',' + Math.round(r.top * 2) + ',' + Math.round(r.width * 2) + ',' + Math.round(r.height * 2) + ',' + cs.transform + ',' +
      Math.round(cs.opacity * 50) + ',' + cs.color + ',' + cs.backgroundColor + ',' + cs.strokeDashoffset + ',' + svg + (el.firstChild?.nodeType === 3 ? el.textContent.length : '')
  }).join(';')
  return { faults: out, sign, facts }
})`

const layoutFile = (project, shot) => path.join(project.root, '.shotloop', 'shots', shot.id, 'layout.json')

// The shot's layout faults, each { rule, from, to, what } in shot seconds,
// kept with the shot and the render's cache key; null for a shot that
// isn't measured
export async function measureLayout(project, shot, key = null) {
  if (project.track !== '2d' || !project.config.promo) return null
  const promo = true
  // The beat the plan laid out (promo/frames.mjs), when it did
  const beat = readJson(path.join(project.root, 'world', 'frames.json'), null)?.beats?.find(b => b.id === shot.id) ?? null
  const s = await openShot(project, shot, 'final')
  const found = []
  const open = new Map()
  const facts = []
  // The run of samples that look alike: { sign, from, to }
  let still = null
  const stood = () => still && found.push({ kind: 'still', rule: 'promo-motion', what: 'nothing moves', from: still.from, to: still.to })
  try {
    for (let t = 0; t < shot.duration - 1e-6; t = Math.round((t + STEP) * 1000) / 1000) {
      await s.draw(t)
      const now = await s.page.evaluate(`${LOOK}(${promo}, ${JSON.stringify(beat)})`)
      if (now.facts) facts.push(now.facts)
      // Consecutive samples of the same fault become one range
      const end = Math.round((t + STEP) * 1000) / 1000
      const here = new Set()
      for (const f of now.faults) {
        // The same fault though its numbers drift (a band's edge moving
        // with a push-in): one range, told as it was first seen
        const key = f.rule + f.what.replace(/[\d.]+/g, '#')
        here.add(key)
        const r = open.get(key)
        if (r) r.to = end
        else open.set(key, { ...f, from: t, to: end })
      }
      for (const [key, r] of open) if (!here.has(key)) found.push(r), open.delete(key)
      // A frame that looks as the last one did
      if (promo) {
        if (still?.sign === now.sign) still.to = end
        else {
          stood()
          still = { sign: now.sign, from: t, to: end }
        }
      }
    }
  } finally {
    await s.close()
  }
  found.push(...open.values())
  stood()
  const issues = found
    .map(f => ({ rule: f.rule, from: f.from, to: f.to, what: f.what, kind: f.kind }))
    .filter(f => f.to - f.from >= LASTS[f.kind] - 1e-6)
    .map(({ kind, ...f }) => (kind === 'still' ? { ...f, what: `nothing moves for ${(f.to - f.from).toFixed(1)} s` } : f))
  if (promo) issues.push(...againstOthers(project, shot, settled(facts)))
  const kept = ruled(issues).sort((a, b) => a.from - b.from)
  writeJson(layoutFile(project, shot), { key, facts: settled(facts), issues: kept })
  return kept
}

// Only the rules that are on as the house wrote them: one the person
// turned off or reworded is theirs to judge, not measured
function ruled(issues) {
  const { fixed, taste } = listRules()
  const measured = new Set([...fixed, ...taste].filter(r => !r.off && !r.edited).map(r => r.id))
  return issues.filter(i => measured.has(i.rule))
}

// A rendered clip's faults, by ffmpeg's detectors, each { rule, from, to,
// what } in clip seconds
export async function measureClip(project, clip) {
  const promo = !!project.config.promo
  let out = ''
  await ffmpeg(['-i', clip, '-an', '-vf', 'blackdetect=d=0.1:pix_th=0.10,freezedetect=n=-60dB:d=1,blurdetect=block_width=32:block_height=32,metadata=print:file=-', '-f', 'null', '-'], { onStdout: d => (out += d) })
  const issues = []
  const blur = []
  let at = 0, black = null, freeze = null
  for (const line of out.split('\n')) {
    const time = line.match(/pts_time:([\d.]+)/)
    if (time) at = Number(time[1])
    const [key, value] = line.split('=')
    if (key === 'lavfi.blur') blur.push({ at, v: Number(value) })
    else if (key === 'lavfi.black_start') black = Number(value)
    else if (key === 'lavfi.black_end' && black != null) {
      issues.push({ rule: 'clean', from: black, to: Number(value), what: 'black frames' })
      black = null
    } else if (key === 'lavfi.freezedetect.freeze_start') freeze = Number(value)
    else if (key === 'lavfi.freezedetect.freeze_end' && freeze != null) {
      issues.push({ rule: promo ? 'promo-motion' : 'alive', from: freeze, to: Number(value), what: `the picture stands still for ${(Number(value) - freeze).toFixed(1)} s` })
      freeze = null
    }
  }
  // Still frozen or black at the end: up to the last frame
  if (freeze != null) issues.push({ rule: promo ? 'promo-motion' : 'alive', from: freeze, to: at, what: `the picture stands still for ${(at - freeze).toFixed(1)} s` })
  if (black != null) issues.push({ rule: 'clean', from: black, to: at, what: 'black frames' })
  if (promo) issues.push(...softSpans(blur))
  return ruled(issues).sort((a, b) => a.from - b.from)
}

// Soft for half a second or more: frames blurrier than half again the
// clip's usual sharpness (its median), a move's blur passing in a moment
function softSpans(blur) {
  if (blur.length < 10) return []
  const usual = blur.map(b => b.v).sort((a, b) => a - b)[Math.floor(blur.length / 2)]
  const out = []
  let from = null, peak = 0
  for (const [i, b] of blur.entries()) {
    const soft = b.v > usual * 1.5
    if (soft && from == null) from = b.at
    if (soft) peak = Math.max(peak, b.v)
    if ((!soft || i === blur.length - 1) && from != null) {
      if (b.at - from >= 0.5) out.push({ rule: 'promo-crisp', from, to: b.at, what: `the picture is soft (blur up to ${peak.toFixed(1)}, the clip's usual ${usual.toFixed(1)})` })
      from = null
      peak = 0
    }
  }
  return out
}

// Where a shot ends up: its last moment's headline and desktop
function settled(facts) {
  const last = key => facts.findLast(f => f[key] != null)?.[key] ?? null
  return { headline: last('headline'), desktop: last('desktop') }
}

// The film holds its headline size and its desktop's box from beat to beat
function againstOthers(project, shot, mine) {
  const others = project.shots.filter(s => s.id !== shot.id).map(s => readJson(layoutFile(project, s), null)?.facts).filter(Boolean)
  const out = []
  const sizes = others.map(f => f.headline).filter(Boolean)
  if (mine.headline && sizes.length) {
    const usual = sizes.sort((a, b) => a - b)[Math.floor(sizes.length / 2)]
    if (Math.abs(mine.headline - usual) > usual * 0.04) {
      out.push({ rule: 'promo-fill', from: 0, to: shot.duration, what: `the headline is set at ${Math.round(mine.headline)} px, the film's other beats at ${Math.round(usual)} px` })
    }
  }
  const boxes = others.map(f => f.desktop).filter(Boolean)
  if (mine.desktop && boxes.length) {
    const usual = boxes[0]
    if (mine.desktop.some((v, i) => Math.abs(v - usual[i]) > 3)) {
      out.push({ rule: 'promo-desktop', from: 0, to: shot.duration, what: `the desktop sits at ${mine.desktop.join(', ')} (x, y, w, h), the other beats' at ${usual.join(', ')}` })
    }
  }
  return out
}

// The issues as lines a person (or the agent) reads
export const describeLayout = issues =>
  issues.map(i => `- ${i.rule}, ${i.from.toFixed(1)}–${i.to.toFixed(1)} s: ${i.what}`)

// A shot's layout faults as measured for the render with this key, or
// null (another version of its code was measured last)
export const layoutResult = (project, shot, key) => {
  const layout = readJson(layoutFile(project, shot), null)
  return layout?.key === key ? layout.issues ?? null : null
}
