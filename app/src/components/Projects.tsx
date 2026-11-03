import { ask } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api, fileUrl, isBroken, type BrokenProject, type ListEntry, type ProjectSummary } from '../api'
import { aspectOf, formatSeconds } from '../model'
import { baseName, forget, listRecent } from '../recent'
import { examplesFor, styleName } from '../styles'
import { Icon } from './Icon'
import { formatDate, t } from '../i18n'
import { ErrorText } from './ErrorDialog'

// All projects: the recently opened ones and the examples, as cards
// with a poster still (open-design's project grid)
export function Projects({ open, openFolder }: { open: (path: string) => void; openFolder: () => void }) {
  const [tab, setTab] = useState<'recent' | 'examples'>('recent')
  const [items, setItems] = useState<ListEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // To the Trash, after a native confirm; it can be put back from there
  const remove = async (p: ProjectSummary) => {
    setError(null)
    if (!(await ask(t('projects.deleteAsk', { title: p.title }), { title: t('projects.delete'), kind: 'warning', okLabel: t('projects.deleteOk'), cancelLabel: t('plan.cancel') }))) return
    try {
      await api.trashProject(p.root)
      drop(p.root)
    } catch (e) {
      setError(String(e) === 'busy' ? t('projects.deleteBusy') : String(e))
    }
  }
  const drop = (root: string) => {
    forget(root)
    setItems(list => list?.filter(x => x.root !== root) ?? null)
  }

  useEffect(() => {
    setItems(null)
    setError(null)
    const list = tab === 'recent' ? listRecent() : api.listProjects([], true).then(examplesFor)
    list.then(setItems, e => {
      setItems([])
      setError(String(e))
    })
  }, [tab])

  return (
    <div className="projects-page">
      <div className="row between">
        <h1>{t('projects.title')}</h1>
        {/* A project made elsewhere: a colleague's, a git clone (also ⌘O) */}
        <button onClick={openFolder}>
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
      {items?.length === 0 && !error && (
        <p className="empty">{t(tab === 'recent' ? 'projects.emptyRecent' : 'projects.emptyExamples')}</p>
      )}
      <ErrorText error={error} className="small warn-note" />
      <div className="card-grid">
        {items?.map(p => (
          <div key={p.root} className="project-item">
            {isBroken(p) ? <BrokenCard p={p} /> : <ProjectCard p={p} open={() => open(p.root)} />}
            {tab === 'recent' && (isBroken(p)
              ? (
                <button className="icon-button project-delete" onClick={() => drop(p.root)} title={t('projects.forget')} aria-label={t('projects.forget')}>
                  <Icon name="x" size={14} />
                </button>
              )
              : (
                <button className="icon-button project-delete" onClick={() => remove(p)} title={t('projects.delete')} aria-label={t('projects.delete')}>
                  <Icon name="trash" size={14} />
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectCard({ p, open }: { p: ProjectSummary; open: () => void }) {
  return (
    <button className="project-card" onClick={open} title={p.root}>
      <div className="poster">
        {p.poster
          ? <img src={fileUrl(p.poster)} alt="" />
          : <span className="poster-empty"><Icon name="film" size={28} /></span>}
        {/* What kind of film, on the picture: 2D or 3D, its style, a voice */}
        <span className="poster-tags">
          <span className="poster-tag">{p.track.toUpperCase()}</span>
          {p.promo
            ? <span className="poster-tag">{t('home.kind.promo')}</span>
            : p.style && p.style !== '3d' && <span className="poster-tag">{styleName(p.style)}</span>}
          {p.voice && <span className="poster-tag" title={t('gallery.voiceHint')}><Icon name="mic" size={11} /> {t('gallery.voice')}</span>}
        </span>
        <span className="duration">{formatSeconds(p.duration)}</span>
      </div>
      <div className="card-text">
        <strong className="ellipsis">{p.title}</strong>
        {p.description && <span className="muted small ellipsis">{p.description}</span>}
        <div className="card-meta">
          {/* An example's date is when it was last rendered, which says nothing to the person */}
          <span className="muted small">{t('common.shots', { n: p.shots })}{p.example ? '' : ` · ${formatDate(p.changed, { dateStyle: 'medium' })}`}</span>
          <span className="tag">{aspectOf(p.size)}</span>
        </div>
      </div>
    </button>
  )
}

// A project whose shotloop.json can't be read: its folder and why, so the
// person can mend it (or take it off the list)
function BrokenCard({ p }: { p: BrokenProject }) {
  return (
    <div className="project-card broken" title={p.root}>
      <div className="poster">
        <span className="poster-empty"><Icon name="info" size={28} /></span>
      </div>
      <div className="card-text">
        <strong className="ellipsis">{baseName(p.root)}</strong>
        <span className="tag danger">{t('projects.broken')}</span>
        <span className="muted small broken-why">{p.error}</span>
      </div>
    </div>
  )
}
