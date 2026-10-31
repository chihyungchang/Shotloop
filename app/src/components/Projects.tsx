import { ask, open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api, fileUrl, type ProjectSummary } from '../api'
import { formatSeconds } from '../model'
import { forget, readRecent } from '../recent'
import { examplesFor } from './Home'
import { Icon } from './Icon'
import { formatDate, t } from '../i18n'

// All projects: the recently opened ones and the examples, as cards
// with a poster still (open-design's project grid)
export function Projects({ open }: { open: (path: string) => void }) {
  const [tab, setTab] = useState<'recent' | 'examples'>('recent')
  const [items, setItems] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // To the Trash, after a native confirm; it can be put back from there
  const remove = async (p: ProjectSummary) => {
    setError(null)
    if (!(await ask(t('projects.deleteAsk', { title: p.title }), { title: t('projects.delete'), kind: 'warning', okLabel: t('projects.deleteOk'), cancelLabel: t('plan.cancel') }))) return
    try {
      await api.trashProject(p.root)
      forget(p.root)
      setItems(list => list?.filter(x => x.root !== p.root) ?? null)
    } catch (e) {
      setError(String(e) === 'busy' ? t('projects.deleteBusy') : String(e))
    }
  }

  useEffect(() => {
    setItems(null)
    const recent = readRecent()
    api.listProjects(tab === 'recent' ? recent : [], tab === 'examples').then(list => {
      // Forget recents that are gone or no longer projects
      if (tab === 'recent') for (const p of recent) if (!list.some(x => x.root === p && !x.example && !x.draft)) forget(p)
      setItems(tab === 'examples' ? examplesFor(list) : list.filter(p => !p.example && !p.draft))
    }, () => setItems([]))
  }, [tab])

  return (
    <div className="projects-page">
      <div className="row between">
        <h1>{t('projects.title')}</h1>
        {/* A project made elsewhere: a colleague's, a git clone (also ⌘O) */}
        <button onClick={async () => {
          const dir = await pick({ directory: true, title: t('dialog.openProject') })
          if (typeof dir === 'string') open(dir)
        }}>
          <Icon name="folder" size={14} /> {t('projects.open')} <span className="kbd">⌘O</span>
        </button>
      </div>
      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>{t('projects.recent')}</button>
        <button role="tab" aria-selected={tab === 'examples'} className={tab === 'examples' ? 'on' : ''} onClick={() => setTab('examples')}>{t('projects.examples')}</button>
      </div>
      {items === null && (
        <div className="card-grid" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="project-item skeleton" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="poster sk-block" />
              <span className="sk-line w70" />
              <span className="sk-line w40" />
            </div>
          ))}
        </div>
      )}
      {items?.length === 0 && (
        <p className="empty">{t(tab === 'recent' ? 'projects.emptyRecent' : 'projects.emptyExamples')}</p>
      )}
      {error && <p className="small warn-note">{error}</p>}
      <div className="card-grid">
        {items?.map(p => (
          <div key={p.root} className="project-item">
          <button className="project-card" onClick={() => open(p.root)} title={p.root}>
            <div className="poster">
              {p.poster
                ? <img src={fileUrl(p.poster)} alt="" />
                : <span className="poster-empty"><Icon name="film" size={28} /></span>}
              <span className="duration">{formatSeconds(p.duration)}</span>
            </div>
            <div className="card-text">
            <strong className="ellipsis">{p.title}</strong>
            {p.description && <span className="muted small ellipsis">{p.description}</span>}
            <div className="card-meta">
              <span className="muted small">{t('common.shots', { n: p.shots })} · {formatDate(p.changed, { dateStyle: 'medium' })}</span>
              <span className="tag">{p.track.toUpperCase()} · {p.size.width > p.size.height ? '16:9' : '9:16'}</span>
            </div>
            </div>
          </button>
          {tab === 'recent' && (
            <button className="icon-button project-delete" onClick={() => remove(p)} title={t('projects.delete')} aria-label={t('projects.delete')}>
              <Icon name="trash" size={14} />
            </button>
          )}
          </div>
        ))}
      </div>
    </div>
  )
}
