// What the UI shows about a shot, derived from the engine's status and
// the queue: the state badge, the stills and clip to show, time estimates.

import type { Job, Mode, Project, Shot, Take } from './api'
import { t } from './i18n'

export type ShotState = 'cached' | 'stale' | 'missing' | 'queued' | 'rendering' | 'failed'

export interface ShotView {
  state: ShotState
  job: Job | null
  // The take to show: the latest one of this mode, whatever its inputs
  take: Take | null
  stills: string[] | null
  clip: string | null
  stale: boolean
  failedChecks: string[]
}

const activeFor = (jobs: Job[], project: Project, shot: string, mode: Mode) =>
  jobs.find(j => j.project === project.root && j.shot === shot && j.kind === 'render' && j.mode === mode
    && (j.state === 'running' || j.state === 'queued')) ?? null

// The quality the editor works in (the engine's editMode): 3D shows fast
// previews and renders final frames only to export; 2D is final throughout
export const editMode = (project: Project): Mode => (project.track === '3d' ? 'draft' : 'final')

export function shotView(project: Project, shot: Shot, mode: Mode, jobs: Job[]): ShotView {
  const entry = shot[mode]
  const job = activeFor(jobs, project, shot.id, mode)
  const takes = shot.takes.filter(t => t.mode === mode)
  const clipTake = [...takes].reverse().find(t => t.kind === 'clip') ?? null
  const latest = takes.at(-1) ?? null
  const lastAt = latest ? Date.parse(latest.at) : 0
  const failed = shot.error && shot.error.mode === mode && Date.parse(shot.error.at) > lastAt
  const state: ShotState = job
    ? job.state === 'running' ? 'rendering' : 'queued'
    : failed ? 'failed' : entry.state
  return {
    state,
    job,
    take: latest,
    // Current stills first; otherwise the latest take's, marked stale
    stills: entry.stills ?? latest?.stills ?? null,
    clip: entry.clip ? (clipTake?.key === entry.key ? clipTake.preview ?? entry.clip : entry.clip) : clipTake?.preview ?? clipTake?.clip ?? null,
    stale: !entry.stills && !!latest,
    failedChecks: shot.checks?.results.filter(r => !r.pass).map(r => r.rule) ?? []
  }
}

// Seconds per frame when a shot has never been rendered in a mode
const PER_FRAME: Record<Project['track'], Record<Mode, number>> = {
  '2d': { draft: 0.06, final: 0.12 },
  '3d': { draft: 0.4, final: 3 }
}

// Estimated render time: the last render of this shot in this mode, or
// a per-frame guess for the track
export function estimate(project: Project, shot: Shot, mode: Mode, stills = false): number {
  if (stills) return project.track === '3d' ? (mode === 'draft' ? 25 : 40) : 3
  const last = shot[mode].seconds ?? [...shot.takes].reverse().find(t => t.mode === mode && t.kind === 'clip')?.seconds
  if (last) return last
  // 3D final: the time grows with the samples (measured on an M4: 1.0 s
  // a frame at 24, 2.4 s at 64)
  const perFrame = project.track === '3d' && mode === 'final' && project.samples ? 0.35 + 0.028 * project.samples : PER_FRAME[project.track][mode]
  return Math.round(shot.duration * project.fps * perFrame + (project.track === '3d' ? 20 : 3))
}

export function jobEstimate(project: Project | null, job: Job): number | null {
  if (job.state === 'running' && job.progress?.eta != null) return job.progress.eta
  if (!project || job.project !== project.root) return null
  if (job.kind === 'render' && job.shot && job.mode) {
    const shot = project.shots.find(s => s.id === job.shot)
    return shot ? estimate(project, shot, job.mode, job.label.startsWith('Stills')) : null
  }
  if (job.kind === 'export') return 10
  return null
}

export function formatSeconds(s: number | null | undefined) {
  if (s == null) return '–'
  const n = Math.max(1, Math.round(s))
  if (n < 60) return t('unit.s', { n })
  return t('unit.min', { m: Math.floor(n / 60), s: String(n % 60).padStart(2, '0') })
}

// A time still to come, rounded the way people say it: seconds under a
// minute, else whole minutes
export function formatEta(s: number | null | undefined) {
  if (s == null) return '–'
  if (s < 50) return t('unit.s', { n: Math.max(5, Math.round(s / 5) * 5) })
  return t('unit.minutes', { n: Math.max(1, Math.round(s / 60)) })
}

export const shotTime = (shot: Shot) => t('unit.s', { n: `${shot.start.toFixed(1)}–${(shot.start + shot.duration).toFixed(1)}` })

// A job's label in the UI language, from its fields (the shell's own
// label is English)
export function jobLabel(job: Job): string {
  const mode = job.mode ? t(`mode.${job.mode}`) : ''
  switch (job.kind) {
    case 'render':
      return t(job.label.startsWith('Stills') ? 'job.stills' : 'job.render', { shot: job.shot ?? '', mode })
    case 'export':
      return t('job.export', { mode, aspects: job.label.match(/\(([^)]*)\)/)?.[1] ?? '' })
    case 'fix':
      return t('job.fix', { shot: job.shot ?? '', request: job.label.replace(/^Fix [^:]+: /, '') })
    case 'check':
      return t('job.check', { shot: job.shot ?? '' })
    case 'publish':
      return t('job.publish')
    case 'plan':
      return t('job.plan')
    case 'build':
      return t('job.build')
  }
}

// What a file in a project is, in words
function fileWords(file: string): string {
  const shot = file.match(/shots\/(\d+)[^/]*\/(notes\.md)?/)
  if (shot) return t(shot[2] ? 'act.notes' : 'act.shot', { n: shot[1] })
  if (/^world\//.test(file)) return t('act.world')
  if (/captions/.test(file)) return t('act.captions')
  if (/storyboard/.test(file)) return t('act.storyboard')
  if (/copy\.md/.test(file)) return t('act.copy')
  return t('act.file')
}

// An agent's activity log line, in words: tool lines ("read_file
// shots/05-x/shot.py", "Write /abs/path") become a sentence; anything
// else (the agent's own text) is shown as it is
export function activityLine(line: string): string {
  const m = line.match(/^(\w+)\s*(.*)$/)
  if (!m) return line
  const [, name, rest] = m
  const what = fileWords(rest.replace(/^.*?\/(shots|world)\//, '$1/'))
  switch (name.toLowerCase()) {
    case 'read_file': case 'read': return t('act.read', { what })
    case 'write_file': case 'write': return t('act.write', { what })
    case 'edit_file': case 'edit': case 'multiedit': return t('act.edit', { what })
    case 'list_files': case 'glob': case 'grep': case 'ls': return t('act.list')
    case 'render_stills': return t('act.stills', { what: rest ? t('act.shot', { n: rest.match(/\d+/)?.[0] ?? rest }) : t('act.shot', { n: '' }) })
    case 'read_checklist': case 'report_checks': return rest ? t('act.checks', { what: t('act.shot', { n: rest.match(/\d+/)?.[0] ?? rest }) }) : t('act.checking')
    case 'bash': return t('act.run')
    case 'agent': return t('act.think')
  }
  return line.replace(/^agent:\s*/, '')
}

// A build's progress: the shots it has written so far
export function buildProgress(job: Job, total: number): { done: number; total: number } | null {
  if (job.kind !== 'build' || !total) return null
  const written = new Set<string>()
  for (const l of job.log) {
    const m = l.match(/^(write_file|write|edit_file|edit)\s.*shots\/(\d+)[^/]*\/shot\./i)
    if (m) written.add(m[2])
  }
  return { done: Math.min(written.size, total), total }
}

// A render's stage, in words
const STAGES: Record<string, 'stage.frames' | 'stage.captions' | 'stage.screen' | 'stage.export'> = { frames: 'stage.frames', captions: 'stage.captions', screen: 'stage.screen', export: 'stage.export' }
export const stageName = (s: string) => (STAGES[s] ? t(STAGES[s]) : s)
