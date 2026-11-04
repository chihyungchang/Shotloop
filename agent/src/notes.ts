// A world file's notes for the agent's prompts and its read_file: what a
// module is and what it exports, so its pieces are used without reading
// its code; the engine's own kit (world/screens.js, its pieces, the
// promo's layout) is only ever seen this way

// The engine's kit in a project's world: copied in whole, never edited
export const isKit = (name: string) => /^(screens\.js|screens\/[\w-]+\.js|promo-layout\.js)$/.test(name)

// A file's notes: its leading comment (HTML, block or line comments) and,
// for a module, what it exports with each one's parameters and the
// comment over it, so its pieces are used without reading it whole (a
// kit runs to tens of thousands of tokens); a small file without notes
// is itself, a big one is named for read_file
const SMALL = 3000
export function notesOf(name: string, text: string) {
  const top = text.match(/^\s*(?:<!doctype[^>]*>\s*)?(<!--[\s\S]*?-->|(?:\s*(?:\/\/.*|\/\*[\s\S]*?\*\/)\n)+)/i)?.[1].trim()
  const api = /\.m?js$/.test(name) ? exportsOf(text) : ''
  if (isKit(name)) return `${top ?? ''}${api}\n(the engine's kit: use its pieces as listed here; its code isn't for reading)`
  if (top) return `${top}${api}\n(the code: read_file world/${name}, only for a detail these don't give)`
  if (text.length <= SMALL) return text
  return api ? `${api.trim()}\n(the code: read_file world/${name}, only for a detail these don't give)` : `(no notes at its top; read_file world/${name} for its code)`
}

// A module's exports: each signature (its line, to its body) with the
// start of the comment over it
function exportsOf(text: string) {
  const lines = text.split('\n')
  const out: string[] = []
  lines.forEach((line, i) => {
    const fn = line.match(/^export (?:async )?function (\w+\s*\(.*?)\s*\{\s*$/)
    const arrow = line.match(/^export const (\w+) = (?:async )?(.*?)\s*=>/)
    if (!fn && !arrow) return
    let k = i
    while (k > 0 && /^\s*\/\//.test(lines[k - 1])) k--
    const note = lines.slice(k, i).map(l => l.replace(/^\s*\/\/\s?/, '')).join(' ').trim()
    const head = fn ? fn[1] : `${arrow![1]}${arrow![2].startsWith('(') ? arrow![2] : `(${arrow![2]})`}`
    out.push(`- ${head}${note ? `: ${note.length > 240 ? `${note.slice(0, 237)}…` : note}` : ''}`)
  })
  return out.length ? `\nExports:\n${out.join('\n')}` : ''
}
