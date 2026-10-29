// The built-in 2D looks (engine/shotloop/looks.mjs), for the pickers on
// Home and the plan: id, name and what it suits per language, and the
// colors of a small preview (background, text, accents)
import { lang } from './i18n'

type Words = { en: string; 'zh-CN': string; 'pt-BR': string }

export const LOOKS: readonly { id: string; name: Words; about: Words; bg: string; swatch: string; text: string; accent: string; accent2: string }[] = [
  {
    id: 'midnight',
    name: { en: 'Midnight', 'zh-CN': '深夜蓝', 'pt-BR': 'Meia-noite' },
    about: { en: 'Science and explainers', 'zh-CN': '科普、讲解', 'pt-BR': 'Ciência e explicações' },
    bg: 'radial-gradient(120% 80% at 50% 0%, #1b2d63 0%, #0d1736 55%, #080e24 100%)', swatch: '#13224d',
    text: '#f4f7ff', accent: '#ffb340', accent2: '#4fd1c5'
  },
  {
    id: 'paper',
    name: { en: 'Paper', 'zh-CN': '纸张', 'pt-BR': 'Papel' },
    about: { en: 'Editorial, calm', 'zh-CN': '杂志感、沉静', 'pt-BR': 'Editorial, calmo' },
    bg: 'radial-gradient(130% 90% at 50% 30%, #f7f3ea 0%, #efe8da 70%, #e6dccb 100%)', swatch: '#f3eee4',
    text: '#1d1b17', accent: '#2f6fed', accent2: '#e8553d'
  },
  {
    id: 'neon',
    name: { en: 'Neon', 'zh-CN': '霓虹', 'pt-BR': 'Neon' },
    about: { en: 'Tech, games, bold hooks', 'zh-CN': '科技、游戏、强钩子', 'pt-BR': 'Tecnologia, games' },
    bg: 'radial-gradient(90% 60% at 15% 10%, rgba(255, 61, 154, 0.35), transparent 60%), radial-gradient(90% 60% at 90% 85%, rgba(46, 230, 255, 0.28), transparent 60%), #07070c', swatch: '#07070c',
    text: '#ffffff', accent: '#ff3d9a', accent2: '#2ee6ff'
  },
  {
    id: 'pastel',
    name: { en: 'Pastel', 'zh-CN': '马卡龙', 'pt-BR': 'Pastel' },
    about: { en: 'Lifestyle, kids, how-tos', 'zh-CN': '生活、亲子、教程', 'pt-BR': 'Estilo de vida, tutoriais' },
    bg: 'linear-gradient(165deg, #f7f0ff 0%, #f1f6ff 50%, #eaf8f2 100%)', swatch: '#f1ecff',
    text: '#2b2540', accent: '#7c5cff', accent2: '#ff8a65'
  },
  {
    id: 'mono',
    name: { en: 'Swiss', 'zh-CN': '极简黑白', 'pt-BR': 'Suíço' },
    about: { en: 'Data, facts, news', 'zh-CN': '数据、事实、新闻', 'pt-BR': 'Dados, fatos, notícias' },
    bg: '#ffffff', swatch: '#ffffff',
    text: '#0a0a0a', accent: '#ff3b30', accent2: '#0a0a0a'
  }
]

const words = (w: Words) => w[lang() as keyof Words] ?? w.en
export const lookById = (id: string | null | undefined) => LOOKS.find(x => x.id === id) ?? null
export const lookName = (id: string) => {
  const l = lookById(id)
  return l ? words(l.name) : id
}
export const lookAbout = (id: string) => {
  const l = lookById(id)
  return l ? words(l.about) : ''
}
