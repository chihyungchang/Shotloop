// An export delivered where the person wants it: a folder named after
// the work in the folder they chose, with plainly named files in it.
// out/ keeps the engine's own timestamped copies; this is what they
// open, upload and keep. An existing folder of that name is never
// overwritten: the new one gets the date and time.
//
//   <to>/<name>/<name> 竖屏.mp4  <name> 横屏.mp4  <name> 封面.png  <name> 发布文案.md

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// The files' words in the app's language
const WORDS = {
  en: { '9:16': 'vertical', '16:9': 'horizontal', cover: 'cover', copy: 'publish copy' },
  'zh-CN': { '9:16': '竖屏', '16:9': '横屏', cover: '封面', copy: '发布文案' },
  'pt-BR': { '9:16': 'vertical', '16:9': 'horizontal', cover: 'capa', copy: 'texto de publicação' },
  'zh-TW': { '9:16': '直式', '16:9': '橫式', cover: '封面', copy: '發布文案' },
  ja: { '9:16': '縦', '16:9': '横', cover: 'カバー', copy: '投稿用テキスト' },
  ko: { '9:16': '세로', '16:9': '가로', cover: '커버', copy: '게시용 문안' },
  es: { '9:16': 'vertical', '16:9': 'horizontal', cover: 'portada', copy: 'texto de publicación' },
  fr: { '9:16': 'vertical', '16:9': 'horizontal', cover: 'couverture', copy: 'texte de publication' },
  de: { '9:16': 'Hochformat', '16:9': 'Querformat', cover: 'Cover', copy: 'Beitragstext' },
  it: { '9:16': 'verticale', '16:9': 'orizzontale', cover: 'copertina', copy: 'testi di pubblicazione' },
  ru: { '9:16': 'вертикальное', '16:9': 'горизонтальное', cover: 'обложка', copy: 'текст для публикации' },
  tr: { '9:16': 'dikey', '16:9': 'yatay', cover: 'kapak', copy: 'yayın metni' },
  vi: { '9:16': 'dọc', '16:9': 'ngang', cover: 'ảnh bìa', copy: 'nội dung đăng' },
  id: { '9:16': 'vertikal', '16:9': 'horizontal', cover: 'sampul', copy: 'teks publikasi' }
}
const words = lang => WORDS[lang] ?? WORDS.en

// A name safe as a file name on macOS and elsewhere
const safe = s => String(s ?? '').replace(/[/\\:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[\s.-]+|[\s.]+$/g, '').slice(0, 100) || 'Shotloop'

export const expandHome = p => (p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p)

const pad = n => String(n).padStart(2, '0')
const when = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`

// A new folder for this export: <name>, else "<name> <date time>", else
// with -2, -3 … (two exports in the same minute)
function newFolder(to, name) {
  fs.mkdirSync(to, { recursive: true })
  let dir = path.join(to, name)
  if (fs.existsSync(dir)) dir = path.join(to, `${name} ${when()}`)
  for (let n = 2; fs.existsSync(dir); n++) dir = path.join(to, `${name} ${when()}-${n}`)
  fs.mkdirSync(dir)
  return dir
}

// The export's files (out/ paths) copied into a new folder; the same
// result with the folder and the copies' paths
export function deliver(project, result, { to, name, lang }) {
  name = safe(name || project.title)
  const w = words(lang)
  const folder = newFolder(path.resolve(expandHome(to)), name)
  const copy = (file, label, ext) => {
    if (!file) return null
    const out = path.join(folder, `${name} ${label}${ext}`)
    fs.copyFileSync(file, out)
    return out
  }
  return {
    ...result,
    folder,
    films: result.films.map(f => ({ ...f, file: copy(f.file, w[f.aspect] ?? f.aspect.replace(':', 'x'), '.mp4') })),
    cover: copy(result.cover, w.cover, '.png'),
    publish: copy(result.publish, w.copy, '.md')
  }
}

// The publish copy into an export's folder, when it was written after the
// export finished (the AI writes it alongside)
export function deliverCopy(project, folder, { name, lang }) {
  if (!project.publish || !fs.existsSync(project.publish)) throw new Error('no publish copy yet')
  if (!fs.existsSync(folder)) throw new Error(`no folder ${folder}`)
  const out = path.join(folder, `${safe(name || project.title)} ${words(lang).copy}.md`)
  fs.copyFileSync(project.publish, out)
  return out
}
