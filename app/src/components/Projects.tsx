import { useEffect, useState } from 'react'
import { api, fileUrl, type ProjectSummary } from '../api'
import { formatSeconds } from '../model'
import { forget, readRecent } from '../recent'
import { Icon } from './Icon'
import { formatDate, t } from '../i18n'

// All projects: the recently opened ones and the examples, as cards
// with a poster still (open-design's project grid)
export function Projects({ open }: { open: (path: string) => void }) {
  const [tab, setTab] = useState<'recent' | 'examples'>('recent')
  const [items, setItems] = useState<ProjectSummary[] | null>(null)

  useEffect(() => {
    setItems(null)
    const recent = readRecent()
    api.listProjects(tab === 'recent' ? recent : [], tab === 'examples').then(list => {
      // Forget recents that are gone or no longer projects
      if (tab === 'recent') for (const p of recent) if (!list.some(x => x.root === p)) forget(p)
      setItems(list)
    }, () => setItems([]))
  }, [tab])

  return (
    <div className="projects-page">
      <h1>{t('projects.title')}</h1>
      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>{t('projects.recent')}</button>
        <button role="tab" aria-selected={tab === 'examples'} className={tab === 'examples' ? 'on' : ''} onClick={() => setTab('examples')}>{t('projects.examples')}</button>
      </div>
      {items === null && <p className="muted">{t('common.loading')}</p>}
      {items?.length === 0 && (
        <p className="empty">{t(tab === 'recent' ? 'projects.emptyRecent' : 'projects.emptyExamples')}</p>
      )}
      <div className="card-grid">
        {items?.map(p => (
          <button key={p.root} className="project-card" onClick={() => open(p.root)} title={p.root}>
            <div className="poster">
              {p.poster
                ? <img src={fileUrl(p.poster)} alt="" />
                : <span className="poster-empty"><Icon name="film" size={28} /></span>}
              <span className="duration">{formatSeconds(p.duration)}</span>
            </div>
            <div className="card-text">
            <strong className="ellipsis">{p.title}</strong>
            <div className="card-meta">
              <span className="muted small">{t('common.shots', { n: p.shots })} · {formatDate(p.changed, { dateStyle: 'medium' })}</span>
              <span className="tag">{p.track.toUpperCase()} · {p.size.width > p.size.height ? '16:9' : '9:16'}</span>
            </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
