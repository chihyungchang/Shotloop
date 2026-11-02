<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>Короткие видео-объяснялки из кода, кадр за кадром.</b><br/>
Идея превращается в текст, раскадровку и фильм из кадров. У каждого кадра свой цикл: ИИ пишет его, Shotloop рендерит, вы смотрите, ИИ исправляет. Правка перерендеривает только этот кадр, а не весь фильм.</p>

<p align="center">
  <img src="docs/screenshots/hero.jpg" alt="Студия Shotloop: 3D-разборка телефона, кадр с разнесённым видом как начальный, средний и конечный стоп-кадры, внизу лента кадров, слева ИИ-ассистент" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>Скачать для macOS</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">Релизы</a> ·
  <a href="#сборка-из-исходников">Сборка из исходников</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <b>Русский</b> · <a href="README.tr.md">Türkçe</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## Что такое Shotloop

Shotloop — десктопное приложение для коротких видео, нарисованных кодом: промо продуктов, научпоп, истории на данных и анимация в стиле слайдов. В 2D (веб-страницы, отрендеренные покадрово) или 3D (сцены Blender), в восьми визуальных стилях.

Вы начинаете с одного предложения. ИИ выбирает, как его показать (кинематографичная сцена, инфографика, карта, демо интерфейса, чертёж, кинетическая типографика, новостная история или 3D), и тему — если вы не выбрали сами. Он пишет хук, сценарий и факты с источниками, а затем разбивает всё на раскадровку — с репликой, которую голос за кадром произносит над каждым кадром. Вы правите раскадровку, ИИ собирает каждый кадр. В студии вы смотрите каждый кадр и простыми словами говорите, что не так, например «текст слишком мелкий» или «слишком статично, добавь движения». ИИ меняет этот кадр, рендерит, сверяет с заметками и показывает «до/после». Когда фильм готов, «Экспорт» склеивает кадры, кладёт озвучку с субтитрами и музыку под ними, ИИ делает обложку в стиле фильма (или заполняет шаблон вашей серии) и пишет пост для каждой площадки — всё в отдельную папку.

ИИ — тот, которым вы уже пользуетесь: Claude Code или другой агент для кода, в котором вы вошли в аккаунт, API модели с вашим ключом или локальная модель.

Приложение говорит на 14 языках: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português, Français, Deutsch, Italiano, Русский, Türkçe, Tiếng Việt и Bahasa Indonesia. Оно следует языку вашего Mac, а ИИ отвечает и пишет посты на выбранном вами языке.

## Сделано в Shotloop

Каждый кадр ниже отрендерен Shotloop из встроенных [примеров](examples/).

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="Телефон раскрывается в разнесённый вид по слоям" /><br/><sub><b>3D</b>: разборка телефона в Blender.</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="Импульс света летит от Солнца к Земле, рядом таймер" /><br/><sub><b>2D</b>: сколько солнечный свет идёт до Земли.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="График 0,99 в 365-й степени, падающий до 0,027" /><br/><sub><b>2D, данные</b>: на 1% лучше каждый день, в графиках (16:9).</sub></td>
</tr>
</table>

## Восемь способов показать идею

ИИ выбирает стиль под тему и объясняет почему; сменить его можно в плане или выбрать сразу на главной. Каждая картинка — кадр из примера, на который она ссылается.

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/styles/scene/1.jpg" alt="Кинематографичная сцена" /></a><br/><sub><b>Кинематографичная сцена</b>: свет, глубина и движущаяся камера — для того, что можно снять: космос, природа, физика.</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/styles/infographic/1.jpg" alt="Инфографика" /></a><br/><sub><b>Инфографика</b>: графики и живые цифры — для статистики, сравнений, денег.</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/styles/map/1.jpg" alt="Карта" /></a><br/><sub><b>Карта</b>: карта мира, маршруты и подсвеченные страны — для мест и распространения.</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/styles/ui/1.jpg" alt="Демо интерфейса" /></a><br/><sub><b>Демо интерфейса</b>: телефон или браузер, шаг за шагом — для приложений, настроек и мошеннических схем.</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/styles/blueprint/1.jpg" alt="Чертёж" /></a><br/><sub><b>Чертёж</b>: линии на сетке, разнесённые виды и выноски — чтобы показать, как работает механизм.</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/styles/kinetic/1.jpg" alt="Кинетическая типографика" /></a><br/><sub><b>Кинетическая типографика</b>: огромный движущийся текст — для цитат, слов и мифов.</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/styles/news/1.jpg" alt="Новостная история" /></a><br/><sub><b>Новостная история</b>: срочные события с напряжением — бегущие часы, след денег, хронология, кто что сказал.</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b>: сцены Blender с настоящим светом и камерой, летящей в пространстве.</sub></td>
</tr>
</table>

2D-видео следуют набору правил: жёстким, которые держат каждый кадр чистым, а видео правдивым (ничего не перекрыто, без битых кадров, время прочитать каждую строку, честность, указанные источники), и вкусу по умолчанию, который можно переписать, отключить или дополнить в разделе Настройки → Правила, а также набору анимационных приёмов, куда можно добавить свои. Они описаны в [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs) и попадают в каждый 2D-промпт.

## Обзор

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home.jpg"><img src="docs/screenshots/home.jpg" alt="Главная: поле для идеи с 2D/3D, форматом, длительностью, стилем и темой, ниже галерея примеров с фильтром по стилю" /></a><br/>
<sub><b>Главная</b>: одно предложение. 2D или 3D, длительность, стиль и тему можно оставить на «Авто». Или начните с примера из галереи.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan.jpg"><img src="docs/screenshots/plan.jpg" alt="Страница плана: текст, хук, сценарий и факты с источниками слева, раскадровка справа" /></a><br/>
<sub><b>Текст и раскадровка</b>: хук, сценарий и факты с источниками, а также кадры с описанием того, что в каждом. Всё можно править до рендера.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="Студия с 2D-кадром на сцене и лентой кадров" /></a><br/>
<sub><b>Студия</b>: кадр на тёмной сцене, лента кадров, заметки и проверки для каждого кадра.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent.jpg"><img src="docs/screenshots/agent.jpg" alt="Ответ ИИ-ассистента со сравнением до/после" /></a><br/>
<sub><b>ИИ-ассистент</b>: скажите, что не так, и ИИ исправит этот кадр. Тяните разделитель, чтобы сравнить до и после.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="Окно экспорта: обложка, имя и папка, видео с форматами и музыкой, текст для публикации" /></a><br/>
<sub><b>Экспорт</b>: отметьте видео (вертикальное, горизонтальное), обложку и текст для публикации; обложку и текст можно сначала отредактировать. Каждый экспорт — в своей папке.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="Настройки: модели и провайдеры, найден Claude Code" /></a><br/>
<sub><b>Модели и провайдеры</b>: CLI-агент, в котором вы вошли в аккаунт, API модели с вашим ключом или локальная модель.</sub>
</td>
</tr>
</table>

## Как это работает

```mermaid
flowchart LR
  A[Идея] --> B[Текст и раскадровка]
  B --> C[Собрать каждый кадр]
  C --> D{Проверить кадр}
  D -- "сказать, что не так" --> E[ИИ исправляет кадр] --> F[Рендер + проверка] --> D
  D -- всё хорошо --> G[Экспорт: склейка, озвучка, музыка, текст для публикации]
```

- **Кадры, а не один долгий рендер.** Фильм — это список кадров. Каждый кадр — маленькая программа: `shot.js` для 2D-страницы, `shot.py` для движения камеры в Blender. Каждый кешируется по хешу входных данных, поэтому правка перерендеривает один кадр за секунды (2D) или минуту (3D), а экспорт лишь склеивает клипы.
- **Правки простыми словами.** ИИ трогает только текущий кадр, если правка не требует менять общий мир. Он рендерит стоп-кадры, проверяет их по чек-листу (читаемо, ничего не перекрыто, вне зоны субтитров и т. д.) и сообщает, что изменил.
- **Восемь визуальных стилей.** Кинематографичная сцена, инфографика, карта, демо интерфейса, чертёж, кинетическая типографика, новостная история или 3D — у каждого свой набор инструментов и эталонные кадры, которые ИИ смотрит перед выбором и сборкой ([`engine/shotloop/styles.mjs`](engine/shotloop/styles.mjs)). Тема задаёт только фон и шрифт; картинки и данные сохраняют цвета, нужные их теме.
- **Правила, по которым проверяется план.** Подписи проверяются на длину и время показа ещё до сборки. Картинка, которая повторяется в нескольких кадрах, рисуется один раз и переиспользуется, поэтому везде выглядит одинаково.
- **Факты с источниками.** Текст хранит каждый факт рядом с источником, а текст для публикации может использовать только факты из текста.
- **Обложки.** ИИ делает обложку в стиле фильма и сам проверяет рендеры. Сохраните её как шаблон, чтобы серия выглядела единообразно, или загрузите понравившуюся обложку — ИИ повторит её дизайн.
- **Озвучка, синтезированная на вашем Mac.** У каждого кадра есть реплика, и голос ведёт монтаж: кадр длится столько, сколько его реплика, а картинка попадает в слова. Kokoro говорит по-английски, CosyVoice 2 — по-китайски, Supertonic — на остальных языках, всё офлайн. Субтитры произнесённых слов добавляются автоматически, а проверка перечисляет всё, что они закрыли бы (текст и отмеченный объект), так что фильм с закрытым содержимым не экспортируется. Для фильма только с подписями озвучку можно отключить.
- **Музыка под монтаж.** Синтезированный фон подстроен так, что склейки попадают в бит; он звучит до последнего кадра и плавно затихает. Под озвучкой он тише и приглушается, пока звучит реплика.
- **Быстро при правке, полное качество при экспорте.** 3D показывает быстрые превью во время работы и рендерит кадры в полном качестве только при экспорте. 2D всегда работает в полном качестве.
- **Библиотека ресурсов для 3D.** Ищите CC0-модели на [Poly Pizza](https://poly.pizza) и [Smithsonian Open Access](https://www.si.edu/openaccess) со своим ключом. Каждая модель скачивается один раз и добавляется в любой 3D-проект.

## Какой ИИ им управляет

| Режим | Что нужно |
| --- | --- |
| **Локальный CLI-агент** | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) с выполненным входом на этом Mac (Codex CLI и Gemini CLI — экспериментально). Работает в фоновом режиме с отключёнными собственными инструментами и действует только через инструменты Shotloop. |
| **API модели** | Ваш собственный ключ. Пресеты для Anthropic, OpenAI, Google Gemini, OpenRouter, xAI, Mistral, Together, DeepSeek, Qwen, Kimi, GLM, MiniMax, Doubao и SiliconFlow или любой эндпоинт, совместимый с Anthropic или OpenAI. Ключи остаются на вашем Mac. |
| **Локальная модель** | Ollama, LM Studio, vLLM, llama.cpp или любой OpenAI-совместимый сервер. |

Модели нужен вызов инструментов, а для проверок — умение видеть изображения. Агент работает через узкий набор инструментов: читает и пишет файлы кадра, рендерит стоп-кадры и сообщает результаты проверок. Выполнять команды оболочки он не может.

## Установка

1. Скачайте `Shotloop_<version>_aarch64.dmg` из [последнего релиза](https://github.com/chihyungchang/Shotloop/releases/latest), откройте его и перетащите Shotloop в «Программы».
2. Установите **Google Chrome** (в нём рендерятся 2D-кадры). Для 3D-проектов Shotloop попросит установить **Blender** при создании первого из них.
3. Выберите ИИ в «Настройки → Модели и провайдеры». Если Claude Code уже есть на вашем Mac, он будет выбран автоматически.

> **Первый запуск:** Shotloop пока не нотаризован Apple, поэтому macOS сообщает, что не может проверить разработчика. Откройте его один раз через **Системные настройки → Конфиденциальность и безопасность → Всё равно открыть** или выполните в Терминале `xattr -dr com.apple.quarantine /Applications/Shotloop.app`. После этого приложение открывается как обычно, а обновления ставятся без повторных вопросов.

Node.js, ffmpeg и движки синтеза речи для озвучки встроены в приложение. Голосовые модели — нет: каждая скачивается, когда фильм впервые говорит на её языках (Kokoro для английского 132 MB; CosyVoice 2 для китайского около 5 GB, вместе с Python, на котором он работает; Supertonic для остальных языков 400 MB), с индикатором прогресса, или заранее в «Настройки → Зависимости». В «Настройки → О программе» перечислены все сторонние компоненты с их лицензиями. Shotloop проверяет обновления на GitHub и устанавливает их на место. Работает на Mac с Apple silicon (M1 и новее).

## Сборка из исходников

```bash
nvm use                      # Node 22.18+ (агент запускает TypeScript напрямую)
corepack enable              # один раз: даёт зафиксированную версию pnpm
pnpm install
pnpm app                     # tauri dev; нужен тулчейн Rust
pnpm app:build               # Shotloop.app и dmg со встроенными Node и ffmpeg
```

`pnpm app` использует Node и ffmpeg вашего Mac и запускает всё прямо из рабочей копии. Релизы подписываются для апдейтера и публикуются через [`app/scripts/release.mjs`](app/scripts/release.mjs).

<details>
<summary><b>Движок из терминала</b></summary>

```bash
pnpm shotloop status   fixtures/hello-3d
pnpm shotloop render   fixtures/hello-3d --shot 02-close --stills   # начало/середина/конец
pnpm shotloop render   fixtures/hello-3d --shot 02-close            # клип в качестве редактора
pnpm shotloop export   fixtures/hello-3d                            # рендерятся только изменённые кадры
pnpm shotloop new      my-short --idea "Почему стареет аккумулятор телефона?" --track auto --duration auto
pnpm shotloop new      coffee --idea "Откуда берётся кофе?" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/hello-3d --to ~/Movies/Shotloop --name "Hello"   # в новую папку там
pnpm shotloop covers   list                                         # шаблоны обложек
pnpm shotloop voice    my-short --on --voice af_heart --fit        # озвучка: произнести реплики, подогнать кадры
pnpm shotloop check-subtitles my-short                              # что закрыли бы субтитры (ошибка, если хоть что-то)
pnpm shotloop voice-models --download kokoro-en                     # модель речи, заранее
pnpm shotloop doctor
```

Добавьте `--json`, чтобы получать события построчно (их и читает приложение). Агент запускается так же:

```bash
node agent/src/main.ts detect                                         # CLI-агенты и локальные серверы на этом Mac
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/hello-3d --shot 01-wide
pnpm test                                                             # каждый бэкенд против скриптовых заглушек
```

</details>

<details>
<summary><b>Формат проекта</b></summary>

```
my-video/
  shotloop.json        название, трек (2d|3d), стиль, размер, fps, язык, голос { on, voice, speed },
                       кадры [{ id, title, duration, say (произносимая реплика), cues (время её предложений) }]
  storyboard.json      план: текст (хук, сценарий, факты с источниками) и кадры
  world/               3D: world.py (+ screen.html); 2D: page.html (набор стиля), parts.js (повторяющиеся
                       картинки, нарисованные один раз), geo.data.js (страны для стиля «Карта»)
  shots/<id>/          shot.py | shot.js, notes.md (что показать, текст на экране, движение)
  assets/<id>/         3D-модели из библиотеки ресурсов
  copy.md  script.md  captions.html  music.json  thumb.html  publish.json
  .shotloop/           кеш: по кадру и хешу входных данных, дубли, проверки, правки; voice/: произнесённые реплики, субтитры
  out/                 экспорты движка (с отметкой времени); приложение копирует каждый в новую папку, где вы укажете
```

- **3D**: `world.py` строит общий мир с помощью `kit` ([`engine/shotloop/blender/kit/kit.py`](engine/shotloop/blender/kit/kit.py)). `shot.py` выполняется в пространстве имён мира и создаёт одну камеру; `at(t)` переводит локальные секунды кадра во время фильма.
- **2D**: `shot.js` по умолчанию экспортирует `render(t, ctx)`, который рисует `world/page.html` в локальное время кадра `t`. В `ctx.voice` лежат произносимые в кадре предложения с их временем, чтобы картинка попадала в слова; отметьте объект через `data-keep` (или `subtitles.keep()` на canvas), чтобы проверка субтитров держала его открытым.
- **Кеш**: ключ кадра — хеш мира, его кода, подписей, ресурсов, рендерера и настроек. Неизменённые кадры переиспользуются.

</details>

<details>
<summary><b>Структура репозитория</b></summary>

| Путь | Что там |
| --- | --- |
| [`app/`](app/) | Десктопное приложение: оболочка на Tauri 2 (Rust) с очередью рендера, апдейтером и контролем процессов, плюс интерфейс на React + TypeScript. |
| [`engine/shotloop/`](engine/shotloop/) | Движок кадров: формат проекта, кеш рендера по кадрам, рендер 2D (Chrome) и 3D (Blender), сборка фильма, экспорт в MP4, тайминг озвучки, субтитры и их проверка, музыка, библиотека ресурсов. CLI, который вызывает приложение. |
| [`voice/`](voice/) | Синтез речи для озвучки, на этом Mac: Kokoro через sherpa-onnx, Supertonic на ONNX Runtime и CosyVoice 2 в локальном Python-сервере, со скачиванием моделей. |
| [`agent/`](agent/) | Агент: планирование, сборка, правки простыми словами, проверки по чек-листу, текст для публикации. Поддерживает API, CLI (через MCP) и локальные модели. |
| [`examples/`](examples/) | Примеры с главной, на английском: минимум один на каждый визуальный стиль (2D и 3D, 9:16 и 16:9). |
| [`fixtures/`](fixtures/) | Проекты для тестов и пошаговых примеров в терминале. |

</details>

## Благодарности

Shotloop стоит на работе open source. Спасибо людям, которые создают:

- **Озвучка:** [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) от hexgrad и [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (английский); [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice) от FunAudioLLM с [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS), [WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing), [Whisper](https://github.com/openai/whisper), [PyTorch](https://pytorch.org) и [Transformers](https://github.com/huggingface/transformers) (китайский); [Supertonic](https://huggingface.co/Supertone/supertonic-3) от Supertone (остальные языки); [ONNX Runtime](https://onnxruntime.ai); [uv](https://github.com/astral-sh/uv) и [Python](https://www.python.org), на которых работает китайский голос.
- **Рендер и фильм:** [FFmpeg](https://ffmpeg.org), [Google Chrome](https://www.google.com/chrome/) через протокол DevTools, [Blender](https://www.blender.org) и [Node.js](https://nodejs.org).
- **Приложение:** [Tauri](https://tauri.app), [React](https://react.dev), [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) и [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk).
- **Ресурсы и данные:** [Kenney](https://kenney.nl), [Poly Haven](https://polyhaven.com), [Quaternius](https://quaternius.com), [Poly Pizza](https://poly.pizza), [Smithsonian Open Access](https://www.si.edu/openaccess) и [Natural Earth](https://www.naturalearthdata.com) через [world-atlas](https://github.com/topojson/world-atlas).

В «Настройки → О программе» перечислены все компоненты с версиями и лицензиями, а подробности — в [NOTICE](NOTICE).

## Конфиденциальность

Раз в день Shotloop отправляет автору анонимные счётчики: версию, чип, язык интерфейса и сколько фильмов было спланировано, собрано, исправлено и экспортировано (экспорт — по визуальным стилям), со случайным ID установки. Никогда — ваши проекты, их названия и тексты, файлы или ключи API; IP-адреса не сохраняются. При первом запуске об этом сообщается; отключить можно в **Настройки → Основные**. Сборки из исходного кода ничего не отправляют ([`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)). Всё, что Shotloop хранит и отправляет, описано в [полном уведомлении о конфиденциальности](https://oliverz.dev/ru/products/shotloop/privacy).

## Лицензия

[Apache License 2.0](LICENSE); см. также [NOTICE](NOTICE). Модели из библиотеки ресурсов сохраняют собственные лицензии (CC0 или CC-BY, с указанием авторства в проекте), как и голосовые модели (Kokoro и CosyVoice 2: Apache-2.0; Supertonic: OpenRAIL-M).
