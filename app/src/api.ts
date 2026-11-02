// Typed access to the app shell (src-tauri/src/commands/*.rs) and the
// shapes the engine and the agent report (engine/shotloop/protocol.d.ts).

import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  BrokenProject, ExportResult, FixRecord, ListResult, Mode, MusicResult, SoundResult, PickedElement, PickMap, PreviewResult, ProgressEvent, ProjectSummary,
  QualityResult, ShotStatus, StatusResult, Take, UsageEvent, UsageWindow, VoiceResult
} from '../../engine/shotloop/protocol'
import type { Protocol } from './ai/presets'
import { lang } from './i18n'

export type { BrokenProject, ExportResult, FixRecord, Mode, PickedElement, PickMap, PreviewResult, ProjectSummary, Take, UsageWindow }
export type Project = StatusResult
export type Shot = ShotStatus
export type VoiceInfo = VoiceResult
export type MusicInfo = MusicResult
export type SoundInfo = SoundResult
// What the sound panel changes; nothing set reads it
export interface SoundChange { ambience?: string; ambienceGain?: number; effects?: boolean; effectsGain?: number; cue?: string; kind?: string; on?: boolean }

// A card of `list`: a project, or one that can't be read (shown as broken)
export type ListEntry = ListResult[number]
export const isBroken = (p: ListEntry): p is BrokenProject => 'error' in p

// Claude Code's subscription limits, from its last run (the shell adds when)
export type Usage = Omit<UsageEvent, 'type'> & { at: number }

// A job's latest progress (queue.rs Progress)
type Progress = Omit<ProgressEvent, 'type' | 'shot'> & { shot: string | null }

type Spec =
  | { kind: 'render'; project: string; shot: string; mode: Mode; stills: boolean }
  | { kind: 'export'; project: string; mode: Mode; aspects: string[]; video?: boolean; cover?: boolean; publish?: boolean; to?: string; name?: string; lang?: string }
  | { kind: 'fix'; project: string; shot: string; request: string; element?: PickedElement; lang?: string }
  | { kind: 'check'; project: string; shot: string; lang?: string }
  | { kind: 'publish'; project: string; lang?: string }
  | { kind: 'cover'; project: string; request?: string; template?: string; reference?: boolean; lang?: string }
  | { kind: 'plan'; project: string; request?: string; lang?: string }
  | { kind: 'build'; project: string; lang?: string }
  // A speech model for the voice-over, downloaded with progress
  | { kind: 'voiceModel'; model: string }
  // Every line spoken and the shots fitted to them
  | { kind: 'voiceFit'; project: string }
  // The whole film to watch: the shots' clips joined, with music (cached)
  | { kind: 'preview'; project: string; mode: Mode }

// A job of the queue (src-tauri/src/queue.rs Job)
export interface Job {
  id: number
  kind: Spec['kind']
  lane: 'render' | 'agent' | 'voice' | 'preview'
  project: string
  shot: string | null
  // The speech model a voiceModel job downloads
  model: string | null
  mode: Mode | null
  // A render of the shot's stills, not its clip
  stills: boolean
  // The aspect ratios an export makes
  aspects: string[]
  // What the person asked for (a fix's, a plan's or a cover's request)
  request: string | null
  // The element a fix is about, picked in the frame
  element: PickedElement | null
  state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  progress: Progress | null
  // A build's step, and each shot at its latest state: start, written
  // (not every CLI sends it), done
  phase: 'world' | 'parts' | 'shots' | null
  shots: Record<string, string>
  log: string[]
  logAt: number | null
  result: any
  error: string | null
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
}

// The plan the planning page edits (storyboard.json)
export interface StoryShot {
  title: string
  duration: number
  show: string
  text: string
  motion: string
  // The voice-over's line for the shot
  say?: string
}
export interface Storyboard {
  target?: number
  // The visual style the planner picked (engine/shotloop/data.mjs STYLES),
  // why, and its second choice
  style?: string | null
  styleWhy?: string
  styleAlt?: string
  look?: string | null
  // The look the AI picked and why; lookChosen: the person picked look
  // instead (agent/src/main.ts keepChosenLook)
  lookAi?: string
  lookWhy?: string
  lookChosen?: boolean
  // The language spoken and written (a voiced plan names it)
  lang?: string
  copy: { idea?: string; hook: string; body: string; facts: { text: string; source: string }[] }
  shots: StoryShot[]
  // 2D: pictures several shots show, drawn once before the shots (the
  // build's "parts" step); shots are numbered from 1
  recurring?: { name?: string; design?: string; shots?: number[] }[]
}

interface Tool {
  path: string
  version: string | null
}

export interface Doctor {
  node: string
  nodePath: string | null
  root: string
  apiKey: boolean
  chrome: Tool | null
  ffmpeg: Tool | null
  blender: Tool | null
  install: Record<'chrome' | 'ffmpeg' | 'blender', string>
  // Node and ffmpeg shipped inside the app
  bundled: { node: boolean; ffmpeg: boolean }
}

export type Provider = 'api' | 'cli' | 'local'

export interface Settings {
  provider: Provider | ''
  // api: a preset from ai/presets.ts, its protocol and base URL, and the
  // user's key per preset
  apiPreset: string
  apiProtocol: Protocol | ''
  apiUrl: string
  apiKeys: Record<string, string>
  cli: string
  model: string
  localUrl: string
  localModel: string
  localKey: string
  blender: string
  chrome: string
  // A sound and a desktop notification when the queue runs dry
  notifySound: boolean
  notifyDesktop: boolean
  // Asset library sources: the person's own keys
  polypizzaKey: string
  smithsonianKey: string
  // Shots the AI builds at once, 1–5; 0 picks by the machine
  parallel: number
  // Anonymous usage counts (src/telemetry.ts): on unless turned off, sent once
  // the first-launch notice was shown
  telemetryOff: boolean
  telemetryTold: boolean
}

// The anonymous usage report due now (src-tauri/src/telemetry.rs)
interface TelemetryCounts { jobs: Record<string, number>; styles: Record<string, number> }
interface TelemetryReport { id: string; version: string; arch: string; counts: TelemetryCounts }

export interface Machine { cores: number; memoryGb: number; autoParallel: number }

// A search result from an asset source, and an asset on this Mac
export interface LibraryItem {
  id: string
  source: 'polypizza' | 'smithsonian'
  name: string
  thumb: string | null
  license: string
  author: string
  authorUrl: string | null
  page: string | null
  download: string
  triangles: number | null
  animated: boolean
  size: number | null
}
export const BLENDER_DOWNLOAD = 'https://www.blender.org/download/'

// Where the person gets a key for each asset source
export const KEY_PAGES: Record<LibraryItem['source'], string> = {
  polypizza: 'https://poly.pizza/settings/api',
  smithsonian: 'https://api.data.gov/signup/'
}

export interface Asset {
  id: string
  name: string
  source: string
  license: string
  author: string
  page?: string | null
  triangles?: number | null
  dir: string
  model: string
  thumb: string | null
}

// The speech models (Settings → Dependencies): each downloaded on first
// use into one folder
export interface VoiceModel {
  id: string
  name: string
  license: string
  home: string
  langs: string[]
  bytes: number
  installed: boolean
}

export interface About {
  version: string
  os: string
  arch: string
  bundled: boolean
  root: string
  data: string | null
}

// What the agent finds on this Mac (agent/src/providers.ts detect): every
// CLI agent it knows, installed or not, and every local server it looks for
export interface Detected {
  clis: { id: string; name: string; bin: string; vendor: string; note?: string; models: string[]; install: string; url: string; path: string | null; version: string | null }[]
  servers: { id: string; name: string; url: string; running: boolean; models: string[] }[]
}

export interface CoverTemplate {
  id: string
  name: string
  // The title of the project it was saved from
  from: string | null
  created: string | null
  page: string
  preview: string | null
}

// The video rules (engine/shotloop/rules.mjs): fixed ones, the person's
// taste as they set it (built-in ones reworded or off, their own), and
// the toolbox with a picture per tool (a file path, or null)
export type RuleTrack = 'all' | '2d' | '3d'
export interface Rule {
  id: string
  track: RuleTrack
  name: string | null
  rule?: string
  builtIn?: boolean
  edited?: boolean
  off?: boolean
}
export interface RuleTool { id: string; group: 'story' | 'science' | 'camera' | 'frame' | 'cut' | 'staging' | 'light' | 'explain' | 'mine'; tracks: ('2d' | '3d')[]; name: string; text: string; builtIn: boolean; off: boolean; image: string | null }
// damaged: where a rules file that couldn't be read was set aside, while
// the defaults stand in for it
export interface Rules { damaged: string | null; fixed: Rule[]; taste: Rule[]; tools: RuleTool[] }

// One entry of the AI's memory (engine/shotloop/memory.mjs): a note the
// person wrote, or a lesson the AI kept while building
export interface Memory {
  id: string
  by: 'user' | 'ai'
  track: 'all' | '2d' | '3d'
  text: string
  // The title of the project a lesson was learned on
  from: string | null
  created: string | null
}

// What the new-project form sends (projects.rs NewProject)
interface NewProject {
  dir: string
  idea: string
  title: string
  // 'auto': the planner picks 2D or 3D through the visual style
  track: '2d' | '3d' | 'auto'
  // 3D: WebGL (three.js, fast) or Blender (slower, higher quality)
  renderer?: 'webgl' | 'blender'
  aspect: '9:16' | '16:9'
  // Seconds as text, or 'auto' for the planner to choose 15–60 s
  duration: string
  // 2D look id; '' lets the planner pick
  look: string
  // 2D visual style id; '' lets the planner pick
  style: string
  // The voice-over (on unless turned off)
  voice?: boolean
}

// A change to the music bed (media.rs MusicChange); none reads it
type MusicChange = { preset?: string; shuffle?: boolean; file?: string; none?: boolean; gain?: number; bed?: boolean }

// Agent jobs (and an export's copy) reply in the UI language
const SPOKEN: Spec['kind'][] = ['fix', 'check', 'plan', 'build', 'publish', 'cover', 'export']

export const api = {
  doctor: () => invoke<Doctor>('doctor'),
  openProject: (path: string) => invoke<Project>('open_project', { path }),
  status: (path: string) => invoke<Project>('project_status', { path }),
  createProject: (project: NewProject) => invoke<{ root: string }>('create_project', { project }),
  listProjects: (paths: string[], examples = false) => invoke<ListResult>('list_projects', { paths, examples }),
  readText: (project: string, path: string) => invoke<string>('read_text', { project, path }),
  writeText: (project: string, path: string, content: string) => invoke<void>('write_text', { project, path, content }),
  enqueue: (spec: Spec) => invoke<number>('enqueue', { spec: SPOKEN.includes(spec.kind) ? { ...spec, lang: lang() } : spec }),
  machine: () => invoke<Machine>('machine'),
  aiUsage: () => invoke<Usage | null>('ai_usage'),
  jobs: () => invoke<Job[]>('jobs'),
  cancel: (id: number) => invoke<void>('cancel_job', { id }),
  clearJobs: () => invoke<void>('clear_jobs'),
  // Rejects with a message when the settings file is damaged (src/settings.ts)
  getSettings: () => invoke<Settings>('get_settings'),
  // A few fields saved onto the settings as saved now; gives back the result
  updateSettings: (patch: Partial<Settings>) => invoke<Settings>('update_settings', { patch }),
  aiDetect: () => invoke<Detected>('ai_detect'),
  aiModels: (url: string, key: string, protocol: Protocol = 'openai') => invoke<string[]>('ai_models', { url, key, protocol }),
  // Only the sites the shell lists (os.rs SITES) open
  openUrl: (url: string) => invoke<void>('open_url', { url }),
  initialProject: () => invoke<string | null>('initial_project'),
  reveal: (path: string) => invoke<void>('reveal', { path }),
  trashProject: (path: string) => invoke<void>('trash_project', { path }),
  // Folders and the media and documents the app makes (os.rs OPENABLE)
  openPath: (path: string) => invoke<void>('open_path', { path }),
  setTrayText: (status: string, show: string, quit: string, done: string, failed: string, update: string) => invoke<void>('set_tray_text', { status, show, quit, done, failed, update }),
  // One tiny request through the backend as Settings shows it, saved or not
  aiTest: (settings: Settings) => invoke<{ ok: boolean; latencyMs: number; reply: string; backend: string }>('ai_test', { settings }),
  about: () => invoke<About>('about'),
  telemetryDue: () => invoke<TelemetryReport | null>('telemetry_due'),
  telemetrySent: (counts: TelemetryCounts) => invoke<void>('telemetry_sent', { counts }),
  // The completion alert, now: a sound and a desktop notification
  testAlert: () => invoke<void>('test_alert'),
  librarySearch: (source: string, query: string, cursor: string | null, all: boolean, category: string | null = null) =>
    invoke<{ results: LibraryItem[]; cursor: string | null; total?: number }>('library_search', { source, query, cursor, all, category }),
  libraryGet: (item: LibraryItem) => invoke<Asset>('library', { action: 'get', item }),
  libraryList: (project?: string) => invoke<Asset[]>('library', { action: 'list', project }),
  libraryRemove: (id: string) => invoke<void>('library', { action: 'remove', id }),
  // A .glb from this Mac into the library
  libraryImport: (file: string) => invoke<Asset>('library', { action: 'import', id: file }),
  libraryUse: (project: string, id: string) => invoke<Asset>('library', { action: 'use', project, id }),
  libraryUnuse: (project: string, id: string) => invoke<void>('library', { action: 'unuse', project, id }),
  // Cover templates: covers saved to start the next ones from
  coverTemplates: () => invoke<CoverTemplate[]>('covers', { action: 'list' }),
  saveCoverTemplate: (project: string, name: string) => invoke<CoverTemplate>('covers', { action: 'save', project, name }),
  removeCoverTemplate: (id: string) => invoke<void>('covers', { action: 'remove', id }),
  // An image for the AI to design the cover after (cover-reference.png)
  coverReference: (project: string, file: string) => invoke<string>('covers', { action: 'reference', project, file }),
  // The cover page rendered as a preview (.shotloop/cover.png)
  coverPreview: (project: string) => invoke<string | null>('covers', { action: 'preview', project }),
  // The AI's memory, read by every agent task
  memory: () => invoke<Memory[]>('memory', { action: 'list' }),
  addMemory: (text: string) => invoke<Memory>('memory', { action: 'add', text }),
  removeMemory: (id: string) => invoke<void>('memory', { action: 'remove', id }),
  // The video rules; every change answers with the rules as they now stand
  rules: () => invoke<Rules>('rules', { action: 'list' }),
  editRule: (id: string, text: string) => invoke<Rules>('rules', { action: 'edit', id, text }),
  removeRule: (id: string) => invoke<Rules>('rules', { action: 'remove', id }),
  resetRule: (id: string) => invoke<Rules>('rules', { action: 'reset', id }),
  // A fixed rule or a tool switched off or on
  switchOn: (id: string, on: boolean) => invoke<Rules>('rules', { action: 'switch', id, on }),
  addRule: (text: string, track: RuleTrack) => invoke<Rules>('rules', { action: 'add', text, track }),
  addTool: (name: string, text: string, file: string | null, track: RuleTrack) => invoke<Rules>('rules', { action: 'add-tool', name, text, file, track }),
  removeTool: (id: string) => invoke<Rules>('rules', { action: 'remove-tool', id }),
  // The publish copy into an export's folder, written after the export
  deliverCopy: (path: string, folder: string, name: string) => invoke<string>('deliver_copy', { path, folder, name, lang: lang() }),
  defaultWorkspace: () => invoke<string>('default_workspace'),
  openExample: (path: string) => invoke<{ root: string }>('open_example', { path }),
  saveDraft: (path: string, to: string) => invoke<{ root: string }>('save_draft', { path, to }),
  discardDraft: (path: string) => invoke<unknown>('discard_draft', { path }),
  deriveStoryboard: (path: string) => invoke<unknown | null>('derive_storyboard', { path }),
  applyStoryboard: (path: string) => invoke<{ shots: string[]; duration: number }>('apply_storyboard', { path }),
  setTitle: (path: string, title: string) => invoke<{ title: string }>('set_title', { path, title }),
  setStyle: (path: string, style: string) => invoke<{ style: string }>('set_style', { path, style }),
  // The voice-over: read, or change (turning it on or a new voice fits the
  // shots to the lines again); sample: a WAV of the voice to listen to
  voice: (path: string, change: { on?: boolean; voice?: string; sample?: boolean } = {}) =>
    invoke<VoiceInfo>('voice', { path, ...change }),
  // The speech models, with what is on this Mac (Settings → Dependencies)
  voiceModels: () => invoke<{ dir: string; models: VoiceModel[] }>('voice_models'),
  // The music bed: read with no change, or set a preset, a file, none, a volume
  music: (path: string, change?: MusicChange) => invoke<MusicInfo>('music', { path, change }),
  // The ambience and the sound effects, and which of them play
  sound: (path: string, change?: SoundChange) => invoke<SoundInfo>('sound', { path, change }),
  // What is where on a 2D shot's three stills, for the element picker
  pickMap: (path: string, shot: string) => invoke<PickMap>('pick_map', { path, shot }),
  quality: (path: string, change: { samples?: number; reset?: boolean } = {}) => invoke<QualityResult>('quality', { path, ...change })
}

export const onQueue = (f: (jobs: Job[]) => void): Promise<UnlistenFn> => listen<Job[]>('queue', e => f(e.payload))
// One running job's progress, log, phase or shot
export const onJob = (f: (job: Job) => void): Promise<UnlistenFn> => listen<Job>('job', e => f(e.payload))
export const onUsage = (f: (u: Usage) => void): Promise<UnlistenFn> => listen<Usage>('ai-usage', e => f(e.payload))

// The app menu's or the tray's Check for Updates…
export const onCheckUpdate = (f: () => void): Promise<UnlistenFn> => listen('check-update', () => f())
export const onProjectChanged = (f: (root: string) => void): Promise<UnlistenFn> =>
  listen<string>('project-changed', e => f(e.payload))

// A file on disk as a URL the webview can load; `v` busts the cache when
// a file is rewritten under the same name
export const fileUrl = (path: string, v?: string | number) => `${convertFileSrc(path)}${v != null ? `?v=${v}` : ''}`

export const relPath = (project: Project, abs: string) =>
  abs.startsWith(project.root + '/') ? abs.slice(project.root.length + 1) : abs
