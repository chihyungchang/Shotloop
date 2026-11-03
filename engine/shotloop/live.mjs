// Live parts: a part of a product's page (a card, a field, a button) kept
// as HTML with its own styles, fonts and images inlined, so a promo shot
// draws it sharp at any size and can type into its fields (screens.js
// livePart). Taken from the page site.mjs has open, then checked against
// the part's own capture: one that doesn't look the same (a style that
// can't be carried over, an image that couldn't be fetched) is dropped,
// and the capture serves instead.
//
//   site/live/NN-name.json   { html, css, width, height, radius, fields }

// Runs in the page: the part marked data-shotloop-part="index" as
// self-contained HTML. Self-contained (it is sent as source)
async function serialize(index, maxNodes, maxBytes) {
  const root = document.querySelector(`[data-shotloop-part="${index}"]`)
  if (!root) return { error: 'gone' }
  const all = [root, ...root.querySelectorAll('*')]
  if (all.length > maxNodes) return { error: `${all.length} elements` }

  // Each tag's own defaults, from a blank frame: only what differs is kept
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const blank = frame.contentDocument
  const defaults = new Map()
  const defaultsOf = tag => {
    if (!defaults.has(tag)) {
      const el = blank.createElementNS(tag.includes(':') ? 'http://www.w3.org/2000/svg' : blank.body.namespaceURI, tag.replace(/^svg:/, ''))
      blank.body.appendChild(el)
      const cs = blank.defaultView.getComputedStyle(el)
      const map = {}
      for (const prop of cs) map[prop] = cs.getPropertyValue(prop)
      defaults.set(tag, map)
      el.remove()
    }
    return defaults.get(tag)
  }

  // Images and backgrounds as data, fetched once; a failure is reported
  const data = new Map()
  let missing = 0
  const inline = async src => {
    if (!src || src.startsWith('data:')) return src
    if (!data.has(src)) {
      data.set(src, fetch(src).then(r => (r.ok ? r.blob() : Promise.reject(r.status))).then(b => new Promise(res => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result)
        reader.readAsDataURL(b)
      })).catch(() => { missing++; return null }))
    }
    return data.get(src)
  }

  const skip = /^(transition|animation|will-change|cursor|pointer-events|user-select|-webkit-user|caret|outline|scroll|touch-action|view-transition)/
  const clone = root.cloneNode(true)
  const copies = [clone, ...clone.querySelectorAll('*')]
  const families = new Set()
  let fieldN = 0, buttonN = 0
  for (const [i, el] of all.entries()) {
    const copy = copies[i]
    const cs = getComputedStyle(el)
    const tag = el instanceof SVGElement ? `svg:${el.tagName}` : el.tagName.toLowerCase()
    const base = defaultsOf(tag)
    const style = []
    for (const prop of cs) {
      if (skip.test(prop)) continue
      const v = cs.getPropertyValue(prop)
      if (v === base[prop]) continue
      if (prop === 'background-image' && v.includes('url(')) {
        const urls = [...v.matchAll(/url\("?([^")]+)"?\)/g)].map(m => m[1])
        let out = v
        for (const u of urls) {
          const d = await inline(new URL(u, location.href).href)
          if (d) out = out.replace(u, d)
        }
        style.push(`${prop}:${out.replace(/"/g, "'")}`)
        continue
      }
      style.push(`${prop}:${v.replace(/"/g, "'")}`)
    }
    copy.removeAttribute('class')
    copy.removeAttribute('id')
    for (const a of [...copy.attributes]) if (/^(on|data-)/.test(a.name) || a.name === 'srcset' || a.name === 'loading') copy.removeAttribute(a.name)
    copy.setAttribute('style', style.join(';'))
    cs.fontFamily.split(',').forEach(f => families.add(f.trim().replace(/^["']|["']$/g, '')))
    if (copy.tagName === 'IMG') {
      const src = await inline(el.currentSrc || el.src)
      if (src) copy.setAttribute('src', src)
    }
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable || el.getAttribute('role') === 'textbox') copy.setAttribute('data-live', `field-${fieldN++}`)
    else if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') copy.setAttribute('data-live', `button-${buttonN++}`)
    if ('value' in el && el.tagName === 'INPUT') copy.setAttribute('value', el.value)
  }
  frame.remove()

  // The part sits where it was: its own box, the page's ground under it
  const box = root.getBoundingClientRect()
  let ground = 'transparent'
  for (let p = root; p && ground === 'transparent'; p = p.parentElement) {
    const bg = getComputedStyle(p).backgroundColor
    if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) ground = bg
  }
  if (ground === 'transparent') ground = getComputedStyle(document.documentElement).backgroundColor || '#fff'
  clone.setAttribute('style', `${clone.getAttribute('style')};position:relative;left:0;top:0;margin:0;transform:none;width:${box.width}px;height:${box.height}px;box-sizing:border-box`)
  const html = `<div style="width:${box.width}px;height:${box.height}px;background:${ground};overflow:hidden;position:relative">${clone.outerHTML}</div>`

  const css = await fontFaces([...families], inline)
  if (html.length + css.length > maxBytes) return { error: `${Math.round((html.length + css.length) / 1e6)} MB` }
  return {
    html, css, width: Math.round(box.width), height: Math.round(box.height),
    radius: parseFloat(getComputedStyle(root).borderTopLeftRadius) || 0,
    fields: [...clone.querySelectorAll('[data-live]')].map(e => ({ name: e.getAttribute('data-live'), text: (e.getAttribute('placeholder') || e.textContent || '').trim().slice(0, 60) })),
    missing
  }
}

// Runs in the page: the @font-face rules of the families given, their
// fonts inlined as data (read from the page's style sheets, or fetched
// when another origin keeps a sheet from being read). inline(url) → data
// URL or null. Self-contained (it is sent as source)
async function fontFaces(families, inline) {
  const want = new Set(families.map(f => f.replace(/^["']|["']$/g, '').trim()))
  const faces = []
  for (const sheet of document.styleSheets) {
    let text = ''
    try {
      text = [...sheet.cssRules].filter(r => r instanceof CSSFontFaceRule).map(r => r.cssText).join('\n')
    } catch {
      text = sheet.href ? await fetch(sheet.href).then(r => r.text()).catch(() => '') : ''
    }
    const href = sheet.href ?? location.href
    for (const face of text.match(/@font-face\s*{[^}]*}/g) ?? []) {
      const family = face.match(/font-family:\s*["']?([^;"']+)/)?.[1]?.trim()
      if (!family || !want.has(family)) continue
      const src = face.match(/url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/)?.[1] ?? face.match(/url\(["']?([^"')]+)["']?\)/)?.[1]
      if (!src) continue
      const font = await inline(new URL(src, href).href)
      if (font) faces.push(face.replace(/src:[^;]+;?/, `src: url(${font});`))
    }
  }
  return faces.join('\n')
}

// A data URL for an address, fetched in the page. Self-contained
async function toData(src) {
  try {
    const r = await fetch(src)
    if (!r.ok) return null
    const b = await r.blob()
    return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b) })
  } catch {
    // Kept from this page (another origin, gone): left out
    return null
  }
}

// The page's own fonts (heading, body, mono) as a style sheet for a promo:
// their faces inlined, and --brand-head, --brand-body and --brand-mono
// naming them (screens.js draws its words in them). Empty when the page
// serves none it can give
export async function brandFonts(page, { heading, body, mono }) {
  const families = [heading, body, mono].filter(Boolean)
  if (!families.length) return ''
  const faces = await page.evaluate(`(async () => { const toData = ${toData}; return (${fontFaces})(${JSON.stringify(families)}, toData) })()`)
  const name = f => (f ? `'${f.replace(/'/g, '')}', ` : '')
  return `${faces}\n:root {\n  --brand-head: ${name(heading)}var(--head, sans-serif);\n  --brand-body: ${name(body)}var(--font, sans-serif);\n  --brand-mono: ${name(mono)}ui-monospace, 'SF Mono', Menlo, monospace;\n}\n`
}

// The part marked data-shotloop-part="index" in the page, as a live part,
// or { error } saying why it can't be one
export const capturePart = (page, index, { maxNodes = 1500, maxBytes = 6e6 } = {}) =>
  page.evaluate(`(async () => { const fontFaces = ${fontFaces}; return (${serialize})(${index}, ${maxNodes}, ${maxBytes}) })()`)

// Whether a live part looks like its capture (a PNG at `scale`): drawn in
// the page given, both brought down to 96 px wide and compared pixel by
// pixel (mean difference under 6%); a part with an image that couldn't be
// fetched never does
export async function looksTheSame(page, part, png, scale) {
  if (part.missing) return false
  await page.send('Emulation.setDeviceMetricsOverride', { width: Math.max(part.width, 50), height: Math.max(part.height, 50), deviceScaleFactor: scale, mobile: false })
  await page.evaluate(`(async () => {
    document.documentElement.innerHTML = '<head><style>html,body{margin:0}</style></head><body>' + ${JSON.stringify(part.html)} + '</body>'
    const style = document.createElement('style')
    style.textContent = ${JSON.stringify(part.css)}
    document.head.appendChild(style)
    await document.fonts.ready
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})))
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  })()`)
  const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: part.width, height: part.height, scale: 1 } })
  return page.evaluate(`(async () => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
    const [a, b] = await Promise.all([load('data:image/png;base64,${png.toString('base64')}'), load('data:image/png;base64,${data}')])
    const w = 96, h = Math.max(8, Math.round(w * a.height / a.width))
    const pixels = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data }
    const p = pixels(a), q = pixels(b)
    let diff = 0
    for (let i = 0; i < p.length; i += 4) diff += (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2])) / 3
    return diff / (p.length / 4) / 255 < 0.06
  })()`)
}
