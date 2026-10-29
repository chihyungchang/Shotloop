import { useEffect } from 'react'
import { fileUrl, type Project } from '../../api'
import { t } from '../../i18n'
import { Icon } from '../Icon'
import { VideoPlayer } from './VideoPlayer'

// The whole film over the studio, with its music: what the export will
// look like, before exporting. Esc or a click outside closes it.
export function FilmPreview({ project, file, stale = [], close, update }: { project: Project; file: string; stale?: string[]; close: () => void; update?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  const wide = project.size.width > project.size.height
  return (
    <div className="film-overlay" onClick={close} role="dialog" aria-label={t('film.title')}>
      <div className={`film-box${wide ? ' wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="film-head">
          <strong className="ellipsis">{project.title}</strong>
          <span className="muted small">{t('film.note')}</span>
          <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" /></button>
        </div>
        {stale.length > 0 && (
          <div className="film-stale" title={stale.join(', ')}>
            <Icon name="info" size={14} />
            <span>{t('film.stale', { n: stale.length })}</span>
            {update && <button className="small" onClick={update}><Icon name="refresh" size={12} /> {t('film.update')}</button>}
          </div>
        )}
        <VideoPlayer src={fileUrl(file)} className={`film${wide ? ' wide' : ''}`} loop={false} muted={false} sound />
      </div>
    </div>
  )
}
