// A minimal Chrome DevTools Protocol client for local scripts:
// launches headless Chrome, opens one page, and exposes `send` for
// raw CDP calls. No dependencies (Node 22 ships WebSocket).
//
//   const page = await openPage({ width: 1000, height: 700, scale: 2 })
//   await page.goto('http://localhost:1420/')
//   await page.screenshot('out.png')
//   await page.close()

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { renderBrowser } from './browser.mjs'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitForPort(profile) {
  const file = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(file)) {
      const [port, wsPath] = fs.readFileSync(file, 'utf8').split('\n')
      if (wsPath) return `ws://127.0.0.1:${port}${wsPath}`
    }
    await sleep(100)
  }
  throw new Error('Chrome did not start')
}

export async function openPage({
  width,
  height,
  scale = 1,
  dark = false
}) {
  const browser = await renderBrowser()
  // A path set by hand that leads nowhere: said, not a start timed out
  if (!fs.existsSync(browser.path)) throw new Error(`the browser set in Settings is not there: ${browser.path}`)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'))
  const chrome = spawn(
    browser.path,
    [
      browser.shell ? '--headless' : '--headless=new',
      // WebGL on the GPU: the headless shell otherwise draws it in
      // software, about ten times slower for a 3D shot
      ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      // No keychain: otherwise macOS asks the person to let the app read
      // "Chrome Safe Storage" the first time a render starts Chrome
      '--use-mock-keychain',
      '--password-store=basic',
      // No sync, updates or other calls home from a render
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      // Chrome hard-links its own .app into a temp folder at every start
      // (code sign clone); started by Shotloop, macOS counts that as
      // Shotloop modifying another app and asks for App Management
      '--disable-features=MacAppCodeSignClone',
      // Pages opened from file:// may import ES modules from disk (a 2D
      // shot's shot.js); off by default in Chrome
      '--allow-file-access-from-files',
      'about:blank'
    ],
    { stdio: 'ignore' }
  )
  const ws = new WebSocket(await waitForPort(profile))
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  const pending = new Map()
  const listeners = new Set()
  ws.onmessage = e => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error
        ? reject(new Error(msg.error.message))
        : resolve(msg.result)
    } else for (const l of listeners) l(msg)
  }
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })

  const { targetId } = await call('Target.createTarget', {
    url: 'about:blank'
  })
  const { sessionId } = await call('Target.attachToTarget', {
    targetId,
    flatten: true
  })
  const send = (method, params) => call(method, params, sessionId)
  const once = method =>
    new Promise(resolve => {
      const l = msg => {
        if (msg.method === method && msg.sessionId === sessionId) {
          listeners.delete(l)
          resolve(msg.params)
        }
      }
      listeners.add(l)
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false
  })
  await send('Emulation.setEmulatedMedia', {
    features: [
      {
        name: 'prefers-color-scheme',
        value: dark ? 'dark' : 'light'
      }
    ]
  })

  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description)
    }
    return r.result.value
  }

  return {
    send,
    evaluate,
    async goto(url) {
      const loaded = once('Page.loadEventFired')
      await send('Page.navigate', { url })
      await loaded
    },
    async screenshot(file, clip) {
      const ext = path.extname(file).slice(1)
      const format = ext === 'jpg' ? 'jpeg' : ext
      const { data } = await send('Page.captureScreenshot', {
        format,
        ...(format === 'png' ? {} : { quality: 90 }),
        ...(clip ? { clip: { ...clip, scale: 1 } } : {})
      })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(data, 'base64'))
    },
    async close() {
      ws.close()
      // The profile goes once Chrome has exited: one still shutting down
      // writes into it, and removing it then fails (ENOTEMPTY). Its helper
      // processes may write a moment longer, so the removal retries
      if (chrome.exitCode == null && chrome.signalCode == null) {
        const exited = new Promise(r => chrome.once('exit', r))
        chrome.kill()
        // One that ignores the request is stopped outright
        if ((await Promise.race([exited.then(() => true), sleep(5000).then(() => false)])) === false) {
          chrome.kill('SIGKILL')
          await exited
        }
      }
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      } catch {
        // Left in the temp folder, which the system clears: the render (or
        // its own error) is what matters to whoever closes the page
      }
    }
  }
}

export { sleep }
