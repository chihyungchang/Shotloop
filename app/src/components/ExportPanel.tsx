import { useEffect, useState } from 'react'
import { api, fileUrl, type ExportResult, type Job, type Mode, type Project } from '../api'
import { estimate, formatSeconds } from '../model'

const ASPECTS = ['9:16', '16:9']

// Export (docs/PRD.md §7.9, §7.10): the film from cached shots, only the
// changed ones re-render; MP4 at 9:16 and 16:9; cover and publish copy
export function ExportPanel({ project, jobs }: { project: Project; jobs: Job[] }) {
  const [mode, setMode] = useState<Mode>('final')
  const [aspects, setAspects] = useState<string[]>(ASPECTS)
  const [latest, setLatest] = useState<ExportResult | null>(null)
  const [publish, setPublish] = useState<string | null>(null)

  const exportJob = jobs.filter(j => j.project === project.root && j.kind === 'export').at(-1)
  const publishJob = jobs.filter(j => j.project === project.root && j.kind === 'publish').at(-1)
  const busy = exportJob && (exportJob.state === 'running' || exportJob.state === 'queued')

  useEffect(() => {
    api.readText(project.root, 'out/latest.json').then(t => setLatest(JSON.parse(t)), () => setLatest(null))
    if (project.files.publish) api.readText(project.root, 'publish.md').then(setPublish, () => setPublish(null))
  }, [project, exportJob?.state, publishJob?.state])

  // Shots whose frames for this mode are out of date
  const pending = project.shots.filter(s => s[mode].state !== 'cached')
  const time = pending.reduce((t, s) => t + estimate(project, s, mode), 0)

  const run = () => {
    // One job per shot, so the queue shows them one at a time; the export
    // job then only joins the cached clips
    for (const s of pending) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
    api.enqueue({ kind: 'export', project: project.root, mode, aspects })
  }

  return (
    <div className="export">
      <h3>Export</h3>
      <div className="segmented">
        {(['draft', 'final'] as Mode[]).map(m => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'draft' ? 'Draft' : 'Final'}</button>
        ))}
      </div>
      <div className="row gap">
        {ASPECTS.map(a => (
          <label key={a} className="check">
            <input
              type="checkbox"
              checked={aspects.includes(a)}
              onChange={e => setAspects(e.target.checked ? [...aspects, a].sort().reverse() : aspects.filter(x => x !== a))}
            />
            {a}
          </label>
        ))}
      </div>
      <p className="small">
        {pending.length
          ? <>Renders {pending.length} of {project.shots.length} shots first (~{formatSeconds(time)}): {pending.map(s => s.id).join(', ')}.</>
          : <>All {project.shots.length} shots are cached for {mode}: export only joins them.</>}
      </p>
      <button className="primary" onClick={run} disabled={!aspects.length || !!busy}>
        {busy ? 'Exporting…' : `Export ${mode} MP4`}
      </button>
      {exportJob?.state === 'failed' && <pre className="error-box small">{exportJob.error}</pre>}

      {latest && (
        <div className="latest">
          <h3>Latest export <span className="muted small">{latest.mode} · {latest.at}</span></h3>
          <ul>
            {latest.films.map(f => (
              <li key={f.file}>
                <button className="link" onClick={() => api.openPath(f.file)}>{f.aspect} MP4</button>
                {' · '}
                <button className="link" onClick={() => api.reveal(f.file)}>Show</button>
              </li>
            ))}
          </ul>
          {latest.cover && (
            <img className="cover" src={fileUrl(latest.cover)} alt="Cover" onClick={() => api.openPath(latest.cover!)} />
          )}
        </div>
      )}

      <h3>Publish copy</h3>
      <p className="muted small">publish.md: the post for YouTube Shorts, TikTok and Reels, from the copy's facts and sources only.</p>
      <button
        onClick={() => api.enqueue({ kind: 'publish', project: project.root })}
        disabled={publishJob?.state === 'running' || publishJob?.state === 'queued'}
      >
        {publishJob?.state === 'running' ? 'Writing…' : publish ? 'Rewrite with the agent' : 'Write with the agent'}
      </button>
      {publishJob?.state === 'failed' && <pre className="error-box small">{publishJob.error}</pre>}
      {publish && <pre className="publish">{publish}</pre>}
    </div>
  )
}
