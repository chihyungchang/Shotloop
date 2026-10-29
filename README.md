# Shotloop

Make short videos from code, one shot at a time. An idea becomes copy,
script and storyboard, then a video split into shots; each shot loops
through generate, render, review and fix on its own, so a fix re-renders
that shot, not the film.

Status: early. The product plan is [docs/PRD.md](docs/PRD.md). What runs
today is the render engine migrated from the oliverz.dev explainer
pipeline; the desktop app (Tauri 2 + React + an AI agent) comes next.

## Engine

```bash
nvm use            # Node 22+
npm install        # three.js, for the legacy three.js 3D template

# 2D: record a page that draws render(t)
node engine/video/record.mjs engine/video/explainers/2d/ep01-password-crack-time/index.html \
  --out engine/video/explainers/2d/ep01-password-crack-time/out/ep01.mp4 --size portrait

# 3D: Blender scene + caption layer + music
node engine/video/blender.mjs engine/video/explainers/3d/ep02-claude-code-enter --draft
node engine/video/blender.mjs <episode> --draft --range 26.4-31.2   # one shot
node engine/video/blender.mjs <episode> --stills 2,14.5             # a few stills
```

Needs Chrome and ffmpeg; the 3D track also needs Blender
(`brew install --cask blender`) and the CC0 assets listed in
[engine/video/assets/README.md](engine/video/assets/README.md), which are
downloaded, not committed.

| Path | What |
| --- | --- |
| [`engine/video/`](engine/video/README.md) | Workflows (explainers 2D/3D, promo), the page contract, recorder, Blender driver, music synth. |
| [`engine/video/explainers/3d/README.md`](engine/video/explainers/3d/README.md) | 3D rules, the shot checklist and Blender pitfalls: the seed of the app's automatic checks. |
| [`engine/lib/chrome.mjs`](engine/lib/chrome.mjs) | Dependency-free headless Chrome client. |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements and milestones. |

The two example episodes (ep01 2D, ep02 3D) are the test projects for
milestone M1, the move to a shot-based project format.
