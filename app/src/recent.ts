// Recently opened projects and the folder new projects go to, kept in
// local storage (a convenience: the projects themselves live on disk),
// and how paths are shown.

import { open as pick } from '@tauri-apps/plugin-dialog'
import { api } from './api'
import { readJson, writeJson } from './storage'
import { t } from './i18n'

const RECENT = 'shotloop.recent'
const FOLDER = 'shotloop.folder'

export const readRecent = (): string[] => readJson(RECENT, [])

export function remember(path: string) {
  writeJson(RECENT, [path, ...readRecent().filter(p => p !== path)].slice(0, 12))
}

export const forget = (path: string) => writeJson(RECENT, readRecent().filter(p => p !== path))

export const projectsFolder = (): string | null => readJson(FOLDER, null)
export const setProjectsFolder = (dir: string) => writeJson(FOLDER, dir)

export const baseName = (p: string) => p.split('/').filter(Boolean).at(-1) ?? p

// A path in the person's home folder as ~/…
export const tildePath = (p: string) => p.replace(/^\/Users\/[^/]+/, '~')

// The recent projects as they should be, newest first: the person's own
// that still exist (one that can't be read stays, shown as broken);
// examples and drafts (opened before they were kept apart) and folders
// that are gone are dropped from the list
export async function listRecent(limit?: number) {
  const recent = readRecent()
  const list = await api.listProjects(recent)
  const keep = recent.filter(p => list.some(x => x.root === p && !x.example && !x.draft))
  if (keep.length !== recent.length) writeJson(RECENT, keep)
  return keep.slice(0, limit).flatMap(p => list.filter(x => x.root === p))
}

// A project folder chosen in the system dialog (⌘O, All projects' Open)
export async function pickProject(): Promise<string | null> {
  const dir = await pick({ directory: true, title: t('dialog.openProject') })
  return typeof dir === 'string' ? dir : null
}
