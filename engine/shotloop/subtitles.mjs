// Subtitles of the voice-over: the spoken words burned over the shots, in
// the look the person chose (data.mjs SUBTITLE_STYLES): a short chunk at a
// time, a chunk with the word being said marked, or one word at a time.
// They are not part of a shot's frames (a line re-timed or reworded never
// re-renders the picture): each state of the subtitle (a chunk, a chunk
// with its word lit, a word popping in) is drawn once as a transparent
// PNG, and a shot's clip is "dressed" with the states inside it by ffmpeg,
// cached by the clip and the states' frames.
//
// The words are timed off the spoken sentences (words.mjs): the voice's
// pauses place them, so a lit word follows the voice.
//
// They sit in a band above the platforms' buttons (cues.mjs SUBTITLE_BAND,
// inside the safe area's width); with the voice-over on, shots keep their
// text out of it (check.mjs checks).

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cachedFile, engineCode } from './cache.mjs'
import { ffmpeg, openRenderPage, pageGeometry, progress, QUALITY, renderPageFrames } from './compose.mjs'
import { SUBTITLE_BAND, subtitleStyle, voiceLang } from './cues.mjs'
import { SUBTITLE_STYLES, subtitleRules } from './data.mjs'
import { pageLayout } from './looks.mjs'
import { cssSize } from './project.mjs'
import { FRAME, isCjk, splitWords, timeWords, wordsHtml } from './words.mjs'

// A sentence cut into chunks short enough to read at a glance (max:
// [Latin letters, CJK characters]; the default two lines of about 21, or
// 18 CJK): at punctuation first, else at the space nearest the middle
export function chunk(text, max = [42, 18]) {
  const cjk = isCjk(text)
  const most = max[cjk ? 1 : 0]
  const len = s => (cjk ? [...s.replace(/\s/g, '')].length : s.length)
  if (len(text) <= most) return [text]
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
  return [...chunk(text.slice(0, at).trim(), max), ...chunk(text.slice(at).trim(), max)]
}

// A sentence's timed words in its chunks: each word goes to the chunk its
// first letter is in (a CJK chunk may be cut inside a word)
function chunkWords(text, words, max) {
  const solid = s => s.replace(/\s/g, '').length
  let end = 0
  const ends = chunk(text, max).map(c => (end += solid(c)))
  const out = ends.map(() => [])
  let at = 0
  for (const w of words) {
    out[Math.max(0, ends.findIndex(e => at < e))].push(w)
    at += solid(w.text)
  }
  return out.filter(ws => ws.length)
}

// A spoken sentence's loudness, one RMS value per FRAME s (its WAV is
// voice.mjs's: 16-bit mono PCM); null for a file of another shape, whose
// words are then timed by their length alone
function loudness(file) {
  const buf = fs.readFileSync(file)
  if (buf.toString('ascii', 36, 40) !== 'data' || buf.readUInt16LE(34) !== 16 || buf.readUInt16LE(22) !== 1) return null
  const step = Math.round(buf.readUInt32LE(24) * FRAME)
  const n = Math.floor((buf.length - 44) / 2)
  return Array.from({ length: Math.ceil(n / step) }, (_, f) => {
    let sum = 0
    const to = Math.min(n, (f + 1) * step)
    for (let i = f * step; i < to; i++) sum += (buf.readInt16LE(44 + i * 2) / 32768) ** 2
    return Math.sqrt(sum / (to - f * step))
  })
}

// The film's voice lines as subtitle chunks: { shot, text, at, end,
// words: [{ text, space, at, end }] } in film seconds. A line with its
// speech (file) has its words placed by the voice's pauses; without it,
// by their share of the sentence's length
export function subtitleCues(lines, { lang = 'en', chunk: max } = {}) {
  return lines.flatMap(l => {
    const words = timeWords(splitWords(l.text, lang), l.at, l.end, l.file ? loudness(l.file) : null)
    return chunkWords(l.text, words, max).map(ws => ({
      shot: l.shot, text: ws.map(w => w.text + w.space).join('').trim(), at: ws[0].at, end: ws.at(-1).end, words: ws
    }))
  })
}

// Shorter than this a word is said too fast to read alone: one at a time,
// it shows with the next
const ONE_MIN = 0.22

// A chunk's words one at a time, a quick one joined with the next (two at
// most, never across punctuation)
function oneByOne(words) {
  const out = []
  for (const w of words) {
    const last = out.at(-1)
    if (last && last.n < 2 && last.end - last.at < ONE_MIN && !/[\p{P}]$/u.test(last.text)) {
      Object.assign(last, { text: last.text + last.space + w.text, space: w.space, end: w.end, n: 2 })
    } else out.push({ ...w, n: 1 })
  }
  return out.map(({ n, ...w }) => w)
}

// What the subtitle shows during a shot and when, in shot seconds: { html,
// words, on, at, end }, by how the look brings its words ('line',
// 'follow', 'one', 'single'): every chunk spoken while the shot plays, whichever
// shot's line it is (a line may run over a cut), each state on until the
// next one when the gap is short (so the band doesn't flicker between
// the chunks of a sentence), else to its end
export function subtitleWindows(shot, cues, words = 'line') {
  const film = cues.flatMap(c =>
    words === 'line' ? [{ words: c.words, on: -1, at: c.at, end: c.end }]
      : words === 'follow' ? c.words.map((w, i) => ({ words: c.words, on: i, at: i ? w.at : c.at, end: w.end }))
        : (words === 'one' ? oneByOne(c.words) : c.words).map(w => ({ words: [w], on: 0, at: w.at, end: w.end })))
  const local = film.filter(w => w.at < shot.start + shot.duration && w.end > shot.start)
    .map(w => ({ ...w, html: wordsHtml(w.words, w.on), at: Math.max(0, w.at - shot.start), end: Math.min(shot.duration, w.end - shot.start) }))
  return local.map((w, i) => {
    const next = local[i + 1]
    return { ...w, end: next && next.at - w.end < 0.3 ? next.at : w.end }
  })
}

// A face that draws the language's own glyphs (Japanese kanji are not
// Chinese ones)
const FONT = { ja: 'Hiragino Sans', ko: 'Apple SD Gothic Neo', 'zh-TW': 'PingFang TC' }
const fontFor = lang => `'${FONT[lang] ?? 'PingFang SC'}', -apple-system, 'Helvetica Neue', sans-serif`

// The subtitle band and box in page CSS px (the project's page, 2/3 of
// its pixel size), the box in the look chosen (a SUBTITLE_STYLES id): ids
// prefixed so another page can lay one out too (the subtitle check
// measures the box in the shot's own page)
export function subtitleCss(frame, lang, look, id = '') {
  const { w, h, safeRight } = pageLayout(frame)
  const tall = h > w
  // Centred on the frame: as clear of its left edge as the safe area is
  // of its right one (the platforms' buttons, portrait)
  const pad = w - safeRight
  const right = safeRight
  const [from, to] = SUBTITLE_BAND[tall ? 'portrait' : 'landscape']
  const top = Math.round(h * from)
  const bottom = Math.round(h * to)
  const size = Math.round((tall ? w : h) * 0.05)
  return `#${id}band { position: absolute; left: ${pad}px; width: ${right - pad}px; top: ${top}px; height: ${bottom - top}px;
        display: flex; align-items: center; justify-content: center; }
      #${id}sub { max-width: 100%; text-align: center; text-wrap: balance; overflow-wrap: anywhere; font-family: ${fontFor(lang)}; }
      ${subtitleRules(`#${id}sub`, SUBTITLE_STYLES[look], size)}`
}

// The page that draws one state at a time (window.render(i)), on the
// project's page size like the caption layer; '' draws nothing
function page(size, lang, look, htmls) {
  const { width: w, height: h } = cssSize(size)
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
      ${subtitleCss(size, lang, look)}
    </style>
  </head>
  <body>
    <div id="band"><div id="sub"></div></div>
    <script>
      const HTML = ${JSON.stringify(htmls)}
      window.render = i => {
        document.getElementById('sub').innerHTML = HTML[i]
        document.getElementById('band').style.visibility = HTML[i] ? 'visible' : 'hidden'
      }
      window.ready = document.fonts.ready
    </script>
  </body>
</html>
`
}

// A shot's subtitle on the film's frame grid: [{ html, from, to }] in
// frames, the word being said entering at the look's pop scales, a frame
// each (when it stays long enough to settle)
function framed(windows, pop, fps) {
  const out = []
  for (const w of windows) {
    let f = Math.round(w.at * fps)
    const to = Math.round(w.end * fps)
    if (to <= f) continue
    for (const scale of w.on >= 0 && pop && to - f > pop.length + 1 ? pop : []) out.push({ html: wordsHtml(w.words, w.on, scale), from: f, to: ++f })
    out.push({ html: w.html, from: f, to })
  }
  return out
}

// Each state as a transparent PNG at the mode's size, cached by the
// states, the CSS they're drawn with (band, face, look), the size and
// this layer's code: html → file. Drawn in a folder of its own and moved
// into place whole, so two renders at once never read a half-drawn set
async function subtitleImages(project, mode, look, htmls) {
  const geo = pageGeometry(project, mode)
  const lang = voiceLang(project)
  const key = createHash('sha256').update(JSON.stringify([engineCode('subtitles.mjs', 'cues.mjs', 'words.mjs'), geo, subtitleCss(project.size, lang, look), htmls])).digest('hex').slice(0, 16)
  const dir = path.join(project.state, 'voice', 'subs', `${mode}-${key}`)
  const name = (d, i) => path.join(d, `${String(i).padStart(4, '0')}.png`)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true })
    const tmp = fs.mkdtempSync(`${dir}.`)
    try {
      const html = path.join(tmp, 'subs.html')
      fs.writeFileSync(html, page(project.size, lang, look, htmls))
      const p = await openRenderPage(html, geo, { transparent: true })
      await renderPageFrames(p, htmls.map((_, i) => i), i => name(tmp, i), progress({ stage: 'subtitles' }, htmls.length))
      // Another render may have finished the same set first: keep that one
      if (!fs.existsSync(dir)) fs.renameSync(tmp, dir)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
  return new Map(htmls.map((t, i) => [t, name(dir, i)]))
}

// A shot's clip with its subtitle burned in (the clip itself when it has
// none): the states as one stream of stills (an ffconcat list, nothing
// shown between them), cached by the clip and the stills' frames
async function dressClip(project, shot, mode, clip, parts, images) {
  if (!parts.length) return clip
  const fps = project.fps
  const runs = []
  let f = 0
  for (const p of parts) {
    if (p.from > f) runs.push({ file: images.get(''), from: f })
    runs.push({ file: images.get(p.html), from: p.from })
    f = p.to
  }
  runs.push({ file: images.get(''), from: f })
  // By the clip's place in the project, so a copy of the project (an
  // example opened as a draft) finds it
  const key = createHash('sha256').update(JSON.stringify([3, fps, path.relative(project.root, clip), runs.map(r => [path.relative(project.root, r.file), r.from])])).digest('hex').slice(0, 16)
  return cachedFile(path.join(project.state, 'voice', 'clips', `${shot.id}-${mode}-${key}.mp4`), async part => {
    // Each still starts half a frame early, so the clip's frame at its
    // start already shows it
    const start = r => (r.from ? (r.from - 0.5) / fps : 0)
    const quote = file => `'${file.replace(/'/g, "'\\''")}'`
    const list = runs.map((r, i) => `file ${quote(r.file)}${runs[i + 1] ? `\nduration ${(start(runs[i + 1]) - start(r)).toFixed(6)}` : ''}`)
    const txt = `${part}.txt`
    fs.writeFileSync(txt, `ffconcat version 1.0\n${list.join('\n')}\nfile ${quote(runs.at(-1).file)}\n`)
    try {
      await ffmpeg([
        '-i', clip, '-f', 'concat', '-safe', '0', '-i', txt,
        '-filter_complex', '[0:v][1:v]overlay=0:0:eof_action=repeat,format=yuv420p[out]',
        '-map', '[out]', '-c:v', 'libx264', ...QUALITY[mode], '-r', String(fps), '-movflags', '+faststart', part
      ])
    } finally {
      fs.rmSync(txt, { force: true })
    }
  })
}

// Every shot's clip dressed for the film (clips: one per shot, in order),
// and the subtitle set they use; none with the subtitles off
export async function dressClips(project, mode, clips, lines) {
  const id = subtitleStyle(project)
  const look = SUBTITLE_STYLES[id]
  const cues = look ? subtitleCues(lines, { lang: voiceLang(project), chunk: look.chunk }) : []
  if (!cues.length) return { clips, subs: null }
  const parts = project.shots.map((shot, i) => (clips[i] ? framed(subtitleWindows(shot, cues, look.words), look.pop, project.fps) : []))
  const images = await subtitleImages(project, mode, id, ['', ...new Set(parts.flat().map(p => p.html))])
  const out = []
  for (const [i, shot] of project.shots.entries()) out.push(clips[i] && (await dressClip(project, shot, mode, clips[i], parts[i], images)))
  return { clips: out, subs: path.dirname(images.get('')) }
}
