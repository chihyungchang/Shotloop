// The built-in 2D looks (engine/shotloop/looks.mjs), for the pickers on
// Home and the plan: id, name and what it suits per language, and the
// colors of a small preview (background, text, accents)
import { lang, type Lang } from './i18n'

type Words = Record<Lang, string>

export const LOOKS: readonly { id: string; name: Words; about: Words; bg: string; swatch: string; text: string; accent: string; accent2: string }[] = [
  {
    id: 'midnight',
    name: { en: 'Midnight', 'zh-CN': '深夜蓝', 'pt-BR': 'Meia-noite', 'zh-TW': '午夜藍', ja: 'ミッドナイト', ko: '미드나잇', es: 'Medianoche', fr: 'Minuit', de: 'Mitternacht', it: 'Mezzanotte', ru: 'Полночь', tr: 'Gece yarısı', vi: 'Nửa đêm', id: 'Tengah malam' },
    about: { en: 'Science and explainers', 'zh-CN': '科普、讲解', 'pt-BR': 'Ciência e explicações', 'zh-TW': '科普、解說', ja: '科学、解説', ko: '과학과 설명 영상', es: 'Ciencia y explicaciones', fr: 'Sciences et explications', de: 'Wissenschaft und Erklärvideos', it: 'Scienza e spiegazioni', ru: 'Наука и объяснения', tr: 'Bilim ve anlatım', vi: 'Khoa học và giải thích', id: 'Sains dan penjelasan' },
    bg: 'radial-gradient(120% 80% at 50% 0%, #1b2d63 0%, #0d1736 55%, #080e24 100%)', swatch: '#13224d',
    text: '#f4f7ff', accent: '#ffb340', accent2: '#4fd1c5'
  },
  {
    id: 'paper',
    name: { en: 'Paper', 'zh-CN': '纸张', 'pt-BR': 'Papel', 'zh-TW': '紙張', ja: 'ペーパー', ko: '종이', es: 'Papel', fr: 'Papier', de: 'Papier', it: 'Carta', ru: 'Бумага', tr: 'Kâğıt', vi: 'Giấy', id: 'Kertas' },
    about: { en: 'Editorial, calm', 'zh-CN': '杂志感、沉静', 'pt-BR': 'Editorial, calmo', 'zh-TW': '雜誌感、沉靜', ja: '雑誌風、落ち着き', ko: '에디토리얼, 차분함', es: 'Editorial, sereno', fr: 'Éditorial, calme', de: 'Redaktionell, ruhig', it: 'Editoriale, calmo', ru: 'Журнальный, спокойный', tr: 'Editoryal, sakin', vi: 'Kiểu tạp chí, điềm tĩnh', id: 'Editorial, tenang' },
    bg: 'radial-gradient(130% 90% at 50% 30%, #f7f3ea 0%, #efe8da 70%, #e6dccb 100%)', swatch: '#f3eee4',
    text: '#1d1b17', accent: '#2f6fed', accent2: '#e8553d'
  },
  {
    id: 'neon',
    name: { en: 'Neon', 'zh-CN': '霓虹', 'pt-BR': 'Neon', 'zh-TW': '霓虹', ja: 'ネオン', ko: '네온', es: 'Neón', fr: 'Néon', de: 'Neon', it: 'Neon', ru: 'Неон', tr: 'Neon', vi: 'Neon', id: 'Neon' },
    about: { en: 'Tech, games, bold hooks', 'zh-CN': '科技、游戏、强钩子', 'pt-BR': 'Tecnologia, games', 'zh-TW': '科技、遊戲、強烈開場', ja: 'テック、ゲーム、強いフック', ko: '테크, 게임, 강렬한 훅', es: 'Tecnología, videojuegos, ganchos potentes', fr: 'Tech, jeux, accroches fortes', de: 'Tech, Games, starke Hooks', it: 'Tecnologia, giochi, ganci forti', ru: 'Технологии, игры, смелые зацепки', tr: 'Teknoloji, oyunlar, güçlü girişler', vi: 'Công nghệ, game, mở đầu mạnh', id: 'Teknologi, game, pembuka yang berani' },
    bg: 'radial-gradient(90% 60% at 15% 10%, rgba(255, 61, 154, 0.35), transparent 60%), radial-gradient(90% 60% at 90% 85%, rgba(46, 230, 255, 0.28), transparent 60%), #07070c', swatch: '#07070c',
    text: '#ffffff', accent: '#ff3d9a', accent2: '#2ee6ff'
  },
  {
    id: 'pastel',
    name: { en: 'Pastel', 'zh-CN': '马卡龙', 'pt-BR': 'Pastel', 'zh-TW': '粉彩', ja: 'パステル', ko: '파스텔', es: 'Pastel', fr: 'Pastel', de: 'Pastell', it: 'Pastello', ru: 'Пастель', tr: 'Pastel', vi: 'Pastel', id: 'Pastel' },
    about: { en: 'Lifestyle, kids, how-tos', 'zh-CN': '生活、亲子、教程', 'pt-BR': 'Estilo de vida, tutoriais', 'zh-TW': '生活、親子、教學', ja: '暮らし、子ども、ハウツー', ko: '라이프스타일, 아이, 사용법', es: 'Estilo de vida, niños, tutoriales', fr: 'Lifestyle, enfants, tutos', de: 'Lifestyle, Kinder, Anleitungen', it: 'Lifestyle, bambini, tutorial', ru: 'Лайфстайл, дети, инструкции', tr: 'Yaşam tarzı, çocuklar, nasıl yapılır', vi: 'Đời sống, trẻ em, hướng dẫn', id: 'Gaya hidup, anak-anak, tutorial' },
    bg: 'linear-gradient(165deg, #f7f0ff 0%, #f1f6ff 50%, #eaf8f2 100%)', swatch: '#f1ecff',
    text: '#2b2540', accent: '#7c5cff', accent2: '#ff8a65'
  },
  {
    id: 'mono',
    name: { en: 'Swiss', 'zh-CN': '极简黑白', 'pt-BR': 'Suíço', 'zh-TW': '瑞士風', ja: 'スイス', ko: '스위스', es: 'Suizo', fr: 'Suisse', de: 'Schweizer', it: 'Svizzero', ru: 'Швейцарский', tr: 'İsviçre', vi: 'Thụy Sĩ', id: 'Swiss' },
    about: { en: 'Data, facts, news', 'zh-CN': '数据、事实、新闻', 'pt-BR': 'Dados, fatos, notícias', 'zh-TW': '數據、事實、新聞', ja: 'データ、事実、ニュース', ko: '데이터, 사실, 뉴스', es: 'Datos, hechos, noticias', fr: 'Données, faits, actualité', de: 'Daten, Fakten, Nachrichten', it: 'Dati, fatti, notizie', ru: 'Данные, факты, новости', tr: 'Veri, bilgi, haber', vi: 'Dữ liệu, sự thật, tin tức', id: 'Data, fakta, berita' },
    bg: '#ffffff', swatch: '#ffffff',
    text: '#0a0a0a', accent: '#ff3b30', accent2: '#0a0a0a'
  },
  {
    id: 'ocean',
    name: { en: 'Ocean', 'zh-CN': '深海', 'pt-BR': 'Oceano', 'zh-TW': '深海', ja: 'オーシャン', ko: '오션', es: 'Océano', fr: 'Océan', de: 'Ozean', it: 'Oceano', ru: 'Океан', tr: 'Okyanus', vi: 'Đại dương', id: 'Samudra' },
    about: { en: 'Nature, water, biology', 'zh-CN': '自然、海洋、生物', 'pt-BR': 'Natureza, água, biologia', 'zh-TW': '自然、海洋、生物', ja: '自然、水、生物', ko: '자연, 물, 생물학', es: 'Naturaleza, agua, biología', fr: 'Nature, eau, biologie', de: 'Natur, Wasser, Biologie', it: 'Natura, acqua, biologia', ru: 'Природа, вода, биология', tr: 'Doğa, su, biyoloji', vi: 'Thiên nhiên, nước, sinh học', id: 'Alam, air, biologi' },
    bg: 'radial-gradient(120% 80% at 50% 0%, #0d4a5c 0%, #072a3a 55%, #041822 100%)', swatch: '#0a3442',
    text: '#eefcff', accent: '#3ee0d0', accent2: '#ff8a6b'
  },
  {
    id: 'ember',
    name: { en: 'Ember', 'zh-CN': '余烬', 'pt-BR': 'Brasa', 'zh-TW': '餘燼', ja: 'エンバー', ko: '엠버', es: 'Brasa', fr: 'Braise', de: 'Glut', it: 'Brace', ru: 'Угли', tr: 'Kor', vi: 'Than hồng', id: 'Bara' },
    about: { en: 'History, drama, energy', 'zh-CN': '历史、戏剧、能源', 'pt-BR': 'História, drama, energia', 'zh-TW': '歷史、戲劇、能源', ja: '歴史、ドラマ、エネルギー', ko: '역사, 드라마, 에너지', es: 'Historia, drama, energía', fr: 'Histoire, drame, énergie', de: 'Geschichte, Drama, Energie', it: 'Storia, dramma, energia', ru: 'История, драма, энергия', tr: 'Tarih, dram, enerji', vi: 'Lịch sử, kịch tính, năng lượng', id: 'Sejarah, drama, energi' },
    bg: 'radial-gradient(110% 80% at 50% 100%, #3a120a 0%, #1a0907 55%, #0c0505 100%)', swatch: '#1c0a07',
    text: '#fff4ec', accent: '#ff7a2f', accent2: '#ffc65c'
  },
  {
    id: 'forest',
    name: { en: 'Forest', 'zh-CN': '森林', 'pt-BR': 'Floresta', 'zh-TW': '森林', ja: 'フォレスト', ko: '포레스트', es: 'Bosque', fr: 'Forêt', de: 'Wald', it: 'Foresta', ru: 'Лес', tr: 'Orman', vi: 'Rừng', id: 'Hutan' },
    about: { en: 'Nature, climate, health', 'zh-CN': '自然、气候、健康', 'pt-BR': 'Natureza, clima, saúde', 'zh-TW': '自然、氣候、健康', ja: '自然、気候、健康', ko: '자연, 기후, 건강', es: 'Naturaleza, clima, salud', fr: 'Nature, climat, santé', de: 'Natur, Klima, Gesundheit', it: 'Natura, clima, salute', ru: 'Природа, климат, здоровье', tr: 'Doğa, iklim, sağlık', vi: 'Thiên nhiên, khí hậu, sức khỏe', id: 'Alam, iklim, kesehatan' },
    bg: 'radial-gradient(120% 80% at 50% 0%, #1d4a2c 0%, #0f2a19 55%, #08170e 100%)', swatch: '#123020',
    text: '#f1fbf0', accent: '#a8e05f', accent2: '#ffc94d'
  },
  {
    id: 'graphite',
    name: { en: 'Graphite', 'zh-CN': '石墨', 'pt-BR': 'Grafite', 'zh-TW': '石墨', ja: 'グラファイト', ko: '그래파이트', es: 'Grafito', fr: 'Graphite', de: 'Graphit', it: 'Grafite', ru: 'Графит', tr: 'Grafit', vi: 'Than chì', id: 'Grafit' },
    about: { en: 'Tech, products, engineering', 'zh-CN': '科技、产品、工程', 'pt-BR': 'Tecnologia, produtos', 'zh-TW': '科技、產品、工程', ja: 'テック、製品、エンジニアリング', ko: '테크, 제품, 엔지니어링', es: 'Tecnología, productos, ingeniería', fr: 'Tech, produits, ingénierie', de: 'Tech, Produkte, Technik', it: 'Tecnologia, prodotti, ingegneria', ru: 'Технологии, продукты, инженерия', tr: 'Teknoloji, ürünler, mühendislik', vi: 'Công nghệ, sản phẩm, kỹ thuật', id: 'Teknologi, produk, rekayasa' },
    bg: 'radial-gradient(120% 80% at 50% 0%, #2b2f36 0%, #1a1d22 55%, #101215 100%)', swatch: '#1e2126',
    text: '#f5f7fa', accent: '#4c9dff', accent2: '#ffb547'
  },
  {
    id: 'sand',
    name: { en: 'Sand', 'zh-CN': '沙丘', 'pt-BR': 'Areia', 'zh-TW': '沙丘', ja: 'サンド', ko: '샌드', es: 'Arena', fr: 'Sable', de: 'Sand', it: 'Sabbia', ru: 'Песок', tr: 'Kum', vi: 'Cát', id: 'Pasir' },
    about: { en: 'Travel, culture, food', 'zh-CN': '旅行、文化、美食', 'pt-BR': 'Viagem, cultura, comida', 'zh-TW': '旅行、文化、美食', ja: '旅、文化、食', ko: '여행, 문화, 음식', es: 'Viajes, cultura, comida', fr: 'Voyage, culture, cuisine', de: 'Reisen, Kultur, Essen', it: 'Viaggi, cultura, cibo', ru: 'Путешествия, культура, еда', tr: 'Seyahat, kültür, yemek', vi: 'Du lịch, văn hóa, ẩm thực', id: 'Perjalanan, budaya, kuliner' },
    bg: 'radial-gradient(130% 90% at 50% 30%, #f6ead6 0%, #eedcc0 70%, #e4ceab 100%)', swatch: '#f1e3cb',
    text: '#2a2118', accent: '#d2582f', accent2: '#1f8a83'
  }
]

// A frame each look renders, per style (engine/shotloop/looks/<id>-<style>.jpg,
// the same demo shot in every look)
const PREVIEWS = import.meta.glob('../../engine/shotloop/looks/*.jpg', { eager: true, import: 'default' }) as Record<string, string>
export const lookPreview = (id: string, style?: string | null) =>
  PREVIEWS[`../../engine/shotloop/looks/${id}-${style === 'scene' ? 'scene' : 'infographic'}.jpg`] ?? null

const words = (w: Words) => w[lang()] ?? w.en
export const lookById = (id: string | null | undefined) => LOOKS.find(x => x.id === id) ?? null
export const lookName = (id: string) => {
  const l = lookById(id)
  return l ? words(l.name) : id
}
export const lookAbout = (id: string) => {
  const l = lookById(id)
  return l ? words(l.about) : ''
}
