// The built-in 2D looks (engine/shotloop/data.mjs LOOKS) for the pickers
// on Home and the plan. The engine has their colors and which can draw a
// cinematic scene; the app adds their names and what they suit in every
// UI language, and the flat color of a small swatch.
import { LOOKS as ENGINE_LOOKS, lookById as engineLook } from '../../engine/shotloop/data.mjs'
import { lang, type Lang } from './i18n'

type Words = Record<Lang, string>

const WORDS: Record<string, { swatch: string; name: Words; about: Words }> = {
  midnight: {
    swatch: '#13224d',
    name: { en: 'Midnight', 'zh-CN': '深夜蓝', 'pt-BR': 'Meia-noite', 'zh-TW': '午夜藍', ja: 'ミッドナイト', ko: '미드나잇', es: 'Medianoche', fr: 'Minuit', de: 'Mitternacht', it: 'Mezzanotte', ru: 'Полночь', tr: 'Gece yarısı', vi: 'Nửa đêm', id: 'Tengah malam' },
    about: { en: 'Science and explainers', 'zh-CN': '科普、讲解', 'pt-BR': 'Ciência e explicações', 'zh-TW': '科普、解說', ja: '科学、解説', ko: '과학과 설명 영상', es: 'Ciencia y explicaciones', fr: 'Sciences et explications', de: 'Wissenschaft und Erklärvideos', it: 'Scienza e spiegazioni', ru: 'Наука и объяснения', tr: 'Bilim ve anlatım', vi: 'Khoa học và giải thích', id: 'Sains dan penjelasan' }
  },
  paper: {
    swatch: '#f3eee4',
    name: { en: 'Paper', 'zh-CN': '纸张', 'pt-BR': 'Papel', 'zh-TW': '紙張', ja: 'ペーパー', ko: '종이', es: 'Papel', fr: 'Papier', de: 'Papier', it: 'Carta', ru: 'Бумага', tr: 'Kâğıt', vi: 'Giấy', id: 'Kertas' },
    about: { en: 'Editorial, calm', 'zh-CN': '杂志感、沉静', 'pt-BR': 'Editorial, calmo', 'zh-TW': '雜誌感、沉靜', ja: '雑誌風、落ち着き', ko: '에디토리얼, 차분함', es: 'Editorial, sereno', fr: 'Éditorial, calme', de: 'Redaktionell, ruhig', it: 'Editoriale, calmo', ru: 'Журнальный, спокойный', tr: 'Editoryal, sakin', vi: 'Kiểu tạp chí, điềm tĩnh', id: 'Editorial, tenang' }
  },
  neon: {
    swatch: '#07070c',
    name: { en: 'Neon', 'zh-CN': '霓虹', 'pt-BR': 'Neon', 'zh-TW': '霓虹', ja: 'ネオン', ko: '네온', es: 'Neón', fr: 'Néon', de: 'Neon', it: 'Neon', ru: 'Неон', tr: 'Neon', vi: 'Neon', id: 'Neon' },
    about: { en: 'Tech, games, bold hooks', 'zh-CN': '科技、游戏、强钩子', 'pt-BR': 'Tecnologia, games', 'zh-TW': '科技、遊戲、強烈開場', ja: 'テック、ゲーム、強いフック', ko: '테크, 게임, 강렬한 훅', es: 'Tecnología, videojuegos, ganchos potentes', fr: 'Tech, jeux, accroches fortes', de: 'Tech, Games, starke Hooks', it: 'Tecnologia, giochi, ganci forti', ru: 'Технологии, игры, смелые зацепки', tr: 'Teknoloji, oyunlar, güçlü girişler', vi: 'Công nghệ, game, mở đầu mạnh', id: 'Teknologi, game, pembuka yang berani' }
  },
  pastel: {
    swatch: '#f1ecff',
    name: { en: 'Pastel', 'zh-CN': '马卡龙', 'pt-BR': 'Pastel', 'zh-TW': '粉彩', ja: 'パステル', ko: '파스텔', es: 'Pastel', fr: 'Pastel', de: 'Pastell', it: 'Pastello', ru: 'Пастель', tr: 'Pastel', vi: 'Pastel', id: 'Pastel' },
    about: { en: 'Lifestyle, kids, how-tos', 'zh-CN': '生活、亲子、教程', 'pt-BR': 'Estilo de vida, tutoriais', 'zh-TW': '生活、親子、教學', ja: '暮らし、子ども、ハウツー', ko: '라이프스타일, 아이, 사용법', es: 'Estilo de vida, niños, tutoriales', fr: 'Lifestyle, enfants, tutos', de: 'Lifestyle, Kinder, Anleitungen', it: 'Lifestyle, bambini, tutorial', ru: 'Лайфстайл, дети, инструкции', tr: 'Yaşam tarzı, çocuklar, nasıl yapılır', vi: 'Đời sống, trẻ em, hướng dẫn', id: 'Gaya hidup, anak-anak, tutorial' }
  },
  mono: {
    swatch: '#ffffff',
    name: { en: 'Swiss', 'zh-CN': '极简黑白', 'pt-BR': 'Suíço', 'zh-TW': '瑞士風', ja: 'スイス', ko: '스위스', es: 'Suizo', fr: 'Suisse', de: 'Schweizer', it: 'Svizzero', ru: 'Швейцарский', tr: 'İsviçre', vi: 'Thụy Sĩ', id: 'Swiss' },
    about: { en: 'Data, facts, news', 'zh-CN': '数据、事实、新闻', 'pt-BR': 'Dados, fatos, notícias', 'zh-TW': '數據、事實、新聞', ja: 'データ、事実、ニュース', ko: '데이터, 사실, 뉴스', es: 'Datos, hechos, noticias', fr: 'Données, faits, actualité', de: 'Daten, Fakten, Nachrichten', it: 'Dati, fatti, notizie', ru: 'Данные, факты, новости', tr: 'Veri, bilgi, haber', vi: 'Dữ liệu, sự thật, tin tức', id: 'Data, fakta, berita' }
  },
  ocean: {
    swatch: '#0a3442',
    name: { en: 'Ocean', 'zh-CN': '深海', 'pt-BR': 'Oceano', 'zh-TW': '深海', ja: 'オーシャン', ko: '오션', es: 'Océano', fr: 'Océan', de: 'Ozean', it: 'Oceano', ru: 'Океан', tr: 'Okyanus', vi: 'Đại dương', id: 'Samudra' },
    about: { en: 'Nature, water, biology', 'zh-CN': '自然、海洋、生物', 'pt-BR': 'Natureza, água, biologia', 'zh-TW': '自然、海洋、生物', ja: '自然、水、生物', ko: '자연, 물, 생물학', es: 'Naturaleza, agua, biología', fr: 'Nature, eau, biologie', de: 'Natur, Wasser, Biologie', it: 'Natura, acqua, biologia', ru: 'Природа, вода, биология', tr: 'Doğa, su, biyoloji', vi: 'Thiên nhiên, nước, sinh học', id: 'Alam, air, biologi' }
  },
  ember: {
    swatch: '#1c0a07',
    name: { en: 'Ember', 'zh-CN': '余烬', 'pt-BR': 'Brasa', 'zh-TW': '餘燼', ja: 'エンバー', ko: '엠버', es: 'Brasa', fr: 'Braise', de: 'Glut', it: 'Brace', ru: 'Угли', tr: 'Kor', vi: 'Than hồng', id: 'Bara' },
    about: { en: 'History, drama, energy', 'zh-CN': '历史、戏剧、能源', 'pt-BR': 'História, drama, energia', 'zh-TW': '歷史、戲劇、能源', ja: '歴史、ドラマ、エネルギー', ko: '역사, 드라마, 에너지', es: 'Historia, drama, energía', fr: 'Histoire, drame, énergie', de: 'Geschichte, Drama, Energie', it: 'Storia, dramma, energia', ru: 'История, драма, энергия', tr: 'Tarih, dram, enerji', vi: 'Lịch sử, kịch tính, năng lượng', id: 'Sejarah, drama, energi' }
  },
  forest: {
    swatch: '#123020',
    name: { en: 'Forest', 'zh-CN': '森林', 'pt-BR': 'Floresta', 'zh-TW': '森林', ja: 'フォレスト', ko: '포레스트', es: 'Bosque', fr: 'Forêt', de: 'Wald', it: 'Foresta', ru: 'Лес', tr: 'Orman', vi: 'Rừng', id: 'Hutan' },
    about: { en: 'Nature, climate, health', 'zh-CN': '自然、气候、健康', 'pt-BR': 'Natureza, clima, saúde', 'zh-TW': '自然、氣候、健康', ja: '自然、気候、健康', ko: '자연, 기후, 건강', es: 'Naturaleza, clima, salud', fr: 'Nature, climat, santé', de: 'Natur, Klima, Gesundheit', it: 'Natura, clima, salute', ru: 'Природа, климат, здоровье', tr: 'Doğa, iklim, sağlık', vi: 'Thiên nhiên, khí hậu, sức khỏe', id: 'Alam, iklim, kesehatan' }
  },
  graphite: {
    swatch: '#1e2126',
    name: { en: 'Graphite', 'zh-CN': '石墨', 'pt-BR': 'Grafite', 'zh-TW': '石墨', ja: 'グラファイト', ko: '그래파이트', es: 'Grafito', fr: 'Graphite', de: 'Graphit', it: 'Grafite', ru: 'Графит', tr: 'Grafit', vi: 'Than chì', id: 'Grafit' },
    about: { en: 'Tech, products, engineering', 'zh-CN': '科技、产品、工程', 'pt-BR': 'Tecnologia, produtos', 'zh-TW': '科技、產品、工程', ja: 'テック、製品、エンジニアリング', ko: '테크, 제품, 엔지니어링', es: 'Tecnología, productos, ingeniería', fr: 'Tech, produits, ingénierie', de: 'Tech, Produkte, Technik', it: 'Tecnologia, prodotti, ingegneria', ru: 'Технологии, продукты, инженерия', tr: 'Teknoloji, ürünler, mühendislik', vi: 'Công nghệ, sản phẩm, kỹ thuật', id: 'Teknologi, produk, rekayasa' }
  },
  sand: {
    swatch: '#f1e3cb',
    name: { en: 'Sand', 'zh-CN': '沙丘', 'pt-BR': 'Areia', 'zh-TW': '沙丘', ja: 'サンド', ko: '샌드', es: 'Arena', fr: 'Sable', de: 'Sand', it: 'Sabbia', ru: 'Песок', tr: 'Kum', vi: 'Cát', id: 'Pasir' },
    about: { en: 'Travel, culture, food', 'zh-CN': '旅行、文化、美食', 'pt-BR': 'Viagem, cultura, comida', 'zh-TW': '旅行、文化、美食', ja: '旅、文化、食', ko: '여행, 문화, 음식', es: 'Viajes, cultura, comida', fr: 'Voyage, culture, cuisine', de: 'Reisen, Kultur, Essen', it: 'Viaggi, cultura, cibo', ru: 'Путешествия, культура, еда', tr: 'Seyahat, kültür, yemek', vi: 'Du lịch, văn hóa, ẩm thực', id: 'Perjalanan, budaya, kuliner' }
  },
  sunset: {
    swatch: '#4a1f4f',
    name: { en: 'Sunset', 'zh-CN': '日落', 'pt-BR': 'Pôr do sol', 'zh-TW': '日落', ja: 'サンセット', ko: '선셋', es: 'Atardecer', fr: 'Coucher de soleil', de: 'Sonnenuntergang', it: 'Tramonto', ru: 'Закат', tr: 'Gün batımı', vi: 'Hoàng hôn', id: 'Senja' },
    about: { en: 'Travel, lifestyle, feeling', 'zh-CN': '旅行、生活、情感', 'pt-BR': 'Viagem, estilo de vida, emoção', 'zh-TW': '旅行、生活、情感', ja: '旅、暮らし、エモーショナル', ko: '여행, 라이프스타일, 감성', es: 'Viajes, estilo de vida, emoción', fr: 'Voyage, lifestyle, émotion', de: 'Reisen, Lifestyle, Gefühl', it: 'Viaggi, lifestyle, emozione', ru: 'Путешествия, жизнь, чувства', tr: 'Seyahat, yaşam, duygu', vi: 'Du lịch, đời sống, cảm xúc', id: 'Perjalanan, gaya hidup, perasaan' }
  },
  aurora: {
    swatch: '#071526',
    name: { en: 'Aurora', 'zh-CN': '极光', 'pt-BR': 'Aurora', 'zh-TW': '極光', ja: 'オーロラ', ko: '오로라', es: 'Aurora', fr: 'Aurore', de: 'Polarlicht', it: 'Aurora', ru: 'Сияние', tr: 'Kutup ışığı', vi: 'Cực quang', id: 'Aurora' },
    about: { en: 'Space, wonders of nature', 'zh-CN': '太空、自然奇观', 'pt-BR': 'Espaço, maravilhas da natureza', 'zh-TW': '太空、自然奇觀', ja: '宇宙、自然の神秘', ko: '우주, 자연의 경이', es: 'Espacio, maravillas naturales', fr: 'Espace, merveilles de la nature', de: 'Weltraum, Naturwunder', it: 'Spazio, meraviglie della natura', ru: 'Космос, чудеса природы', tr: 'Uzay, doğa harikaları', vi: 'Vũ trụ, kỳ quan thiên nhiên', id: 'Antariksa, keajaiban alam' }
  },
  royal: {
    swatch: '#2a1240',
    name: { en: 'Royal', 'zh-CN': '皇家紫金', 'pt-BR': 'Real', 'zh-TW': '皇家紫金', ja: 'ロイヤル', ko: '로열', es: 'Real', fr: 'Royal', de: 'Royal', it: 'Reale', ru: 'Королевский', tr: 'Kraliyet', vi: 'Hoàng gia', id: 'Royal' },
    about: { en: 'History, money, luxury', 'zh-CN': '历史、财经、奢华', 'pt-BR': 'História, dinheiro, luxo', 'zh-TW': '歷史、財經、奢華', ja: '歴史、お金、ラグジュアリー', ko: '역사, 돈, 럭셔리', es: 'Historia, dinero, lujo', fr: 'Histoire, argent, luxe', de: 'Geschichte, Geld, Luxus', it: 'Storia, denaro, lusso', ru: 'История, деньги, роскошь', tr: 'Tarih, para, lüks', vi: 'Lịch sử, tiền bạc, xa xỉ', id: 'Sejarah, uang, kemewahan' }
  },
  terminal: {
    swatch: '#050c07',
    name: { en: 'Terminal', 'zh-CN': '终端', 'pt-BR': 'Terminal', 'zh-TW': '終端機', ja: 'ターミナル', ko: '터미널', es: 'Terminal', fr: 'Terminal', de: 'Terminal', it: 'Terminale', ru: 'Терминал', tr: 'Terminal', vi: 'Terminal', id: 'Terminal' },
    about: { en: 'Code, hacking, security, AI', 'zh-CN': '编程、黑客、安全、AI', 'pt-BR': 'Código, hacking, segurança, IA', 'zh-TW': '程式、駭客、資安、AI', ja: 'コード、ハッキング、セキュリティ、AI', ko: '코드, 해킹, 보안, AI', es: 'Código, hacking, seguridad, IA', fr: 'Code, hacking, sécurité, IA', de: 'Code, Hacking, Sicherheit, KI', it: 'Codice, hacking, sicurezza, IA', ru: 'Код, хакинг, безопасность, ИИ', tr: 'Kod, hackleme, güvenlik, YZ', vi: 'Lập trình, hack, bảo mật, AI', id: 'Kode, peretasan, keamanan, AI' }
  },
  chalk: {
    swatch: '#2b453a',
    name: { en: 'Chalkboard', 'zh-CN': '黑板', 'pt-BR': 'Lousa', 'zh-TW': '黑板', ja: '黒板', ko: '칠판', es: 'Pizarra', fr: 'Tableau noir', de: 'Tafel', it: 'Lavagna', ru: 'Доска', tr: 'Kara tahta', vi: 'Bảng đen', id: 'Papan tulis' },
    about: { en: 'Math, lessons, how things work', 'zh-CN': '数学、课堂、原理讲解', 'pt-BR': 'Matemática, aulas, como funciona', 'zh-TW': '數學、課堂、原理講解', ja: '数学、授業、しくみ', ko: '수학, 수업, 원리', es: 'Matemáticas, clases, cómo funciona', fr: 'Maths, cours, comment ça marche', de: 'Mathe, Unterricht, wie es funktioniert', it: 'Matematica, lezioni, come funziona', ru: 'Математика, уроки, как это работает', tr: 'Matematik, dersler, nasıl çalışır', vi: 'Toán, bài giảng, cách hoạt động', id: 'Matematika, pelajaran, cara kerja' }
  },
  mint: {
    swatch: '#e3f5ec',
    name: { en: 'Mint', 'zh-CN': '薄荷', 'pt-BR': 'Menta', 'zh-TW': '薄荷', ja: 'ミント', ko: '민트', es: 'Menta', fr: 'Menthe', de: 'Minze', it: 'Menta', ru: 'Мята', tr: 'Nane', vi: 'Bạc hà', id: 'Mint' },
    about: { en: 'Health, money tips, how-tos', 'zh-CN': '健康、理财小技巧、教程', 'pt-BR': 'Saúde, dicas de dinheiro, tutoriais', 'zh-TW': '健康、理財小技巧、教學', ja: '健康、お金のコツ、ハウツー', ko: '건강, 돈 관리 팁, 사용법', es: 'Salud, consejos de dinero, tutoriales', fr: 'Santé, conseils d’argent, tutos', de: 'Gesundheit, Geldtipps, Anleitungen', it: 'Salute, consigli sui soldi, tutorial', ru: 'Здоровье, советы о деньгах, инструкции', tr: 'Sağlık, para ipuçları, nasıl yapılır', vi: 'Sức khỏe, mẹo tài chính, hướng dẫn', id: 'Kesehatan, tips keuangan, tutorial' }
  },
  blush: {
    swatch: '#fbe3e6',
    name: { en: 'Blush', 'zh-CN': '樱粉', 'pt-BR': 'Rosé', 'zh-TW': '櫻粉', ja: 'ブラッシュ', ko: '블러시', es: 'Rubor', fr: 'Rose poudré', de: 'Rosé', it: 'Cipria', ru: 'Румянец', tr: 'Allık', vi: 'Hồng phấn', id: 'Blush' },
    about: { en: 'Beauty, relationships, self-care', 'zh-CN': '美妆、情感关系、自我关怀', 'pt-BR': 'Beleza, relacionamentos, autocuidado', 'zh-TW': '美妝、情感關係、自我照顧', ja: '美容、人間関係、セルフケア', ko: '뷰티, 관계, 셀프케어', es: 'Belleza, relaciones, autocuidado', fr: 'Beauté, relations, bien-être', de: 'Beauty, Beziehungen, Selbstfürsorge', it: 'Bellezza, relazioni, cura di sé', ru: 'Красота, отношения, забота о себе', tr: 'Güzellik, ilişkiler, öz bakım', vi: 'Làm đẹp, các mối quan hệ, chăm sóc bản thân', id: 'Kecantikan, hubungan, merawat diri' }
  },
  slate: {
    swatch: '#eceff4',
    name: { en: 'Slate', 'zh-CN': '商务灰', 'pt-BR': 'Ardósia', 'zh-TW': '商務灰', ja: 'スレート', ko: '슬레이트', es: 'Pizarra gris', fr: 'Ardoise', de: 'Schiefer', it: 'Ardesia', ru: 'Сланец', tr: 'Arduvaz', vi: 'Xám đá', id: 'Batu tulis' },
    about: { en: 'Business, products, finance', 'zh-CN': '商业、产品、财经', 'pt-BR': 'Negócios, produtos, finanças', 'zh-TW': '商業、產品、財經', ja: 'ビジネス、製品、金融', ko: '비즈니스, 제품, 금융', es: 'Negocios, productos, finanzas', fr: 'Business, produits, finance', de: 'Business, Produkte, Finanzen', it: 'Business, prodotti, finanza', ru: 'Бизнес, продукты, финансы', tr: 'İş, ürünler, finans', vi: 'Kinh doanh, sản phẩm, tài chính', id: 'Bisnis, produk, keuangan' }
  }
}

export const LOOKS = ENGINE_LOOKS

// A frame each look renders, per style (engine/shotloop/looks/<id>-<style>.jpg,
// the same demo shot in every look)
const PREVIEWS = import.meta.glob('../../engine/shotloop/looks/*.jpg', { eager: true, import: 'default' }) as Record<string, string>
export const lookPreview = (id: string, style?: string | null) =>
  PREVIEWS[`../../engine/shotloop/looks/${id}-${style === 'scene' ? 'scene' : 'infographic'}.jpg`] ?? null

export const lookById = (id: string | null | undefined) => (id ? engineLook(id) : null)
export const lookSwatch = (id: string) => WORDS[id]?.swatch ?? lookById(id)?.text ?? null
export const lookName = (id: string) => WORDS[id]?.name[lang()] ?? lookById(id)?.name.en ?? id
export const lookAbout = (id: string) => WORDS[id]?.about[lang()] ?? ''
