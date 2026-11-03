// Frames a screenshot as a macOS window: rounded corners, a hairline
// edge, the traffic lights and the window shadow on a transparent
// background (after oliverzdev's scripts/shots/frame-window.mjs). A
// capture of a web page has no title bar of its own, so the window gets
// one, with the page's address in it.
//
//   const framed = await frameWindow(page, 'in.png', 'out.png', { scale: 2, title: 'example.com' })

import fs from 'node:fs'

// Room around the window for its shadow, which falls downward
const PAD = { x: 64, top: 40, bottom: 88 }
const BAR = 36

const css = ({ width, height, dark }) => `
  html, body { margin: 0; background: transparent; }
  .window {
    position: absolute; left: ${PAD.x}px; top: ${PAD.top}px; width: ${width}px; height: ${height + BAR}px;
    border-radius: 12px; overflow: hidden; background: ${dark ? '#1e1f22' : '#f6f6f7'};
    box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08), 0 24px 64px rgba(0, 0, 0, 0.2);
  }
  .bar { height: ${BAR}px; display: flex; align-items: center; justify-content: center; position: relative;
    border-bottom: 0.5px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'};
    font: 500 12px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; color: ${dark ? '#a0a2a8' : '#6e6f75'}; }
  .bar span { padding: 3px 14px; border-radius: 6px; background: ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}; }
  .lights { position: absolute; left: 14px; top: ${(BAR - 12) / 2}px; display: flex; gap: 8px; }
  .lights i { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18); }
  .lights i:nth-child(1) { background: #ff5f57; }
  .lights i:nth-child(2) { background: #febc2e; }
  .lights i:nth-child(3) { background: #28c840; }
  .window img { display: block; width: ${width}px; height: ${height}px; }
`

// The window round one PNG, written as a PNG at the same scale; the page
// is any openPage() page (its size is set here). Gives back the framed
// picture's size in pixels
export async function frameWindow(page, input, output, { scale = 2, title = '', dark = false } = {}) {
  const png = fs.readFileSync(input)
  const width = Math.round(png.readUInt32BE(16) / scale)
  const height = Math.round(png.readUInt32BE(20) / scale)
  const size = { width: width + PAD.x * 2, height: height + BAR + PAD.top + PAD.bottom }
  await page.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: scale, mobile: false })
  await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  const html = `<style>${css({ width, height, dark })}</style><div class="window"><div class="bar"><div class="lights"><i></i><i></i><i></i></div>${title ? `<span>${title.replace(/[&<]/g, c => (c === '&' ? '&amp;' : '&lt;'))}</span>` : ''}</div><img src="data:image/png;base64,${png.toString('base64')}"></div>`
  await page.evaluate(`(async () => {
    document.documentElement.innerHTML = ${JSON.stringify(html)}
    await document.querySelector('img').decode()
  })()`)
  await page.screenshot(output)
  return { width: size.width * scale, height: size.height * scale }
}
