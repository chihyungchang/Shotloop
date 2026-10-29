import { useEffect, useState } from 'react'
import { api, fileUrl, type Asset, type Project } from '../../api'
import { t } from '../../i18n'
import { Icon } from '../Icon'

// A 3D project's models: the ones it uses (copied into assets/), and the
// library's, to add. Once added, the AI assistant can place them ("put the
// robot on the desk"); the shots that use them re-render.
export function AssetsPanel({ project, refresh }: { project: Project; refresh: () => void }) {
  const [used, setUsed] = useState<Asset[] | null>(null)
  const [library, setLibrary] = useState<Asset[] | null>(null)
  const load = () => {
    api.libraryList(project.root).then(setUsed, () => setUsed([]))
    api.libraryList().then(setLibrary, () => setLibrary([]))
  }
  useEffect(load, [project.root])

  const inProject = new Set(used?.map(a => a.id))
  const change = async (fn: () => Promise<unknown>) => {
    await fn()
    load()
    refresh()
  }

  const row = (a: Asset, action: React.ReactNode) => (
    <div key={a.id} className="asset-row">
      <span className="asset-row-thumb">{a.thumb ? <img src={fileUrl(a.thumb)} alt="" /> : <Icon name="cube" size={16} />}</span>
      <span className="asset-row-text">
        <strong className="ellipsis">{a.name}</strong>
        <span className="small muted ellipsis">{a.license} · {a.author}</span>
      </span>
      {action}
    </div>
  )

  return (
    <div className="assets-panel">
      <h3>{t('assets.inProject')}</h3>
      {used?.length
        ? used.map(a => row(a, (
          <button className="icon-button" title={t('plan.remove')} onClick={() => change(() => api.libraryUnuse(project.root, a.id))}><Icon name="x" size={14} /></button>
        )))
        : <p className="small muted">{t('assets.noneInProject')}</p>}
      {used?.length ? <p className="hint">{t('assets.tellAi', { name: used[0].name })}</p> : null}

      <h3>{t('assets.fromLibrary')}</h3>
      {library === null && <p className="small muted">{t('common.loading')}</p>}
      {library?.length === 0 && <p className="small muted">{t('assets.emptyLibrary')}</p>}
      {library?.filter(a => !inProject.has(a.id)).map(a => row(a, (
        <button className="small" onClick={() => change(() => api.libraryUse(project.root, a.id))}><Icon name="plus" size={12} /> {t('assets.add')}</button>
      )))}
    </div>
  )
}
