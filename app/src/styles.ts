// The visual styles (engine/shotloop/styles.mjs) for Home and the plan
// page: id, name and what it suits per language, a reference still from
// the example that defines it, and the looks a style can draw with
import { lang, type Lang } from './i18n'
import scene from '../../engine/shotloop/styles/scene/1.jpg'
import infographic from '../../engine/shotloop/styles/infographic/1.jpg'
import threeD from '../../engine/shotloop/styles/3d/1.jpg'
import map from '../../engine/shotloop/styles/map/1.jpg'
import ui from '../../engine/shotloop/styles/ui/1.jpg'
import blueprint from '../../engine/shotloop/styles/blueprint/1.jpg'
import kinetic from '../../engine/shotloop/styles/kinetic/1.jpg'

type Words = Record<Lang, string>

export const STYLES: readonly { id: string; track: '2d' | '3d'; name: Words; about: Words; still: string; looks: readonly string[] | null }[] = [
  {
    id: 'scene', track: '2d', name: { en: 'Cinematic scene', 'zh-CN': '电影感场景', 'pt-BR': 'Cena cinematográfica', 'zh-TW': '電影感場景', ja: 'シネマティック', ko: '시네마틱 장면', es: 'Escena cinematográfica', fr: 'Scène cinématographique', de: 'Filmische Szene', it: 'Scena cinematografica', ru: 'Киносцена', tr: 'Sinematik sahne', vi: 'Cảnh điện ảnh', id: 'Adegan sinematik' },
    about: { en: 'Light, depth, a moving camera: space, nature, physics', 'zh-CN': '有光、有纵深、镜头在动：宇宙、自然、物理', 'pt-BR': 'Luz, profundidade, câmera em movimento: espaço, natureza, física', 'zh-TW': '有光、有景深、鏡頭在移動：宇宙、自然、物理', ja: '光、奥行き、動くカメラ：宇宙、自然、物理', ko: '빛, 깊이, 움직이는 카메라: 우주, 자연, 물리', es: 'Luz, profundidad, cámara en movimiento: espacio, naturaleza, física', fr: 'Lumière, profondeur, caméra en mouvement : espace, nature, physique', de: 'Licht, Tiefe, eine bewegte Kamera: Weltall, Natur, Physik', it: 'Luce, profondità, una camera in movimento: spazio, natura, fisica', ru: 'Свет, глубина, движущаяся камера: космос, природа, физика', tr: 'Işık, derinlik, hareket eden kamera: uzay, doğa, fizik', vi: 'Ánh sáng, chiều sâu, máy quay chuyển động: vũ trụ, thiên nhiên, vật lý', id: 'Cahaya, kedalaman, kamera bergerak: luar angkasa, alam, fisika' },
    still: scene, looks: ['midnight', 'neon', 'ocean', 'ember', 'forest', 'graphite']
  },
  {
    id: 'infographic', track: '2d', name: { en: 'Infographic', 'zh-CN': '信息图', 'pt-BR': 'Infográfico', 'zh-TW': '資訊圖表', ja: 'インフォグラフィック', ko: '인포그래픽', es: 'Infografía', fr: 'Infographie', de: 'Infografik', it: 'Infografica', ru: 'Инфографика', tr: 'İnfografik', vi: 'Đồ họa thông tin', id: 'Infografik' },
    about: { en: 'Charts and moving numbers: statistics, comparisons, money', 'zh-CN': '图表和会动的数字：统计、对比、金钱', 'pt-BR': 'Gráficos e números em movimento: estatísticas, comparações', 'zh-TW': '圖表和會動的數字：統計、比較、金錢', ja: 'グラフと動く数字：統計、比較、お金', ko: '차트와 움직이는 숫자: 통계, 비교, 돈', es: 'Gráficos y números en movimiento: estadísticas, comparaciones, dinero', fr: 'Graphiques et chiffres animés : statistiques, comparaisons, argent', de: 'Diagramme und bewegte Zahlen: Statistiken, Vergleiche, Geld', it: 'Grafici e numeri in movimento: statistiche, confronti, denaro', ru: 'Графики и движущиеся числа: статистика, сравнения, деньги', tr: 'Grafikler ve hareketli sayılar: istatistik, karşılaştırma, para', vi: 'Biểu đồ và con số chuyển động: thống kê, so sánh, tiền bạc', id: 'Grafik dan angka bergerak: statistik, perbandingan, uang' },
    still: infographic, looks: null
  },
  {
    id: 'map', track: '2d', name: { en: 'Map', 'zh-CN': '地图', 'pt-BR': 'Mapa', 'zh-TW': '地圖', ja: '地図', ko: '지도', es: 'Mapa', fr: 'Carte', de: 'Karte', it: 'Mappa', ru: 'Карта', tr: 'Harita', vi: 'Bản đồ', id: 'Peta' },
    about: { en: 'Places, routes, how things spread', 'zh-CN': '地点、路线、传播与分布', 'pt-BR': 'Lugares, rotas, como algo se espalha', 'zh-TW': '地點、路線、擴散與分布', ja: '場所、ルート、広がり方', ko: '장소, 경로, 무언가가 퍼지는 방식', es: 'Lugares, rutas, cómo se extiende algo', fr: 'Lieux, itinéraires, propagation', de: 'Orte, Routen, wie sich etwas ausbreitet', it: 'Luoghi, percorsi, come si diffondono le cose', ru: 'Места, маршруты, как что-то распространяется', tr: 'Yerler, rotalar, bir şeyin nasıl yayıldığı', vi: 'Địa điểm, lộ trình, cách mọi thứ lan rộng', id: 'Tempat, rute, cara sesuatu menyebar' },
    still: map, looks: null
  },
  {
    id: 'ui', track: '2d', name: { en: 'Interface demo', 'zh-CN': '界面演示', 'pt-BR': 'Demo de interface', 'zh-TW': '介面示範', ja: '画面デモ', ko: '인터페이스 데모', es: 'Demo de interfaz', fr: 'Démo d’interface', de: 'Interface-Demo', it: 'Demo di interfaccia', ru: 'Демо интерфейса', tr: 'Arayüz tanıtımı', vi: 'Demo giao diện', id: 'Demo antarmuka' },
    about: { en: 'Apps, settings, scams on a screen', 'zh-CN': 'App 技巧、设置、诈骗手法', 'pt-BR': 'Apps, configurações, golpes na tela', 'zh-TW': 'App 技巧、設定、詐騙手法', ja: 'アプリ、設定、画面上の詐欺の手口', ko: '앱, 설정, 화면 속 사기 수법', es: 'Apps, ajustes, estafas en pantalla', fr: 'Apps, réglages, arnaques à l’écran', de: 'Apps, Einstellungen, Betrugsmaschen auf dem Bildschirm', it: 'App, impostazioni, truffe sullo schermo', ru: 'Приложения, настройки, мошенничество на экране', tr: 'Ekranda uygulamalar, ayarlar, dolandırıcılıklar', vi: 'Ứng dụng, cài đặt, chiêu lừa đảo trên màn hình', id: 'Aplikasi, pengaturan, penipuan di layar' },
    still: ui, looks: null
  },
  {
    id: 'blueprint', track: '2d', name: { en: 'Blueprint', 'zh-CN': '剖面图纸', 'pt-BR': 'Planta técnica', 'zh-TW': '剖面圖', ja: '図面', ko: '설계도', es: 'Plano técnico', fr: 'Plan technique', de: 'Bauplan', it: 'Progetto tecnico', ru: 'Чертёж', tr: 'Teknik çizim', vi: 'Bản vẽ kỹ thuật', id: 'Cetak biru' },
    about: { en: 'How a machine works inside', 'zh-CN': '机器、装置内部怎么运作', 'pt-BR': 'Como uma máquina funciona por dentro', 'zh-TW': '機器內部如何運作', ja: '機械の中の仕組み', ko: '기계 내부가 작동하는 방식', es: 'Cómo funciona una máquina por dentro', fr: 'Le fonctionnement interne d’une machine', de: 'Wie eine Maschine innen funktioniert', it: 'Come funziona una macchina dentro', ru: 'Как машина устроена внутри', tr: 'Bir makinenin içi nasıl çalışır', vi: 'Máy móc vận hành bên trong ra sao', id: 'Cara kerja bagian dalam mesin' },
    still: blueprint, looks: null
  },
  {
    id: 'kinetic', track: '2d', name: { en: 'Kinetic type', 'zh-CN': '动态排版', 'pt-BR': 'Tipografia cinética', 'zh-TW': '動態文字', ja: 'モーションタイポ', ko: '키네틱 타이포', es: 'Tipografía cinética', fr: 'Typo animée', de: 'Kinetische Typo', it: 'Tipografia cinetica', ru: 'Кинетическая типографика', tr: 'Kinetik tipografi', vi: 'Chữ chuyển động', id: 'Tipografi kinetik' },
    about: { en: 'Quotes, words, myths: the text is the picture', 'zh-CN': '名言、词语、辟谣：文字就是画面', 'pt-BR': 'Citações, palavras, mitos: o texto é a imagem', 'zh-TW': '名言、字詞、破解迷思：文字就是畫面', ja: '名言、言葉、俗説：文字が絵になる', ko: '명언, 단어, 오해: 글자가 곧 그림', es: 'Citas, palabras, mitos: el texto es la imagen', fr: 'Citations, mots, idées reçues : le texte est l’image', de: 'Zitate, Wörter, Mythen: Der Text ist das Bild', it: 'Citazioni, parole, miti: il testo è l’immagine', ru: 'Цитаты, слова, мифы: текст и есть картинка', tr: 'Alıntılar, sözcükler, efsaneler: yazı görüntünün kendisi', vi: 'Trích dẫn, từ ngữ, ngộ nhận: chữ chính là hình', id: 'Kutipan, kata, mitos: teksnya adalah gambarnya' },
    still: kinetic, looks: null
  },
  {
    id: '3d', track: '3d', name: { en: '3D', 'zh-CN': '3D', 'pt-BR': '3D', 'zh-TW': '3D', ja: '3D', ko: '3D', es: '3D', fr: '3D', de: '3D', it: '3D', ru: '3D', tr: '3D', vi: '3D', id: '3D' },
    about: { en: 'Real objects and a camera through space', 'zh-CN': '真实的物体，镜头在空间里移动', 'pt-BR': 'Objetos reais e uma câmera no espaço', 'zh-TW': '真實的物體，鏡頭在空間中移動', ja: '本物の物体と空間を進むカメラ', ko: '실제 사물과 공간을 누비는 카메라', es: 'Objetos reales y una cámara que recorre el espacio', fr: 'De vrais objets et une caméra qui se déplace dans l’espace', de: 'Echte Objekte und eine Kamera, die durch den Raum fährt', it: 'Oggetti reali e una camera nello spazio', ru: 'Реальные объекты и камера в пространстве', tr: 'Gerçek nesneler ve uzayda dolaşan bir kamera', vi: 'Vật thể thật và máy quay di chuyển trong không gian', id: 'Benda nyata dan kamera yang bergerak di ruang' },
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
