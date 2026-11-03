<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>用 AI 做短视频。改一个镜头，不用重做整部片子。</b><br/>
一个想法会变成文案、分镜和由多个镜头组成的成片。每个镜头都有自己的循环：AI 编写，Shotloop 渲染，你来检查，AI 来修改。修一个镜头只重新渲染这一个，不用重做整部片子。</p>

<p align="center">
  <img src="docs/screenshots/hero-zh.jpg" alt="Shotloop 工作室：3D 机械表项目，舞台上是摆轮镜头的开头、中间、结尾三帧，下方是镜头条，左边是 AI 镜头助手" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>下载 macOS 版</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">所有版本</a> ·
  <a href="#从源码运行">从源码运行</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><a href="README.md">English</a> · <b>简体中文</b> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## Shotloop 是什么

Shotloop 是一个桌面应用，用代码"画"短视频，适合做产品宣传、科普视频、数据可视化和 PPT 式动画。有两种做法：2D 是逐帧渲染的网页，3D 是像离线渲染器那样渲染的 three.js 世界；画面方式共有八种。

你只需要写一句话。AI 会根据题目选择画面方式（电影感场景、信息图、地图、界面演示、剖面图纸、动态排版、新闻叙事或 3D）和主题色，你也可以自己选。接着它写好开头钩子、文案和带来源的事实，再拆成分镜，并写好每个镜头的配音台词。你改好分镜后，AI 生成每个镜头。在工作室里逐个看镜头，有问题就用大白话说出来，比如"字太小了""太静了，加点动效"。AI 先看一遍，给你几个改法；你选一个（或者说说你的想法），它再只改这一个镜头，并给你看改动前后的对比。整片满意后点导出：镜头拼接成片，铺上配音和字幕，下面垫上音乐；AI 按视频的风格设计封面（也可以套用你的系列模版），并为各个平台写好发布文案，全部放进一个单独的文件夹。

驱动它的 AI 就用你已有的：已登录的 Claude Code 等命令行工具、自带 key 的模型 API，或者本地模型。

界面支持 14 种语言：English、简体中文、繁體中文、日本語、한국어、Español、Português、Français、Deutsch、Italiano、Русский、Türkçe、Tiếng Việt 和 Bahasa Indonesia。默认跟随 Mac 的系统语言；AI 的回复和发布文案也用你选的语言。

## 用 Shotloop 做的片子

下面每一帧都是 Shotloop 用自带的[示例](examples/)渲染出来的。

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="机械表转动，再展开成机芯的爆炸图" /><br/><sub><b>3D</b>：用 WebGL 做的机械表。</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="一束光从太阳飞向地球，旁边是计时器" /><br/><sub><b>2D</b>：阳光到地球要走多久。</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="0.99 的 365 次方曲线一路降到 0.027" /><br/><sub><b>2D 数据</b>：每天进步 1%，用图表讲复利（16:9）。</sub></td>
</tr>
</table>

## 八种画面方式

AI 会按题目挑选最合适的画面方式并说明理由；你可以在策划页切换，也可以在首页直接指定。每张图都来自它链接的示例。

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/styles/scene/1.jpg" alt="电影感场景" /></a><br/><sub><b>电影感场景</b>： 有光、有纵深、镜头在动，适合能“拍到”的东西：宇宙、自然、物理。</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/styles/infographic/1.jpg" alt="信息图" /></a><br/><sub><b>信息图</b>： 图表和会动的数字，适合统计、对比、金钱。</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/styles/map/1.jpg" alt="地图" /></a><br/><sub><b>地图</b>： 世界地图、航线、国家被点亮，适合地点、路线、传播与分布。</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/styles/ui/1.jpg" alt="界面演示" /></a><br/><sub><b>界面演示</b>： 手机或浏览器上一步步演示，适合 App 技巧、设置、诈骗手法。</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/styles/blueprint/1.jpg" alt="剖面图纸" /></a><br/><sub><b>剖面图纸</b>： 网格上的线稿、拆解、标注，适合讲机器和装置怎么运作。</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/styles/kinetic/1.jpg" alt="动态排版" /></a><br/><sub><b>动态排版</b>： 会动的大字，适合名言、词语、辟谣。</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/styles/news/1.jpg" alt="新闻叙事" /></a><br/><sub><b>新闻叙事</b>：有张力地讲突发事件：不停走的时钟、资金流向、时间线、谁说了什么。</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b>：three.js 世界，影棚灯光、柔和阴影，镜头在空间里移动。</sub></td>
</tr>
</table>

2D 视频遵循一套规则：硬性规则保证每一帧干净、内容真实（不遮挡、没有垃圾画面、每句字幕都读得完、如实呈现、注明来源）；品味规则是我们的默认值，你可以在“设置 → 规则”里改写、关闭或添加；还有一个动画手法工具箱，可以加入你自己的手法。规则写在 [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs)，每个 2D 提示词里都带着。“运行检查”会对照这些规则审核镜头，每个没通过的项都链接到对应的规则。

## 功能一览

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home-zh.jpg"><img src="docs/screenshots/home-zh.jpg" alt="首页：输入想法，选择 2D/3D、画幅、时长、画面方式和主题色，下面是可按画面方式筛选的示例画廊" /></a><br/>
<sub><b>首页</b>：一句话。2D/3D、时长、画面方式和主题色都可以交给“自动”，也可以从示例画廊开始。</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan-zh.jpg"><img src="docs/screenshots/plan-zh.jpg" alt="策划页：左边是文案、钩子和带来源的事实，右边是分镜" /></a><br/>
<sub><b>文案与分镜</b>：开头钩子、文案、带来源的事实，以及每个镜头要呈现的内容。渲染之前都可以修改。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="工作室：舞台上是 2D 镜头，下面是镜头条" /></a><br/>
<sub><b>工作室</b>：深色舞台上的镜头、镜头条和下面的声音音轨，以及每个镜头的说明与检查。</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent-zh.jpg"><img src="docs/screenshots/agent-zh.jpg" alt="AI 镜头助手的回复，带改动前后对比图" /></a><br/>
<sub><b>AI 镜头助手</b>：说出哪里不对，AI 先给你几个改法，选一个（或者说说你的想法），它再修改这个镜头。拖动分割线可以对比改动前后。</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="导出对话框：封面、名称和导出位置、视频画幅与配乐，以及发布文案" /></a><br/>
<sub><b>导出</b>：勾选要导出的视频（竖屏、横屏）、封面和发布文案，导出前可以先编辑封面和文案。每次导出都放进一个单独的文件夹。</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="设置：模型与服务商，已检测到 Claude Code" /></a><br/>
<sub><b>模型与服务商</b>：已登录的命令行工具、自带 key 的模型 API，或本地模型。</sub>
</td>
</tr>
</table>

## 工作原理

```mermaid
flowchart LR
  A[想法] --> B[文案与分镜]
  B --> C[生成每个镜头]
  C --> D{检查镜头}
  D -- "说出哪里不对" --> E[AI 修改这个镜头] --> F[渲染并检查] --> D
  D -- 满意 --> G[导出：拼接、配音、配乐、发布文案]
```

- **按镜头做，不是一次渲染整片。** 一部片子由多个镜头组成，每个镜头都是一小段程序 `shot.js`，画出某一时刻 t 的画面：2D 是网页，3D 是 three.js 世界。每个镜头按输入内容缓存，修一个镜头只需几秒，导出时只是把片段拼起来。
- **用大白话修改。** AI 只改你当前选中的镜头，除非修改必须动到共享场景。它先给出几个具体改法，你选中的那个（或者你自己的想法）才会被执行，一次修改通常不到一分钟，改完自动渲染镜头视频，可以直接预览。“运行检查”会按检查清单逐条审核（文字能否看清、有没有被遮挡、有没有压到字幕区等），只报告不修改，发现的问题一键就能修。
- **八种画面方式。** 电影感场景、信息图、地图、界面演示、剖面图纸、动态排版、新闻叙事和 3D，各有一套工具和样片，AI 选择和生成之前都会先看样片（[`engine/shotloop/styles.mjs`](engine/shotloop/styles.mjs)）。主题色只管背景和文字，画面里的物体和数据按含义取色。
- **策划会按规则检查。** 生成之前，先检查每句字幕的长度和停留时间。在多个镜头里反复出现的画面只画一次、各镜头共用，保证每次长得一样。
- **事实都有来源。** 文案里每条事实都附带来源，发布文案也只能使用文案里的事实。
- **封面。** AI 按视频的风格设计封面，并自己检查渲染效果。可以存为模版让同一系列统一，也可以上传一张喜欢的封面，让 AI 照它的版式设计。
- **配音，在你的 Mac 上配音，需要时才开。** 默认不配音：由画面决定节奏，用画面上的字幕。开启后每个镜头有一句台词，由配音带动剪辑：镜头长度跟着台词走，画面落在说到的词上。也可以在镜头都做好之后再补旁白：台词按镜头长度来写，镜头时长不变，稍长的一句会自然延续到下一个镜头。英文用 Kokoro，中文用 CosyVoice 2，其他语言用 Supertonic，全部离线运行。字幕按说出的话自动生成，并会检查列出字幕会遮住的内容（文字和标记的主体），被遮住的片子不会导出。
- **画面定了再做声音。** 声音放在镜头条下面，是带波形的彩色音轨：配音、配乐、环境音、音效。从任意位置播放，画面跟着走。每条音轨的音量在轨道头里，拖动时立刻听到变化；设置在旁边展开，音效点一下就能关掉。“AI 配声音”会先问要生成哪些部分（按每个镜头代码里的动作节拍加音效、环境音，没有配音时还能加旁白），再一次配好整部片子。
- **配乐贴合剪辑。** 合成的配乐会调整节拍，让剪切点落在拍子上；音乐一直响到最后一帧，再平滑淡出。有配音时音乐会压低，说话时再让一让。
- **3D 像离线渲染器一样精致，几分钟出片。** 每一帧 3D 都由多个子帧平均而成（抗锯齿、软阴影、环境光遮蔽、景深、运动模糊），约半秒一帧，30 秒的片子几分钟就能渲染完，无需安装任何东西。
- **素材库：模型和音频。** 用你自己的 key 在 [Poly Pizza](https://poly.pizza) 和 [Smithsonian 开放资源](https://www.si.edu/openaccess)中搜索免费模型；在 [Openverse](https://openverse.org)（Freesound、Wikimedia、Jamendo）里搜索音效、环境音和音乐，不需要 key，下载前可以先试听。每个素材只下载一次，任何项目都能用：模型放进 3D 世界，音频放在画面节拍上，或者铺在整片下面做环境音。下载会先在队列里等你批准。

## 支持的 AI

| 方式 | 需要什么 |
| --- | --- |
| **本地命令行工具** | 在这台 Mac 上登录过的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（Codex CLI、Gemini CLI 为实验支持）。运行时它自带的工具都关闭，只能使用 Shotloop 提供的工具。 |
| **模型 API** | 你自己的 key。内置 Anthropic、OpenAI、Google Gemini、OpenRouter、xAI、Mistral、Together、DeepSeek、通义千问、Kimi、智谱 GLM、MiniMax、豆包、硅基流动，也支持任意兼容 Anthropic 或 OpenAI 接口的服务。key 只保存在你的 Mac 上。 |
| **本地模型** | Ollama、LM Studio、vLLM、llama.cpp，或任何兼容 OpenAI 接口的服务。 |

模型需要支持工具调用；做检查时还需要能看图片的模型。AI 只能使用一小组工具：读写当前镜头的文件、渲染静帧、提交检查结果，不能执行命令行。

## 安装

1. 从[最新版本](https://github.com/chihyungchang/Shotloop/releases/latest)下载 `Shotloop_<版本>_aarch64.dmg`，打开后把 Shotloop 拖进"应用程序"。
2. 需要安装 **Google Chrome**，2D 镜头用它渲染。
3. 在"设置 → 模型与服务商"里选择 AI。如果你的 Mac 上已经有 Claude Code，会自动选好。

> **第一次打开**：Shotloop 还没有经过 Apple 公证，macOS 会提示"无法验证开发者"。请在 **系统设置 → 隐私与安全性 → 仍要打开** 里打开一次，或者在终端运行 `xattr -dr com.apple.quarantine /Applications/Shotloop.app`。之后就能正常打开，自动更新也不会再弹这个提示。

Node.js、ffmpeg 和配音的语音引擎已经内置在应用里。语音模型不在其中：某种语言的片子第一次配音时才下载（英文用的 Kokoro 132 MB；中文用的 CosyVoice 2 约 5 GB，含它运行所需的 Python；用于其他语言的 Supertonic 400 MB），会显示进度条；也可以提前在"设置 → 依赖"里下载。"设置 → 关于"列出了所有第三方组件及其许可证。Shotloop 会自动从 GitHub 检查并安装更新。支持 Apple 芯片（M1 及以后）的 Mac。

## 从源码运行

```bash
nvm use                      # Node 22.18+（AI 助手直接运行 TypeScript）
corepack enable              # 只需一次：启用锁定版本的 pnpm
pnpm install
pnpm app                     # tauri dev，需要 Rust 工具链
pnpm app:build               # 生成 Shotloop.app 和 dmg，内置 Node 和 ffmpeg
```

`pnpm app` 使用你 Mac 上已有的 Node 和 ffmpeg，所有代码都从仓库里直接运行。发布版本带有更新签名，由 [`app/scripts/release.mjs`](app/scripts/release.mjs) 发布。

<details>
<summary><b>在终端里使用引擎</b></summary>

```bash
pnpm shotloop status   fixtures/ep01-password-crack-time
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu --stills   # 开头/中间/结尾三帧
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu            # 渲染片段
pnpm shotloop export   fixtures/ep01-password-crack-time                                   # 只渲染改过的镜头
pnpm shotloop new      my-short --idea "手机电池为什么会老化？" --track auto --duration auto
pnpm shotloop new      coffee --idea "咖啡从哪里来？" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/ep01-password-crack-time --to ~/Movies/Shotloop --name "Hello"   # 导出到那里的新文件夹
pnpm shotloop covers   list                                         # 封面模版
pnpm shotloop voice    my-short --on --voice af_heart --fit        # 配音：念出台词，按台词调整镜头时长
pnpm shotloop check-subtitles my-short                              # 字幕会遮住什么（有遮挡就失败）
pnpm shotloop voice-models --download kokoro-en                     # 提前下载一个语音模型
pnpm shotloop doctor
```

加上 `--json` 会逐行输出事件（app 读取的就是这个）。AI 助手也可以这样运行：

```bash
node agent/src/main.ts detect                                         # 检测本机的命令行工具和本地模型服务
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/ep01-password-crack-time --shot 01-password-field-dots
pnpm test                                                             # 用脚本化的替身测试每种 AI 方式
```

</details>

<details>
<summary><b>项目格式</b></summary>

```
my-video/
  shotloop.json        标题、2d|3d、画面方式、尺寸、帧率、lang、voice { on, voice, speed }、
                       镜头列表 [{ id, title, duration, say（配音台词）, cues（各句的时间）}]
  storyboard.json      策划：文案（钩子、文案、带来源的事实）和镜头
  world/               page.html（2D：画面方式的工具包；3D：WebGL 工具包）、2D：parts.js（反复出现的画面，
                       只画一次）、geo.data.js（地图方式的国家数据）；3D：*.js（布景、机械）
  shots/<id>/          shot.js、notes.md（必须呈现、屏幕文字、动作、声音）、sounds.json（它的音效）
  assets/<id>/         从素材库加入的模型和音频
  copy.md  script.md  music.json  thumb.html  publish.json
  .shotloop/           缓存：按镜头和输入哈希保存的渲染、记录、检查、修改；voice/：配音语音、字幕
  out/                 引擎的导出文件（带时间戳）；App 会把每次导出复制到你选的位置，新建一个文件夹
```

</details>

<details>
<summary><b>仓库结构</b></summary>

| 路径 | 内容 |
| --- | --- |
| [`app/`](app/) | 桌面应用：Tauri 2（Rust）外壳，负责渲染队列、自动更新和进程管理；React + TypeScript 界面。 |
| [`engine/shotloop/`](engine/shotloop/) | 镜头引擎：项目格式、按镜头缓存、在 Chrome 中进行的 2D 和 3D（three.js）渲染、成片拼接、MP4 导出、配音计时、字幕及其检查、配乐、素材库。app 通过它的命令行调用。 |
| [`voice/`](voice/) | 配音的文字转语音，在本机运行：Kokoro（通过 sherpa-onnx）、Supertonic（基于 ONNX Runtime）和 CosyVoice 2（运行在本地的 Python 服务里），以及模型的下载。 |
| [`agent/`](agent/) | AI 助手：策划、生成、按要求修改、按检查清单检查、发布文案。支持 API、命令行工具（通过 MCP）和本地模型。 |
| [`examples/`](examples/) | 首页提供的示例，统一为英文，每种画面方式至少一个（2D 和 3D，竖屏和横屏）。 |
| [`fixtures/`](fixtures/) | 测试和终端演示用的项目。 |

</details>

## 致谢

Shotloop 建立在开源成果之上。感谢以下项目背后的人：

- **配音：** hexgrad 的 [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) 和 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)（英文）；FunAudioLLM 的 [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice)，以及 [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS)、[WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing)、[Whisper](https://github.com/openai/whisper)、[PyTorch](https://pytorch.org) 和 [Transformers](https://github.com/huggingface/transformers)（中文）；Supertone 的 [Supertonic](https://huggingface.co/Supertone/supertonic-3)（其他语言）；[ONNX Runtime](https://onnxruntime.ai)；运行中文配音的 [uv](https://github.com/astral-sh/uv) 和 [Python](https://www.python.org)。
- **渲染与成片：** [FFmpeg](https://ffmpeg.org)、通过 DevTools 协议驱动的 [Google Chrome](https://www.google.com/chrome/)、[three.js](https://threejs.org) 和 [Node.js](https://nodejs.org)。
- **应用：** [Tauri](https://tauri.app)、[React](https://react.dev)、[Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) 和 [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)。
- **素材与数据：** [Kenney](https://kenney.nl)、[Poly Haven](https://polyhaven.com)、[Quaternius](https://quaternius.com)、[Poly Pizza](https://poly.pizza)、[Smithsonian Open Access](https://www.si.edu/openaccess)、[Openverse](https://openverse.org)，以及经由 [world-atlas](https://github.com/topojson/world-atlas) 提供的 [Natural Earth](https://www.naturalearthdata.com)。

"设置 → 关于"列出了每个组件的版本和许可证，详情见 [NOTICE](NOTICE)。

## 隐私

Shotloop 每天最多一次向开发者发送匿名计数：版本、芯片架构、界面语言，以及规划、生成、修改和导出了多少部片子（导出按画面方式统计），附一个随机的安装编号。绝不包含你的项目内容、名称、文字、文件或 API 密钥，也不保存 IP 地址。第一次打开时会告诉你；在 **设置 → 通用** 里可以关闭。从源码构建的版本永远不会发送（[`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)）。完整的[隐私说明](https://oliverz.dev/zh/products/shotloop/privacy)列出了 Shotloop 存储和发送的全部内容。

## 许可证

[Apache License 2.0](LICENSE)，另见 [NOTICE](NOTICE)。素材库里的模型和音频保留各自的许可（CC0 或 CC-BY，署名会写进项目里），语音模型也一样（Kokoro 和 CosyVoice 2：Apache-2.0；Supertonic：OpenRAIL-M）。
