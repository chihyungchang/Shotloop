// What the UI shows about a shot, derived from the engine's status and
// the queue: the state badge, the stills and clip to show, time estimates.

import type { Job, Mode, Project, Shot, Take } from './api'
import { t } from './i18n'
import { lookName } from './looks'

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
    case 'cover':
      return t('job.cover')
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
  if (/thumb\.html/.test(file)) return t('act.cover')
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
    case 'render_cover': return t('act.coverRender')
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

// Seconds without an event before an agent reads as "thinking": it writes
// a whole shot (or the world) in one long turn that sends nothing
export const QUIET = 20

// What a running agent is doing now, in words: its last step, or that it
// has been thinking for a while
export function agentNow(job: Job): string | null {
  const last = job.log.at(-1)
  if (!last) return null
  const quiet = job.state === 'running' && job.logAt ? (Date.now() - job.logAt) / 1000 : 0
  return quiet > QUIET ? t('act.thinkFor', { time: formatSeconds(quiet) }) : activityLine(last)
}

// Where a build stands, shot by shot: the shots the AI works on now (five
// at a time, each with what it is doing), the shots whose code it has
// written, the phase (world first when there is no look, then the shots).
// Builds before parallel shots had no markers: then the last shot touched
// is the one in work
export type ShotAction = 'write' | 'stills' | 'check'
export function buildSteps(job: Job | null) {
  const written = new Set<string>()
  const finished = new Set<string>()
  const active = new Map<string, ShotAction>()
  let phase: 'read' | 'world' | 'shots' = 'read'
  let world = false
  let marked = false
  for (const l of job?.log ?? []) {
    let m: RegExpMatchArray | null
    if (l === 'phase world') phase = 'world'
    else if (l === 'phase shots') phase = 'shots'
    else if ((m = l.match(/^shot_start (\S+)/))) {
      marked = true
      active.set(m[1], 'write')
    } else if ((m = l.match(/^shot_done (\S+)/))) {
      active.delete(m[1])
      finished.add(m[1])
    } else if ((m = l.match(/^(\w+)\s+(?:.*?shots\/)?(\d+[a-z0-9-]*)/i)) && /^(write_file|edit_file|render_stills|report_checks|read_checklist)$/i.test(m[1])) {
      const id = m[2]
      const action: ShotAction = /render_stills/i.test(m[1]) ? 'stills' : /checks?/i.test(m[1]) ? 'check' : 'write'
      if (action === 'write' && /shot\.\w+$/.test(l)) written.add(id)
      if (!marked) {
        active.clear()
        phase = 'shots'
      }
      if (!marked || active.has(id)) active.set(id, action)
    } else if (/^(write_file|edit_file)\s+world\//i.test(l)) world = true
  }
  if (job && job.state !== 'running' && job.state !== 'queued') active.clear()
  return { active, written, finished, world, phase }
}

// Seconds since a running job's last event
export const quietFor = (job: Job) => (job.state === 'running' && job.logAt ? (Date.now() - job.logAt) / 1000 : 0)

export type StepState = 'done' | 'active' | 'todo'
export interface Step { label: string; state: StepState; detail?: string }

const stepStates = (n: number, at: number, finished: boolean): StepState[] =>
  Array.from({ length: n }, (_, i) => (finished || i < at ? 'done' : i === at ? 'active' : 'todo'))

// A plan's steps for the person: it reads, then writes everything in one
// long quiet turn, then saves storyboard.json
export function planSteps(job: Job): Step[] {
  const log = job.log
  const finished = job.state === 'done'
  const saving = log.some(l => /^(write_file|edit_file)\s+storyboard\.json/i.test(l))
  // Reading is quick; a few seconds of quiet after it is the writing
  const at = saving ? 2 : log.length && (quietFor(job) > 5 || log.some(l => !/^(read_file|list_files|read_checklist|agent:)/i.test(l))) ? 1 : 0
  const s = stepStates(3, at, finished)
  const time = job.startedAt ? formatSeconds((Date.now() - job.startedAt) / 1000) : ''
  return [
    { label: t('planStep.read'), state: s[0] },
    { label: t('planStep.write'), state: s[1], detail: s[1] === 'active' ? t('planStep.writeDetail', { time }) : undefined },
    { label: t('planStep.save'), state: s[2] }
  ]
}

// A build's steps: read the plan, the shared look (a built-in look, or
// designed by the AI), then the shots, five at a time
export function buildStepList(job: Job, shots: { id: string }[], look: string | null): Step[] {
  const { active, written, finished, world, phase } = buildSteps(job)
  const done = job.state === 'done'
  const thinking = quietFor(job) > QUIET
  const at = phase === 'shots' || active.size ? 2 : phase === 'world' || world || (!look && thinking) ? 1 : 0
  const s = stepStates(3, at, done)
  const n = (id: string) => shots.findIndex(x => x.id === id) + 1
  const words: Record<ShotAction, 'build.writing' | 'build.rendering' | 'build.checking'> = { write: 'build.writing', stills: 'build.rendering', check: 'build.checking' }
  const now = [...active].map(([id, a]) => t('build.shotDoing', { n: n(id), what: t(words[a]) })).join(' · ')
  const count = new Set([...written, ...finished]).size
  return [
    { label: t('buildStep.read'), state: s[0] },
    look
      ? { label: t('buildStep.lookUsed', { name: lookName(look) }), state: s[0] === 'done' ? 'done' : 'todo' }
      : { label: t('buildStep.look'), state: s[1], detail: s[1] === 'active' ? t('buildStep.lookDetail') : undefined },
    {
      label: t('buildStep.shots', { done: Math.min(count, shots.length), total: shots.length }), state: s[2],
      detail: s[2] === 'active' ? (now || (thinking ? t('build.thinking') : undefined)) : undefined
    }
  ]
}

// A render's stage, in words
const STAGES: Record<string, 'stage.frames' | 'stage.captions' | 'stage.screen' | 'stage.export'> = { frames: 'stage.frames', captions: 'stage.captions', screen: 'stage.screen', export: 'stage.export' }
export const stageName = (s: string) => (STAGES[s] ? t(STAGES[s]) : s)
