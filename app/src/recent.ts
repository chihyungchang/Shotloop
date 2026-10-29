// Recently opened projects and the folder new projects go to, kept in
// local storage (a convenience: the projects themselves live on disk).

const RECENT = 'shotloop.recent'
const FOLDER = 'shotloop.folder'

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}

export const readRecent = (): string[] => read(RECENT, [])

export function remember(path: string) {
  write(RECENT, [path, ...readRecent().filter(p => p !== path)].slice(0, 12))
}

export const forget = (path: string) => write(RECENT, readRecent().filter(p => p !== path))

export const projectsFolder = (): string | null => read(FOLDER, null)
export const setProjectsFolder = (dir: string) => write(FOLDER, dir)

export const baseName = (p: string) => p.split('/').filter(Boolean).at(-1) ?? p

// The recent list as it should be: the person's own projects that still
// exist; examples and drafts (opened before they were kept apart) and
// folders that are gone are dropped from it
export async function cleanRecent(): Promise<string[]> {
  const { api } = await import('./api')
  const recent = readRecent()
  const list = await api.listProjects(recent).catch(() => null)
  if (!list) return recent
  const keep = recent.filter(p => list.some(x => x.root === p && !x.example && !x.draft))
  if (keep.length !== recent.length) write(RECENT, keep)
  return keep
}
