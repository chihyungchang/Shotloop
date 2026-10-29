import { fileUrl, type Mode, type Project } from '../../api'
import { formatSeconds, type ShotView } from '../../model'
import { t } from '../../i18n'

const LABEL = (s: ShotView['state']) => t(`state.${s}`)

// The film as a strip of shots (docs/PRD.md §7.3): widths follow the
// shots' durations; each shows its still, state and failed checks
export function Filmstrip({ project, views, mode, selected, onSelect }: {
  project: Project
  views: Map<string, ShotView>
  mode: Mode
  selected: string
  onSelect: (id: string) => void
}) {
  const ticks = Array.from({ length: Math.floor(project.duration / 5) + 1 }, (_, i) => i * 5)
  return (
    <div className="filmstrip">
      <div className="ruler" aria-hidden>
        {ticks.map(s => (
          <span key={s} style={{ left: `${(s / project.duration) * 100}%` }}>{s}s</span>
        ))}
      </div>
      <nav className="strip" aria-label={t('common.shots', { n: project.shots.length })}>
        {project.shots.map((shot, i) => {
          const v = views.get(shot.id)!
          const thumb = v.stills?.[1]
          const p = v.job?.progress
          return (
            <button
              key={shot.id}
              className={`frame state-${v.state}${shot.id === selected ? ' selected' : ''}`}
              style={{ flexGrow: shot.duration }}
              onClick={() => onSelect(shot.id)}
              title={`${shot.id} · ${formatSeconds(shot.duration)} · ${LABEL(v.state)} (${t(`mode.${mode}`)})`}
            >
              <div className="frame-thumb">
                {thumb ? <img src={fileUrl(thumb, v.take?.take)} alt="" className={v.stale ? 'dim' : ''} /> : null}
                <span className="frame-no">{i + 1}</span>
                {v.failedChecks.length > 0 && (
                  <span className="frame-flag" title={t('film.failedChecks', { rules: v.failedChecks.join(', ') })}>{v.failedChecks.length}</span>
                )}
                {v.state === 'rendering' && p && p.total > 0 && (
                  <div className="frame-bar"><i style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
                )}
              </div>
              <div className="frame-meta">
                <span className="dot" />
                <span className="ellipsis">{shot.title ?? shot.id}</span>
                <span className="muted">{formatSeconds(shot.duration)}</span>
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
