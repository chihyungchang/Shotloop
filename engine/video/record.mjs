// Records an HTML animation to MP4, frame by frame, so the video is
// smooth and identical every run whatever the machine's speed. Shared by
// every workflow in engine/video (see README.md there).
//
//   node engine/video/record.mjs <page.html> --out <file.mp4>
//     [--size landscape|portrait] [--lang en,zh,pt-br] [--music bed.wav]
//
// The page must define window.render(t) (draw the frame at t seconds)
// and window.DURATION, and may define a window.ready promise. --out may
// contain {lang}; the page is opened with ?lang=<lang> for each one.
//
// Sizes: landscape is 1280×720 CSS px, portrait (Shorts, Reels, TikTok)
// is 720×1280; both are captured at 1.5x, so 1920×1080 or 1080×1920.
// --music muxes a WAV (engine/video/music.mjs) as AAC, trimmed to the
// video. Needs ffmpeg (brew install ffmpeg) and local Chrome.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { openPage } from '../lib/chrome.mjs'

const SIZES = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 }
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    lang: { type: 'string', default: 'en' },
    size: { type: 'string', default: 'landscape' },
    music: { type: 'string' },
    fps: { type: 'string', default: '30' }
  }
})
const [html] = positionals
const size = SIZES[values.size]
if (!html || !values.out || !size) {
  console.error(
    'usage: record.mjs <page.html> --out <file{lang}.mp4> [--size landscape|portrait] [--lang en,zh] [--music bed.wav]'
  )
  process.exit(1)
}
const fps = Number(values.fps)

const run = (args, input) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...args], {
      stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit']
    })
    p.on('close', code =>
      code ? reject(new Error(`ffmpeg ${code}`)) : resolve()
    )
    if (input) input(p.stdin)
  })

for (const lang of values.lang.split(',')) {
  const out = values.out.replace('{lang}', lang)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  // Frames go to a temp file outside out/ until the music is muxed: a
  // half-written MP4 there looks like a broken video
  const silent = values.music
    ? path.join(os.tmpdir(), `record-${process.pid}-${path.basename(out)}`)
    : out
  const page = await openPage({ ...size, scale: 1.5 })
  const url = pathToFileURL(path.resolve(html))
  url.searchParams.set('lang', lang)
  await page.goto(url.href)
  // Module scripts (three.js pages) define render() after load
  await page.evaluate(
    `new Promise(r => { const c = () => typeof window.render === 'function' ? r() : setTimeout(c, 50); c() })`
  )
  await page.evaluate('window.ready')
  const duration = await page.evaluate('window.DURATION')
  const frames = Math.round(duration * fps)

  await run(
    ['-framerate', String(fps), '-f', 'image2pipe', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
      '-preset', 'slow', '-movflags', '+faststart', silent],
    async stdin => {
      for (let i = 0; i < frames; i++) {
        await page.evaluate(`render(${i / fps})`)
        const { data } = await page.send('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 92
        })
        if (!stdin.write(Buffer.from(data, 'base64'))) {
          await new Promise(r => stdin.once('drain', r))
        }
        if (i % fps === 0) {
          process.stdout.write(`\r${lang} ${i / fps}s / ${duration}s`)
        }
      }
      stdin.end()
    }
  )
  await page.close()

  if (values.music) {
    await run([
      '-i', silent, '-i', values.music,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '160k', '-shortest',
      '-movflags', '+faststart', out
    ])
    fs.rmSync(silent)
  }
  console.log(`\r${out}`)
}
