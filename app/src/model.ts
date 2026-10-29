// What the UI shows about a shot, derived from the engine's status and
// the queue: the state badge, the stills and clip to show, time estimates.

import type { Job, Mode, Project, Shot, Take } from './api'

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
  return Math.round(shot.duration * project.fps * PER_FRAME[project.track][mode] + (project.track === '3d' ? 20 : 3))
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
  if (s < 60) return `${Math.max(1, Math.round(s))} s`
  const m = Math.floor(s / 60)
  return `${m} min ${String(Math.round(s % 60)).padStart(2, '0')} s`
}

export const shotTime = (shot: Shot) => `${shot.start.toFixed(1)}–${(shot.start + shot.duration).toFixed(1)} s`
