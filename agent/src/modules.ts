// What would stop a JavaScript file the agent writes from loading, found
// as it is written rather than a render later: an import of a file that
// isn't there, a name the file imported from doesn't export, a recurring
// picture taken from the kit instead of imported from world/parts.js.
// Weaker models slip here most, and each render round costs them minutes.

import fs from 'node:fs'
import path from 'node:path'

const IMPORT = /^\s*import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}|\*\s*as\s+[\w$]+)?\s*(?:from\s*)?['"]([^'"]+)['"]/gm
const KIT = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:window\.)?kit\b/g

// The names a module exports, or null when it re-exports a whole module
// (export * from), whose names aren't read here
function exportsOf(source: string): Set<string> | null {
  if (/^\s*export\s*\*\s*from/m.test(source)) return null
  const names = new Set<string>()
  for (const m of source.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)) names.add(m[1])
  for (const m of source.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) for (const n of names_(m[1])) names.add(n.exported)
  if (/^\s*export\s+default\b/m.test(source)) names.add('default')
  return names
}

// "a, b as c" → [{ local, exported }]
function names_(list: string) {
  return list.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [a, b] = s.split(/\s+as\s+/)
    return { local: a.trim(), exported: (b ?? a).trim() }
  })
}

const posix = (p: string) => p.split(path.sep).join('/')

// root: the project; rel: the file written (posix, from root); source: its text
export function moduleFaults(root: string, rel: string, source: string): string[] {
  if (!/\.m?js$/.test(rel)) return []
  const dir = path.dirname(path.join(root, rel))
  const parts = path.join(root, 'world', 'parts.js')
  const toParts = () => {
    const r = posix(path.relative(dir, parts))
    return r.startsWith('.') ? r : `./${r}`
  }
  const faults: string[] = []
  for (const m of source.matchAll(IMPORT)) {
    const [, def, named, spec] = m
    if (!spec.startsWith('.')) continue
    const target = path.resolve(dir, spec.replace(/[?#].*$/, ''))
    if (!fs.existsSync(target)) {
      const hint = fs.existsSync(parts) && /parts/.test(spec) ? `; the recurring pictures are imported from "${toParts()}"` : ''
      faults.push(`import "${spec}" names ${posix(path.relative(root, target))}, which doesn't exist${hint}`)
      continue
    }
    const exported = exportsOf(fs.readFileSync(target, 'utf8'))
    if (!exported) continue
    const wanted = [...(named ? names_(named).map(n => n.local) : []), ...(def ? ['default'] : [])]
    for (const name of wanted) {
      if (!exported.has(name)) faults.push(`"${spec}" exports no ${name}${exported.size ? ` (it exports ${[...exported].join(', ')})` : ''}`)
    }
  }
  if (fs.existsSync(parts)) {
    const pictures = exportsOf(fs.readFileSync(parts, 'utf8'))
    for (const m of source.matchAll(KIT)) {
      for (const { local } of names_(m[1])) {
        if (pictures?.has(local)) faults.push(`${local} is not in the kit: it is a recurring picture; import { ${local} } from "${toParts()}"`)
      }
    }
  }
  return faults
}
