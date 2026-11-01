// The export dialog's last choices, kept on this Mac: what to export and
// in which aspects (per project, else the last export's anywhere), and
// the folder exports go to (one for every project)

import { readJson, readStored, writeJson, writeStored } from '../../../storage'

// What to export, ticked like CapCut's export dialog
export type Parts = { video: boolean; cover: boolean; copy: boolean }
type Prefs = { aspects: string[]; parts: Parts }

const LAST = 'shotloop.export.last'
const TO = 'shotloop.export.to'
const DEFAULT_TO = '~/Movies/Shotloop'
const keyFor = (root: string) => `shotloop.export.${root}`

export function readExportPrefs(root: string): Prefs {
  const saved = readJson<Partial<Prefs> | null>(keyFor(root), null) ?? readJson<Partial<Prefs> | null>(LAST, null)
  return {
    aspects: saved?.aspects?.length ? saved.aspects : ['9:16'],
    parts: saved?.parts ?? { video: true, cover: true, copy: true }
  }
}

export function saveExportPrefs(root: string, prefs: Prefs) {
  writeJson(keyFor(root), prefs)
  writeJson(LAST, prefs)
}

export const readExportTo = () => readStored(TO) || DEFAULT_TO
export const saveExportTo = (dir: string) => writeStored(TO, dir)
