// The subtitle check: nothing the viewer must see sits under a subtitle.
// Each voiced 2D shot is drawn every 0.1 s (no frames captured, so it
// takes seconds) with the subtitle on screen at that moment laid out in
// the shot's own page, and what the box covers is listed:
//
//   - text in the DOM or SVG,
//   - elements marked data-keep="name" (the subject: a satellite, a zipper),
//   - regions canvas drawing reports that frame with
//     subtitles.keep(x, y, w, h, 'name') (page CSS px).
//
// Hidden or nearly transparent things (under 5% opacity) don't count.
// What it can't see: canvas shapes nobody reported, text drawn on a
// canvas, and 3D shots. So on-screen text is DOM or SVG, the subject is
// marked, and big backgrounds (a globe, a grid, a glow) stay unmarked and
// may pass under the subtitles.

import { shotKey, subtitleFile } from './cache.mjs'
import { writeJson } from './files.mjs'
import { emit, progress } from './compose.mjs'
import { openShot } from './render2d.mjs'
import { subtitleCss, subtitleCues, subtitleWindows } from './subtitles.mjs'
import { timedLines, voiceOn } from './cues.mjs'

const STEP = 0.1
const MIN_OPACITY = 0.05

// Runs in the shot's page: what the subtitle box covers right now
const COVERED = `(text => {
  const sub = document.getElementById('__sl_sub')
  sub.textContent = text
  const box = sub.getBoundingClientRect()
  const hits = (r) => r.width > 0 && r.height > 0 && Math.min(r.right, box.right) - Math.max(r.left, box.left) > 1
    && Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top) > 1
  // Opacity down the ancestors, 0 when hidden
  const seen = el => {
    let a = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 0
      a *= parseFloat(cs.opacity)
      if (e instanceof SVGElement && e === el) a *= parseFloat(cs.fillOpacity || '1')
    }
    return a
  }
  const out = []
  const band = document.getElementById('__sl_band')
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement
    if (!n.textContent.trim() || !el || band.contains(el) || /^(SCRIPT|STYLE|TITLE)$/.test(el.tagName)) continue
    if (seen(el) < ${MIN_OPACITY}) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    if ([...range.getClientRects()].some(hits)) out.push('text "' + n.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + '"')
  }
  for (const el of document.querySelectorAll('[data-keep]')) {
    if (seen(el) >= ${MIN_OPACITY} && hits(el.getBoundingClientRect())) out.push(el.getAttribute('data-keep') || el.tagName.toLowerCase())
  }
  for (const k of window.subtitles?.kept ?? []) {
    if (hits({ left: k.x, top: k.y, right: k.x + k.w, bottom: k.y + k.h, width: k.w, height: k.h })) out.push(k.name || 'canvas region')
  }
  return [...new Set(out)]
})`

// The voiced 2D shots (or the one asked for) checked, each result saved
// with its shot: { checked, issues: [{ shot, from, to, what }] }, time
// ranges in shot seconds. The times come from the fitted cues in
// shotloop.json: no speech is made
export async function checkSubtitles(project, { shot: only, mode = 'final' } = {}) {
  if (project.track !== '2d' || !voiceOn(project)) return { checked: 0, issues: [] }
  const cues = subtitleCues(timedLines(project))
  const shots = project.shots.filter(s => (!only || s.id === only) && subtitleWindows(s, cues).length)
  const all = []
  for (const shot of shots) {
    const issues = []
    const windows = subtitleWindows(shot, cues)
    const s = await openShot(project, shot, mode)
    try {
      await s.page.evaluate(`(() => {
        const style = document.createElement('style')
        style.textContent = ${JSON.stringify(subtitleCss(project.size, project.config.lang ?? 'en', '__sl_'))} + ' #__sl_band { visibility: hidden; z-index: -1; }'
        document.head.appendChild(style)
        const band = document.createElement('div')
        band.id = '__sl_band'
        band.innerHTML = '<div id="__sl_sub"></div>'
        document.body.appendChild(band)
      })()`)
      const times = []
      for (let t = 0; t < shot.duration - 1e-6; t = Math.round((t + STEP) * 1000) / 1000) times.push(t)
      const tick = progress({ shot: shot.id, stage: 'subtitle check' }, times.length)
      const open = new Map()
      for (const [i, t] of times.entries()) {
        const on = windows.find(w => t >= w.at && t < w.end)
        let covered = []
        if (on) {
          await s.draw(t)
          covered = await s.page.evaluate(`${COVERED}(${JSON.stringify(on.text)})`)
        }
        // Consecutive samples of the same thing become one range, which
        // ends a step after its last sample
        for (const what of covered) {
          const r = open.get(what)
          const end = Math.round((t + STEP) * 1000) / 1000
          if (r && t - r.to < 1e-6) r.to = end
          else {
            if (r) issues.push(r)
            open.set(what, { shot: shot.id, from: t, to: end, what })
          }
        }
        tick(i + 1)
      }
      issues.push(...open.values())
    } finally {
      await s.close()
    }
    issues.sort((a, b) => a.from - b.from)
    writeJson(subtitleFile(project, shot), { key: shotKey(project, shot, 'final'), at: new Date().toISOString(), issues })
    all.push(...issues)
  }
  return { checked: shots.length, issues: all }
}

// The issues as lines a person (or the agent) reads
export const describeIssues = issues =>
  issues.map(i => `${i.shot} ${i.from.toFixed(1)}–${i.to.toFixed(1)} s: the subtitle covers ${i.what}`)

// Fails with the list when a subtitle covers something
export async function assertSubtitlesClear(project, opts) {
  const { issues } = await checkSubtitles(project, opts)
  if (!issues.length) return
  const lines = describeIssues(issues)
  for (const l of lines) emit({ type: 'log', message: l })
  throw new Error(`subtitles cover what the viewer must see:\n${lines.join('\n')}`)
}
