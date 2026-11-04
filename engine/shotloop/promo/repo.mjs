// A product's repository, read into a promo project: what the product is
// and does in its makers' own words (its README, docs, changelog and
// releases) and the pictures it keeps of itself (screenshots in its docs),
// so the plan tells the product's story from its facts. A GitHub address
// is read through GitHub's API (GITHUB_TOKEN raises its limit); a folder
// on this Mac is read as it is. GitHub's API answers 60 requests an hour
// without a token: the person's own (GITHUB_TOKEN, or the GitHub CLI's
// login, which also opens their private repositories) is used when there
// is one, and when the API still turns the reading away, the repository
// is cloned shallowly (no large files) and read as a folder.
//
//   repo/brief.md          the repository's own words, trimmed
//   repo/repo.json         what was read: name, description, files, pictures
//   repo/pictures/*.png|jpg  its screenshots
//   repo/logo.png          its logo (the app's icon), when it keeps one
//
// Written into a temporary folder and moved into place, so a reading cut
// short leaves the last complete one.

import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeJson } from '../project/files.mjs'
import { imageSize } from './images.mjs'

export const REPO_DIR = 'repo'
const API = 'https://api.github.com'
const MAX_DOCS = 8
const MAX_DOC_BYTES = 60_000
const MAX_PICTURES = 12
const MAX_PICTURE_BYTES = 8 << 20
// Pictures narrower than this are icons and badges, not screens
const MIN_PICTURE_WIDTH = 600
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'vendor', '.next', 'out', 'coverage', '.shotloop', '__pycache__'])

// "github.com/owner/name" in any of its spellings → { owner, name }
export function githubRepo(text) {
  const m = String(text ?? '').trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/i)
  return m ? { owner: m[1], name: m[2] } : null
}

// What a promo's repository setting names: a GitHub repository or a folder
export function repoSource(text) {
  const s = String(text ?? '').trim()
  if (!s) return null
  if (githubRepo(s)) return { kind: 'github', ...githubRepo(s), label: `github.com/${githubRepo(s).owner}/${githubRepo(s).name}` }
  if (path.isAbsolute(s) && fs.existsSync(s) && fs.statSync(s).isDirectory()) return { kind: 'folder', dir: s, label: path.basename(s) }
  throw new Error('a repository is a github.com address or a folder on this Mac')
}

// Docs worth reading, in order: the changelog, then docs/ pages by name
const isDoc = f => /\.(md|mdx|markdown|txt)$/i.test(f) && !/(^|\/)(node_modules|test|tests|fixtures|examples?)\//i.test(f) && !/(license|code_of_conduct|contributing|security)\b/i.test(path.basename(f))
const docRank = f => (/changelog|releases?|history/i.test(f) ? 0 : /^docs?\//i.test(f) ? 1 : /readme/i.test(path.basename(f)) ? 3 : 2)
// The product's logo or app icon: a PNG named so, never a favicon, a tray
// or a badge; one under a logo name or folder first, then the largest
const isLogo = f => /\.png$/i.test(f) && /(logo|icon)/i.test(path.basename(f)) && !/(favicon|tray|badge|sponsor|avatar|social)/i.test(f)
const logoRank = f => (/logo/i.test(f.path) ? 0 : 1)
// A logo is square-ish and big enough to show large
const MIN_LOGO = 256
const isPicture = f => /\.(png|jpe?g)$/i.test(f) && /(screen|shot|preview|demo|hero|ui|app|docs?\/|images?\/|assets?\/)/i.test(f) && !/(icon|logo|badge|favicon|avatar|sponsor)/i.test(path.basename(f))

// Markdown made readable for the plan: no badges, no HTML, no long tables
const tidy = text => String(text)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
const trim = (text, n) => (text.length > n ? `${text.slice(0, n)}\n…(cut)` : text)

// ---- GitHub ----

// The person's GitHub token: GITHUB_TOKEN, else the GitHub CLI's login
let token
function githubToken() {
  if (token !== undefined) return token
  token = process.env.GITHUB_TOKEN || null
  if (!token) {
    try {
      token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
    } catch {
      // No GitHub CLI, or not logged in: the API is asked without a token
      token = null
    }
  }
  return token
}

class Limited extends Error {}

async function github(url, raw = false) {
  const headers = { 'User-Agent': 'Shotloop', Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json' }
  if (githubToken()) headers.Authorization = `Bearer ${githubToken()}`
  const res = await fetch(url, { headers })
  if (res.status === 403 || res.status === 429) throw new Limited('GitHub turned the request away (its hourly limit)')
  if (!res.ok) throw new Error(`GitHub: ${res.status} for ${url.replace(API, '')}`)
  return raw ? res.text() : res.json()
}

async function readGithub({ owner, name }) {
  const base = `${API}/repos/${owner}/${name}`
  const meta = await github(base)
  const branch = meta.default_branch
  const readme = await github(`${base}/readme`, true).catch(() => '')
  const releases = await github(`${base}/releases?per_page=5`).catch(() => [])
  const tree = (await github(`${base}/git/trees/${branch}?recursive=1`).catch(() => ({ tree: [] }))).tree ?? []
  const files = tree.filter(e => e.type === 'blob')
  const docs = []
  for (const f of files.filter(e => isDoc(e.path) && e.size <= MAX_DOC_BYTES && !/^readme/i.test(e.path)).sort((a, b) => docRank(a.path) - docRank(b.path)).slice(0, MAX_DOCS)) {
    const text = await github(`${base}/contents/${encodeURIComponent(f.path).replace(/%2F/g, '/')}?ref=${branch}`, true).catch(() => null)
    if (text) docs.push({ file: f.path, text })
  }
  // With the token too: a private repository's files are 404 without it
  const auth = githubToken() ? { headers: { Authorization: `Bearer ${githubToken()}` } } : {}
  const raw = e => ({ file: e.path, fetch: () => fetch(`https://raw.githubusercontent.com/${owner}/${name}/${branch}/${e.path}`, auth).then(r => (r.ok ? r.arrayBuffer() : null)) })
  const pictures = files.filter(e => isPicture(e.path) && e.size <= MAX_PICTURE_BYTES).sort((a, b) => b.size - a.size).map(raw)
  const logos = logosOf(files).map(raw)
  return {
    name: meta.name, description: meta.description ?? '', homepage: meta.homepage ?? '', topics: meta.topics ?? [], license: meta.license?.spdx_id ?? '',
    readme, docs, pictures, logos,
    releases: releases.map(r => ({ name: r.name || r.tag_name, date: (r.published_at ?? '').slice(0, 10), body: r.body ?? '' }))
  }
}

// ---- A folder ----

function walk(dir, rel = '', out = [], depth = 0) {
  if (depth > 6 || out.length > 4000) return out
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) walk(dir, r, out, depth + 1)
    else if (e.isFile()) out.push({ path: r, size: fs.statSync(path.join(dir, r)).size })
  }
  return out
}

function readFolder({ dir }) {
  const files = walk(dir)
  const read = f => fs.readFileSync(path.join(dir, f), 'utf8')
  const readmeFile = files.find(f => /^readme(\.md|\.markdown|\.txt)?$/i.test(f.path))
  const pkg = files.some(f => f.path === 'package.json') ? JSON.parse(read('package.json')) : {}
  return {
    name: pkg.name ?? path.basename(dir), description: pkg.description ?? '', homepage: pkg.homepage ?? '', topics: pkg.keywords ?? [], license: pkg.license ?? '',
    readme: readmeFile ? read(readmeFile.path) : '',
    docs: files.filter(f => isDoc(f.path) && f.size <= MAX_DOC_BYTES && f !== readmeFile && !/^readme/i.test(path.basename(f.path)))
      .sort((a, b) => docRank(a.path) - docRank(b.path)).slice(0, MAX_DOCS).map(f => ({ file: f.path, text: read(f.path) })),
    pictures: files.filter(f => isPicture(f.path) && f.size <= MAX_PICTURE_BYTES).sort((a, b) => b.size - a.size)
      .map(f => ({ file: f.path, fetch: async () => fs.readFileSync(path.join(dir, f.path)) })),
    logos: logosOf(files).map(f => ({ file: f.path, fetch: async () => fs.readFileSync(path.join(dir, f.path)) })),
    releases: []
  }
}

// The files that may be the logo, the likeliest first
const logosOf = files => files.filter(f => isLogo(f.path) && f.size <= MAX_PICTURE_BYTES)
  .sort((a, b) => logoRank(a) - logoRank(b) || b.size - a.size).slice(0, 6)

// A repository the API won't serve, cloned shallowly into a temporary
// folder without its large files, and read as a folder there
function cloned({ owner, name }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-repo-'))
  try {
    execFileSync('git', ['clone', '--depth', '1', '--filter=blob:limit=8m', `https://github.com/${owner}/${name}.git`, dir], { stdio: 'ignore', timeout: 120000 })
    const info = readFolder({ dir })
    // The pictures are read now: the folder goes when this returns
    const keep = p => {
      const bytes = fs.readFileSync(path.join(dir, p.file))
      return { ...p, fetch: async () => bytes }
    }
    info.pictures = info.pictures.slice(0, MAX_PICTURES * 2).map(keep)
    info.logos = info.logos.map(keep)
    return info
  } catch (err) {
    throw new Error(`github.com/${owner}/${name} could not be read: GitHub's API is over its hourly limit and cloning failed (${err.message.split('\n')[0]})`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// The brief the plan reads: the repository's own words
function briefMarkdown(src, info, pictures, logo) {
  const lines = [`# ${info.name}: the product in its makers' words`, '', `Read from ${src.label} on ${new Date().toISOString().slice(0, 10)}. Facts for the story come from here: quote them, add none.`, '']
  if (info.description || info.homepage || info.topics.length) {
    lines.push('## About', '')
    if (info.description) lines.push(info.description)
    if (info.homepage) lines.push(`Home page: ${info.homepage}`)
    if (info.topics.length) lines.push(`Topics: ${info.topics.join(', ')}`)
    if (info.license) lines.push(`License: ${info.license}`)
    lines.push('')
  }
  if (info.readme) lines.push('## README', '', trim(tidy(info.readme), 16000), '')
  if (info.releases.length) lines.push('## Latest releases', '', ...info.releases.flatMap(r => [`### ${r.name}${r.date ? ` (${r.date})` : ''}`, '', trim(tidy(r.body), 1500), '']))
  for (const d of info.docs) lines.push(`## ${d.file}`, '', trim(tidy(d.text), 3000), '')
  lines.push('## Logo', '', logo ? `${logo.file} (${logo.width}×${logo.height} px): the product's real logo, from ${logo.from}` : '(none found)', '')
  lines.push('## Pictures', '', ...(pictures.length ? pictures.map(p => `- ${p.file} (${p.width}×${p.height} px): ${p.from}`) : ['(none)']), '')
  return lines.join('\n')
}

// The first of the logos that is one (square-ish, big enough), written to
// file without its clear margin; null when none is
async function keepLogo(logos, file) {
  for (const l of logos) {
    const bytes = await l.fetch().catch(() => null)
    if (!bytes) continue
    fs.writeFileSync(file, Buffer.from(bytes))
    const size = imageSize(file)
    if (size && size.width >= MIN_LOGO && Math.abs(size.width - size.height) <= size.width * 0.1) {
      await trimClear(file)
      return { file: `${REPO_DIR}/logo.png`, ...imageSize(file), from: l.file }
    }
    fs.rmSync(file)
  }
  return null
}

// An app's icon sits in a clear margin of its own (a tenth of it on each
// side, by macOS's grid): cut to its ink, so the logo is as tall as what
// shows of it wherever it is set. ffmpeg finds the ink in the picture's
// alpha; a picture without one (or ffmpeg missing) is kept as it is
async function trimClear(file) {
  const run = args => new Promise(res => execFile('ffmpeg', ['-hide_banner', ...args], (err, out, log) => res(err ? null : log)))
  const log = await run(['-i', file, '-vf', 'alphaextract,cropdetect=limit=24:round=2:skip=0', '-f', 'null', '-'])
  const crop = log?.match(/crop=(\d+):(\d+):(\d+):(\d+)/g)?.at(-1)
  const size = imageSize(file)
  if (!crop || crop === `crop=${size.width}:${size.height}:0:0`) return
  const cut = `${file}.${process.pid}.png`
  if (await run(['-loglevel', 'error', '-y', '-i', file, '-vf', crop, cut]) != null) fs.renameSync(cut, file)
  else fs.rmSync(cut, { force: true })
}

// Reads the repository into the project's repo/. onStep(message, done,
// total) reports each step; done and total once the pictures are known
export async function readRepo(root, source, onStep = () => {}) {
  const src = repoSource(source)
  if (!src) throw new Error('no repository to read')
  onStep(`reading ${src.label}`)
  const info = src.kind === 'github' ? await readGithub(src).catch(err => (err instanceof Limited ? cloned(src) : Promise.reject(err))) : readFolder(src)
  const final = path.join(root, REPO_DIR)
  const tmp = path.join(root, `.${REPO_DIR}-${process.pid}`)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(path.join(tmp, 'pictures'), { recursive: true })
  try {
    const pictures = []
    const total = Math.min(info.pictures.length, MAX_PICTURES * 2)
    for (const [i, p] of info.pictures.slice(0, total).entries()) {
      onStep('copying its screenshots', i + 1, total)
      if (pictures.length >= MAX_PICTURES) break
      const bytes = await p.fetch().catch(() => null)
      if (!bytes) continue
      const name = `${String(pictures.length + 1).padStart(2, '0')}-${path.basename(p.file).toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`
      const file = path.join(tmp, 'pictures', name)
      fs.writeFileSync(file, Buffer.from(bytes))
      const size = imageSize(file)
      // Icons and badges are left out: a promo shows screens
      if (!size || size.width < MIN_PICTURE_WIDTH) {
        fs.rmSync(file)
        continue
      }
      pictures.push({ file: `${REPO_DIR}/pictures/${name}`, ...size, from: p.file })
    }
    onStep('finding its logo')
    const logo = await keepLogo(info.logos, path.join(tmp, 'logo.png'))
    writeJson(path.join(tmp, 'repo.json'), { source: src.label, name: info.name, description: info.description, homepage: info.homepage, read: new Date().toISOString(), docs: info.docs.map(d => d.file), pictures, logo })
    fs.writeFileSync(path.join(tmp, 'brief.md'), briefMarkdown(src, info, pictures, logo))
    fs.rmSync(final, { recursive: true, force: true })
    fs.renameSync(tmp, final)
    return { name: info.name, homepage: info.homepage, docs: info.docs.length, pictures: pictures.length }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
