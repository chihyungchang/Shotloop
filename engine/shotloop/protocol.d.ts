// What the engine CLI (cli.mjs --json) and the agent sidecar write on
// stdout, one JSON object per line (engine/lib/jsonl.mjs), and the result
// values of the commands the app reads. Kept to what the code sends: a
// change to an event or a result changes this file in the same commit.

export type Mode = 'draft' | 'final'
export type Track = '2d' | '3d'
export type Size = { width: number; height: number }

// ------------------------------------------------------------------ events

// A render or an export begins (render.mjs)
export interface StartEvent {
  type: 'start'
  shot: string
  mode: Mode
  what: 'stills' | 'clip'
  key: string
  frames: number
}

// Work in steps (compose.mjs progress): frames, subtitle
// check, voice, export; a download counts MB (voice-model, download).
// eta: seconds left, null until one step is done
export interface ProgressEvent {
  type: 'progress'
  stage: string
  done: number
  total: number
  eta: number | null
  shot?: string
}

export interface LogEvent {
  type: 'log'
  message: string
}

// A shot rendered (render.mjs)
export interface RenderDoneEvent {
  type: 'done'
  what: 'stills' | 'clip'
  shot: string
  mode: Mode
  key: string
  seconds: number
  take: number
}

// A film exported (film.mjs exportFilm): the export's result
export type ExportDoneEvent = { type: 'done'; what: 'export' } & ExportResult

export type DoneEvent = RenderDoneEvent | ExportDoneEvent

// The command failed (it exits 1 after this)
export interface ErrorEvent {
  type: 'error'
  message: string
}

// The command's answer, last: the value's type depends on the command
// (see the results below)
export interface ResultEvent<T = unknown> {
  type: 'result'
  value: T
}

// The agent: what the model says, the tools it calls, and the AI CLI's
// subscription limits
export interface TextEvent {
  type: 'text'
  text: string
}

export interface ToolEvent {
  type: 'tool'
  name: string
  summary?: string
  // A file it wrote (relative to the project), or the shot it rendered or checked
  path?: string
  shot?: string
}

export interface UsageWindow {
  utilization: number
  resetsAt: number
  status?: string
}

export interface UsageEvent {
  type: 'usage'
  cli: string
  status?: string
  windows: { five_hour?: UsageWindow; seven_day?: UsageWindow } | null
}

// The agent's build: which phase it is in, and each shot as it goes
export interface PhaseEvent {
  type: 'phase'
  phase: 'world' | 'parts' | 'shots'
}

export interface ShotEvent {
  type: 'shot'
  id: string
  state: 'start' | 'written' | 'done'
}

// The engine's events, as the engine writes them; the agent passes the
// engine's on with source: 'engine'
export type EngineEvent = StartEvent | ProgressEvent | LogEvent | DoneEvent | ErrorEvent | ResultEvent
export type AgentEvent = TextEvent | ToolEvent | UsageEvent | PhaseEvent | ShotEvent | LogEvent | ErrorEvent | ResultEvent
  | (Exclude<EngineEvent, ResultEvent | ErrorEvent> & { source: 'engine' })
export type ShotloopEvent = EngineEvent | AgentEvent

// ------------------------------------------------------------------ status

export type CacheState = 'cached' | 'stale' | 'missing'

// A shot in one mode (cache.mjs status)
export interface CacheEntry {
  key: string
  state: CacheState
  // Stale: what changed since its last render in this mode (code, scene,
  // captions, timing, engine; unknown for renders before parts were kept)
  changed: ('code' | 'scene' | 'captions' | 'timing' | 'engine' | 'unknown')[] | null
  clip: string | null
  stills: string[] | null
  seconds: number | null
}

// One render of a shot; its files are absolute paths in this project
export interface Take {
  take: number
  at: string
  mode: Mode
  kind: 'stills' | 'clip'
  key: string
  parts: Record<'code' | 'scene' | 'captions' | 'timing' | 'engine', string>
  seconds: number
  stills: string[] | null
  clip: string | null
  preview: string | null
}

// A subtitle check's finding: what a subtitle covers, in shot seconds
export interface SubtitleIssue {
  shot: string
  from: number
  to: number
  what: string
}

export interface CheckResult {
  rule: string
  pass: boolean
  note: string
}

export interface Checks {
  at: string
  shot: string
  results: CheckResult[]
  summary: string
}

// The agent's record of a fix or a check (fixes/<stamp>/fix.json); its
// paths are read in this project
export interface FixRecord {
  at: string
  task: 'fix' | 'check'
  shot: string
  request: string | null
  // The element the request was about, picked in the frame
  element?: PickedElement | null
  summary: string
  touched: string[]
  worldTouched: boolean
  affectedShots: string[]
  checks: Checks[]
  before: string[] | null
  after: string[] | null
  record: string
}

// What the person picked on a 2D shot's still, for a fix: a target of
// the pick map, with the point clicked (page CSS px) and the still's time
// (shot seconds). kind 'three' is the shot's three.js scene as a whole,
// 'canvas' a 2D canvas drawing (a region named there with
// window.picker.part or subtitles.keep, or the point); the box is in
// fractions of the frame
export interface PickedElement {
  kind: 'dom' | 'three' | 'canvas'
  // data-name, data-keep or id
  name: string | null
  tag: string
  text: string | null
  path: string
  box: { x: number; y: number; w: number; h: number }
  point: { x: number; y: number }
  t: number
}

// A thing on a still: the box of an unnamed canvas drawing is null (the
// app outlines the point clicked)
export type PickTarget = Omit<PickedElement, 'point' | 't' | 'box'> & { box: PickedElement['box'] | null }

// shotloop pick: each of a 2D shot's three stills (start, middle, end)
// hit-tested on a grid: cells, row by row, index targets (-1: background)
export interface PickMap {
  size: { width: number; height: number }
  stills: { t: number; cols: number; rows: number; targets: PickTarget[]; cells: number[] }[]
}

export interface ShotStatus {
  id: string
  title: string | null
  start: number
  duration: number
  say: string | null
  // The voice-over's sentences timed in the shot, as its code sees them
  cues: { text: string; at: number; end: number }[]
  code: string
  notes: string
  draft: CacheEntry
  final: CacheEntry
  takes: Take[]
  error: { at: string; mode: Mode; message: string } | null
  checks: Checks | null
  // The last subtitle check of these frames (null: not checked since)
  subtitles: { at: string; issues: SubtitleIssue[] } | null
  fixes: FixRecord[]
  fix: FixRecord | null
}

export interface VoiceSettings {
  on: boolean
  voice?: string
  speed?: number
  gain?: number
}

// shotloop status <project>
export interface StatusResult {
  root: string
  title: string
  slug: string
  track: Track
  fps: number
  size: Size
  duration: number
  // The world's key: a change touches every shot
  world: string
  lang: string | null
  voice: VoiceSettings | null
  // The voice-over plays: on, with lines (cues.mjs voiceOn)
  voiced: boolean
  files: { music: string | null; cover: string | null; publish: string | null }
  shots: ShotStatus[]
  example: boolean
  draft: boolean
  look: string | null
  coverFrame: { shot: string; time: number } | null
  coverMade: { how: 'default' | 'free' | 'template' | 'reference'; template?: string; at?: string } | null
  style: string | null
  // The person chose the style (the planner keeps it)
  styleChosen: boolean
  // What the planner still decides: 2D or 3D, the length
  trackAuto: boolean
  lengthAuto: boolean
}

// ------------------------------------------------------------------ results

// shotloop list <dir>… [--examples]: a card per project, or the error of
// one that can't be read
export interface ProjectSummary {
  root: string
  title: string
  description: string
  lang: string | null
  slug: string
  track: Track
  size: Size
  // The visual style, '3d' for the 3D track
  style: string | null
  // A voice-over that plays
  voice: boolean
  duration: number
  shots: number
  poster: string | null
  clip: string | null
  changed: string
  example: boolean
  draft: boolean
}
export interface BrokenProject {
  root: string
  error: string
  example: boolean
  draft: boolean
}
export type ListResult = (ProjectSummary | BrokenProject)[]

// shotloop render <project> --shot <id>
export interface RenderResult {
  shot: string
  mode: Mode
  key: string
  cached: boolean
  take?: number
  seconds?: number
  stills: string[] | null
  clip: string | null
  // The shot with its subtitles, music and voice, when it has a clip
  preview: string | null
  // A voiced 2D shot's subtitle check, run before the render
  subtitles?: SubtitleIssue[]
  // --stills of a 3D shot: each still's areas blown to white (exposure.mjs);
  // null when the check couldn't run
  exposure?: StillExposure[] | null
}

export interface StillExposure {
  still: string
  // Boxes in the still's pixels, largest first; share: of the frame's area
  areas: { x: number; y: number; w: number; h: number; share: number }[]
  // The still with those areas striped and boxed, when there are any
  zebra: string | null
}

// shotloop export <project>
export interface ExportResult {
  mode: Mode
  at: string
  films: { aspect: '9:16' | '16:9'; file: string }[]
  cover: string | null
  publish: string | null
  // --to: the new folder the files were delivered into (their paths then point there)
  folder: string | null
  // Shots rendered for this export
  rendered: string[]
  // The film's visual style, '3d' for the 3D track
  style: string | null
}

// shotloop preview <project>: the whole film to watch
export interface PreviewResult {
  mode: Mode
  file: string
  cached: boolean
  // Shots playing an older clip (their frames are out of date)
  stale: string[]
}

// shotloop voice <project>
export interface VoiceResult {
  on: boolean
  // The picture leads: narration added to a finished film never changes a
  // shot's length (the fit reports overruns instead)
  picture: boolean
  voice: string | null
  speed: number
  gain: number
  lang: string
  // A voice speaks the project's language
  available: boolean
  voices: { id: string; name: string; gender: 'f' | 'm' }[]
  model: { id: string; name: string; bytes: number; installed: boolean } | null
  // Shots with a line
  lines: number
  // --fit (or a new voice or speed): what the fit changed
  fit?: {
    lang: string
    voice: string
    changes: { shot: string; from: number; to: number }[]
    // With the picture leading: lines too long for their shot even spoken
    // faster (seconds spoken, seconds the shot has)
    overruns: { shot: string; spoken: number; room: number }[]
    // Words the voice can't say, per shot
    unspoken: { shot: string; words: string[] }[]
    duration: number
  }
  // --sample: a WAV of the voice
  sample?: string
}

// shotloop tracks <project>: each WAV, or null where the film has none
export interface TracksResult {
  voice: string | null
  music: string | null
  ambience: string | null
  effects: string | null
  // Everything as the film plays it
  mix: string | null
}

// shotloop music <project>
// shotloop sound <project> [changes]: the ambience and the shots' sound
// effects (engine/shotloop/sound.mjs), each with whether it is on
export interface SoundCue {
  // <shot>@<at>:<sound>, what --cue switches
  key: string
  shot: string
  // Film seconds
  at: number
  sound: string
  gain: number
  pan: number
  on: boolean
}
export interface SoundResult {
  ambience?: string | null
  ambienceGain?: number
  effects?: boolean
  effectsGain?: number
  // Switched off: cue keys and "kind:<sound>"
  off?: string[]
  cues: SoundCue[]
  // The synth's ambiences and effects, by name
  ambiences: string[]
  sounds: string[]
  // Sounds added from the asset library: effects or the ambience, by id
  library: { id: string; name: string; duration: number | null; license: string }[]
}

export interface MusicResult {
  kind: 'preset' | 'file' | 'none'
  // A synthesized bed's mood (data.mjs MUSIC_MOODS), 'custom' for a hand-written one
  preset?: string
  // The person's audio file
  name?: string
  gain: number
}

