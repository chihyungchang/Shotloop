import type { Mode, Project } from '../api'
import { fileUrl } from '../api'
import type { ShotView } from '../model'

const LABEL: Record<ShotView['state'], string> = {
  cached: 'Cached',
  stale: 'Stale',
  missing: 'Not rendered',
  queued: 'Queued',
  rendering: 'Rendering',
  failed: 'Failed'
}

// The film as a row of shots (docs/PRD.md §7.3): thumbnail, duration,
// state, mode. Widths follow the shots' durations.
export function Timeline({ project, views, mode, selected, onSelect }: {
  project: Project
  views: Map<string, ShotView>
  mode: Mode
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <nav className="timeline" aria-label="Shots">
      {project.shots.map(shot => {
        const v = views.get(shot.id)!
        const thumb = v.stills?.[1]
        const p = v.job?.progress
        return (
          <button
            key={shot.id}
            className={`shot-card state-${v.state}${shot.id === selected ? ' selected' : ''}`}
            style={{ flexGrow: shot.duration, aspectRatio: 'auto' }}
            onClick={() => onSelect(shot.id)}
            title={`${shot.id} · ${shot.duration} s · ${LABEL[v.state]} (${mode})`}
          >
            <div className="thumb">
              {thumb ? <img src={fileUrl(thumb, v.take?.take)} alt="" className={v.stale ? 'dim' : ''} /> : <div className="empty-thumb" />}
              {v.failedChecks.length > 0 && <span className="flag" title={`Failed checks: ${v.failedChecks.join(', ')}`}>{v.failedChecks.length}</span>}
            </div>
            <div className="meta">
              <span className="id">{shot.id}</span>
              <span className="dur">{shot.duration.toFixed(1)} s</span>
            </div>
            <div className="state">
              <span className="dot" /> {LABEL[v.state]}
              {v.state === 'rendering' && p && p.total ? ` ${Math.round((p.done / p.total) * 100)}%` : ''}
            </div>
            {v.state === 'rendering' && p && p.total > 0 && (
              <div className="bar"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
            )}
          </button>
        )
      })}
    </nav>
  )
}
