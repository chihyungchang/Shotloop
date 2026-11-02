# Shotloop — Product requirements

Status: draft · Owner: Oliver Zhang · Last updated: 2026-11-01

## 1. Summary

Shotloop is a desktop app (macOS first) for making short videos from
code: explainers, product promos, motion pieces. An idea goes through
copy, script and storyboard, and comes out as a video split into
**shots**. Every shot is its own loop: generate, render, review, fix.
When one shot is wrong, you fix and re-render that shot, not the film.

AI does the heavy lifting in every step (writing, storyboarding, scene
code, self-review against a checklist), and the person directs: they
read stills and drafts and say what is wrong in plain words.

Tagline: *Fix one shot, not the whole film.*

## 2. Problem

Shotloop grows out of the explainer pipeline built for oliverz.dev
(`engine/`, migrated from that repo). Making episode 02 in Blender showed
where the time goes:

- **Whole-film iterations.** Feedback was nearly always about one shot
  (a cable hidden behind a bookcase, a dull overview, a model scene with
  no motion), but each check meant rendering the whole 48 s: ~8 min as a
  draft, ~1 h final. Most of that time re-rendered shots that had not
  changed.
- **Mistakes a still would have caught.** The subject hidden, too small
  to see, behind the caption, under the floor; a traveller out of step
  with the camera. Each was visible on a single still, but only after a
  person looked.
- **One monolithic scene file.** Animations are written against the
  film's absolute time, so editing one shot can shift another.
- **Stale outputs.** An earlier render under the same file name was
  mistaken for the new one.

## 3. Users

1. **The maker (primary).** A developer–creator who publishes short
   explainers and product promos and is comfortable with code but does
   not want to hand-edit Blender scripts or wait on full renders.
2. **Later: small teams and indie product makers** who want promos and
   explainers without a motion designer.

## 4. Goals

- Iterate on a single shot in about a minute (draft).
- Re-render only what changed: a final render after a one-shot fix costs
  that shot, not the film.
- Catch the common visual mistakes automatically before a person looks.
- Keep every video reproducible: same project, same frames.
- Keep the person in charge of every step; AI proposes, the person
  approves.

### Non-goals (v1)

- A general timeline video editor (no clip trimming, transitions panel,
  keyframe UI).
- Live-action footage, stock footage, licensed music.
- Cloud rendering, collaboration, accounts.
- Windows and Linux (later; Tauri keeps the door open).
- Publishing to platforms from the app.

## 5. Core concepts

| Term | Meaning |
| --- | --- |
| Project | One video. A folder on disk (§8), versioned with git if the user wants. |
| Track | How the video is made: **2D** (an HTML page drawing `render(t)`, recorded in Chrome) or **3D** (a Blender scene). |
| World | What the shots share: for 3D the sets, assets and lights; for 2D the shared styles and helpers. |
| Shot | A slice of the film with its own camera, timing and animation, written in shot-local time (0 = the shot's first frame). |
| Take | One render of a shot. A shot keeps its takes; the person picks one. |
| Draft / final | Draft: half resolution, few samples, ~0.3 s a frame. Final: full resolution, motion blur, ~2–4 s a frame. |
| Checklist | The rules a shot must pass (sightline clear, subject readable, clear of the caption zone, something moves…). Seeded from the 3D notes (`engine/shotloop/blender/kit/README.md`); `engine/shotloop/rules.mjs` (fixed rules, the person's taste, the toolbox). |

## 6. Workflow

```
idea → copy → script → storyboard → shot list → world + shot code
     → per shot: render stills → AI checks → person reviews → fix ⟲
     → draft film → final film (only changed shots re-render) → mp4
     → cover + publish copy
```

Each step is a document the person can read and edit; the next step
starts only when the person approves the current one. The two existing
workflows map onto it:

- **Explainer:** copy (with sources) → script → storyboard → code →
  render.
- **Promo:** product story → script → storyboard → code → render.

## 7. Features

### Built (0.9)

1. **Shot-based project format** (§8): shot-local time, a shared world,
   one code file and one notes file per shot.
2. **Per-shot render with cache.** Each shot's frames are keyed by a hash
   of its inputs (§8). An unchanged shot reuses its frames; the film is
   joined from cached shots. A stale shot says what changed (its code,
   the scene, the captions, its timing or the engine).
3. **Film strip and shot view.** The film as a row of shots with their
   state; a shot's stills (start, middle, end), its clip with subtitles,
   music and voice, its takes, its checks and fixes.
4. **Plain-language fixes** and **automatic checks** against the
   checklist, by the agent (§9), with before/after stills.
5. **Plan.** Idea → copy and storyboard (storyboard.json) on a planning
   page the person edits; applying it writes the shot list, each shot's
   notes and starter code. Then the agent builds the world and every shot.
6. **Visual styles and looks.** Eight styles (cinematic scene,
   infographic, map, interface demo, blueprint, kinetic type, news story,
   3D) with reference stills; for 2D, ten looks (palette and type) over
   one page kit (engine/shotloop/data.mjs, looks.mjs).
7. **Voice-over.** Each shot's line spoken on the Mac (Kokoro, CosyVoice 2
   or Supertonic, downloaded on first use); the voice leads the cut (shots
   are fitted to their lines), subtitles are burned in a band the shots
   keep clear, and a subtitle check stops an export that would cover what
   the viewer must see.
8. **Music.** A bed composed per film in a mood (score.mjs, synthesized
   by synth.mjs) and tuned to the cuts, or the person's own audio file;
   ducked under the voice.
9. **Render queue** in the app shell: renders, exports, agent jobs and
   model downloads, with progress and estimates.
10. **Export and publish kit.** MP4 (H.264 + AAC) at 9:16 and 16:9, a
    cover (thumb.html, cover templates), and the publish copy per
    platform, delivered into a folder named after the work.
11. **3D asset library** (Poly Pizza, Smithsonian Open Access) copied
    into the project that uses a model.

### Next

- Takes side by side; pick one.
- Caption languages: re-render only the subtitle layer per language.
- The checklist grows: when the person reports a new kind of mistake,
  the agent proposes a rule for it.
- Cost and time budget per project; Windows support; a review link.

## 8. Project format

```
my-video/
  shotloop.json        # title, track, size, fps, shot order and lengths, style,
                       # look, language, voice-over and music settings
  storyboard.json      # the plan the planning page edits
  copy.md  script.md  storyboard.md   # the readable plan
  world/               # 3D: world.py (+ screen.html); 2D: page.html (the look's kit),
                       # parts.js (recurring pictures), style data
  shots/<id>/          # shot.py | shot.js in shot-local time; notes.md
  assets/<id>/         # 3D models from the asset library
  captions.html        # 3D: the caption layer
  music.json  thumb.html  publish.md
  .shotloop/           # cache (engine/shotloop/cache.mjs): frames per shot and key,
                       # takes, checks, fixes, music, voice and subtitles
  out/                 # exports (timestamped); out/latest.json names the newest
```

Rules:

- A shot sees the world and its own code only. Anything two shots share
  lives in the world.
- Shot time starts at 0; a shot's place is the sum of the lengths before it.
- The cache key covers every input that changes a pixel: the world, the
  shot's code, the captions, its timing and voice cues, the renderer, the
  settings, and for 3D the kit and assets. A changed world invalidates
  every shot. Keys and records name files by their place in the project,
  so a copied project keeps its cache.
- Writes go through a temporary file and a rename; shotloop.json writers
  change only the fields they own.
- Outputs are named with their mode and a timestamp, and the app shows
  the latest take, so a stale file can't be mistaken for a new one.

## 9. Architecture

| Layer | Choice | Role |
| --- | --- | --- |
| App shell | Tauri 2 (Rust) | Windows, file access, the job queue (one render lane, one agent lane, one voice lane), process supervision, updates, settings. |
| UI | React + TypeScript | Home, planning page, studio (film strip, shot view), export, settings. |
| Engine | Node, no dependencies (`engine/`) | Owns the project format and the cache. A CLI (`engine/shotloop/cli.mjs --json`, events typed in `protocol.d.ts`) the app and the agent run: render a shot (2D: Chrome; 3D: Blender), voice-over, subtitles and their check, music, film, export, cover, asset library. |
| Voice | Node package (`voice/`), on-device models | Text to speech, models downloaded on first use. |
| Agent | Node sidecar (`agent/`), TypeScript | Plans, builds, fixes and checks shots through narrow tools: files inside the project and engine renders, never shell commands. Its model is the person's choice: Anthropic's API (Opus for planning and code, Sonnet for routine checks by default), another hosted API (OpenAI-compatible), a CLI agent on the Mac (Claude Code, Codex, Gemini) or a local model server. |
| External | Chrome (the user's), ffmpeg (bundled), Blender (user-installed, 3D only) | Detected (`shotloop doctor`), with install instructions. |

## 10. Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | **Migrate** the pipeline and these docs from oliverz.dev. | `engine/` runs ep01 (2D) and ep02 (3D) from this repo. ✅ ep01 verified. |
| M1 | **Shot split + cache (CLI).** ep02 restructured into world + shots; `render --shot`, cache, assemble. | Changing one shot and rendering the final film re-renders only that shot. |
| M2 | **Second episode** (ep03) made in the new format from the start. | The format holds for a new subject without engine changes. |
| M3 | **Desktop app**: Tauri + React timeline, shot view, queue, on the M1 engine. | The ep02 fixes from this month can be done in the app without a terminal. |
| M4 | **Agent**: plain-language fixes and automatic checks. | A seeded mistake (subject hidden behind a prop) is caught and fixed before the person sees the shot. |
| M5 | **Steps and templates** (P1). | A new explainer goes from idea to draft inside the app. |

## 11. Metrics

- Time from feedback to a reviewed draft of one shot: under 2 min (draft).
- Final re-render after a one-shot fix: proportional to that shot.
- Share of checklist mistakes caught before the person sees the shot.
- Iterations per episode until approval.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| AI-written Blender code fails or looks wrong. | Small shot files, a shared helper kit (`kit.py`), stills after every change, automatic checks, takes to roll back to. |
| Shots are not really independent (shared animation, world edits). | Shot-local time, world/shot boundary enforced by the format; world edits flagged as touching all shots. |
| Render time on modest Macs. | Draft mode, per-shot cache, background final renders, estimates up front. |
| Dependencies (Blender ~1 GB, Chrome) put people off. | Detect and guide; 2D-only projects need Chrome and ffmpeg only. |
| API cost. | Sonnet for routine work, budgets (P2), stills before full renders. |
| Name overlap in AI video (Tesseract, Tessact). | Distinct name chosen (Shotloop); check trademark before a public launch. |

## 13. Open questions

- Distribution: free (like the other oliverz.dev apps) or paid. The code
  is open source under Apache-2.0 (LICENSE).
- Bundle a headless Chrome, or require the user's Chrome.
- Whether 2D shots should share one page (as today) or one page per
  shot.
