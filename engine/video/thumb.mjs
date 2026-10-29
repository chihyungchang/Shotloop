// Renders an episode's cover (thumb.html, 1080×1920) to
// <episode>/out/thumbnail.png, for YouTube Shorts, TikTok and Reels:
//   node engine/video/thumb.mjs <episode dir>
// The page defines window.ready (fonts, background image).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { openPage } from '../lib/chrome.mjs'

const dir = path.resolve(process.argv[2] ?? '')
const page = path.join(dir, 'thumb.html')
if (!fs.existsSync(page)) {
  console.error('usage: thumb.mjs <episode dir with thumb.html>')
  process.exit(1)
}
const out = path.join(dir, 'out', 'thumbnail.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
const p = await openPage({ width: 1080, height: 1920 })
await p.goto(pathToFileURL(page).href)
await p.evaluate('window.ready')
await p.screenshot(out)
await p.close()
console.log(path.relative(process.cwd(), out))
