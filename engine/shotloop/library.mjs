// The asset library: 3D models searched on free sources, downloaded once
// to a folder on this Mac, and copied into the projects that use them.
//
//   library/<source>-<id>/model.glb   the model (glTF binary)
//   library/<source>-<id>/thumb.jpg   a preview image
//   library/<source>-<id>/asset.json  name, source, license, author, links
//
// Sources: Poly Pizza (low-poly models, CC0 and CC-BY; the person's own
// API key) and the Smithsonian Open Access 3D collection (CC0 scans; an
// api.data.gov key). A project keeps its own copy in assets/<id>/, so it
// travels whole and the library can change without touching its renders.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const LIBRARY = process.env.SHOTLOOP_LIBRARY ?? path.join(os.homedir(), '.shotloop', 'library')
export const SOURCES = ['polypizza', 'smithsonian']

const UA = { 'user-agent': 'Shotloop (https://github.com/chihyungchang/Shotloop)' }
const safe = s => String(s).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(20000) }).catch(e => {
    throw new Error(`could not reach ${new URL(url).host} (${e.cause?.code ?? e.name}): check the network`)
  })
  if (res.status === 401 || res.status === 403) throw new Error(`${new URL(url).host}: the API key was refused (${res.status}); check it in Settings`)
  if (res.status === 429) throw new Error(`${new URL(url).host}: too many requests; try again in a moment`)
  if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// One shape for every source's results
function item(source, o) {
  return {
    id: `${source}-${safe(o.id)}`, source, name: o.name || 'Untitled', thumb: o.thumb ?? null, license: o.license ?? '',
    author: o.author ?? '', authorUrl: o.authorUrl ?? null, page: o.page ?? null, download: o.download,
    triangles: o.triangles ?? null, animated: !!o.animated, size: o.size ?? null
  }
}

// Poly Pizza API v1.1 (poly.pizza/docs/api/v1.1): x-auth-token on every
// request, static.poly.pizza included; 32 results a page; License=1 is
// CC0 only; Category browses without a keyword
const POLY = 'https://api.poly.pizza/v1.1'
const POLY_PAGE = 32
export const POLY_CATEGORIES = ['food', 'clutter', 'weapons', 'transport', 'furniture', 'objects', 'nature', 'animals', 'buildings', 'people', 'scenes', 'other']

async function searchPolyPizza(query, { key, cursor, cc0Only, category }) {
  if (!key) throw new Error('Poly Pizza needs an API key (free, from poly.pizza/settings/api): add it in Settings → Assets')
  const page = Number(cursor ?? 0)
  const params = new URLSearchParams({ Limit: String(POLY_PAGE), Page: String(page) })
  if (cc0Only) params.set('License', '1')
  const cat = POLY_CATEGORIES.indexOf(category)
  if (cat >= 0) params.set('Category', String(cat))
  if (!query.trim() && cat < 0) return { results: [], cursor: null, total: 0 }
  const url = query.trim() ? `${POLY}/search/${encodeURIComponent(query.trim())}?${params}` : `${POLY}/search?${params}`
  const body = await getJson(url, { 'x-auth-token': key })
  const results = (body.results ?? []).map(m => ({
    ...item('polypizza', {
      id: m.ID, name: m.Title, thumb: m.Thumbnail, license: m.Licence ?? m.License ?? '', author: m.Creator?.Username,
      page: `https://poly.pizza/m/${m.ID}`, download: m.Download, triangles: m['Tri Count'] ?? m.TriangleCount, animated: m.Animated
    }),
    attribution: m.Attribution ?? null
  })).filter(m => m.download)
  const total = body.total ?? 0
  return { results, cursor: (page + 1) * POLY_PAGE < total ? String(page + 1) : null, total }
}

// Poly Pizza's files need the key too, so a page can't load its
// thumbnails: they are fetched here, once each, into the library's cache
async function cacheThumbs(results, key) {
  const dir = path.join(LIBRARY, '.cache', 'thumbs')
  fs.mkdirSync(dir, { recursive: true })
  const local = async it => {
    if (!it.thumb || !/^https:\/\/static\.poly\.pizza\//.test(it.thumb)) return it
    const file = path.join(dir, `${createHash('sha1').update(it.thumb).digest('hex')}${path.extname(new URL(it.thumb).pathname) || '.jpg'}`)
    if (!fs.existsSync(file)) {
      try {
        await fetchTo(it.thumb, file, { 'x-auth-token': key })
      } catch {
        return { ...it, thumb: null }
      }
    }
    return { ...it, thumbUrl: it.thumb, thumb: file }
  }
  const out = []
  for (let i = 0; i < results.length; i += 8) out.push(...(await Promise.all(results.slice(i, i + 8).map(local))))
  return out
}

// Merge a resource's attribute objects ([{FILE_TYPE…}, {FILE_SIZE…}])
const attrs = r => Object.assign({}, ...(r.attributes ?? []))

async function searchSmithsonian(query, { key, cursor }) {
  const q = `${query.trim() || '*'} AND online_media_type:"3D Models"`
  const start = Number(cursor ?? 0)
  const params = new URLSearchParams({ q, rows: '24', start: String(start), api_key: key || 'DEMO_KEY' })
  const body = await getJson(`https://api.si.edu/openaccess/api/v1.0/search?${params}`)
  const rows = body.response?.rows ?? []
  const results = []
  for (const row of rows) {
    const d = row.content?.descriptiveNonRepeating ?? {}
    const media = (d.online_media?.media ?? []).filter(m => m.type === '3d_voyager')
    media.forEach((m, i) => {
      // The light GLB: low resolution, not Draco-compressed when there is a choice
      const glbs = (m.resources ?? []).filter(r => attrs(r).MODEL_FILE_TYPE === 'glb' || attrs(r).FILE_TYPE === 'glb')
      const pick = glbs.find(r => r.category === 'Low resolution' && !attrs(r).DRACO_COMPRESSED) ?? glbs.find(r => r.category === 'Low resolution') ?? glbs[0]
      if (!pick) return
      results.push(item('smithsonian', {
        id: `${row.id}${media.length > 1 ? `-${i + 1}` : ''}`, name: row.title ?? d.title?.content, thumb: m.thumbnail,
        license: m.usage?.access ?? d.metadata_usage?.access ?? 'CC0', author: `Smithsonian · ${row.unitCode ?? ''}`.trim(),
        page: d.record_link ?? m.content, download: pick.url, size: attrs(pick).FILE_SIZE ?? null
      }))
    })
  }
  const total = body.response?.rowCount ?? 0
  return { results, cursor: start + rows.length < total ? String(start + rows.length) : null }
}

// Search results are kept on disk for a week: the same search never
// spends the person's API quota twice (Poly Pizza's free plan counts
// requests). Failures are not kept.
const SEARCH_TTL = 7 * 24 * 3600 * 1000

export async function search(source, query, opts = {}) {
  if (!SOURCES.includes(source)) throw new Error(`unknown source ${source} (${SOURCES.join(', ')})`)
  const q = query.trim().toLowerCase()
  // Poly Pizza filters by licence on its side; the filter is part of the key
  const only = v => (opts.cc0Only ? { ...v, results: v.results.filter(m => /^cc0/i.test(m.license)) } : v)
  const poly = source === 'polypizza'
  const key = createHash('sha1').update(JSON.stringify([source, q, opts.cursor ?? null, poly ? [!!opts.cc0Only, opts.category ?? null] : null])).digest('hex')
  const file = path.join(LIBRARY, '.cache', 'search', `${key}.json`)
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < SEARCH_TTL) {
    const v = only(JSON.parse(fs.readFileSync(file, 'utf8')))
    return { ...v, results: poly ? await cacheThumbs(v.results, opts.key) : v.results, cached: true }
  }
  const value = poly ? await searchPolyPizza(q, opts) : await searchSmithsonian(q, opts)
  if (value.results.length || q) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(value))
  }
  const v = only(value)
  return { ...v, results: poly ? await cacheThumbs(v.results, opts.key) : v.results }
}

async function fetchTo(url, file, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(180000) }).catch(e => {
    throw new Error(`could not reach ${new URL(url).host} (${e.cause?.code ?? e.name}): check the network`)
  })
  if (res.status === 401 || res.status === 403) throw new Error(`${new URL(url).host} refused the download (${res.status}); check the API key in Settings`)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${url}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

// Downloads a search result into the library (once); Poly Pizza's files
// need the key
export async function download(it, key) {
  if (!it?.id || !it.download) throw new Error('nothing to download')
  const dir = path.join(LIBRARY, safe(it.id))
  const meta = path.join(dir, 'asset.json')
  if (fs.existsSync(meta)) return JSON.parse(fs.readFileSync(meta, 'utf8'))
  fs.mkdirSync(dir, { recursive: true })
  try {
    const auth = it.source === 'polypizza' && key ? { 'x-auth-token': key } : {}
    await fetchTo(it.download, path.join(dir, 'model.glb'), auth)
    // The thumbnail: the cached copy when the search fetched one
    if (it.thumb && fs.existsSync(it.thumb)) fs.copyFileSync(it.thumb, path.join(dir, 'thumb.jpg'))
    else if (it.thumbUrl ?? it.thumb) await fetchTo(it.thumbUrl ?? it.thumb, path.join(dir, 'thumb.jpg'), auth).catch(() => {})
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw e
  }
  const asset = {
    id: safe(it.id), name: it.name, source: it.source, license: it.license, author: it.author, authorUrl: it.authorUrl,
    page: it.page, attribution: it.attribution ?? null, triangles: it.triangles, animated: it.animated, added: new Date().toISOString()
  }
  fs.writeFileSync(meta, JSON.stringify(asset, null, 2) + '\n')
  return withFiles(asset, dir)
}

function withFiles(asset, dir) {
  const thumb = path.join(dir, 'thumb.jpg')
  return { ...asset, dir, model: path.join(dir, 'model.glb'), thumb: fs.existsSync(thumb) ? thumb : null }
}

function readAssets(base) {
  if (!fs.existsSync(base)) return []
  return fs.readdirSync(base).flatMap(d => {
    const meta = path.join(base, d, 'asset.json')
    if (!fs.existsSync(meta)) return []
    try {
      return [withFiles(JSON.parse(fs.readFileSync(meta, 'utf8')), path.join(base, d))]
    } catch {
      return []
    }
  }).sort((a, b) => String(b.added).localeCompare(String(a.added)))
}

// A model file from this Mac (downloaded by hand from any site) into the
// library; its licence is the person's to state
export function importFile(file, { name, license = '', author = '', page = null } = {}) {
  if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`)
  if (!/\.glb$/i.test(file)) throw new Error('import a .glb file (glTF binary)')
  const base = path.basename(file, path.extname(file))
  // Named after the file and its content, so two "model.glb" files don't collide
  const hash = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8)
  const id = `local-${safe(base)}-${hash}`
  const dir = path.join(LIBRARY, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(file, path.join(dir, 'model.glb'))
  const asset = { id, name: name || base.replace(/[-_]+/g, ' '), source: 'local', license, author, page, added: new Date().toISOString() }
  fs.writeFileSync(path.join(dir, 'asset.json'), JSON.stringify(asset, null, 2) + '\n')
  return withFiles(asset, dir)
}

export const list = () => readAssets(LIBRARY)
export const projectAssets = project => readAssets(path.join(project.root, 'assets'))

export function remove(id) {
  const dir = path.join(LIBRARY, safe(id))
  if (!fs.existsSync(dir)) throw new Error(`no asset ${id}`)
  fs.rmSync(dir, { recursive: true, force: true })
  return { removed: safe(id) }
}

// A library asset into the project (assets/<id>/), for its world to import
export function use(project, id) {
  const from = path.join(LIBRARY, safe(id))
  if (!fs.existsSync(path.join(from, 'asset.json'))) throw new Error(`no asset ${id} in the library`)
  const to = path.join(project.root, 'assets', safe(id))
  fs.cpSync(from, to, { recursive: true })
  return { ...withFiles(JSON.parse(fs.readFileSync(path.join(to, 'asset.json'), 'utf8')), to), path: `assets/${safe(id)}/model.glb` }
}

export function unuse(project, id) {
  fs.rmSync(path.join(project.root, 'assets', safe(id)), { recursive: true, force: true })
  return { removed: safe(id) }
}
