// Subtitles of the voice-over: the spoken words, a short chunk at a time,
// burned over the shots. They are not part of a shot's frames (a line
// re-timed or reworded never re-renders the picture): each chunk is drawn
// once as a transparent PNG, and a shot's clip is "dressed" with the
// chunks inside it by ffmpeg, cached by the clip and the chunks.
//
// They sit in a band above the platforms' buttons (cues.mjs SUBTITLE_BAND,
// inside the safe area's width); with the voice-over on, shots keep their
// text out of it (check.mjs checks).

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cachedFile, engineCode } from './cache.mjs'
import { ffmpeg, openRenderPage, pageGeometry, QUALITY, renderPageFrames } from './compose.mjs'
import { SUBTITLE_BAND, voiceLang } from './cues.mjs'
import { cssSize } from './project.mjs'

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
// Longest chunk on screen: two lines of about 21 characters, or 18 CJK
const MAX_LATIN = 42
const MAX_CJK = 18

const units = s => [...s].reduce((n, c) => n + (CJK.test(c) ? 2.3 : /\s/.test(c) ? 0.6 : 1), 0)

// A sentence cut into chunks short enough to read at a glance: at
// punctuation first, else at the space nearest the middle
export function chunk(text) {
  const cjk = CJK.test(text)
  const max = cjk ? MAX_CJK : MAX_LATIN
  const len = s => (cjk ? [...s.replace(/\s/g, '')].length : s.length)
  if (len(text) <= max) return [text]
  const marks = [...text.matchAll(cjk ? /[，、；：,;:]/gu : /[,;:—–](?=\s)/gu)].map(m => m.index + 1)
  const mid = text.length / 2
  let at = marks.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]
  if (at == null || at < text.length * 0.2 || at > text.length * 0.8) {
    if (cjk) at = Math.round(mid)
    else {
      const spaces = [...text.matchAll(/\s/g)].map(m => m.index)
      at = spaces.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0] ?? Math.round(mid)
    }
  }
  return [...chunk(text.slice(0, at).trim()), ...chunk(text.slice(at).trim())]
}

// The chunks of the film's voice lines, timed by their share of each
// sentence's length: { text, at, end } in film seconds
export function subtitleCues(lines) {
  return lines.flatMap(l => {
    const parts = chunk(l.text)
    const total = parts.reduce((n, p) => n + units(p), 0)
    let t = l.at
    return parts.map(p => {
      const end = t + ((l.end - l.at) * units(p)) / total
      const cue = { shot: l.shot, text: p, at: t, end }
      t = end
      return cue
    })
  })
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// A face that draws the language's own glyphs (Japanese kanji are not
// Chinese ones)
const FONT = { ja: 'Hiragino Sans', ko: 'Apple SD Gothic Neo', 'zh-TW': 'PingFang TC' }
const fontFor = lang => `'${FONT[lang] ?? 'PingFang SC'}', -apple-system, 'Helvetica Neue', sans-serif`

// The subtitle band and box in page CSS px (the project's page, 2/3 of
// its pixel size): ids prefixed so another page can lay one out too (the
// subtitle check measures the box in the shot's own page)
export function subtitleCss(frame, lang, id = '') {
  const { width: w, height: h } = cssSize(frame)
  const tall = h > w
  const pad = Math.round(w * (tall ? 0.056 : 0.045))
  const right = tall ? Math.round(w * 0.861) : w - pad
  const [from, to] = SUBTITLE_BAND[tall ? 'portrait' : 'landscape']
  const top = Math.round(h * from)
  const bottom = Math.round(h * to)
  const size = Math.round((tall ? w : h) * 0.05)
  return `#${id}band { position: absolute; left: ${pad}px; width: ${right - pad}px; top: ${top}px; height: ${bottom - top}px;
        display: flex; align-items: center; justify-content: center; }
      #${id}sub { max-width: 100%; text-align: center; padding: ${Math.round(size * 0.22)}px ${Math.round(size * 0.45)}px;
        border-radius: ${Math.round(size * 0.3)}px; background: rgba(8, 10, 16, 0.62); color: #fff;
        font: 700 ${size}px/1.25 ${fontFor(lang)}; letter-spacing: 0.005em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5); overflow-wrap: anywhere; }`
}

// The page that draws one chunk at a time (window.render(i)), on the
// project's page size like the caption layer
function page(size, lang, texts) {
  const { width: w, height: h } = cssSize(size)
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
      ${subtitleCss(size, lang)}
    </style>
  </head>
  <body>
    <div id="band"><div id="sub"></div></div>
    <script>
      const TEXTS = ${JSON.stringify(texts.map(esc))}
      window.render = i => { document.getElementById('sub').innerHTML = TEXTS[i] }
      window.ready = document.fonts.ready
    </script>
  </body>
</html>
`
}

// When each chunk of a shot is on screen, in shot seconds: from its start
// to the next one's when the gap is short (so the band doesn't flicker
// between the chunks of a sentence), else to its own end
export function subtitleWindows(shot, cues) {
  const local = cues.filter(c => c.shot === shot.id)
    .map(c => ({ text: c.text, at: Math.max(0, c.at - shot.start), end: Math.min(shot.duration, c.end - shot.start) }))
  return local.map((c, i) => {
    const next = local[i + 1]
    return { ...c, end: next && next.at - c.end < 0.3 ? next.at : c.end }
  })
}

// Each chunk as a transparent PNG at the mode's size, cached by the texts,
// their face, the size and this layer's code: text → file. Drawn in a
// folder of its own and moved into place whole, so two renders at once
// never read a half-drawn set
async function subtitleImages(project, mode, cues) {
  const texts = [...new Set(cues.map(c => c.text))]
  const geo = pageGeometry(project, mode)
  const lang = voiceLang(project)
  const key = createHash('sha256').update(JSON.stringify([engineCode('subtitles.mjs', 'cues.mjs'), geo, lang, texts])).digest('hex').slice(0, 16)
  const dir = path.join(project.state, 'voice', 'subs', `${mode}-${key}`)
  const name = (d, i) => path.join(d, `${String(i).padStart(3, '0')}.png`)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true })
    const tmp = fs.mkdtempSync(`${dir}.`)
    try {
      const html = path.join(tmp, 'subs.html')
      fs.writeFileSync(html, page(project.size, lang, texts))
      const p = await openRenderPage(html, geo, { transparent: true })
      await renderPageFrames(p, texts.map((_, i) => i), i => name(tmp, i))
      // Another render may have finished the same set first: keep that one
      if (!fs.existsSync(dir)) fs.renameSync(tmp, dir)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
  return new Map(texts.map((t, i) => [t, name(dir, i)]))
}

// A shot's clip with its subtitles burned in (the clip itself when it has
// none), cached by the clip and its chunks
async function dressClip(project, shot, mode, clip, cues, images) {
  const windows = subtitleWindows(shot, cues)
  if (!windows.length) return clip
  const local = windows.map(c => ({ file: images.get(c.text), at: c.at, end: c.end }))
  // By the clip's place in the project, so a copy of the project (an
  // example opened as a draft) finds it
  const key = createHash('sha256').update(JSON.stringify([2, path.relative(project.root, clip), local.map(c => ({ ...c, file: path.relative(project.root, c.file) }))])).digest('hex').slice(0, 16)
  const chain = local.map((c, i) => `[v${i}][${i + 1}:v]overlay=0:0:enable='between(t,${c.at.toFixed(3)},${(c.end - 0.001).toFixed(3)})'[v${i + 1}]`)
  return cachedFile(path.join(project.state, 'voice', 'clips', `${shot.id}-${mode}-${key}.mp4`), part => ffmpeg([
    '-i', clip, ...local.flatMap(c => ['-i', c.file]),
    '-filter_complex', ['[0:v]null[v0]', ...chain, `[v${local.length}]format=yuv420p[out]`].join(';'),
    '-map', '[out]', '-c:v', 'libx264', ...QUALITY[mode], '-r', String(project.fps), '-movflags', '+faststart', part
  ]))
}

// Every shot's clip dressed for the film (clips: one per shot, in order),
// and the subtitle set they use
export async function dressClips(project, mode, clips, lines) {
  const cues = subtitleCues(lines)
  if (!cues.length) return { clips, subs: null }
  const images = await subtitleImages(project, mode, cues)
  const out = []
  for (const [i, shot] of project.shots.entries()) out.push(clips[i] && (await dressClip(project, shot, mode, clips[i], cues, images)))
  return { clips: out, subs: path.dirname(images.values().next().value) }
}
