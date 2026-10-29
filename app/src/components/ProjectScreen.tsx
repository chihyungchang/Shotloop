import { useEffect, useMemo, useState } from 'react'
import { api, type Job, type Mode, type Project } from '../api'
import { estimate, formatSeconds, shotView } from '../model'
import { ExportPanel } from './ExportPanel'
import { QueuePanel } from './QueuePanel'
import { ShotPanel } from './ShotPanel'
import { Timeline } from './Timeline'

export function ProjectScreen({ project, jobs, refresh, close }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  close: () => void
}) {
  const [mode, setMode] = useState<Mode>('draft')
  const [selected, setSelected] = useState(project.shots[0]?.id ?? '')
  const [side, setSide] = useState<'queue' | 'export'>('queue')

  // Keep the selection valid when shots are renamed or removed
  useEffect(() => {
    if (!project.shots.some(s => s.id === selected)) setSelected(project.shots[0]?.id ?? '')
  }, [project, selected])

  const views = useMemo(
    () => new Map(project.shots.map(s => [s.id, shotView(project, s, mode, jobs)])),
    [project, mode, jobs]
  )
  const pending = project.shots.filter(s => views.get(s.id)!.state === 'stale' || views.get(s.id)!.state === 'missing' || views.get(s.id)!.state === 'failed')
  const pendingTime = pending.reduce((t, s) => t + estimate(project, s, mode), 0)
  const shot = project.shots.find(s => s.id === selected)

  // Render every shot whose frames are out of date, one at a time
  const renderPending = () => {
    for (const s of pending) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
  }

  const running = jobs.filter(j => j.state === 'running' || j.state === 'queued').length

  return (
    <div className="project">
      <header className="topbar">
        <button className="ghost" onClick={close} title="Close project">←</button>
        <div className="title">
          <h1>{project.title}</h1>
          <span className="muted small">
            {project.track.toUpperCase()} · {project.size.width}×{project.size.height} · {project.fps} fps · {project.duration.toFixed(1)} s · {project.shots.length} shots
          </span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Render mode">
          {(['draft', 'final'] as Mode[]).map(m => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === 'draft' ? 'Draft' : 'Final'}
            </button>
          ))}
        </div>
        <button onClick={renderPending} disabled={!pending.length}
          title={pending.length ? `${pending.map(s => s.id).join(', ')}` : 'Every shot is up to date'}>
          {pending.length ? `Render ${pending.length} changed · ~${formatSeconds(pendingTime)}` : 'All shots cached'}
        </button>
        <button className="ghost" onClick={() => api.reveal(project.root)}>Show in Finder</button>
        <div className="segmented">
          <button className={side === 'queue' ? 'on' : ''} onClick={() => setSide('queue')}>
            Queue{running ? ` · ${running}` : ''}
          </button>
          <button className={side === 'export' ? 'on' : ''} onClick={() => setSide('export')}>Export</button>
        </div>
      </header>

      <Timeline project={project} views={views} mode={mode} selected={selected} onSelect={setSelected} />

      <div className="workspace">
        <main className="main">
          {shot ? (
            <ShotPanel key={shot.id} project={project} shot={shot} view={views.get(shot.id)!} mode={mode} jobs={jobs} refresh={refresh} />
          ) : (
            <p className="muted pad">No shots.</p>
          )}
        </main>
        <aside className="side">
          {side === 'queue'
            ? <QueuePanel project={project} jobs={jobs} />
            : <ExportPanel project={project} jobs={jobs} />}
        </aside>
      </div>
    </div>
  )
}
