<h1 align="center">
  <img src="docs/screenshots/logo.png" alt="" width="72" /><br/>
  Shotloop
</h1>

<p align="center"><b>Short videos with AI. Fix one shot, not the whole film.</b><br/>
An idea becomes copy, a storyboard and a film made of shots. Each shot has its own loop: the AI writes it, Shotloop renders it, you review it and the AI fixes it. A fix re-renders that shot only, not the whole film.</p>

<p align="center">
  <img src="docs/screenshots/hero.jpg" alt="Shotloop Studio: a 3D mechanical watch, its balance-wheel shot as start, middle and end stills, the filmstrip below and the AI shot assistant on the left" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><b>Download for macOS</b></a> ·
  <a href="https://github.com/chihyungchang/Shotloop/releases">Releases</a> ·
  <a href="#build-from-source">Build from source</a>
</p>

<p align="center">
  <a href="https://github.com/chihyungchang/Shotloop/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/chihyungchang/Shotloop?style=flat&color=14b8a6&label=release" /></a>
  <img alt="platform" src="https://img.shields.io/badge/macOS-Apple%20silicon-111?style=flat&logo=apple" />
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat" /></a>
  <img alt="built with" src="https://img.shields.io/badge/Tauri%202-React-24c8db?style=flat&logo=tauri&logoColor=white" />
</p>

<p align="center"><b>English</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.tr.md">Türkçe</a> · <a href="README.vi.md">Tiếng Việt</a> · <a href="README.id.md">Bahasa Indonesia</a></p>

---

## What is Shotloop

Shotloop is a desktop app for short videos that are drawn with code: product promos, science explainers, data stories and slide-style animation, made in 2D (web pages rendered frame by frame) or 3D (three.js worlds rendered like an offline renderer), in eight visual styles.

You start with one sentence. The AI picks how to show it (a cinematic scene, an infographic, a map, an interface demo, a blueprint, kinetic type, a news story or 3D) and a theme, unless you choose them. It writes the hook, the script and the facts with their sources, then splits them into a storyboard, with the line a voice-over says over each shot. You edit the storyboard, and the AI builds every shot. In the Studio you look at each shot and say what is wrong in plain words, such as "the text is too small" or "it's too still: add some motion". The AI looks first and offers a few ways to change that shot; you pick one (or say your own), and it changes the shot and shows you a before/after. When the film reads right, Export joins the shots, lays the voice-over with its subtitles and the music under them, the AI designs a cover in the film's look (or fills your series' template) and writes the post for each platform, all into a folder of its own.

The AI is the one you already use: Claude Code or another coding agent you're signed in to, a model API with your own key, or a local model.

The app speaks 14 languages: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português, Français, Deutsch, Italiano, Русский, Türkçe, Tiếng Việt and Bahasa Indonesia. It follows your Mac's language, and the AI replies and writes the publish posts in the one you pick.

## Made with Shotloop

Every frame below was rendered by Shotloop from the [examples](examples/) it ships with.

<table>
<tr>
<td width="25%" valign="top"><img src="docs/screenshots/film-3d.gif" alt="A mechanical watch turning, then opening into an exploded view of its movement" /><br/><sub><b>3D</b>: a mechanical watch in WebGL.</sub></td>
<td width="25%" valign="top"><img src="docs/screenshots/film-2d.gif" alt="A light pulse travelling from the Sun to Earth with a timer" /><br/><sub><b>2D</b>: how long sunlight takes to reach Earth.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/film-chart.gif" alt="A chart of 0.99 to the 365th power falling to 0.027" /><br/><sub><b>2D data</b>: 1% better every day, in charts (16:9).</sub></td>
</tr>
</table>

## Eight ways to show an idea

The AI picks the style that fits the subject and tells you why; you can switch on the plan, or choose one on Home. Each picture is a frame of the example it links to.

<table>
<tr>
<td width="25%" valign="top"><a href="examples/sunlight-en/"><img src="engine/shotloop/kits/styles/scene/1.jpg" alt="Cinematic scene" /></a><br/><sub><b>Cinematic scene</b>: light, depth and a moving camera, for things you could film: space, nature, physics.</sub></td>
<td width="25%" valign="top"><a href="examples/solar-share-en/"><img src="engine/shotloop/kits/styles/infographic/1.jpg" alt="Infographic" /></a><br/><sub><b>Infographic</b>: charts and moving numbers, for statistics, comparisons, money.</sub></td>
<td width="25%" valign="top"><a href="examples/coffee-map-en/"><img src="engine/shotloop/kits/styles/map/1.jpg" alt="Map" /></a><br/><sub><b>Map</b>: the world map, routes and countries lighting up, for places and how things spread.</sub></td>
<td width="25%" valign="top"><a href="examples/fake-parcel-text-en/"><img src="engine/shotloop/kits/styles/ui/1.jpg" alt="Interface demo" /></a><br/><sub><b>Interface demo</b>: a phone or a browser, step by step, for apps, settings and scams.</sub></td>
</tr>
<tr>
<td width="25%" valign="top"><a href="examples/zipper-blueprint-en/"><img src="engine/shotloop/kits/styles/blueprint/1.jpg" alt="Blueprint" /></a><br/><sub><b>Blueprint</b>: line art on a grid, exploded views and callouts, for how a machine works.</sub></td>
<td width="25%" valign="top"><a href="examples/chinese-words-en/"><img src="engine/shotloop/kits/styles/kinetic/1.jpg" alt="Kinetic type" /></a><br/><sub><b>Kinetic type</b>: huge type that moves, for quotes, words and myths.</sub></td>
<td width="25%" valign="top"><a href="examples/bybit-heist-en/"><img src="engine/shotloop/kits/styles/news/1.jpg" alt="News story" /></a><br/><sub><b>News story</b>: breaking events told with tension: a running clock, the money trail, the timeline, who said what.</sub></td>
<td width="25%" valign="top"><a href="examples/watch-3d-en/"><img src="engine/shotloop/kits/styles/3d/1.jpg" alt="3D" /></a><br/><sub><b>3D</b>: three.js worlds with studio light, soft shadows and a camera through space.</sub></td>
</tr>
</table>

2D videos follow a set of rules: fixed ones that keep every frame clean and the video true (nothing covered, no broken frames, time to read every line, honest, sourced), and a house taste you can reword, switch off or add to in Settings → Rules, together with a toolbox of animation devices you can extend with your own. They live in [engine/shotloop/rules.mjs](engine/shotloop/rules.mjs) and reach every 2D prompt. Run checks reviews a shot against them, and every failed check links to its rule.

## Product tour

<table>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/home.jpg"><img src="docs/screenshots/home.jpg" alt="Home: an idea composer with 2D/3D, aspect, length, style and theme, and the example gallery filtered by style" /></a><br/>
<sub><b>Home</b>: one sentence. 2D or 3D, the length, the style and the theme can stay on Auto. Or start from an example in the gallery.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/plan.jpg"><img src="docs/screenshots/plan.jpg" alt="Planning page: copy, hook, script and sourced facts on the left, the storyboard on the right" /></a><br/>
<sub><b>Copy &amp; storyboard</b>: the hook, the script and sourced facts, and the shots with what each one shows, all editable before anything renders.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/studio.jpg"><img src="docs/screenshots/studio.jpg" alt="Studio with a 2D shot on the stage and the filmstrip" /></a><br/>
<sub><b>Studio</b>: the shot on a dark stage, the filmstrip with the sound tracks under it, and each shot's notes and checks.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/agent.jpg"><img src="docs/screenshots/agent.jpg" alt="The AI shot assistant's reply with a before/after compare view" /></a><br/>
<sub><b>AI shot assistant</b>: say what's wrong, pick one of the ways the AI offers (or say your own), and it fixes that shot. Drag the divider to compare before and after.</sub>
</td>
</tr>
<tr>
<td width="50%" valign="top">
<a href="docs/screenshots/export.jpg"><img src="docs/screenshots/export.jpg" alt="Export dialog: the cover, the name and folder, the video with aspects and music, and the publish copy" /></a><br/>
<sub><b>Export</b>: tick the video (vertical, horizontal), the cover and the publish copy; edit the cover and the copy first. Every export goes into its own folder.</sub>
</td>
<td width="50%" valign="top">
<a href="docs/screenshots/settings.jpg"><img src="docs/screenshots/settings.jpg" alt="Settings: models and providers, with Claude Code detected" /></a><br/>
<sub><b>Models &amp; providers</b>: a CLI agent you're signed in to, a model API with your key, or a local model.</sub>
</td>
</tr>
</table>

## How it works

```mermaid
flowchart LR
  A[Idea] --> B[Copy &amp; storyboard]
  B --> C[Build every shot]
  C --> D{Review a shot}
  D -- "say what's wrong" --> E[AI fixes that shot] --> F[Render + check] --> D
  D -- looks right --> G[Export: join, voice-over, music, publish copy]
```

- **Shots, not one long render.** A film is a list of shots. Each shot is a small program, `shot.js`, that draws its page at a time t: a 2D page, or a three.js world for 3D. Each one is cached by a hash of its inputs, so a fix re-renders one shot in seconds, and Export only joins clips.
- **Plain-language fixes.** The AI only touches the shot you're on, unless the fix needs the shared world. It first offers a few concrete ways to make your change; the one you pick (or your own) is the fix, done in well under a minute, and the shot's clip renders right after so it plays at once. Run checks reviews the shot against the checklist (readable, nothing covered, out of the caption zone and so on) without changing anything, and fixes what it found in one click.
- **Eight visual styles.** A cinematic scene, an infographic, a map, an interface demo, a blueprint, kinetic type, a news story or 3D, each with its own kit and reference stills the AI looks at before it chooses and builds ([`engine/shotloop/kits/styles.mjs`](engine/shotloop/kits/styles.mjs)). A theme sets only the ground and the type; pictures and data keep the colors their subject needs.
- **Rules a plan is measured against.** Captions are checked for length and for the time they stay up before anything is built. A picture that recurs across shots is drawn once and shared, so it looks the same in each.
- **Facts with sources.** The copy keeps each fact next to its source, and the publish copy may only use facts from the copy.
- **Covers.** The AI designs a cover in the film's look and checks its own renders. Save one as a template to keep a series consistent, or upload a cover you like and the AI follows its design.
- **A voice-over, spoken on your Mac, when you want one.** Off by default: the picture sets the timing, with captions on screen. Turn it on and each shot has a line that leads the cut: a shot lasts as long as its line, and the picture lands on the words. Or add a narration once the shots are done: the lines are written to fit the shots, which keep their lengths, and a line a little too long runs on over the cut. Kokoro speaks English, CosyVoice 2 Chinese and Supertonic the other languages, all offline. Subtitles of the spoken words are added automatically, and a check lists anything they would cover (text and the marked subject), so a covered film is never exported.
- **Sound once the picture is right.** The sound sits under the filmstrip as coloured tracks, each with its waveform: voice, music, ambience and effects. Play from anywhere and the picture follows. Each track's volume is in its header and is heard at once while you drag; its settings open beside it, and any effect switches off with a click. AI sound asks which parts to make (effects on the picture's beats, read from each shot's code, an ambience, and narration when there is no voice-over) and goes through the whole film at once.
- **Music that fits the cut.** The synthesized bed is tuned so the cuts land on its beats, runs to the last frame and fades out. Under a voice-over it sits lower and dips while a line is spoken.
- **3D that renders like an offline renderer, in minutes.** Each 3D frame averages several sub-frames (antialiasing, soft shadows, ambient occlusion, depth of field, motion blur) in about half a second, so a 30-second film renders in a few minutes, with nothing to install.
- **Asset library: models and sounds.** Search CC0 models on [Poly Pizza](https://poly.pizza) and [Smithsonian Open Access](https://www.si.edu/openaccess) with your own key, and sound effects, ambiences and music on [Openverse](https://openverse.org) (Freesound, Wikimedia, Jamendo) with no key; listen before you download. Each one is downloaded once and can be added to any project: a model to a 3D world, a sound to a beat or as the ambience under the film. Downloads wait in the Queue for your approval.

## The AI that drives it

| Mode | What you need |
| --- | --- |
| **Local CLI agent** | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), signed in on this Mac (Codex CLI and Gemini CLI are experimental). It runs headless with its own tools switched off and works only through Shotloop's tools. |
| **Model API** | Your own key. Presets for Anthropic, OpenAI, Google Gemini, OpenRouter, xAI, Mistral, Together, DeepSeek, Qwen, Kimi, GLM, MiniMax, Doubao and SiliconFlow, or any Anthropic- or OpenAI-compatible endpoint. Keys stay on your Mac. |
| **Local model** | Ollama, LM Studio, vLLM, llama.cpp or any OpenAI-compatible server. |

The model needs tool calling, and checks need one that can see images. The agent works through a narrow set of tools: it can read and write the shot's files, render stills and report checks. It can't run shell commands.

## Install

1. Download `Shotloop_<version>_aarch64.dmg` from the [latest release](https://github.com/chihyungchang/Shotloop/releases/latest), open it and drag Shotloop into Applications.
2. Shots render in a Chromium browser already on your Mac (Chrome, Edge, Brave, Arc…). Without one, Shotloop downloads a headless one (about 100 MB) the first time it renders, or ahead of time in Settings → Dependencies.
3. Pick the AI in Settings → Models & providers. Claude Code is picked for you if it's already on your Mac.

> **First launch:** Shotloop isn't notarized by Apple yet, so macOS says it can't verify the developer. Open it once from **System Settings → Privacy & Security → Open Anyway**, or run `xattr -dr com.apple.quarantine /Applications/Shotloop.app` in Terminal. After that it opens normally, and updates install without asking again.

Node.js, ffmpeg and the voice-over's speech engines are inside the app. The voice models are not: each downloads the first time a film speaks its languages (Kokoro for English 132 MB; CosyVoice 2 for Chinese about 5 GB, with the Python it runs on; Supertonic for the other languages 400 MB), with a progress bar, or ahead of time in Settings → Dependencies. Settings → About lists every third-party component with its license. Shotloop checks GitHub for updates and installs them in place. It runs on Macs with Apple silicon (M1 and later).

## Build from source

```bash
nvm use                      # Node 22.18+ (the agent runs TypeScript directly)
corepack enable              # once: provides the pinned pnpm
pnpm install
pnpm app                     # tauri dev; needs the Rust toolchain
pnpm app:build               # Shotloop.app and a dmg, with Node and ffmpeg inside
```

`pnpm app` uses the Node and ffmpeg on your Mac and runs everything from the checkout. Releases are signed for the updater and published with [`app/scripts/release.mjs`](app/scripts/release.mjs).

<details>
<summary><b>The engine from a terminal</b></summary>

```bash
pnpm shotloop status   fixtures/ep01-password-crack-time
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu --stills   # start/middle/end
pnpm shotloop render   fixtures/ep01-password-crack-time --shot 02-stack-16-gpu            # a clip
pnpm shotloop export   fixtures/ep01-password-crack-time                                   # only changed shots render
pnpm shotloop new      my-short --idea "Why does your phone battery age?" --track auto --duration auto
pnpm shotloop new      coffee --idea "Where does coffee come from?" --track 2d --style map --duration 30
pnpm shotloop export   fixtures/ep01-password-crack-time --to ~/Movies/Shotloop --name "Hello"   # into a new folder there
pnpm shotloop covers   list                                         # cover templates
pnpm shotloop voice    my-short --on --voice af_heart --fit        # the voice-over: speak the lines, fit the shots
pnpm shotloop check-subtitles my-short                              # what the subtitles would cover (fails if anything)
pnpm shotloop voice-models --download kokoro-en                     # a speech model, ahead of time
pnpm shotloop doctor
```

Add `--json` for line-delimited events (what the app reads). The agent runs the same way:

```bash
node agent/src/main.ts detect                                         # CLI agents and local servers on this Mac
SHOTLOOP_PROVIDER=cli SHOTLOOP_CLI=claude node agent/src/main.ts check fixtures/ep01-password-crack-time --shot 01-password-field-dots
pnpm test                                                             # every backend against scripted stand-ins
```

</details>

<details>
<summary><b>Project format</b></summary>

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

- **3D**: `world/page.html` is the engine's WebGL kit ([`engine/shotloop/kits/webgl.mjs`](engine/shotloop/kits/webgl.mjs)): a three.js stage with studio light, materials, shapes, glTF models, lens-based cameras and type above it. Sets and machines the shots share live in `world/*.js`; a shot builds what it shows in `setup(ctx)` and poses it for `t` in `render(t)`.
- **2D**: `shot.js` default-exports `render(t, ctx)`, which draws `world/page.html` at shot-local time `t`. `ctx.voice` holds the shot's spoken sentences with their times, so the picture can land on the words; mark the subject with `data-keep` (or `subtitles.keep()` on a canvas) so the subtitle check keeps it clear.
- **Cache**: a shot's key hashes the world, its code, its models, the renderer and the settings. Unchanged shots are reused.

</details>

<details>
<summary><b>Repository layout</b></summary>

| Path | What |
| --- | --- |
| [`app/`](app/) | The desktop app: a Tauri 2 (Rust) shell with the render queue, updater and process supervision, and the React + TypeScript UI. |
| [`engine/shotloop/`](engine/shotloop/) | The shot engine: project format, per-shot render cache, 2D and 3D (three.js) renders in Chrome, film assembly, MP4 export, voice-over timing, subtitles and their check, music, asset library. A CLI that the app calls. |
| [`voice/`](voice/) | The voice-over's text to speech, on this Mac: Kokoro through sherpa-onnx, Supertonic on ONNX Runtime, and CosyVoice 2 in a local Python server, with the models' downloads. |
| [`agent/`](agent/) | The agent: planning, building, plain-language fixes, checks against the checklist, publish copy. It supports API, CLI (through MCP) and local models. |
| [`examples/`](examples/) | The examples Home offers, in English: at least one for every visual style (2D and 3D, 9:16 and 16:9). |
| [`fixtures/`](fixtures/) | Projects for the tests and terminal walkthroughs. |

</details>

## Acknowledgements

Shotloop stands on open-source work. Thank you to the people behind:

- **The voice-over:** [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) by hexgrad and [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (English); [CosyVoice 2](https://github.com/FunAudioLLM/CosyVoice) by FunAudioLLM with [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS), [WeTextProcessing](https://github.com/wenet-e2e/WeTextProcessing), [Whisper](https://github.com/openai/whisper), [PyTorch](https://pytorch.org) and [Transformers](https://github.com/huggingface/transformers) (Chinese); [Supertonic](https://huggingface.co/Supertone/supertonic-3) by Supertone (the other languages); [ONNX Runtime](https://onnxruntime.ai); [uv](https://github.com/astral-sh/uv) and [Python](https://www.python.org), which run the Chinese voice.
- **Rendering and the film:** [FFmpeg](https://ffmpeg.org), [Google Chrome](https://www.google.com/chrome/) through the DevTools protocol, [three.js](https://threejs.org) and [Node.js](https://nodejs.org).
- **The app:** [Tauri](https://tauri.app), [React](https://react.dev), the [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) and the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk).
- **Assets and data:** [Kenney](https://kenney.nl), [Poly Haven](https://polyhaven.com), [Quaternius](https://quaternius.com), [Poly Pizza](https://poly.pizza), [Smithsonian Open Access](https://www.si.edu/openaccess), [Openverse](https://openverse.org), and [Natural Earth](https://www.naturalearthdata.com) via [world-atlas](https://github.com/topojson/world-atlas).

Settings → About lists every component with its version and license, and [NOTICE](NOTICE) has the details.

## Privacy

Once a day Shotloop sends anonymous counts to its maker: the version, the chip, the interface language and how many films were planned, built, fixed and exported (exports by visual style), with a random install ID. Never your projects, their names or text, your files or your API keys, and no IP address is stored. The first launch says so; turn it off in **Settings → General**. Builds from source never send ([`app/src-tauri/src/telemetry.rs`](app/src-tauri/src/telemetry.rs)). The full [privacy notice](https://oliverz.dev/products/shotloop/privacy) lists everything Shotloop stores and sends.

## License

[Apache License 2.0](LICENSE); see [NOTICE](NOTICE). Models and sounds from the asset library keep their own licenses (CC0 or CC-BY, with credit written into the project), and so do the voice models (Kokoro and CosyVoice 2: Apache-2.0; Supertonic: OpenRAIL-M).
