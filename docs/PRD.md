# Shotloop — Product requirements

Status: draft · Owner: Oliver Zhang · Last updated: 2026-10-29

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
| Checklist | The rules a shot must pass (sightline clear, subject readable, clear of the caption zone, something moves…). Seeded from `engine/video/explainers/3d/README.md`. |

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

### P0 — MVP

1. **Shot-based project format** (§8) and a converter for the existing
   episodes (ep01 2D, ep02 3D).
2. **Per-shot render with cache.** Each shot's frames are keyed by a hash
   of its inputs (world code, shot code, assets, render settings). An
   unchanged shot reuses its frames; the film is assembled from cached
   shots.
3. **Timeline view.** The film as a row of shots: thumbnail, duration,
   state (cached, stale, rendering, failed), draft or final.
4. **Shot view.** Stills at start, middle and end; the draft clip with
   captions and music for that range; the shot's code; its takes.
5. **Plain-language fixes.** The person writes what is wrong ("the cable
   is hidden behind the building"); the agent edits only that shot (or
   the world, if needed, and says which other shots that touches),
   renders stills, and shows a before/after.
6. **Automatic checks.** After every change the agent renders stills and
   reviews them against the checklist, using vision; it fixes what it can
   and reports the rest. Failed checks are shown on the shot.
7. **Render queue.** Draft and final jobs, one shot at a time, with
   progress and time estimates; final renders run in the background.
8. **Captions and music.** The existing caption layer (`captions.html`,
   transparent, composited) and music bed (`music.json` → `music.mjs`),
   both aligned to shots.
9. **Export.** MP4 (H.264 + AAC), 9:16 and 16:9.
10. **Publish kit.** With every export: a cover (`thumb.html` → 1080×1920
    PNG, text inside the 3:4 crop) and `publish.md`, the post for each
    platform (YouTube Shorts title, description, tags; TikTok caption and
    pinned comment; Reels caption; a first-person LinkedIn post), written from the copy's facts and
    sources only, with each platform's AI-label setting.

### P1

- Step documents in the app: copy, script, storyboard, scene and shot
  list, each generated by the agent and edited by the person.
- New project from a template (2D explainer, 3D explainer, promo).
- Takes side by side; pick one.
- Asset library: CC0 packs (Kenney, Poly Haven, Quaternius) downloaded
  on demand, with a manifest per project.
- Caption languages: re-render only the caption layer per language.
- The checklist grows: when the person reports a new kind of mistake,
  the agent proposes a rule for it.

### P2

- Cost and time budget per project (API tokens, render minutes).
- Windows support.
- Share a review link for a draft.
- Platform presets (Shorts, Reels, TikTok safe areas).

## 8. Project format

```
my-video/
  shotloop.json        # title, track, size, fps, duration, shot order
  copy.md  script.md  storyboard.md  scene.md
  world/               # 3D: world.py (sets, lights, assets); 2D: shared.js/css
  shots/
    01-room/
      shot.py | shot.js  # camera, timing, animation in shot-local time
      notes.md           # what the shot must show; review history
  captions.html  music.json
  .shotloop/           # cache: frames per shot and input hash, takes, logs
  out/                 # exported films
```

Rules:

- A shot sees the world and its own code only. Anything two shots share
  lives in the world.
- Shot time starts at 0; the assembler adds the offset.
- The cache key covers every input that changes a pixel. A changed world
  invalidates every shot that uses the changed part (v1: all shots).
- Outputs are named with their take and a timestamp, and the app only
  ever shows the latest take, so a stale file can't be mistaken for a
  new one.

## 9. Architecture

| Layer | Choice | Role |
| --- | --- | --- |
| App shell | Tauri 2 (Rust) | Windows, file system, process supervision (Blender, ffmpeg, Chrome), render queue, cache. |
| UI | React + TypeScript | Timeline, shot view, step documents, queue. |
| Engine | Node scripts in `engine/` (today), then a library | Render a shot (2D: Chrome; 3D: Blender), captions, music, composite, assemble. |
| Agent | Claude Agent SDK (TypeScript), run as a Node sidecar | Writes and edits documents and shot code, renders stills through engine tools, reviews them against the checklist. |
| Models | `claude-opus-5-5` for planning and scene code; `claude-sonnet-5-5` for routine edits and checks | Chosen per task; the user's own API key. |
| External | Blender (user-installed), ffmpeg, Chrome or a bundled headless shell | Detected on first run, with install instructions. |

The agent's tools are narrow: read and write files inside the project,
render stills or a range, read the checklist. It never runs arbitrary
shell commands.

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

- Distribution: free (like the other oliverz.dev apps) or paid; open
  source or not.
- Bundle a headless Chrome, or require the user's Chrome.
- Whether 2D shots should share one page (as today) or one page per
  shot.
- Licence for the engine and templates.
