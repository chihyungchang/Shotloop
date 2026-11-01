import { fileUrl, type Project } from '../../api'
import { useEscape } from '../../hooks'
import { t } from '../../i18n'
import { isWide } from '../../model'
import { Icon } from '../Icon'
import { VideoPlayer } from './VideoPlayer'

// The whole film over the studio, with its music: what the export will
// look like, before exporting. Esc or a click outside closes it.
export function FilmPreview({ project, file, close }: { project: Project; file: string; close: () => void }) {
  useEscape(close)
  const wide = isWide(project.size)
  return (
    <div className="film-overlay" onClick={close} role="dialog" aria-label={t('film.title')}>
      <div className={`film-box${wide ? ' wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="film-head">
          <strong className="ellipsis">{project.title}</strong>
          <span className="muted small">{t('film.note')}</span>
          <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" /></button>
        </div>
        <VideoPlayer src={fileUrl(file)} className={`film${wide ? ' wide' : ''}`} loop={false} muted={false} sound />
      </div>
    </div>
  )
}
