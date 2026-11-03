// A product page, read into a promo project: what it says (name, tagline,
// features, pricing), how it looks (logo, theme colors, fonts) and its
// sections captured in high resolution and framed as windows (frame.mjs),
// so the plan has the product's own words and the shots its own screens.
//
//   site/brief.json        what was read, as data
//   site/brief.md          the product brief the plan starts from
//   site/hero.png          the first screen as a visitor sees it (3x)
//   site/page.png          the page from the top, up to four screens (2x)
//   site/logo.png          the logo as the page shows it, when one was found
//   site/sections/NN-*.png each section of the page (3x)
//   site/framed/NN-*.png   the hero and the sections in a window (3x)
//   site/parts/NN-*.png    its parts on their own (3x): the main field and
//                          button, the feature and pricing cards
//   site/live/NN-*.json    the same parts as live HTML (live.mjs), where
//                          they carry over faithfully
//   site/fonts.css         the page's own fonts, inlined, as --brand-head,
//                          --brand-body and --brand-mono (screens.js)
//
// Captures are at 3x, so a close-up of 2× in a 1080p film stays sharp.
//
// Written into a temporary folder and moved into place, so a reading cut
// short leaves the last complete one.

import fs from 'node:fs'
import path from 'node:path'
import { openPage, sleep } from '../lib/chrome.mjs'
import { writeJson } from './files.mjs'
import { frameWindow } from './frame.mjs'
import { SITE_DIR } from './images.mjs'
import { brandFonts, capturePart, looksTheSame } from './live.mjs'

const W = 1440
const H = 900
const SCALE = 3
// The whole-page capture, a pan's material
const PAGE_SCALE = 2
const MAX_SECTIONS = 8
const MAX_PARTS = 8
// Screens of the whole-page capture (at 1x: a pan's material, not a
// close-up's)
const PAGE_SCREENS = 4
const LOAD_TIMEOUT = 45000

// An address as typed ("example.com") made whole
export function siteUrl(text) {
  const s = String(text ?? '').trim()
  if (!s) return null
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`)
  if (!/^https?:$/.test(url.protocol)) throw new Error('a product page is an http or https address')
  return url.href
}

// Runs in the page: everything it says and shows that a promo can use.
// Self-contained (it is sent as source)
function readPage(maxSections, maxParts) {
  const vw = innerWidth
  // Text as read, once: a heading often repeats itself for screen readers
  const clean = s => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim()
    const half = t.slice(0, (t.length - 1) / 2)
    return t.length % 2 && t === `${half} ${half}` ? half : t
  }
  const visible = el => {
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05
  }
  const inChrome = el => !!el.closest('nav, footer, [role="navigation"], [aria-hidden="true"]')
  const meta = name => clean(document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.content)
  const box = (el, tight = false) => {
    // tight: what the element draws (its content), not its box
    const range = document.createRange()
    range.selectNodeContents(el)
    const r = tight && el.tagName !== 'IMG' && range.getBoundingClientRect().width ? range.getBoundingClientRect() : el.getBoundingClientRect()
    return { x: Math.max(0, Math.round(r.left + scrollX)), y: Math.round(r.top + scrollY), width: Math.round(Math.min(r.width, vw)), height: Math.round(r.height) }
  }

  // Colors: rgb() → #rrggbb, and how colorful one is
  const hex = c => {
    const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null
    return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')
  }
  const chroma = h => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    return Math.max(r, g, b) - Math.min(r, g, b)
  }

  const h1 = [...document.querySelectorAll('h1')].find(visible)
  const tagline = clean(h1?.innerText)
  // The line under the headline: the first paragraph after it
  let sub = ''
  if (h1) {
    const after = [...document.querySelectorAll('p')].find(p => visible(p) && (h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) && clean(p.innerText).length > 20)
    sub = clean(after?.innerText).slice(0, 300)
  }

  // Features: headings below the hero with the text that follows them
  const features = []
  for (const h of document.querySelectorAll('h2, h3, h4')) {
    // Below the first screen: headings in it belong to the hero's demo
    if (features.length >= 12 || !visible(h) || inChrome(h) || box(h).y < innerHeight * 0.9) continue
    const title = clean(h.innerText)
    if (!title || title.length > 90 || features.some(f => f.title === title)) continue
    let text = ''
    for (let el = h.nextElementSibling ?? h.parentElement?.nextElementSibling; el && !text; el = el.nextElementSibling) {
      if (/^H[1-4]$/.test(el.tagName)) break
      text = clean(el.innerText).slice(0, 240)
    }
    features.push({ title, text })
  }

  // Pricing: cards that show a price, each with its name and what it lists
  const PRICE = /(?:[$€£¥₹]|US\$|USD|EUR)\s?\d[\d.,]*|\d[\d.,]*\s?(?:[$€£¥₹]|USD|EUR|元)|\bfree\b|免费/i
  const plans = []
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    // A price stands alone ("$8 /mo", "Free"); a sentence that says free is not one
    const label = (el.textContent ?? '').trim()
    if (plans.length >= 4 || el.children.length || label.length > 24 || !PRICE.test(label) || !visible(el) || inChrome(el)) continue
    let card = el
    while (card.parentElement && card.parentElement !== document.body) {
      const r = card.parentElement.getBoundingClientRect()
      if (r.width > vw * 0.5 || r.height > 900) break
      card = card.parentElement
    }
    const r = card.getBoundingClientRect()
    if (card === el || r.height < 120 || seen.has(card)) continue
    seen.add(card)
    const name = clean(card.querySelector('h1, h2, h3, h4, h5, strong, b')?.innerText)
    const items = [...card.querySelectorAll('li')].map(li => clean(li.innerText)).filter(Boolean).slice(0, 6)
    plans.push({ name, price: clean(el.textContent).slice(0, 40), items })
  }

  // The logo: an image or drawing named so, else the home link's picture
  const header = document.querySelector('header, nav, [role="banner"]') ?? document.body
  const named = [...header.querySelectorAll('img, svg, [class*="logo" i], [id*="logo" i]')]
    .find(el => visible(el) && /logo|brand/i.test([el.getAttribute('alt'), el.getAttribute('class'), el.id, el.getAttribute('src'), el.getAttribute('aria-label')].join(' ')))
  const home = [...header.querySelectorAll('a[href="/"], a[href="./"], a[href^="' + location.origin + '"]')].find(visible)
  const logoEl = named ?? home?.querySelector('img, svg') ?? null
  const logoBox = logoEl ? box(logoEl, true) : null

  // Theme colors: the colorful fills of buttons and links, by area
  const weight = new Map()
  for (const el of document.querySelectorAll('a, button, [class*="btn" i], [class*="button" i]')) {
    if (!visible(el)) continue
    const st = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    for (const [c, w] of [[hex(st.backgroundColor), r.width * r.height], [hex(st.color), r.width * 4]]) {
      if (c && chroma(c) > 0.25) weight.set(c, (weight.get(c) ?? 0) + w)
    }
  }
  const themeColor = meta('theme-color')
  const colors = [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3)
  const background = hex(getComputedStyle(document.body).backgroundColor) ?? hex(getComputedStyle(document.documentElement).backgroundColor) ?? '#ffffff'
  const text = hex(getComputedStyle(h1 ?? document.body).color)
  const family = el => clean(getComputedStyle(el).fontFamily.split(',')[0]).replace(/^["']|["']$/g, '')

  // Sections: full-width blocks, the finest split that still holds a
  // whole part of the page, top to bottom
  const blocks = [...document.querySelectorAll('body *')].filter(el => {
    if (!visible(el) || ['fixed', 'sticky'].includes(getComputedStyle(el).position)) return false
    const r = el.getBoundingClientRect()
    return r.width >= vw * 0.9 && r.height >= 280 && r.height <= 2400
  })
  // Of a block and its near-twin inside it, the outer one (it carries the
  // background)
  const outer = blocks.filter(el => !blocks.some(p => p !== el && p.contains(el) && p.getBoundingClientRect().height <= el.getBoundingClientRect().height * 1.15))
  const finest = outer.filter(el => !outer.some(c => c !== el && el.contains(c)))
  const sections = []
  for (const el of finest.sort((a, b) => box(a).y - box(b).y)) {
    const b = box(el)
    if (sections.length >= maxSections || b.y < innerHeight * 0.6) continue
    if (sections.some(s => b.y < s.box.y + s.box.height)) continue
    // Its heading, or the one just above it
    const above = [...document.querySelectorAll('h2, h3')].filter(h => visible(h) && box(h).y <= b.y && box(h).y > b.y - 300).at(-1)
    const heading = clean((el.querySelector('h1, h2, h3') ?? above)?.innerText).slice(0, 60)
    sections.push({ name: heading, box: b })
  }

  // Parts: the main button of the first screen, then cards (a box of its
  // own, a heading or a picture in it), the outermost of nested ones
  const ground = hex(getComputedStyle(document.body).backgroundColor)
  const boxed = el => {
    const st = getComputedStyle(el)
    const fill = hex(st.backgroundColor)
    return parseFloat(st.borderTopLeftRadius) >= 6 && ((fill && fill !== ground) || st.boxShadow !== 'none' || parseFloat(st.borderTopWidth) > 0)
  }
  const parts = []
  const cta = [...document.querySelectorAll('a, button')].find(el => {
    if (!visible(el) || inChrome(el)) return false
    const r = el.getBoundingClientRect()
    const fill = hex(getComputedStyle(el).backgroundColor)
    return r.top + scrollY < innerHeight && r.width >= 80 && r.width <= 420 && r.height >= 32 && fill && fill !== ground
  })
  if (cta) parts.push({ el: cta, name: clean(cta.innerText).slice(0, 40) || 'button', kind: 'button', box: box(cta) })
  // The page's main field (a search, a sign-up, a prompt), with its box
  const input = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable="true"]')]
    .find(el => visible(el) && !inChrome(el) && el.getBoundingClientRect().width >= 200)
  const holder = input && (input.closest('form') ?? input.parentElement)
  if (holder && holder.getBoundingClientRect().width <= vw * 0.8 && !parts.some(p => p.el.contains(holder) || holder.contains(p.el))) {
    parts.push({ el: holder, name: clean(input.getAttribute('placeholder') || input.getAttribute('aria-label')).slice(0, 40) || 'field', kind: 'field', box: box(holder) })
  }
  const cards = [...document.querySelectorAll('main *, section *, body > div *')].filter(el => {
    if (!visible(el) || inChrome(el) || !boxed(el)) return false
    const r = el.getBoundingClientRect()
    return r.width >= 220 && r.width <= vw * 0.6 && r.height >= 120 && r.height <= 760 && el.querySelector('h2, h3, h4, img, svg, video, canvas')
  })
  for (const el of cards) {
    if (parts.length >= maxParts) break
    if (cards.some(o => o !== el && o.contains(el)) || parts.some(p => p.el.contains(el) || el.contains(p.el))) continue
    // Its heading, else its first line of text
    const heading = clean(el.querySelector('h2, h3, h4, strong')?.innerText || el.innerText.split('\n').find(l => l.trim())).slice(0, 50)
    parts.push({ el, name: heading || 'card', kind: PRICE.test(el.innerText) ? 'pricing card' : 'card', box: box(el) })
  }

  // Marked, so live.mjs finds each part again
  parts.forEach((p, i) => p.el.setAttribute('data-shotloop-part', String(i)))
  return {
    url: location.href,
    parts: parts.map(({ name, kind, box }) => ({ name, kind, box })),
    host: location.host.replace(/^www\./, ''),
    name: meta('og:site_name') || clean(document.title.split(/\s[|–—-]\s/)[0]),
    title: clean(document.title),
    description: meta('description') || meta('og:description'),
    tagline,
    sub,
    features,
    pricing: plans,
    logoBox,
    icon: document.querySelector('link[rel="apple-touch-icon"], link[rel~="icon"]')?.href ?? null,
    colors: { theme: themeColor || null, accents: colors, background, text },
    fonts: {
      heading: h1 ? family(h1) : null,
      body: family(document.body),
      // A code face, where the page sets one
      mono: (() => { const el = [...document.querySelectorAll('code, pre, kbd, [class*="mono" i]')].find(visible); return el ? family(el) : null })()
    },
    pageHeight: document.documentElement.scrollHeight,
    sections
  }
}

// Cookie and consent banners cover what is captured: their accept button
// is pressed when one is found (best effort; a page without one is as it is)
const DISMISS = `(() => {
  const words = /^(accept( all)?|agree|allow( all)?|got it|ok(ay)?|i understand|同意|接受|全部接受|知道了)$/i
  for (const b of document.querySelectorAll('[class*="cookie" i] button, [id*="cookie" i] button, [class*="consent" i] button, [id*="consent" i] button, [class*="gdpr" i] button'))
    if (words.test(b.innerText.trim())) b.click()
})()`

// Through the page and back, so lazy images load and scroll animations run
const SCROLL = `(async () => {
  const step = innerHeight * 0.8
  for (let y = 0; y < document.documentElement.scrollHeight && y < 40000; y += step) {
    scrollTo(0, y)
    await new Promise(r => setTimeout(r, 250))
  }
  scrollTo(0, 0)
  await document.fonts.ready
  await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000) })))
})()`

const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'section'

// The brief the plan reads: what the page says, how it looks, the pictures
function briefMarkdown(info, pictures) {
  const lines = [`# ${info.name || info.host}: product brief`, '', `Read from ${info.url} on ${new Date().toISOString().slice(0, 10)}. The page's own words: quote them, don't add claims it doesn't make.`, '']
  if (info.tagline) lines.push('## Tagline', '', info.tagline, ...(info.sub ? ['', info.sub] : []), '')
  if (info.description && info.description !== info.sub) lines.push('## Description', '', info.description, '')
  if (info.features.length) lines.push('## Features', '', ...info.features.map(f => `- **${f.title}**${f.text ? `: ${f.text}` : ''}`), '')
  if (info.pricing.length) lines.push('## Pricing', '', ...info.pricing.map(p => `- ${p.name ? `**${p.name}**: ` : ''}${p.price}${p.items.length ? ` (${p.items.join('; ')})` : ''}`), '')
  const c = info.colors
  lines.push('## Brand', '',
    `- Colors: ${[c.theme && `theme ${c.theme}`, c.accents.length && `accents ${c.accents.join(', ')}`, `background ${c.background}`, c.text && `text ${c.text}`].filter(Boolean).join('; ')}`,
    `- Fonts: ${[info.fonts.heading && `headings ${info.fonts.heading}`, info.fonts.body && `body ${info.fonts.body}`].filter(Boolean).join('; ') || 'not found'}`,
    `- Logo: ${pictures.logo ?? 'not found'}`, '')
  lines.push('## Pictures', '', ...pictures.list.map(p => `- ${p.file} (${p.width}×${p.height}${p.file.endsWith('.json') ? ' CSS' : ''} px): ${p.what}`), '')
  return lines.join('\n')
}

// Reads the page at url into the project's site/. onStep(message, done,
// total) reports each step; done and total once the sections are known
export async function readSite(root, url, onStep = () => {}) {
  url = siteUrl(url)
  if (!url) throw new Error('no product page to read')
  const final = path.join(root, SITE_DIR)
  const tmp = path.join(root, `.${SITE_DIR}-${process.pid}`)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(path.join(tmp, 'sections'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'framed'), { recursive: true })
  const page = await openPage({ width: W, height: H, scale: SCALE })
  try {
    // A headless browser says so in its user agent, and some sites turn it away
    const ua = await page.evaluate('navigator.userAgent')
    await page.send('Network.setUserAgentOverride', { userAgent: ua.replace('HeadlessChrome', 'Chrome') })
    onStep(`opening ${url}`)
    await withTimeout(page.goto(url), LOAD_TIMEOUT, `${url} did not finish loading in ${LOAD_TIMEOUT / 1000} s`)
    await page.evaluate(DISMISS)
    await page.evaluate(SCROLL)
    await sleep(600)
    const info = await page.evaluate(`(${readPage})(${MAX_SECTIONS}, ${MAX_PARTS})`)
    const shots = [{ name: 'hero', box: { x: 0, y: 0, width: W, height: H } }, ...info.sections]
    const total = shots.length + 3
    const list = []
    let done = 0
    // The window's bar follows the page: light on a light page
    const dark = luminance(info.colors.background) < 0.4

    onStep('capturing the page', ++done, total)
    await page.screenshot(path.join(tmp, 'hero.png'), { x: 0, y: 0, width: W, height: H })
    list.push({ file: `${SITE_DIR}/hero.png`, width: W * SCALE, height: H * SCALE, what: 'the first screen, as a visitor lands on it' })
    let logo = null
    if (info.logoBox && info.logoBox.width >= 8 && info.logoBox.height >= 8) {
      const pad = 8
      const b = info.logoBox
      await page.screenshot(path.join(tmp, 'logo.png'), { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 })
      logo = `${SITE_DIR}/logo.png`
      list.push({ file: logo, width: (b.width + pad * 2) * SCALE, height: (b.height + pad * 2) * SCALE, what: 'the logo, on the page\'s own background' })
    }
    // The whole page (a pan runs over it); four screens at most
    const pageH = Math.min(info.pageHeight, H * PAGE_SCREENS)
    await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: PAGE_SCALE, mobile: false })
    await page.screenshot(path.join(tmp, 'page.png'), { x: 0, y: 0, width: W, height: pageH })
    list.push({ file: `${SITE_DIR}/page.png`, width: W * PAGE_SCALE, height: pageH * PAGE_SCALE, what: 'the page from the top, for a pan down it' })
    await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false })

    const fonts = await brandFonts(page, info.fonts)
    if (fonts.includes('@font-face')) fs.writeFileSync(path.join(tmp, 'fonts.css'), fonts)

    onStep('capturing its parts', ++done, total)
    const livePending = []
    fs.mkdirSync(path.join(tmp, 'parts'), { recursive: true })
    for (const [i, part] of info.parts.entries()) {
      const name = `${String(i + 1).padStart(2, '0')}-${slug(part.name)}.png`
      await page.screenshot(path.join(tmp, 'parts', name), part.box)
      list.push({ file: `${SITE_DIR}/parts/${name}`, width: part.box.width * SCALE, height: part.box.height * SCALE, what: `a ${part.kind} on its own: "${part.name}"` })
      // The same part as live HTML, checked against this capture below
      const live = await capturePart(page, i)
      if (!live.error) livePending.push({ name: name.replace(/\.png$/, ''), png: path.join(tmp, 'parts', name), part: live })
    }

    onStep('capturing its sections', ++done, total)
    const raw = []
    for (const [i, s] of shots.entries()) {
      const name = `${String(i).padStart(2, '0')}-${i === 0 ? 'hero' : slug(s.name)}.png`
      const file = path.join(tmp, 'sections', name)
      await page.screenshot(file, s.box)
      raw.push({ name, s })
    }
    // A second page frames them: the product page stays as it was read.
    // It also drops parts that came out blank (drawn live, on a canvas or
    // a video, they capture empty)
    const framer = await openPage({ width: W, height: H, scale: SCALE })
    try {
      for (const p of list.filter(p => p.file.startsWith(`${SITE_DIR}/parts/`))) {
        const file = path.join(tmp, path.relative(SITE_DIR, p.file))
        if (!(await isBlank(framer, file))) continue
        fs.rmSync(file)
        list.splice(list.indexOf(p), 1)
      }
      // Live parts that look like their capture (and whose capture wasn't blank)
      fs.mkdirSync(path.join(tmp, 'live'), { recursive: true })
      for (const { name, png, part } of livePending) {
        if (!fs.existsSync(png) || !(await looksTheSame(framer, part, fs.readFileSync(png), SCALE))) continue
        const { missing, ...kept } = part
        writeJson(path.join(tmp, 'live', `${name}.json`), kept)
        const fields = part.fields.filter(f => f.name.startsWith('field-')).map(f => `${f.name}${f.text ? ` ("${f.text}")` : ''}`)
        list.push({ file: `${SITE_DIR}/live/${name}.json`, width: part.width, height: part.height, what: `the part ${name} as live HTML (CSS px, sharp at any size)${fields.length ? `; fields: ${fields.join(', ')}` : ''}` })
      }
      for (const { name, s } of raw) {
        const size = await frameWindow(framer, path.join(tmp, 'sections', name), path.join(tmp, 'framed', name), { scale: SCALE, title: info.host, dark })
        list.push({ file: `${SITE_DIR}/framed/${name}`, ...size, what: `${name.startsWith('00-') ? 'the first screen' : `the section "${s.name || 'untitled'}"`} in a browser window (transparent around it)` })
        onStep('framing the sections', ++done, total)
      }
    } finally {
      await framer.close()
    }

    const brief = { ...info, read: new Date().toISOString(), logo, pictures: list }
    writeJson(path.join(tmp, 'brief.json'), brief)
    fs.writeFileSync(path.join(tmp, 'brief.md'), briefMarkdown(info, { logo, list }))
    fs.rmSync(final, { recursive: true, force: true })
    fs.renameSync(tmp, final)
    return brief
  } finally {
    await page.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// A picture of one flat color, near enough: its pixels barely vary
async function isBlank(page, file) {
  const data = fs.readFileSync(file).toString('base64')
  return page.evaluate(`(async () => {
    const img = new Image()
    img.src = 'data:image/png;base64,${data}'
    await img.decode()
    const c = document.createElement('canvas')
    c.width = c.height = 48
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, 48, 48)
    const px = g.getImageData(0, 0, 48, 48).data
    let sum = 0, sq = 0
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
      sum += l
      sq += l * l
    }
    const n = px.length / 4
    return Math.sqrt(sq / n - (sum / n) ** 2) < 6
  })()`)
}

function withTimeout(promise, ms, message) {
  let timer
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([promise, late]).finally(() => clearTimeout(timer))
}

// 0 (black) to 1 (white)
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
