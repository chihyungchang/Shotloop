// Converts a legacy episode (engine/video/explainers/{2d,3d}/epNN-*) to
// a Shotloop project (docs/PRD.md §7.1, §8).
//
// 2D: the episode page becomes world/page.html; every storyboard row
//     becomes a shot whose shot.js draws the page at the shot's film
//     time, so the shot's code can take over its drawing piece by piece.
// 3D: scene.py minus its shot list becomes world/world.py; every
//     kit.Shot(...) in that list becomes shots/<id>/shot.py, rewritten
//     from film time to shot-local time with at().

import fs from 'node:fs'
import path from 'node:path'
import { saveConfig } from './project.mjs'

const DOCS = ['copy.md', 'script.md', 'storyboard.md', 'scene.md', 'publish.md', 'music.json', 'thumb.html', 'captions.html']

export function convert(src, dst, { force = false } = {}) {
  src = path.resolve(src)
  dst = path.resolve(dst)
  const track = fs.existsSync(path.join(src, 'scene.py')) ? '3d' : fs.existsSync(path.join(src, 'index.html')) ? '2d' : null
  if (!track) throw new Error(`${src}: neither scene.py (3D) nor index.html (2D)`)
  if (fs.existsSync(dst) && fs.readdirSync(dst).length && !force) {
    throw new Error(`${dst} exists and is not empty (use --force)`)
  }
  fs.mkdirSync(path.join(dst, 'world'), { recursive: true })
  for (const f of DOCS) {
    if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dst, f))
  }
  const name = path.basename(src)
  const storyboard = readStoryboard(path.join(src, 'storyboard.md'))
  const { shots, extra } = track === '3d' ? convert3d(src, dst, storyboard) : convert2d(src, dst, storyboard)

  const cfg = {
    version: 1,
    title: readTitle(src) ?? name,
    slug: name,
    track,
    fps: 30,
    size: { width: 1080, height: 1920 },
    shots: shots.map(({ id, title, duration }) => ({ id, title, duration })),
    captions: fs.existsSync(path.join(dst, 'captions.html')) ? 'captions.html' : null,
    music: fs.existsSync(path.join(dst, 'music.json')) ? 'music.json' : null,
    cover: fs.existsSync(path.join(dst, 'thumb.html')) ? 'thumb.html' : null,
    publish: fs.existsSync(path.join(dst, 'publish.md')) ? 'publish.md' : null,
    convertedFrom: path.relative(dst, src),
    ...extra
  }
  for (const s of shots) {
    fs.mkdirSync(path.join(dst, 'shots', s.id), { recursive: true })
    fs.writeFileSync(path.join(dst, 'shots', s.id, track === '3d' ? 'shot.py' : 'shot.js'), s.code)
    fs.writeFileSync(path.join(dst, 'shots', s.id, 'notes.md'), notes(s))
  }
  fs.writeFileSync(path.join(dst, '.gitignore'), '.shotloop/\nout/\n')
  saveConfig(dst, cfg)
  return { dst, track, shots: shots.length }
}

// ---------------------------------------------------------------- shared

const round = x => Math.round(x * 1000) / 1000

function readTitle(src) {
  const copy = path.join(src, 'copy.md')
  if (!fs.existsSync(copy)) return null
  const m = fs.readFileSync(copy, 'utf8').match(/^#\s+(.+)$/m)
  return m ? m[1].replace(/^\d+\s*·\s*/, '').trim() : null
}

const slug = s => s.toLowerCase().replace(/\*\*[^*]+\*\*/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  .split('-').filter(w => w && !['a', 'an', 'the', 'of', 'on', 'in', 'to'].includes(w)).slice(0, 3).join('-')

// Rows of the storyboard's shot table: | # | Time | Shot | Motion |
function readStoryboard(file) {
  if (!fs.existsSync(file)) return []
  const rows = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const cells = line.split('|').slice(1, -1).map(c => c.trim())
    const m = cells[1]?.match(/^([\d.]+)\s*[–-]\s*([\d.]+)$/)
    if (cells.length >= 4 && /^\d+$/.test(cells[0]) && m) {
      rows.push({ n: Number(cells[0]), from: Number(m[1]), to: Number(m[2]), shot: cells[2], motion: cells[3] })
    }
  }
  return rows
}

function notes(s) {
  return `# ${s.id}${s.title ? ` · ${s.title}` : ''}

## Must show

${s.must ?? '(what this shot must show)'}

## Motion

${s.motion ?? '(the move)'}

## Review history

- ${new Date().toISOString().slice(0, 10)}: converted from the legacy episode.
`
}

// ---------------------------------------------------------------- 2D

function convert2d(src, dst, storyboard) {
  if (!storyboard.length) throw new Error('2D conversion needs the storyboard shot table')
  fs.copyFileSync(path.join(src, 'index.html'), path.join(dst, 'world', 'page.html'))
  const shots = storyboard.map((r, i) => {
    const id = `${String(i + 1).padStart(2, '0')}-${slug(r.shot) || 'shot'}`
    return {
      id,
      title: r.shot.replace(/^\*\*[^*]+\*\*\s*/, '').split(/[.:;]/)[0].trim().slice(0, 48).replace(/^./, c => c.toUpperCase()),
      duration: round(r.to - r.from),
      must: r.shot,
      motion: r.motion,
      code: `// ${id}: ${r.shot.replace(/\*\*/g, '').split('.')[0]}.
// Shot-local time: t = 0 is this shot's first frame.
//
// Converted from the legacy episode: the drawing still lives in
// world/page.html, which is drawn here at the shot's film time. Move this
// shot's drawing in here to edit it without touching the other shots.

export default function render(t, { world, start }) {
  world(start + t)
}
`
    }
  })
  return { shots, extra: {} }
}

// ---------------------------------------------------------------- 3D

function splitArgs(s) {
  const out = []
  let depth = 0
  let cur = ''
  let quote = null
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"') quote = ch
    else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0 && !quote) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out.map(a => a.trim())
}

// The text from `open` (index of an opening parenthesis) to its match
function balanced(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0) return s.slice(open + 1, i)
  }
  throw new Error('unbalanced parentheses in kit.Shot(...)')
}

function convert3d(src, dst, storyboard) {
  const scene = fs.readFileSync(path.join(src, 'scene.py'), 'utf8')
  const marker = scene.search(/^# =+ SHOTS/m)
  if (marker < 0) throw new Error('scene.py has no "# ==== SHOTS" section')
  const consts = {}
  for (const m of scene.matchAll(/^([A-Z_]+)\s*=\s*([\d.]+(?:\s*\*\s*[A-Z_\d.]+)*)\s*$/gm)) consts[m[1]] = m[2]
  const evalTime = expr => {
    let e = expr
    for (let i = 0; i < 4; i++) e = e.replace(/\b[A-Z_]+\b/g, k => (k in consts ? `(${consts[k]})` : k))
    if (!/^[\d.\s()+\-*/]+$/.test(e)) throw new Error(`cannot evaluate shot time "${expr}"`)
    return round(Function(`return (${e})`)())
  }

  // world.py: the scene up to its shot list, made location-independent
  const world = scene.slice(0, marker)
    .replace(/^sys\.path\.insert\(0, os\.path\.join\(HERE, '\.\.', 'lib'\)\)\n/m, '# kit is put on sys.path by engine/shotloop/blender/run_shot.py\n')
    .replace(/^ASSETS = .*$/m, "ASSETS = os.environ.get('SHOTLOOP_ASSETS', os.path.join(HERE, '..', 'assets'))")
    .replace(/^OUT = .*$/m, "OUT = os.environ.get('SHOTLOOP_OUT', os.path.join(HERE, '..', '.shotloop'))")
    .trimEnd()
  fs.writeFileSync(path.join(dst, 'world', 'world.py'), `${world}\n\n# Shots: shots/*/shot.py, rendered one at a time by Shotloop\n`)
  if (fs.existsSync(path.join(src, 'screen.html'))) {
    fs.copyFileSync(path.join(src, 'screen.html'), path.join(dst, 'world', 'screen.html'))
  }

  // One shot per statement in the shot list, with the comments above it
  const body = scene.slice(marker).split('\n').slice(1)
  const statements = []
  let comments = []
  let buf = []
  for (const line of body) {
    if (/^a = kit\.args\(\)|^kit\.render\(/.test(line)) continue
    if (!buf.length && /^#/.test(line)) comments.push(line)
    else if (line.trim() || buf.length) {
      buf.push(line)
      const text = buf.join('\n')
      if (text.split('(').length === text.split(')').length) {
        if (text.includes('kit.Shot(')) statements.push({ comments, text })
        comments = []
        buf = []
      }
    }
  }
  if (!statements.length) throw new Error('no kit.Shot(...) in the shot list')

  let cursor = 0
  const shots = statements.map(({ comments, text }) => {
    const i = text.indexOf('kit.Shot(') + 'kit.Shot'.length
    const inner = balanced(text, i)
    const args = splitArgs(inner)
    const id = args[0].replace(/['"]/g, '')
    const start = evalTime(args[1])
    const end = evalTime(args[2])
    if (Math.abs(start - cursor) > 0.001) throw new Error(`shot ${id} starts at ${start}, expected ${cursor} (gap or overlap)`)
    cursor = end
    const local = [args[0], 'at(0)', 'at(DUR)', ...args.slice(3)].join(', ')
    const code = text.slice(0, i + 1) + local + text.slice(i + 1 + inner.length)
    const row = storyboard.find(r => start >= r.from - 0.01 && start < r.to - 0.01)
    const comment = comments.join('\n')
    return {
      id,
      title: (comments[0] ?? '').replace(/^#\s*(\d+[a-z]?\s*·\s*)?/, '').split(/[:.]/)[0].trim(),
      duration: round(end - start),
      start,
      must: [comment.replace(/^#\s?/gm, ''), row && `Storyboard: ${row.shot}`].filter(Boolean).join('\n\n'),
      motion: row?.motion,
      code: `${comment}
#
# Shot-local time: at(t) is t seconds into this shot; DUR is its length.
# Runs in the namespace of world/world.py (see engine/shotloop/blender/run_shot.py).
${code}
`
    }
  })

  // The cover's background frame (thumb.html): legacy covers point at a
  // frame of the full render; Shotloop extracts it from the shot's clip
  const extra = {}
  const thumb = path.join(dst, 'thumb.html')
  if (fs.existsSync(thumb)) {
    const html = fs.readFileSync(thumb, 'utf8')
    const m = html.match(/out\/frames\/(\d{5})\.png/)
    if (m) {
      const t = (Number(m[1]) - 1) / 30
      const shot = shots.find(s => t >= s.start && t < s.start + s.duration)
      if (shot) extra.coverFrame = { shot: shot.id, time: round(t - shot.start) }
      fs.writeFileSync(thumb, html.replace(/out\/frames(-draft)?\/\d{5}\.png/g, 'out/cover-frame.png'))
    }
  }
  return { shots, extra }
}
