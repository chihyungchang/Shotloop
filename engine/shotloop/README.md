# engine/shotloop: the map

The shot engine: a project's format, its per-shot cache, 2D and 3D renders
in Chrome, the film and its export, the voice-over, sound, and a product
promo's material. No dependencies beyond Node, Chrome and ffmpeg.

Each folder owns one thing. Read the folder's modules' first comment for
the detail; this page says where to look.

## Entry points and shared vocabulary (this folder)

| File | What it is |
| --- | --- |
| `cli.mjs` | The CLI the app and the agent run (`--json` events, typed in `protocol.d.ts`). Every command starts here. |
| `protocol.d.ts` | The events and results the CLI prints: the contract with the app and the agent. |
| `data.mjs` | Data shared with the app's browser bundle: looks, visual styles, music moods, subtitle styles. Imports nothing from Node. |
| `rules.mjs` | The video rules, the one source: fixed rules, taste, the toolbox (`tools/<id>.jpg` stills). How to tell them apart: `.claude/rules/rules-taste-tools.md`. |

## Folders

| Folder | Owns | Main exports |
| --- | --- | --- |
| `project/` | A project on disk: its config, starter files, plan, settings, the cache and its keys, the AI's memory, delivering an export | `loadProject`, `updateConfig` (project) · `newProject` (create) · `applyStoryboard` (storyboard) · `freshScreens`, `freshWebglPage` (starters) · `shotKey`, `engineCode` (cache) · `readJson`, `writeAtomic` (files) |
| `render/` | Pixels: a shot's frames (2D and 3D, in Chrome), stills and clips, the film, its cover, the picker map, the checks that measure instead of judging (a promo's layout in its page, a clip's picture by ffmpeg, the 3D exposure); `vendor/` holds three.js | `renderShot` (render) · `openShot` (render2d) · `measureLayout`, `measureClip` (measure) · `ffmpeg`, `emit`, `progress` (compose) · `assemble`, `exportFilm` (film) |
| `kits/` | The page kits a shot's code is written against, copied or generated into a project's `world/`: the 2D looks' page, the visual styles' extras and stills, the cinematic scene, the WebGL kit, the promo's screens kit | `lookPage`, `pageLayout` (looks) · `webglPage` (webgl) · `scenePage` (scene) · `styleStills` (styles) · `screens.js` (copied whole into a promo's `world/`) |
| `voiceover/` | The voice-over: its timing, the spoken words, the subtitles and their check | `fitVoice`, `dressFilm` (voice) · `sentences`, `voiceOn` (cues) · `dressClips` (subtitles) · `checkSubtitles` (check) |
| `sound/` | Music and sound: the synthesized bed, its score, effects and ambience | `musicBed` (bed) · `composeBed` (score) · `soundCues`, `withEffects` (sound) · `wav` (synth) |
| `promo/` | A product promo's material: its page and repository read, its pictures, the text in them and where (macOS Vision, `text.swift` built as the app's `shotloop-text`), live parts, framed windows | `readSite` (site) · `readRepo` (repo) · `promoImages` (images) · `findText` (text) · `frameWindow` (frame) |
| `library/` | What is reused across projects: the asset library (models, sounds) and cover templates | `search`, `download`, `use` (library) · `save`, `apply` (covers) |

## Where a change goes

- **A new command**: `cli.mjs` calls the module that owns the work; its
  result shape goes in `protocol.d.ts`.
- **A new kind of film or material**: a folder of its own, like `promo/`,
  below `project/` and `render/`, never imported by them except for what
  their cache keys must hash.
- **A new device a shot can draw**: the kit it belongs to in `kits/`, then
  a tool in `rules.mjs` with a still in `tools/`.
- **Taste or a rule**: `rules.mjs` only, never a prompt. A rule that can be
  measured (boxes in the page, pixels in a clip) is also measured in
  `render/measure.mjs`, so the agent is told it, not asked to see it.

Modules import each other without cycles (`imports.test.mjs`); shared
low-level pieces sit below both users (`project/files.mjs`,
`voiceover/cues.mjs`). Renderer files (`render/render2d.mjs`,
`render/compose.mjs`) are part of every shot's cache key: changing them
re-renders every example.
