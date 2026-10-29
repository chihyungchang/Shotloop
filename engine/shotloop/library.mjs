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

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const LIBRARY = process.env.SHOTLOOP_LIBRARY ?? path.join(os.homedir(), '.shotloop', 'library')
export const SOURCES = ['polypizza', 'smithsonian']

const UA = { 'user-agent': 'Shotloop (https://github.com/chihyungchang/Shotloop)' }
const safe = s => String(s).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(20000) })
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

async function searchPolyPizza(query, { key, cursor, cc0Only }) {
  if (!key) throw new Error('Poly Pizza needs an API key (free, from poly.pizza/settings/api): add it in Settings → Assets')
  const params = new URLSearchParams({ limit: '30', format: 'glb' })
  if (cursor) params.set('cursor', cursor)
  const path_ = query.trim() ? `search/${encodeURIComponent(query.trim())}` : 'popular'
  const body = await getJson(`https://api.poly.pizza/v1/${path_}?${params}`, { 'x-auth-token': key })
  const results = (body.results ?? []).map(m => item('polypizza', {
    id: m.ID, name: m.Title, thumb: m.Thumbnail, license: m.Licence ?? m.License ?? '', author: m.Creator?.Username,
    authorUrl: m.Creator?.PURL, page: `https://poly.pizza/m/${m.ID}`, download: m.Download, triangles: m.TriangleCount, animated: m.Animated
  })).filter(m => m.download && (!cc0Only || /^cc0/i.test(m.license)))
  return { results, cursor: body.cursor ?? null }
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

export async function search(source, query, opts = {}) {
  if (source === 'polypizza') return searchPolyPizza(query, opts)
  if (source === 'smithsonian') return searchSmithsonian(query, opts)
  throw new Error(`unknown source ${source} (${SOURCES.join(', ')})`)
}

async function fetchTo(url, file) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(180000) })
  if (!res.ok) throw new Error(`download failed: ${res.status} ${url}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

// Downloads a search result into the library (once)
export async function download(it) {
  if (!it?.id || !it.download) throw new Error('nothing to download')
  const dir = path.join(LIBRARY, safe(it.id))
  const meta = path.join(dir, 'asset.json')
  if (fs.existsSync(meta)) return JSON.parse(fs.readFileSync(meta, 'utf8'))
  fs.mkdirSync(dir, { recursive: true })
  try {
    await fetchTo(it.download, path.join(dir, 'model.glb'))
    if (it.thumb) await fetchTo(it.thumb, path.join(dir, 'thumb.jpg')).catch(() => {})
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw e
  }
  const asset = {
    id: safe(it.id), name: it.name, source: it.source, license: it.license, author: it.author, authorUrl: it.authorUrl,
    page: it.page, triangles: it.triangles, animated: it.animated, added: new Date().toISOString()
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
