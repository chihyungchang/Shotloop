// Typed access to the app shell (src-tauri/src/lib.rs) and the shapes the
// engine and the agent report.

import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { lang } from './i18n'

export type Mode = 'draft' | 'final'
export type CacheState = 'cached' | 'stale' | 'missing'

export interface CacheEntry {
  key: string
  state: CacheState
  clip: string | null
  stills: string[] | null
  seconds: number | null
}

export interface Take {
  take: number
  at: string
  mode: Mode
  kind: 'clip' | 'stills'
  key: string
  seconds: number
  stills: string[] | null
  clip: string | null
  preview: string | null
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

export interface FixRecord {
  at?: string
  task: 'fix' | 'check'
  shot: string
  request: string | null
  summary: string
  touched: string[]
  worldTouched: boolean
  affectedShots: string[]
  checks: Checks[]
  before: string[] | null
  after: string[] | null
  record: string
}

export interface Shot {
  id: string
  title: string | null
  start: number
  duration: number
  code: string
  notes: string
  draft: CacheEntry
  final: CacheEntry
  takes: Take[]
  error: { at: string; mode: Mode; message: string } | null
  checks: Checks | null
  fix: FixRecord | null
  fixes: FixRecord[]
}

export interface Project {
  root: string
  title: string
  slug: string
  track: '2d' | '3d'
  fps: number
  size: { width: number; height: number }
  duration: number
  world: string
  files: { captions: string | null; music: string | null; cover: string | null; publish: string | null }
  shots: Shot[]
}

export interface Progress {
  stage: string
  done: number
  total: number
  eta: number | null
}

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface Job {
  id: number
  kind: 'render' | 'export' | 'fix' | 'check' | 'publish'
  lane: 'render' | 'agent'
  label: string
  project: string
  shot: string | null
  mode: Mode | null
  state: JobState
  progress: Progress | null
  log: string[]
  result: any
  error: string | null
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
}

export type Spec =
  | { kind: 'render'; project: string; shot: string; mode: Mode; stills: boolean }
  | { kind: 'export'; project: string; mode: Mode; aspects: string[] }
  | { kind: 'fix'; project: string; shot: string; request: string; lang?: string }
  | { kind: 'check'; project: string; shot: string; lang?: string }
  | { kind: 'publish'; project: string }

export interface Tool {
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
  apiProtocol: 'anthropic' | 'openai' | ''
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
}

export const EMPTY_SETTINGS: Settings = {
  provider: '', apiPreset: '', apiProtocol: '', apiUrl: '', apiKeys: {}, cli: '', model: '', localUrl: '', localModel: '', localKey: '', blender: '', chrome: '', notifySound: false, notifyDesktop: false
}

export interface About {
  version: string
  os: string
  arch: string
  bundled: boolean
  root: string
  data: string | null
}

export interface Detected {
  clis: { id: string; name: string; bin: string; vendor: string; note?: string; models: string[]; install: string; url: string; path: string | null; version: string | null }[]
  servers: { id: string; name: string; url: string; running: boolean; models: string[] }[]
}

export interface ExportResult {
  mode: Mode
  at: string
  films: { aspect: string; file: string }[]
  cover: string | null
  publish: string | null
  rendered: string[]
}

export interface ProjectSummary {
  root: string
  title: string
  description: string
  slug: string
  track: '2d' | '3d'
  size: { width: number; height: number }
  duration: number
  shots: number
  poster: string | null
  changed: string
}

export interface NewProject {
  dir: string
  idea: string
  title: string
  track: '2d' | '3d'
  aspect: '9:16' | '16:9'
  duration: number
}

export const api = {
  doctor: () => invoke<Doctor>('doctor'),
  openProject: (path: string) => invoke<Project>('open_project', { path }),
  status: (path: string) => invoke<Project>('project_status', { path }),
  createProject: (p: NewProject) => invoke<{ root: string }>('create_project', { ...p }),
  listProjects: (paths: string[], examples = false) => invoke<ProjectSummary[]>('list_projects', { paths, examples }),
  readText: (project: string, path: string) => invoke<string>('read_text', { project, path }),
  writeText: (project: string, path: string, content: string) => invoke<void>('write_text', { project, path, content }),
  // Agent jobs reply in the UI language
  enqueue: (spec: Spec) => invoke<number>('enqueue', { spec: spec.kind === 'fix' || spec.kind === 'check' ? { ...spec, lang: lang() } : spec }),
  jobs: () => invoke<Job[]>('jobs'),
  cancel: (id: number) => invoke<void>('cancel_job', { id }),
  clearJobs: () => invoke<void>('clear_jobs'),
  getSettings: () => invoke<Settings>('get_settings'),
  aiDetect: () => invoke<Detected>('ai_detect'),
  aiModels: (url: string, key: string, protocol: 'anthropic' | 'openai' = 'openai') => invoke<string[]>('ai_models', { url, key, protocol }),
  openUrl: (url: string) => invoke<void>('open_url', { url }),
  saveSettings: (settings: Settings) => invoke<void>('save_settings', { settings }),
  initialProject: () => invoke<string | null>('initial_project'),
  reveal: (path: string) => invoke<void>('reveal', { path }),
  openPath: (path: string) => invoke<void>('open_path', { path }),
  openBlenderDownload: () => invoke<void>('open_blender_download'),
  setTrayText: (status: string, show: string, quit: string, done: string, failed: string) => invoke<void>('set_tray_text', { status, show, quit, done, failed }),
  // One tiny request through the backend as Settings shows it, saved or not
  aiTest: (settings: Settings) => invoke<{ ok: boolean; latencyMs: number; reply: string; backend: string }>('ai_test', { settings }),
  about: () => invoke<About>('about'),
  // The whole film, joined from the shots' clips with music (cached)
  filmPreview: (path: string, mode: Mode) => invoke<{ file: string }>('film_preview', { path, finalMode: mode === 'final' })
}

export const onQueue = (f: (jobs: Job[]) => void): Promise<UnlistenFn> => listen<Job[]>('queue', e => f(e.payload))
export const onProjectChanged = (f: (root: string) => void): Promise<UnlistenFn> =>
  listen<string>('project-changed', e => f(e.payload))

// A file on disk as a URL the webview can load; `v` busts the cache when
// a file is rewritten under the same name
export const fileUrl = (path: string, v?: string | number) => `${convertFileSrc(path)}${v != null ? `?v=${v}` : ''}`

export const relPath = (project: Project, abs: string) =>
  abs.startsWith(project.root + '/') ? abs.slice(project.root.length + 1) : abs
