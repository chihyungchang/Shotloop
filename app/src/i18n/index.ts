// UI languages: English and the other major ones (no right-to-left yet).
// The preference ("system" or a language) is kept per user; "system"
// picks the first supported language of the OS. t() reads the current
// language, so changing it re-renders the app from the top (useLanguage).

import { useEffect, useState } from 'react'
import { en, type Key } from './en'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { id } from './id'
import { it } from './it'
import { ja } from './ja'
import { ko } from './ko'
import { ptBR } from './pt-BR'
import { ru } from './ru'
import { tr } from './tr'
import { vi } from './vi'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'

export type Lang = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'es' | 'pt-BR' | 'fr' | 'de' | 'it' | 'ru' | 'tr' | 'vi' | 'id'
export type LangPref = 'system' | Lang

export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh-CN', name: '简体中文' },
  { id: 'zh-TW', name: '繁體中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'es', name: 'Español' },
  { id: 'pt-BR', name: 'Português (Brasil)' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
  { id: 'it', name: 'Italiano' },
  { id: 'ru', name: 'Русский' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'vi', name: 'Tiếng Việt' },
  { id: 'id', name: 'Bahasa Indonesia' }
]

const DICTS: Record<Lang, Record<Key, string>> = {
  en, 'zh-CN': zhCN, 'zh-TW': zhTW, ja, ko, es, 'pt-BR': ptBR, fr, de, it, ru, tr, vi, id
}
const KEY = 'shotloop.lang'
const isLang = (v: unknown): v is Lang => LANGS.some(l => l.id === v)

// An OS language tag matched to ours: Chinese by script or region
// (zh-Hant, zh-TW, zh-HK, zh-MO → zh-TW; other zh → zh-CN), Portuguese
// of any region → pt-BR, the rest by language (es-MX → es, in → id)
export function matchLang(tag: string): Lang | null {
  const s = tag.toLowerCase()
  const base = s.split(/[-_]/)[0]
  if (base === 'zh') return /hant|[-_](tw|hk|mo)\b/.test(s) ? 'zh-TW' : 'zh-CN'
  if (base === 'pt') return 'pt-BR'
  if (base === 'in') return 'id'
  return isLang(base) ? base : null
}

// The OS language: the first of its preferred languages we have
export function systemLang(): Lang {
  for (const l of navigator.languages ?? [navigator.language]) {
    const m = matchLang(l)
    if (m) return m
  }
  return 'en'
}

let current: Lang = 'en'
export const lang = () => current

function readPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY)
    return isLang(v) ? v : 'system'
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
