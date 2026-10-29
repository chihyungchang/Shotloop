# Shotloop

Make short videos from code, one shot at a time. An idea becomes copy,
script and storyboard, then a video split into shots; each shot loops
through generate, render, review and fix on its own, so a fix re-renders
that shot, not the film.

Status: MVP (docs/PRD.md §7, P0). The product plan is
[docs/PRD.md](docs/PRD.md).

## What's here

| Path | What |
| --- | --- |
| [`app/`](app/) | The desktop app: Tauri 2 (Rust) shell with the render queue and process supervision, React + TypeScript UI (timeline, shot view, fixes, checks, queue, export). |
| [`engine/shotloop/`](engine/shotloop/) | The shot engine: project format, per-shot render cache, 2D (Chrome) and 3D (Blender) shot renders, film assembly, MP4 export, publish kit, legacy converter. CLI used by the app. |
| [`agent/`](agent/) | The agent sidecar: plain-language fixes, automatic checks against the checklist, publish copy. |
| [`engine/video/`](engine/video/README.md) | The original explainer pipeline (recorder, Blender driver, music synth, episodes). |
| [`examples/`](examples/) | ep01 (2D) and ep02 (3D) converted to the shot format, and `hello-3d`, a 3D project that needs no downloaded assets. |

## Run the app

```bash
nvm use                      # Node 22.18+ (the agent runs TypeScript directly)
corepack enable              # once: provides the pinned pnpm
pnpm install                 # the app and agent workspace packages
pnpm app                     # tauri dev; Rust toolchain needed
```

Home starts a short from an idea: pick 2D or 3D, 9:16 or 16:9 and a
length, and Shotloop writes a starter project that renders as it is. Or
open one of the examples. In the Studio, the agent conversation for the
selected shot is on the left, the shot (preview, stills, code) on a dark
stage in the middle with the filmstrip and its notes and checks below,
and the render queue and export in a drawer on the right. The layout
follows [open-design](https://github.com/nexu-io/open-design)'s workspace
and studio, adapted to video. The Setup panel checks
Chrome, ffmpeg and Blender and takes your Anthropic API key for the agent.
`pnpm app:build` makes `Shotloop.app`; it runs the engine and agent
from `$SHOTLOOP_ROOT`, or from the checkout it was built from (bundling
them as app resources is still to do).

## The engine from a terminal

```bash
pnpm shotloop status   examples/hello-3d
pnpm shotloop render   examples/hello-3d --shot 02-close --stills   # start/middle/end
pnpm shotloop render   examples/hello-3d --shot 02-close            # draft clip
pnpm shotloop export   examples/hello-3d --draft                    # only changed shots render
pnpm shotloop convert  engine/video/explainers/3d/ep02-claude-code-enter my-ep02
pnpm shotloop new      my-short --idea "Why does your phone battery age?" --track 2d --duration 30
pnpm shotloop doctor
```

Add `--json` for line-delimited events (what the app reads).

## Project format

```
my-video/
  shotloop.json        title, track (2d|3d), size, fps, shots [{ id, title, duration }]
  world/               3D: world.py (+ screen.html); 2D: page.html
  shots/<id>/          shot.py | shot.js, notes.md
  captions.html  music.json  thumb.html  publish.md  copy.md …
  .shotloop/           cache: per shot and input hash, takes, checks, fixes
  out/                 exported films, covers, publish kits (timestamped)
```

- **3D**: `world.py` builds the shared world with `kit`
  (`engine/video/explainers/3d/lib/kit.py`). `shot.py` runs in the world's
  namespace and creates one camera with
  `kit.Shot(name, at(0), at(DUR), …)`; `at(t)` maps shot-local seconds to
  film time.
- **2D**: `shot.js` default-exports `render(t, ctx)`, drawing
  `world/page.html` at shot-local time `t`; `ctx.world(filmTime)` is the
  page's own `render`.
- **Cache**: a shot's key hashes the world, its code, the caption layer,
  the assets, the renderer and the settings. Unchanged shots are reused;
  a world change re-renders every shot (v1).

## Agent

The sidecar uses the Anthropic SDK with a deliberately narrow tool set:
read/write files of the shot, the world and the caption layer, render
stills through the engine, read the checklist, report checks. It cannot
run shell commands (PRD §9). Fixes and publish copy use
`claude-opus-5-5`, routine checks `claude-sonnet-5-5`. The checklist is
[`engine/shotloop/checklist.md`](engine/shotloop/checklist.md); a project
may bring its own.

```bash
ANTHROPIC_API_KEY=… node agent/src/main.ts fix examples/hello-3d --shot 01-wide \
  --request "the packet is too small to see"
pnpm test                    # agent loop against a scripted API stand-in
```

`examples/hello-3d` ships with a seeded mistake: in `01-wide` the packet
is a few pixels at the edge of the frame (checklist rule `readable`).

## Requirements

Node 23+, Chrome, ffmpeg; Blender for 3D projects
(`brew install --cask blender`) and the CC0 assets in
[engine/video/assets/README.md](engine/video/assets/README.md) for ep02.

## License

[Apache License 2.0](LICENSE); see [NOTICE](NOTICE). The CC0 asset
packs a project downloads keep their own licenses.
