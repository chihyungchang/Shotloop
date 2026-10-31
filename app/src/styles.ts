// The visual styles (engine/shotloop/styles.mjs) for Home and the plan
// page: id, name and what it suits per language, a reference still from
// the example that defines it, and the looks a style can draw with
import { lang } from './i18n'
import scene from '../../engine/shotloop/styles/scene/1.jpg'
import infographic from '../../engine/shotloop/styles/infographic/1.jpg'
import threeD from '../../engine/shotloop/styles/3d/1.jpg'
import map from '../../engine/shotloop/styles/map/1.jpg'
import ui from '../../engine/shotloop/styles/ui/1.jpg'
import blueprint from '../../engine/shotloop/styles/blueprint/1.jpg'
import kinetic from '../../engine/shotloop/styles/kinetic/1.jpg'

type Words = { en: string; 'zh-CN': string; 'pt-BR': string }

export const STYLES: readonly { id: string; track: '2d' | '3d'; name: Words; about: Words; still: string; looks: readonly string[] | null }[] = [
  {
    id: 'scene', track: '2d', name: { en: 'Cinematic scene', 'zh-CN': '电影感场景', 'pt-BR': 'Cena cinematográfica' },
    about: { en: 'Light, depth, a moving camera: space, nature, physics', 'zh-CN': '有光、有纵深、镜头在动：宇宙、自然、物理', 'pt-BR': 'Luz, profundidade, câmera em movimento: espaço, natureza, física' },
    still: scene, looks: ['midnight', 'neon', 'ocean', 'ember', 'forest', 'graphite']
  },
  {
    id: 'infographic', track: '2d', name: { en: 'Infographic', 'zh-CN': '信息图', 'pt-BR': 'Infográfico' },
    about: { en: 'Charts and moving numbers: statistics, comparisons, money', 'zh-CN': '图表和会动的数字：统计、对比、金钱', 'pt-BR': 'Gráficos e números em movimento: estatísticas, comparações' },
    still: infographic, looks: null
  },
  {
    id: 'map', track: '2d', name: { en: 'Map', 'zh-CN': '地图', 'pt-BR': 'Mapa' },
    about: { en: 'Places, routes, how things spread', 'zh-CN': '地点、路线、传播与分布', 'pt-BR': 'Lugares, rotas, como algo se espalha' },
    still: map, looks: null
  },
  {
    id: 'ui', track: '2d', name: { en: 'Interface demo', 'zh-CN': '界面演示', 'pt-BR': 'Demonstração de interface' },
    about: { en: 'Apps, settings, scams on a screen', 'zh-CN': 'App 技巧、设置、诈骗手法', 'pt-BR': 'Apps, configurações, golpes na tela' },
    still: ui, looks: null
  },
  {
    id: 'blueprint', track: '2d', name: { en: 'Blueprint', 'zh-CN': '剖面图纸', 'pt-BR': 'Planta técnica' },
    about: { en: 'How a machine works inside', 'zh-CN': '机器、装置内部怎么运作', 'pt-BR': 'Como uma máquina funciona por dentro' },
    still: blueprint, looks: null
  },
  {
    id: 'kinetic', track: '2d', name: { en: 'Kinetic type', 'zh-CN': '动态排版', 'pt-BR': 'Tipografia cinética' },
    about: { en: 'Quotes, words, myths: the text is the picture', 'zh-CN': '名言、词语、辟谣：文字就是画面', 'pt-BR': 'Citações, palavras, mitos: o texto é a imagem' },
    still: kinetic, looks: null
  },
  {
    id: '3d', track: '3d', name: { en: '3D', 'zh-CN': '3D', 'pt-BR': '3D' },
    about: { en: 'Real objects and a camera through space', 'zh-CN': '真实的物体，镜头在空间里移动', 'pt-BR': 'Objetos reais e uma câmera no espaço' },
    still: threeD, looks: []
  }
]

export const styleById = (id: string | null | undefined) => STYLES.find(x => x.id === id) ?? null
export const styleAbout = (id: string) => {
  const s = styleById(id)
  return s ? s.about[lang()] ?? s.about.en : ''
}

export const styleName = (id: string) => {
  const s = STYLES.find(x => x.id === id)
  return s ? s.name[lang()] ?? s.name.en : id
}

// Whether a look can draw a style (null: every look)
export const lookFits = (style: string | null | undefined, look: string) => {
  const s = STYLES.find(x => x.id === style)
  return !s || s.looks === null || s.looks.includes(look)
}
