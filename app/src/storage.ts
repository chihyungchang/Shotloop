// Small conveniences kept in local storage on this Mac (the theme, the
// language, the recent list, the export's last choices). Storage can be
// unavailable (a private window, blocked site data): a read then gives
// the fallback and a write is dropped on purpose, so the choice only
// lasts this session; nothing the app needs to work lives here.

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// null removes the key
export function writeStored(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // unavailable: see above
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(readStored(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

export const writeJson = (key: string, value: unknown) => writeStored(key, JSON.stringify(value))
