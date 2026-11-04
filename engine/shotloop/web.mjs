// The web, for a plan's facts: a search, and a page read as plain text,
// so every fact can name a page that was read (the "sources-read" rule)
// instead of a source remembered. Search is Wikipedia's (no key), plus
// the whole web when the person has a Tavily or Brave Search key.

import { request } from '../lib/fetch.mjs'

// A page's text is cut to this (about 2,500 tokens): enough for its facts,
// small enough that a local model's context holds several pages
const PAGE_CHARS = 10_000
// Characters around each place a page mentions what was looked for
const AROUND = 700

// Results from every source the person has, the web's first:
// [{ title, url, snippet }]. Wikipedia in another language is searched
// with English beside it: English covers far more, and a model asking in
// the idea's language would otherwise miss it
export async function searchWeb(query, { lang = 'en', tavilyKey = '', braveKey = '' } = {}) {
  const web = tavilyKey ? tavily(query, tavilyKey) : braveKey ? brave(query, braveKey) : Promise.resolve([])
  const langs = lang === 'en' ? ['en'] : [lang, 'en']
  const [found, ...wikis] = await Promise.all([web, ...langs.map(l => wikipedia(query, l))])
  return [...found, ...wikis.flat()]
}

async function wikipedia(query, lang) {
  const host = `${/^[a-z]{2,3}(-[a-z]+)?$/.test(lang) ? lang : 'en'}.wikipedia.org`
  const body = await (await request(`https://${host}/w/rest.php/v1/search/page?${new URLSearchParams({ q: query, limit: '5' })}`, { keyed: false })).json()
  return (body.pages ?? []).map(p => ({
    title: p.title,
    url: `https://${host}/wiki/${encodeURIComponent(p.key)}`,
    snippet: plain(`${p.description ? `${p.description}. ` : ''}${p.excerpt ?? ''}`)
  }))
}

async function tavily(query, key) {
  const res = await request('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 6 })
  })
  return ((await res.json()).results ?? []).map(r => ({ title: r.title, url: r.url, snippet: plain(r.content ?? '') }))
}

async function brave(query, key) {
  const res = await request(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: '6' })}`, {
    headers: { accept: 'application/json', 'x-subscription-token': key }
  })
  return ((await res.json()).web?.results ?? []).map(r => ({ title: r.title, url: r.url, snippet: plain(r.description ?? '') }))
}

// A page as text: its title, the address it was read at (after
// redirects) and its words, the article alone when the page marks one.
// find: only the passages around these words, for a long page
export async function readPage(url, find = '') {
  if (!/^https?:\/\//i.test(url)) throw new Error(`${url} is not a web address (http or https)`)
  const res = await request(url, { headers: { accept: 'text/html,text/plain;q=0.9' }, timeout: 30000, keyed: false })
  const type = res.headers.get('content-type') ?? ''
  if (!/text\/(html|plain)|xhtml/.test(type)) throw new Error(`${url} is not a web page (${type || 'unknown type'}); open the page that links to it`)
  const html = await res.text()
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = /html/.test(type) ? pageText(html) : html.trim()
  if (text.length < 200) throw new Error(`${url} has almost no text without JavaScript; find the fact on another page`)
  return { title, url: res.url || url, text: find ? passages(text, find) : cut(text) }
}

// The words of an HTML page: no scripts, styles, menus or footers; the
// <article> or <main> alone when there is one; a line per block
function pageText(html) {
  let s = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|template)\b[\s\S]*?<\/\1>/gi, ' ')
  for (const tag of ['article', 'main']) {
    const start = s.search(new RegExp(`<${tag}\\b`, 'i'))
    const end = s.toLowerCase().lastIndexOf(`</${tag}>`)
    if (start >= 0 && end > start) {
      s = s.slice(start, end)
      break
    }
  }
  s = s.replace(/<\/?(p|div|section|li|tr|h[1-6]|br|blockquote|table|dd|dt)\b[^>]*>/gi, '\n')
  return plain(s).split('\n').map(l => l.trim()).filter(Boolean).join('\n')
}

// Tags gone, entities decoded, spaces collapsed (lines kept)
function plain(s) {
  return s.replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, e) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" })[e])
    .replace(/[ \t\r\f\v]+/g, ' ')
    .trim()
}

const cut = text => (text.length > PAGE_CHARS ? `${text.slice(0, PAGE_CHARS)}\n…(the page goes on; read it again with "find" for a part further down)` : text)

// The passages that mention any of the words looked for, in page order
function passages(text, find) {
  const words = find.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  const lower = text.toLowerCase()
  const spans = []
  for (const w of words) {
    for (let i = lower.indexOf(w); i >= 0 && spans.length < 40; i = lower.indexOf(w, i + w.length)) spans.push([Math.max(0, i - AROUND), Math.min(text.length, i + AROUND)])
  }
  if (!spans.length) return `Nothing on the page mentions "${find}".`
  spans.sort((a, b) => a[0] - b[0])
  const merged = spans.reduce((out, s) => {
    const last = out.at(-1)
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1])
    else out.push([...s])
    return out
  }, [])
  return cut(merged.map(([a, b]) => `…${text.slice(a, b)}…`).join('\n\n'))
}

// An address as compared: no scheme, "www.", fragment or trailing slash,
// percent-escapes decoded, so a page read and the source naming it match
export function sameAddress(url) {
  let s = String(url).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/#.*$/, '').replace(/\/+$/, '')
  try {
    s = decodeURI(s)
  } catch {
    // A malformed escape: compared as written
  }
  const slash = s.indexOf('/')
  return slash < 0 ? s.toLowerCase() : s.slice(0, slash).toLowerCase() + s.slice(slash)
}
