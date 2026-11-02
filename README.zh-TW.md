<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>用程式碼做短影片，一個鏡頭一個鏡頭來。</b><br/>
一個想法會變成文案、分鏡，再變成由多個鏡頭組成的成片。每個鏡頭都有自己的循環：AI 撰寫，Shotloop 渲染，你來檢查，AI 再修改。修一個鏡頭只會重新渲染那一個，不必整支重做。</p>

<p align="center">
  <img src="docs/screenshots/hero.jpg" alt="Shotloop 編輯器：3D 機械錶，擺輪鏡頭的開頭、中間、結尾三張靜態畫面，下方是鏡頭列，左側是 AI 助理" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>下載 macOS 版</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">所有版本</a> ·
  <a href="#從原始碼建置">從原始碼建置</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>繁體中文</b> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## Shotloop 是什麼

Shotloop 是一款桌面應用程式，用程式碼「畫」出短影片：產品宣傳、科普解說、數據故事和簡報式動畫都適用。可以做 2D（逐格渲染的網頁）或 3D（像離線渲染器那樣渲染的 three.js 世界），共有八種視覺風格。

你只要寫一句話。AI 會挑選呈現方式（電影感場景、資訊圖表、地圖、介面示範、藍圖、動態文字、新聞敘事或 3D）和主題，你也可以自己選。接著它寫好開場鉤子、腳本和附來源的事實，再拆成分鏡，並寫好配音在每個鏡頭要說的台詞。你修改分鏡後，AI 建構每個鏡頭。在編輯器裡逐一檢視鏡頭，哪裡不對就用白話說，例如「字太小了」或「太靜了，加點動態」。AI 只改那個鏡頭，渲染後對照說明檢查，再給你看修改前後的對比。整支影片順了之後按「匯出」：鏡頭合併成片，鋪上配音和字幕，底下再墊上音樂；AI 依影片風格設計封面（或套用你的系列範本），並為各平台寫好發布文案，全部放進專屬的資料夾。

驅動它的 AI 就用你手上現有的：已登入的 Claude Code 或其他程式開發代理、用你自己金鑰的模型 API，或本機模型。

介面支援 14 種語言：English、简体中文、繁體中文、日本語、한국어、Español、Português、Français、Deutsch、Italiano、Русский、Türkçe、Tiếng Việt 和 Bahasa Indonesia。預設跟隨 Mac 的系統語言，AI 的回覆和發布文案也會使用你選的語言。

## 用 Shotloop 做的影片

下面每一格畫面，都是 Shotloop 用內建的[範例](examples/)渲染出來的。

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="機械錶轉動，再展開成機芯的爆炸圖" /><br/><sub><b>3D</b>：用 WebGL 做的機械錶。</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="一道光從太陽飛向地球，旁邊有計時器" /><br/><sub><b>2D</b>：陽光要多久才會到達地球。</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="0.99 的 365 次方曲線一路降到 0.027" /><br/><sub><b>2D 數據</b>：每天進步 1%，用圖表說明（16:9）。</sub></td>
</tr>
</table>

## 八種呈現想法的方式

AI 會依題材挑選合適的風格並說明理由；你可以在規劃頁切換，也可以在首頁直接指定。每張圖都是它所連結範例中的一格畫面。

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/styles/scene/1.jpg" alt="電影感場景" /></a><br/><sub><b>電影感場景</b>：光影、景深和移動的鏡頭，適合拍得到的東西：太空、自然、物理。</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/styles/infographic/1.jpg" alt="資訊圖表" /></a><br/><sub><b>資訊圖表</b>：圖表和跳動的數字，適合統計、比較、金錢。</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/styles/map/1.jpg" alt="地圖" /></a><br/><sub><b>地圖</b>：世界地圖、路線和逐一亮起的國家，適合地點與傳播路徑。</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/styles/ui/1.jpg" alt="介面示範" /></a><br/><sub><b>介面示範</b>：手機或瀏覽器上一步步操作，適合 App、設定和詐騙手法。</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/styles/blueprint/1.jpg" alt="藍圖" /></a><br/><sub><b>藍圖</b>：格線上的線稿、爆炸圖和標註，適合說明機器怎麼運作。</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/styles/kinetic/1.jpg" alt="動態文字" /></a><br/><sub><b>動態文字</b>：會動的超大字，適合名言、詞語和破解迷思。</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/styles/news/1.jpg" alt="新聞敘事" /></a><br/><sub><b>新聞敘事</b>：有張力地講突發事件：不停走的時鐘、資金流向、時間軸、誰說了什麼。</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b>：three.js 世界，攝影棚燈光、柔和陰影，鏡頭在空間中穿梭。</sub></td>
</tr>
</table>

2D 影片遵循一套規則：硬性規則確保每一格畫面乾淨、內容真實（不遮擋、沒有垃圾畫面、每句字幕都讀得完、如實呈現、註明來源）；品味規則是我們的預設值，你可以在「設定 → 規則」裡改寫、關閉或新增；還有一個動畫手法工具箱，可以加入你自己的手法。規則寫在 [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs)，每個 2D 提示詞裡都帶著。

## 功能導覽

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home.jpg"><img src="docs/screenshots/home.jpg" alt="首頁：想法輸入框，可選 2D/3D、畫面比例、長度、風格和主題，下方是可依風格篩選的範例" /></a><br/>
<sub><b>首頁</b>：一句話就好。2D 或 3D、長度、風格和主題都可以維持「自動」，也可以從範例開始。</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan.jpg"><img src="docs/screenshots/plan.jpg" alt="規劃頁：左側是文案、開場鉤子、腳本和附來源的事實，右側是分鏡" /></a><br/>
<sub><b>文案與分鏡</b>：開場鉤子、腳本、附來源的事實，以及每個鏡頭要呈現的內容，渲染前都能修改。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="編輯器：舞台上是 2D 鏡頭，下方是鏡頭列" /></a><br/>
<sub><b>編輯器</b>：深色舞台上的鏡頭、鏡頭列，以及每個鏡頭的說明與檢查。</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent.jpg"><img src="docs/screenshots/agent.jpg" alt="AI 助理的回覆，附修改前後對比" /></a><br/>
<sub><b>AI 助理</b>：說出哪裡不對，AI 就修好那個鏡頭。拖動分隔線即可對比修改前後。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="匯出對話框：封面、名稱和資料夾、影片的畫面比例與配樂，以及發布文案" /></a><br/>
<sub><b>匯出</b>：勾選影片（直式、橫式）、封面和發布文案，匯出前可先編輯封面和文案。每次匯出都放進各自的資料夾。</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="設定：模型與供應商，已偵測到 Claude Code" /></a><br/>
<sub><b>模型與供應商</b>：已登入的 CLI 代理、用你金鑰的模型 API，或本機模型。</sub>
</td>
</tr>
</table>

## 運作原理

```mermaid
flowchart LR
  A[想法] --> B[文案與分鏡]
  B --> C[建構每個鏡頭]
  C --> D{檢查鏡頭}
  D -- "說出哪裡不對" --> E[AI 修改這個鏡頭] --> F[渲染並檢查] --> D
  D -- 沒問題 --> G[匯出：合併、配音、配樂、發布文案]
```

- **以鏡頭為單位，而不是整支一次渲染。** 一支影片就是一串鏡頭，每個鏡頭是一小段程式 `shot.js`，畫出時間 t 的畫面：2D 是頁面，3D 是 three.js 世界。每個鏡頭依輸入的雜湊值快取，所以修一個鏡頭只要幾秒，匯出時只是把片段接起來。
- **用白話修改。** AI 只動你目前所在的鏡頭，除非修改必須改到共用的場景。它會渲染靜態畫面，依檢查清單核對（看得清楚、沒被遮住、避開字幕區等），再回報改了什麼。
- **八種視覺風格。** 電影感場景、資訊圖表、地圖、介面示範、藍圖、動態文字、新聞敘事和 3D，各有自己的工具組和參考畫面，AI 在選擇與建構前都會先看過（[`engine/shotloop/styles.mjs`](engine/shotloop/styles.mjs)）。主題只決定背景和字體；圖像和數據保留題材所需的顏色。
- **規劃會依規則檢查。** 建構之前，先檢查每句字幕的長度和停留時間。在多個鏡頭中重複出現的圖像只畫一次、共用，確保每次看起來都一樣。
- **事實附來源。** 文案中每條事實都緊跟著來源，發布文案也只能使用文案裡的事實。
- **封面。** AI 依影片風格設計封面，並自行檢查渲染結果。可以存成範本讓系列保持一致，也可以上傳一張喜歡的封面，讓 AI 照著它的設計做。
- **配音，在你的 Mac 上配音，需要時才開。** 預設不配音：由畫面決定節奏，用畫面上的字幕。開啟後每個鏡頭有一句台詞，由配音帶動剪接：鏡頭長度跟著台詞走，畫面落在說到的字詞上。也可以在鏡頭都做好之後再補旁白：台詞依鏡頭長度來寫，鏡頭時長不變，稍長的一句會自然延續到下一個鏡頭。英文用 Kokoro，中文用 CosyVoice 2，其他語言用 Supertonic，全部離線執行。字幕依說出的話自動產生，並會檢查列出字幕會遮住的內容（文字和標記的主體），被遮住的影片絕不會匯出。
- **畫面定了再做聲音。** 在編輯器點「聲音」，AI 會看過整部影片，依每個鏡頭程式碼裡的動作時間點在節拍上加音效，並挑一個環境音。之後可以在目前鏡頭附近逐軌試聽配音、配樂、環境音、音效或全部一起，就地調整，也能逐一關掉音效。
- **配樂貼合剪接。** 合成的配樂會調整節拍，讓剪接點落在拍子上，一路播到最後一格再淡出。有配音時配樂會壓低，說話時再退讓一些。
- **像離線渲染器一樣的 3D，幾分鐘完成。** 每一格 3D 畫面都由多個子格平均而成（反鋸齒、柔和陰影、環境光遮蔽、景深、動態模糊），約半秒一格，30 秒的影片幾分鐘就能渲染完，不必安裝任何東西。
- **素材庫：模型和音訊。** 用你自己的金鑰在 [Poly Pizza](https://poly.pizza) 和 [Smithsonian Open Access](https://www.si.edu/openaccess) 搜尋 CC0 模型；在 [Openverse](https://openverse.org)（Freesound、Wikimedia、Jamendo）搜尋音效、環境音和音樂，不需要金鑰，下載前可以先試聽。每個素材只下載一次，任何專案都能加入：模型放進 3D 世界，音訊放在畫面節拍上，或鋪在整部影片底下當環境音。

## 驅動它的 AI

| 模式 | 需要什麼 |
| --- | --- |
| **本機 CLI 代理** | 在這台 Mac 上已登入的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（Codex CLI 和 Gemini CLI 為實驗性支援）。它以無介面模式執行，自帶的工具全部關閉，只透過 Shotloop 提供的工具工作。 |
| **模型 API** | 你自己的金鑰。內建 Anthropic、OpenAI、Google Gemini、OpenRouter、xAI、Mistral、Together、DeepSeek、Qwen、Kimi、GLM、MiniMax、Doubao 和 SiliconFlow 預設，也支援任何相容 Anthropic 或 OpenAI 的端點。金鑰只存在你的 Mac 上。 |
| **本機模型** | Ollama、LM Studio、vLLM、llama.cpp，或任何相容 OpenAI 的伺服器。 |

模型需要支援工具呼叫，檢查則需要能看圖的模型。代理只能使用一小組工具：讀寫鏡頭檔案、渲染靜態畫面、回報檢查結果，無法執行 shell 指令。

## 安裝

1. 從[最新版本](https://github.com/chihyungchang/Shotloop/releases/latest)下載 `Shotloop_<version>_aarch64.dmg`，打開後把 Shotloop 拖進「應用程式」。
2. 需要安裝 **Google Chrome**（2D 鏡頭用它渲染）。
3. 在「設定 → 模型與供應商」選擇 AI。如果 Mac 上已經有 Claude Code，會自動幫你選好。

> **第一次開啟：** Shotloop 尚未經過 Apple 公證，macOS 會顯示無法驗證開發者。請從 **系統設定 → 隱私權與安全性 → 強制打開** 開啟一次，或在終端機執行 `xattr -dr com.apple.quarantine /Applications/Shotloop.app`。之後就能正常開啟，更新也不會再詢問。

Node.js、ffmpeg 和配音的語音引擎已內建在 App 中。語音模型則沒有：影片第一次用到某種語言配音時才下載（英文用的 Kokoro 132 MB；中文用的 CosyVoice 2 約 5 GB，含它執行所需的 Python；用於其他語言的 Supertonic 400 MB），會顯示進度條；也可以事先在「設定 → 相依元件」下載。「設定 → 關於」列出所有第三方元件及其授權。Shotloop 會從 GitHub 檢查更新並直接安裝。支援 Apple 晶片（M1 以後）的 Mac。

## 從原始碼建置

```bash
nvm use                      # Node 22.18+ (the agent runs TypeScript directly)
corepack enable              # once: provides the pinned pnpm
pnpm install
pnpm app                     # tauri dev; needs the Rust toolchain
pnpm app:build               # Shotloop.app and a dmg, with Node and ffmpeg inside
```

`pnpm app` 使用你 Mac 上的 Node 和 ffmpeg，所有東西都直接從程式碼目錄執行。發布版本會為自動更新簽署，並透過 [`app/scripts/release.mjs`](app/scripts/release.mjs) 發布。

<details>
<summary><b>在終端機使用引擎</b></summary>

```bash
pnpm shotloop status   fixtures/ep01-password-crack-time
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu --stills   # start/middle/end
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu            # a clip
pnpm shotloop export   fixtures/ep01-password-crack-time                                   # only changed shots render
pnpm shotloop new      my-short --idea "手機電池為什麼會老化？" --track auto --duration auto
pnpm shotloop new      coffee --idea "咖啡從哪裡來？" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/ep01-password-crack-time --to ~/Movies/Shotloop --name "Hello"   # into a new folder there
pnpm shotloop covers   list                                         # cover templates
pnpm shotloop voice    my-short --on --voice af_heart --fit        # the voice-over: speak the lines, fit the shots
pnpm shotloop check-subtitles my-short                              # what the subtitles would cover (fails if anything)
pnpm shotloop voice-models --download kokoro-en                     # a speech model, ahead of time
pnpm shotloop doctor
```

加上 `--json` 會逐行輸出事件（App 讀取的就是這個）。代理也用同樣方式執行：

```bash
node agent/src/main.ts detect                                         # CLI agents and local servers on this Mac
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/ep01-password-crack-time --shot 01-password-field-dots
pnpm test                                                             # every backend against scripted stand-ins
```

</details>

<details>
<summary><b>專案格式</b></summary>

```
my-video/
  shotloop.json        title, track (2d|3d), style, size, fps, lang, voice { on, voice, speed },
                       shots [{ id, title, duration, say (the spoken line), cues (its sentences' times) }]
  storyboard.json      the plan: copy (hook, script, facts with sources) and shots
  world/               page.html (2D: the style's kit; 3D: the WebGL kit), 2D: parts.js (pictures that
                       recur, drawn once), geo.data.js (the map style's countries); 3D: *.js (sets, machines)
  shots/<id>/          shot.js, notes.md (must show, on screen, motion, sound), sounds.json (its sound effects)
  assets/<id>/         models and sounds from the asset library
  copy.md  script.md  music.json  thumb.html  publish.json
  .shotloop/           cache: per shot and input hash, takes, checks, fixes; voice/: spoken lines, subtitles
  out/                 the engine's exports (timestamped); the app copies each into a new folder where you choose
```

- **3D**：`world/page.html` 是引擎的 WebGL 工具組（[`engine/shotloop/webgl.mjs`](engine/shotloop/webgl.mjs)）：一個 three.js 舞台，有攝影棚燈光、材質、形狀、glTF 模型、依鏡片參數運作的攝影機，以及疊在上面的文字。鏡頭共用的布景與機械放在 `world/*.js`；每個鏡頭在 `setup(ctx)` 裡建構要呈現的東西，在 `render(t)` 裡擺出時間 `t` 的姿態。
- **2D**：`shot.js` 預設匯出 `render(t, ctx)`，在鏡頭內時間 `t` 繪製 `world/page.html`。`ctx.voice` 存有這個鏡頭說出的句子和各自的時間，讓畫面能落在字詞上；用 `data-keep`（canvas 上則用 `subtitles.keep()`）標記主體，字幕檢查就會避開它。
- **快取**：鏡頭的鍵值由場景、程式碼、模型、渲染器和設定雜湊而成。沒變動的鏡頭會直接重用。

</details>

<details>
<summary><b>儲存庫結構</b></summary>

| 路徑 | 內容 |
| --- | --- |
| [`app/`](app/) | 桌面應用程式：Tauri 2（Rust）外殼，負責渲染佇列、自動更新和行程監管；React + TypeScript 介面。 |
| [`engine/shotloop/`](engine/shotloop/) | 鏡頭引擎：專案格式、逐鏡頭渲染快取、在 Chrome 中的 2D 與 3D（three.js）渲染、成片組裝、MP4 匯出、配音計時、字幕及其檢查、配樂、素材庫。App 透過它的 CLI 呼叫。 |
| [`voice/`](voice/) | 配音的文字轉語音，在這台 Mac 上執行：Kokoro（透過 sherpa-onnx）、Supertonic（基於 ONNX Runtime）和 CosyVoice 2（在本機的 Python 伺服器中執行），以及模型的下載。 |
| [`agent/`](agent/) | 代理：規劃、建構、白話修改、依檢查清單檢查、發布文案。支援 API、CLI（透過 MCP）和本機模型。 |
| [`examples/`](examples/) | 首頁提供的範例，皆為英文：每種視覺風格至少一個（2D 和 3D，9:16 和 16:9）。 |
| [`fixtures/`](fixtures/) | 測試和終端機示範用的專案。 |

</details>

## 致謝

Shotloop 建立在開源成果之上。感謝以下專案背後的人：

- **配音：** hexgrad 的 [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) 和 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)（英文）；FunAudioLLM 的 [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice)，以及 [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS)、[WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing)、[Whisper](https://github.com/openai/whisper)、[PyTorch](https://pytorch.org) 和 [Transformers](https://github.com/huggingface/transformers)（中文）；Supertone 的 [Supertonic](https://huggingface.co/Supertone/supertonic-3)（其他語言）；[ONNX Runtime](https://onnxruntime.ai)；執行中文配音的 [uv](https://github.com/astral-sh/uv) 和 [Python](https://www.python.org)。
- **算繪與成片：** [FFmpeg](https://ffmpeg.org)、透過 DevTools 協定驅動的 [Google Chrome](https://www.google.com/chrome/)、[three.js](https://threejs.org) 和 [Node.js](https://nodejs.org)。
- **App：** [Tauri](https://tauri.app)、[React](https://react.dev)、[Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) 和 [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)。
- **素材與資料：** [Kenney](https://kenney.nl)、[Poly Haven](https://polyhaven.com)、[Quaternius](https://quaternius.com)、[Poly Pizza](https://poly.pizza)、[Smithsonian Open Access](https://www.si.edu/openaccess)、[Openverse](https://openverse.org)，以及經由 [world-atlas](https://github.com/topojson/world-atlas) 提供的 [Natural Earth](https://www.naturalearthdata.com)。

「設定 → 關於」列出每個元件的版本和授權，詳情見 [NOTICE](NOTICE)。

## 隱私

Shotloop 每天最多一次向開發者傳送匿名計數：版本、晶片架構、介面語言，以及規劃、建構、修改和匯出了多少部影片（匯出依視覺風格統計），附一個隨機的安裝編號。絕不包含你的專案內容、名稱、文字、檔案或 API 金鑰，也不保存 IP 位址。第一次開啟時會告訴你；在 **設定 → 一般** 裡可以關閉。從原始碼建構的版本永遠不會傳送（[`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)）。完整的[隱私說明](https://oliverz.dev/zh-hant/products/shotloop/privacy)列出了 Shotloop 儲存和傳送的全部內容。

## 授權

[Apache License 2.0](LICENSE)；另見 [NOTICE](NOTICE)。素材庫中的模型和音訊保留各自的授權（CC0 或 CC-BY，署名會寫進專案），語音模型也一樣（Kokoro 和 CosyVoice 2：Apache-2.0；Supertonic：OpenRAIL-M）。
