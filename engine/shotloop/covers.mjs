// Cover templates: a cover page saved from one project to start the next
// one's from, so the covers of a series share their layout. The AI keeps
// a template's design and changes only the words and the frame.
//
//   covers/<id>/thumb.html     the cover page as it was saved
//   covers/<id>/cover-*.png    images the page uses (an imported logo or frame)
//   covers/<id>/preview.png    how it looked, for the picker
//   covers/<id>/template.json  name, the project it came from, when

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ffmpeg } from './compose.mjs'
import { renderCover } from './film.mjs'

export const COVERS = process.env.SHOTLOOP_COVERS ?? path.join(os.homedir(), '.shotloop', 'covers')

const safe = s => {
  const id = String(s).replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80)
  if (!id || /^\.+$/.test(id)) throw new Error(`not a template id: ${s}`)
  return id
}

function info(id) {
  const dir = path.join(COVERS, id)
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8'))
  const preview = path.join(dir, 'preview.png')
  return { id, name: String(meta.name ?? id), from: meta.from ?? null, created: meta.created ?? null,
    page: path.join(dir, 'thumb.html'), preview: fs.existsSync(preview) ? preview : null }
}

// Newest first
export function list() {
  if (!fs.existsSync(COVERS)) return []
  return fs.readdirSync(COVERS)
    .filter(id => fs.existsSync(path.join(COVERS, id, 'template.json')) && fs.existsSync(path.join(COVERS, id, 'thumb.html')))
    .map(info)
    .sort((a, b) => String(b.created).localeCompare(String(a.created)))
}

export function get(id) {
  const t = list().find(t => t.id === safe(id))
  if (!t) throw new Error(`no cover template ${id}`)
  return t
}

// The project's cover page as a template, with a fresh preview
export async function save(project, name) {
  if (!project.cover || !fs.existsSync(project.cover)) throw new Error('this project has no cover page')
  name = String(name ?? '').trim().slice(0, 60) || project.title
  const preview = await renderCover(project, { preview: true })
  // The folder: the name in ASCII when it has some (a Chinese name has none)
  const base = name.toLowerCase().replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 40) || 'cover'
  let id = base
  for (let n = 2; fs.existsSync(path.join(COVERS, id)); n++) id = `${base}-${n}`
  const dir = path.join(COVERS, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(project.cover, path.join(dir, 'thumb.html'))
  for (const f of pageImages(project)) fs.copyFileSync(path.join(project.root, f), path.join(dir, f))
  fs.copyFileSync(preview, path.join(dir, 'preview.png'))
  fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify({ name, from: project.title, created: new Date().toISOString() }, null, 2) + '\n')
  return info(id)
}

// The project's own images the cover page uses: cover-*.png next to it
function pageImages(project) {
  const html = fs.readFileSync(project.cover, 'utf8')
  return fs.readdirSync(path.dirname(project.cover)).filter(f => /^cover-[\w-]+\.png$/.test(f) && html.includes(f))
}

// A template into the project: its page, and the images it uses
export function apply(project, id) {
  if (!project.cover) throw new Error('this project has no cover page')
  const t = get(id)
  const dir = path.dirname(t.page)
  fs.copyFileSync(t.page, project.cover)
  for (const f of fs.readdirSync(dir)) if (/^cover-[\w-]+\.png$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(path.dirname(project.cover), f))
  return t
}

// An image the person uploaded, for the AI to design the cover after:
// cover-reference.png next to the cover page, at most 1080×1920 (a PNG
// keeps any transparency, for a logo or frame the page may use as is)
export async function reference(project, file) {
  if (!project.cover) throw new Error('this project has no cover page')
  if (!file || !fs.existsSync(file)) throw new Error(`no image ${file}`)
  const out = path.join(path.dirname(project.cover), 'cover-reference.png')
  await ffmpeg(['-i', file, '-frames:v', '1', '-vf', "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease", out])
  return out
}

export function remove(id) {
  const dir = path.join(COVERS, safe(id))
  if (!fs.existsSync(dir)) throw new Error(`no cover template ${id}`)
  fs.rmSync(dir, { recursive: true, force: true })
  return { removed: safe(id) }
}
