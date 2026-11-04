// The asset library: 3D models and sounds searched on free sources,
// downloaded once to a folder on this Mac, and copied into the projects
// that use them.
//
//   library/<source>-<id>/model.glb   a model (glTF binary), or
//   library/<source>-<id>/sound.<ext> a sound (mp3, ogg, wav…)
//   library/<source>-<id>/thumb.jpg   a model's preview image
//   library/<source>-<id>/asset.json  kind, name, source, license, author, links
//
// Sources: Poly Pizza (low-poly models, CC0 and CC-BY; the person's own
// API key), the Smithsonian Open Access 3D collection (CC0 scans; an
// api.data.gov key) and Openverse (sounds and music from Freesound,
// Wikimedia and Jamendo, CC0 and CC-BY; no key). A project keeps its own
// copy in assets/<id>/, so it travels whole and the library can change
// without touching its renders.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AUDIO_EXTS, POLY_CATEGORIES } from '../data.mjs'
import { request } from '../../lib/fetch.mjs'
import { safeId } from '../project/files.mjs'

const LIBRARY = process.env.SHOTLOOP_LIBRARY ?? path.join(os.homedir(), '.shotloop', 'library')
const SOURCES = ['polypizza', 'smithsonian', 'openverse']

const assetId = s => safeId(s, 'an asset id')

const getJson = async (url, headers = {}) => (await request(url, { headers })).json()

async function fetchTo(url, file, headers = {}) {
  const res = await request(url, { headers, timeout: 180000 })
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

// One shape for every source's results
function item(source, o) {
  return {
    id: `${source}-${assetId(o.id)}`, source, kind: o.kind ?? 'model', name: o.name || 'Untitled', thumb: o.thumb ?? null, license: o.license ?? '',
    author: o.author ?? '', authorUrl: o.authorUrl ?? null, page: o.page ?? null, download: o.download,
    triangles: o.triangles ?? null, animated: !!o.animated, size: o.size ?? null, duration: o.duration ?? null
  }
}

// Poly Pizza API v1.1 (poly.pizza/docs/api/v1.1): x-auth-token on every
// request, static.poly.pizza included; 32 results a page; License=1 is
// CC0 only; Category browses without a keyword
const POLY = 'https://api.poly.pizza/v1.1'
const POLY_PAGE = 32

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
        // A thumbnail that won't load leaves its result without a picture;
        // the search itself still answers
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

// Openverse (api.openverse.org/v1): anonymous requests get 20 results a
// page. Licences: CC0 and public domain only, or CC BY as well (never
// NC/ND/SA, which a film made for anyone to post can't promise)
const OPENVERSE_PAGE = 20
const OV_LICENSE = { cc0: 'CC0', pdm: 'Public domain', by: 'CC-BY' }

async function searchOpenverse(query, { cursor, cc0Only }) {
  if (!query.trim()) return { results: [], cursor: null, total: 0 }
  const page = Number(cursor ?? 1)
  const params = new URLSearchParams({ q: query.trim(), license: cc0Only ? 'cc0,pdm' : 'cc0,pdm,by', page_size: String(OPENVERSE_PAGE), page: String(page), mature: 'false' })
  const body = await getJson(`https://api.openverse.org/v1/audio/?${params}`)
  const results = (body.results ?? []).filter(r => r.url && OV_LICENSE[r.license]).map(r => ({
    ...item('openverse', {
      id: r.id, kind: 'sound', name: r.title, license: `${OV_LICENSE[r.license]}${r.license === 'by' && r.license_version ? ` ${r.license_version}` : ''}`,
      author: [r.creator, r.provider].filter(Boolean).join(' · '), authorUrl: r.creator_url, page: r.foreign_landing_url, download: r.url,
      size: r.filesize, duration: r.duration ? r.duration / 1000 : null
    }),
    attribution: r.attribution ?? null
  }))
  return { results, cursor: page < (body.page_count ?? 0) ? String(page + 1) : null, total: body.result_count ?? 0 }
}

// Search results are kept on disk for a week: the same search never
// spends the person's API quota twice (Poly Pizza's free plan counts
// requests). Failures are not kept.
const SEARCH_TTL = 7 * 24 * 3600 * 1000

export async function search(source, query, opts = {}) {
  if (!SOURCES.includes(source)) throw new Error(`unknown source ${source} (${SOURCES.join(', ')})`)
  const q = query.trim().toLowerCase()
  // Poly Pizza and Openverse filter by licence on their side; the filter is
  // part of the key
  const only = v => (opts.cc0Only ? { ...v, results: v.results.filter(m => /^(cc0|public domain)/i.test(m.license)) } : v)
  const poly = source === 'polypizza'
  const filtered = source !== 'smithsonian'
  const key = createHash('sha1').update(JSON.stringify([source, q, opts.cursor ?? null, filtered ? [!!opts.cc0Only, opts.category ?? null] : null])).digest('hex')
  const file = path.join(LIBRARY, '.cache', 'search', `${key}.json`)
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < SEARCH_TTL) {
    const v = only(JSON.parse(fs.readFileSync(file, 'utf8')))
    return { ...v, results: poly ? await cacheThumbs(v.results, opts.key) : v.results, cached: true }
  }
  const value = await { polypizza: searchPolyPizza, smithsonian: searchSmithsonian, openverse: searchOpenverse }[source](q, opts)
  if (value.results.length || q) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(value))
  }
  const v = only(value)
  return { ...v, results: poly ? await cacheThumbs(v.results, opts.key) : v.results }
}

// A sound's file extension, from its URL or as mp3 (what Openverse's
// providers mostly serve, including Jamendo's "?format=mp32")
function audioExt(url) {
  const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase()
  return AUDIO_EXTS.includes(ext) ? ext : 'mp3'
}

// A sound's length in seconds, from ffmpeg's report on the file (null if
// it can't tell, which only leaves the length off the card)
function audioSeconds(file) {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr ?? ''
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null
}

// Where a sound heard before it was added is kept
const previewFile = url => path.join(LIBRARY, '.cache', 'previews', `${createHash('sha1').update(url).digest('hex')}.${audioExt(url)}`)

// A sound fetched to listen to before it is added (once each); written
// under a name of its own first, so two fetches never share a half file
export async function preview(it) {
  if (it?.kind !== 'sound' || !it.download) throw new Error('only a sound has a preview')
  const file = previewFile(it.download)
  if (!fs.existsSync(file)) {
    const part = `${file}.${process.pid}.part`
    fs.mkdirSync(path.dirname(file), { recursive: true })
    try {
      await fetchTo(it.download, part)
      fs.renameSync(part, file)
    } finally {
      fs.rmSync(part, { force: true })
    }
  }
  return { file }
}

// Downloads a search result into the library (once); Poly Pizza's files
// need the key
export async function download(it, key) {
  if (!it?.id || !it.download) throw new Error('nothing to download')
  const dir = path.join(LIBRARY, assetId(it.id))
  const meta = path.join(dir, 'asset.json')
  if (fs.existsSync(meta)) return withFiles(JSON.parse(fs.readFileSync(meta, 'utf8')), dir)
  const sound = it.kind === 'sound'
  const file = sound ? `sound.${audioExt(it.download)}` : 'model.glb'
  fs.mkdirSync(dir, { recursive: true })
  try {
    const auth = it.source === 'polypizza' && key ? { 'x-auth-token': key } : {}
    // A sound already heard in its preview is that file
    const heard = sound && previewFile(it.download)
    if (heard && fs.existsSync(heard)) fs.copyFileSync(heard, path.join(dir, file))
    else await fetchTo(it.download, path.join(dir, file), auth)
    // The thumbnail: the cached copy when the search fetched one
    if (it.thumb && fs.existsSync(it.thumb)) fs.copyFileSync(it.thumb, path.join(dir, 'thumb.jpg'))
    // A model without its thumbnail is still the model: the library shows
    // a placeholder
    else if (it.thumbUrl ?? it.thumb) await fetchTo(it.thumbUrl ?? it.thumb, path.join(dir, 'thumb.jpg'), auth).catch(() => {})
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw e
  }
  const asset = {
    id: assetId(it.id), kind: sound ? 'sound' : 'model', file, name: it.name, source: it.source, license: it.license, author: it.author, authorUrl: it.authorUrl,
    page: it.page, attribution: it.attribution ?? null, ...(sound
      ? { duration: it.duration ?? audioSeconds(path.join(dir, file)) }
      : { triangles: it.triangles, animated: it.animated }),
    added: new Date().toISOString()
  }
  fs.writeFileSync(meta, JSON.stringify(asset, null, 2) + '\n')
  return withFiles(asset, dir)
}

// An asset with its files' paths; one saved before sounds existed is a model
function withFiles(asset, dir) {
  const kind = asset.kind ?? 'model'
  const thumb = path.join(dir, 'thumb.jpg')
  return { ...asset, kind, dir, file: path.join(dir, asset.file ?? 'model.glb'), thumb: fs.existsSync(thumb) ? thumb : null }
}

function readAssets(base) {
  if (!fs.existsSync(base)) return []
  return fs.readdirSync(base).flatMap(d => {
    const meta = path.join(base, d, 'asset.json')
    if (!fs.existsSync(meta)) return []
    try {
      return [withFiles(JSON.parse(fs.readFileSync(meta, 'utf8')), path.join(base, d))]
    } catch {
      // A folder whose asset.json is broken (edited by hand, cut short) is
      // not an asset: the rest of the library still lists
      return []
    }
  }).sort((a, b) => String(b.added).localeCompare(String(a.added)))
}

// A model or sound file from this Mac (downloaded by hand from any site)
// into the library; its licence is the person's to state
export function importFile(file, { name, license = '', author = '', page = null } = {}) {
  if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`)
  const ext = path.extname(file).slice(1).toLowerCase()
  const sound = AUDIO_EXTS.includes(ext)
  if (!sound && ext !== 'glb') throw new Error(`import a .glb model (glTF binary) or a sound (${AUDIO_EXTS.map(e => `.${e}`).join(', ')})`)
  const base = path.basename(file, path.extname(file))
  // Named after the file and its content, so two "model.glb" files don't collide
  const hash = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8)
  const id = `local-${assetId(base)}-${hash}`
  const dir = path.join(LIBRARY, id)
  const to = sound ? `sound.${ext}` : 'model.glb'
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(file, path.join(dir, to))
  const asset = {
    id, kind: sound ? 'sound' : 'model', file: to, name: name || base.replace(/[-_]+/g, ' '), source: 'local', license, author, page,
    ...(sound ? { duration: audioSeconds(path.join(dir, to)) } : {}), added: new Date().toISOString()
  }
  fs.writeFileSync(path.join(dir, 'asset.json'), JSON.stringify(asset, null, 2) + '\n')
  return withFiles(asset, dir)
}

export const list = () => readAssets(LIBRARY)
export const projectAssets = project => readAssets(path.join(project.root, 'assets'))

export function remove(id) {
  const dir = path.join(LIBRARY, assetId(id))
  if (!fs.existsSync(dir)) throw new Error(`no asset ${id}`)
  fs.rmSync(dir, { recursive: true, force: true })
  return { removed: assetId(id) }
}

// A library asset into the project (assets/<id>/): a model for its world
// to import, a sound for its effects or ambience
export function use(project, id) {
  const from = path.join(LIBRARY, assetId(id))
  if (!fs.existsSync(path.join(from, 'asset.json'))) throw new Error(`no asset ${id} in the library`)
  const to = path.join(project.root, 'assets', assetId(id))
  fs.cpSync(from, to, { recursive: true })
  const asset = withFiles(JSON.parse(fs.readFileSync(path.join(to, 'asset.json'), 'utf8')), to)
  return { ...asset, path: path.relative(project.root, asset.file).split(path.sep).join('/') }
}

export function unuse(project, id) {
  fs.rmSync(path.join(project.root, 'assets', assetId(id)), { recursive: true, force: true })
  return { removed: assetId(id) }
}
