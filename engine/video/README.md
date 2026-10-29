# Video workflows

Videos here are made the same way end to end: words first, then a
storyboard, then an HTML page that draws every frame from a time value,
recorded frame by frame to MP4 with an original music bed. No stock
footage, no timeline editor, no licensed music: everything is in the
repo and renders the same every time.

| Folder | Workflow | Output |
| --- | --- | --- |
| [`explainers/`](explainers/README.md) | Short explainer videos (科普短视频) for TikTok, Reels and Shorts. 9:16, English, music only, captions are the content. | `explainers/<episode>/out/*.mp4` (not committed) |
| [`promo/`](promo/README.md) | Product promo videos (产品宣传视频) for product pages. 16:9 or 9:16, one per language. | `public/products/<slug>/demo.<lang>.mp4` |

## Shared tools

| File | What it does |
| --- | --- |
| [`blender.mjs`](blender.mjs) | 3D track: runs an episode's Blender `scene.py`, renders its transparent `captions.html` in Chrome, composites both and muxes the music. `--stills 2,14.5` renders a few composited frames to check framing. |
| [`record.mjs`](record.mjs) | Opens a page in headless Chrome, calls `render(t)` for every frame, pipes the frames to ffmpeg, and muxes a music WAV if given. `--size landscape` (1920×1080) or `portrait` (1080×1920). |
| [`thumb.mjs`](thumb.mjs) | Renders an episode's cover (`thumb.html`, 1080×1920) to `out/thumbnail.png`. |
| [`music.mjs`](music.mjs) | A deterministic synth: reads a `music.json` (tempo, chords, which layers play when, hits on cuts, risers) and writes a WAV. |
| [`../lib/chrome.mjs`](../lib/chrome.mjs) | The dependency-free Chrome DevTools client both of the above use. |

Needs local Chrome and ffmpeg (`brew install ffmpeg`); the 3D track also
needs Blender (`brew install --cask blender`). Downloaded CC0 assets live
in [`assets/`](assets/README.md), not committed.

The MP4s carry AAC audio. VS Code's built-in preview can't decode AAC
and plays them silent: check sound in QuickTime or a browser.

## The page contract

Every video page (`index.html`) must:

- define `window.render(t)`, which draws the frame at `t` seconds and
  nothing else: no CSS animations, no timers, no randomness. The same
  `t` must always give the same frame;
- define `window.DURATION` in seconds;
- optionally define `window.ready`, a promise the recorder waits on
  (fonts, images);
- support `?play` (real-time preview in a browser) and `?t=12.3` (one
  frame), and `?lang=` if it has more than one language.

Cuts land on bar lines of the music's tempo, so the music and the
pictures hit together. Write the timing in the script in bars.

## Commands

```bash
# music bed from an episode's music.json
node engine/video/music.mjs <dir>/music.json <dir>/out/music.wav

# record (portrait, with music)
node engine/video/record.mjs <dir>/index.html --size portrait \
  --music <dir>/out/music.wav --out <dir>/out/<name>.mp4

# preview: open <dir>/index.html?play in Chrome
```
