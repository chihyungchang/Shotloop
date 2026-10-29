import { useEffect, useState } from 'react'
import { api, fileUrl, type ProjectSummary } from '../api'
import { formatSeconds } from '../model'
import { forget, readRecent } from '../recent'
import { Icon } from './Icon'

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
      <h1>All projects</h1>
      <div className="tabs-row">
        <button className={`pill${tab === 'recent' ? ' on' : ''}`} onClick={() => setTab('recent')}>Recently opened</button>
        <button className={`pill${tab === 'examples' ? ' on' : ''}`} onClick={() => setTab('examples')}>Examples</button>
      </div>
      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && (
        <p className="muted">{tab === 'recent' ? 'Nothing opened yet. Start one on Home, or open an example.' : 'No examples found.'}</p>
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
            <strong className="ellipsis">{p.title}</strong>
            <div className="card-meta">
              <span className="muted small">{p.shots} shots · {new Date(p.changed).toLocaleDateString()}</span>
              <span className="tag">{p.track.toUpperCase()} · {p.size.width > p.size.height ? '16:9' : '9:16'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
