// Renders a 3D explainer made in Blender (engine/video/explainers/3d):
// the episode's scene.py renders frames, captions.html renders a
// transparent caption layer in Chrome, ffmpeg composites both and muxes
// the music bed.
//
//   node engine/video/blender.mjs <episode dir>            full video
//   node engine/video/blender.mjs <episode dir> --draft    preview video
//     (half resolution, few samples: ~0.3 s a frame instead of ~1.7 s)
//   node engine/video/blender.mjs <episode dir> --draft --range 26.4-31.2
//     one shot (seconds), with its captions and music, in about a
//     minute: iterate on a shot without rendering the episode
//   node engine/video/blender.mjs <episode dir> --stills 2.5,14,30
//     a few composited stills (seconds) into <dir>/out/stills/ to check
//     framing before a full render
//
// Needs Blender (brew install --cask blender), ffmpeg and local Chrome.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { openPage } from '../lib/chrome.mjs'
import { render as renderMusic, wav } from './music.mjs'

const BLENDER =
  process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'
const FPS = 30

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { stills: { type: 'string' }, draft: { type: 'boolean' }, range: { type: 'string' } }
})
const dir = path.resolve(positionals[0] ?? '')
if (!fs.existsSync(path.join(dir, 'scene.py'))) {
  console.error('usage: blender.mjs <episode dir> [--stills 1.5,12]')
  process.exit(1)
}
const name = path.basename(dir)
const out = path.join(dir, 'out')
// --range a-b (seconds) → first and last frame
const range = values.range?.split('-').map((s, i) => Math.round(Number(s) * FPS) + (i ? 0 : 1))
const framesDir = path.join(out, values.stills ? 'stills-raw' : range ? 'frames-range' : values.draft ? 'frames-draft' : 'frames')
if (range) fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

const run = (cmd, args, { input, quiet } = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit']
    })
    p.stdout.on('data', d => {
      const s = String(d)
      if (!quiet) {
        const m = s.match(/FRAME (\d+)/g)
        if (m) process.stdout.write(`\r${name} frame ${m.at(-1).split(' ')[1]}   `)
      }
    })
    p.on('close', code => (code ? reject(new Error(`${cmd} exited ${code}`)) : resolve()))
    if (input) input(p.stdin)
  })

const stills = values.stills?.split(',').map(s => Math.round(Number(s) * FPS) + 1)

// 0 · screen.html (optional): an image sequence scene.py maps onto a
// screen in the world, one PNG per video frame, out/screen/00001.png…
const screenHtml = path.join(dir, 'screen.html')
if (fs.existsSync(screenHtml)) {
  const screenDir = path.join(out, 'screen')
  fs.mkdirSync(screenDir, { recursive: true })
  const sp = await openPage({ width: 1024, height: 640, scale: 1 })
  await sp.goto(pathToFileURL(screenHtml).href)
  await sp.evaluate(`new Promise(r => { const c = () => typeof window.render === 'function' ? r() : setTimeout(c, 50); c() })`)
  await sp.evaluate('window.ready')
  const total = Math.round((await sp.evaluate('window.DURATION')) * FPS)
  const [lo, hi] = range ?? [1, total]
  const wanted = stills ?? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  for (const f of wanted) {
    await sp.evaluate(`render(${(f - 1) / FPS})`)
    await sp.screenshot(path.join(screenDir, `${String(f).padStart(5, '0')}.png`))
  }
  await sp.close()
  console.log(`screen: ${wanted.length} frames`)
}

// 1 · Blender frames
await run(BLENDER, [
  '-b', '-P', path.join(dir, 'scene.py'), '--',
  '--out', framesDir,
  ...(stills ? ['--stills', stills.join(',')] : []),
  ...(range ? ['--frames', range.join('-')] : []),
  ...(values.draft ? ['--draft'] : [])
])
const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort()
console.log(`\n${frames.length} frames rendered`)

// 2 · caption layer, transparent, one PNG per frame
// Draft frames are half size (540×960): render captions to match
const page = await openPage({ width: 720, height: 1280, scale: values.draft ? 0.75 : 1.5 })
await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
await page.goto(pathToFileURL(path.join(dir, 'captions.html')).href)
await page.evaluate(`new Promise(r => { const c = () => typeof window.render === 'function' ? r() : setTimeout(c, 50); c() })`)
await page.evaluate('window.ready')
const caption = async frame => {
  await page.evaluate(`render(${(frame - 1) / FPS})`)
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
  return Buffer.from(data, 'base64')
}

// 3 · composite
if (stills) {
  const stillsDir = path.join(out, 'stills')
  fs.mkdirSync(stillsDir, { recursive: true })
  for (const f of stills) {
    const capPath = path.join(framesDir, `cap-${f}.png`)
    fs.writeFileSync(capPath, await caption(f))
    await run('ffmpeg', ['-loglevel', 'error', '-y',
      '-i', path.join(framesDir, `${String(f).padStart(5, '0')}.png`), '-i', capPath,
      '-filter_complex', '[0][1]overlay=0:0', path.join(stillsDir, `${((f - 1) / FPS).toFixed(1)}s.png`)])
  }
  await page.close()
  console.log(`stills in ${path.relative(process.cwd(), stillsDir)}`)
} else {
  const duration = frames.length / FPS
  const first = range?.[0] ?? 1
  const musicPath = path.join(out, 'music.wav')
  const musicJson = path.join(dir, 'music.json')
  if (fs.existsSync(musicJson)) {
    fs.writeFileSync(musicPath, wav(renderMusic(JSON.parse(fs.readFileSync(musicJson, 'utf8')))))
  }
  const target = path.join(out, `${name}${range ? `.${values.range}s` : ''}${values.draft ? '.draft' : ''}.mp4`)
  await run('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-framerate', String(FPS), '-start_number', String(first), '-i', path.join(framesDir, '%05d.png'),
    '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
    ...(fs.existsSync(musicPath) ? ['-ss', String((first - 1) / FPS), '-i', musicPath] : []),
    '-filter_complex', '[0][1]overlay=0:0,format=yuv420p[v]',
    '-map', '[v]', ...(fs.existsSync(musicPath) ? ['-map', '2:a', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []),
    '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', target
  ], {
    input: async stdin => {
      for (let i = 0; i < frames.length; i++) {
        if (!stdin.write(await caption(first + i))) await new Promise(r => stdin.once('drain', r))
        if ((i + 1) % FPS === 0) process.stdout.write(`\rcaptions ${(i + 1) / FPS}s / ${duration}s   `)
      }
      stdin.end()
    }
  })
  await page.close()
  console.log(`\n${path.relative(process.cwd(), target)}`)
}
