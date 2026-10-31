// The visual styles (engine/shotloop/styles.mjs) for the plan page: id,
// name per language, and the looks a style can draw with
import { lang } from './i18n'

type Words = { en: string; 'zh-CN': string; 'pt-BR': string }

export const STYLES: readonly { id: string; track: '2d' | '3d'; name: Words; looks: readonly string[] | null }[] = [
  { id: 'scene', track: '2d', name: { en: 'Cinematic scene', 'zh-CN': '电影感场景', 'pt-BR': 'Cena cinematográfica' }, looks: ['midnight', 'neon'] },
  { id: 'infographic', track: '2d', name: { en: 'Infographic', 'zh-CN': '信息图', 'pt-BR': 'Infográfico' }, looks: null },
  { id: '3d', track: '3d', name: { en: '3D', 'zh-CN': '3D', 'pt-BR': '3D' }, looks: [] }
]

export const styleName = (id: string) => {
  const s = STYLES.find(x => x.id === id)
  return s ? s.name[lang()] ?? s.name.en : id
}

// Whether a look can draw a style (null: every look)
export const lookFits = (style: string | null | undefined, look: string) => {
  const s = STYLES.find(x => x.id === style)
  return !s || s.looks === null || s.looks.includes(look)
}
