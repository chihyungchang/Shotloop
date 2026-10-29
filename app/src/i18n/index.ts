// UI languages: English, 简体中文 and Português (Brasil), as on oliverz.dev.
// The preference ("system" or a language) is kept per user; "system"
// picks the first supported language of the OS. t() reads the current
// language, so changing it re-renders the app from the top (useLanguage).

import { useEffect, useState } from 'react'
import { en, type Key } from './en'
import { ptBR } from './pt-BR'
import { zhCN } from './zh-CN'

export type Lang = 'en' | 'zh-CN' | 'pt-BR'
export type LangPref = 'system' | Lang

export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh-CN', name: '简体中文' },
  { id: 'pt-BR', name: 'Português (Brasil)' }
]

const DICTS: Record<Lang, Record<Key, string>> = { en, 'zh-CN': zhCN, 'pt-BR': ptBR }
const KEY = 'shotloop.lang'

// The OS language, matched by prefix (zh-Hans-CN → zh-CN, pt-PT → pt-BR)
export function systemLang(): Lang {
  for (const l of navigator.languages ?? [navigator.language]) {
    const s = l.toLowerCase()
    if (s.startsWith('zh')) return 'zh-CN'
    if (s.startsWith('pt')) return 'pt-BR'
    if (s.startsWith('en')) return 'en'
  }
  return 'en'
}

let current: Lang = 'en'
export const lang = () => current

function readPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'zh-CN' || v === 'pt-BR' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(pref: LangPref): Lang {
  current = pref === 'system' ? systemLang() : pref
  document.documentElement.lang = current
  return current
}
resolve(readPref())

// t('stage.take', { n: 3 }) → "Take 3 · …". With a numeric `n`, the
// ".one" variant is used for 1 when the language has one.
export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const dict = DICTS[current]
  const one = vars.n === 1 ? dict[`${key}.one` as Key] : undefined
  const text = one ?? dict[key] ?? en[key] ?? key
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

// Splits a template around one placeholder, for markup inside a string
// ("Let’s make a short {mark}")
export function tSplit(key: Key, name: string): [string, string] {
  const [a, b = ''] = t(key).split(`{${name}}`)
  return [a, b]
}

// Locale-aware dates and times in the UI language
export const formatDate = (iso: string | number, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(iso).toLocaleString(current, opts)

export function useLanguage() {
  const [pref, setPref] = useState<LangPref>(readPref)
  const [resolved, setResolved] = useState<Lang>(current)
  useEffect(() => {
    setResolved(resolve(pref))
  }, [pref])
  return {
    pref,
    lang: resolved,
    setPref: (p: LangPref) => {
      try {
        localStorage.setItem(KEY, p)
      } catch {
        // storage unavailable: the choice lasts this session
      }
      resolve(p)
      setPref(p)
    }
  }
}
