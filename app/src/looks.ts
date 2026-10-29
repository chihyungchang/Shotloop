// The built-in 2D looks (engine/shotloop/looks.mjs), for the pickers on
// Home and the plan: id, name per language, and a swatch (background and
// accent)
import { lang } from './i18n'

export const LOOKS = [
  { id: 'midnight', name: { en: 'Midnight', 'zh-CN': '深夜蓝', 'pt-BR': 'Meia-noite' }, bg: '#13224d', accent: '#ffb340' },
  { id: 'paper', name: { en: 'Paper', 'zh-CN': '纸张', 'pt-BR': 'Papel' }, bg: '#f3eee4', accent: '#2f6fed' },
  { id: 'neon', name: { en: 'Neon', 'zh-CN': '霓虹', 'pt-BR': 'Neon' }, bg: '#07070c', accent: '#ff3d9a' },
  { id: 'pastel', name: { en: 'Pastel', 'zh-CN': '马卡龙', 'pt-BR': 'Pastel' }, bg: '#f1ecff', accent: '#7c5cff' },
  { id: 'mono', name: { en: 'Swiss', 'zh-CN': '极简黑白', 'pt-BR': 'Suíço' }, bg: '#ffffff', accent: '#ff3b30' }
] as const

export type LookId = (typeof LOOKS)[number]['id']
export const lookName = (id: string) => {
  const l = LOOKS.find(x => x.id === id)
  return l ? l.name[lang() as keyof typeof l.name] ?? l.name.en : id
}
export const lookById = (id: string | null | undefined) => LOOKS.find(x => x.id === id) ?? null
