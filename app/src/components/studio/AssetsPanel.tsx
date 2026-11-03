import { useEffect, useState } from 'react'
import { api, fileUrl, type Asset, type AssetKind, type Project } from '../../api'
import { useErrorLine } from '../../hooks'
import { t } from '../../i18n'
import { formatSeconds } from '../../model'
import { Icon } from '../Icon'
import { PlayButton } from '../PlayButton'
import { ErrorText } from '../ErrorDialog'

// A project's models (3D) and sounds: the ones it uses (copied into
// assets/), and the library's, to add. Once added, the AI assistant can
// place a model ("put the robot on the desk") or play a sound on a beat;
// the shots that use them re-render.
export function AssetsPanel({ project, refresh }: { project: Project; refresh: () => void }) {
  const [used, setUsed] = useState<Asset[] | null>(null)
  const [library, setLibrary] = useState<Asset[] | null>(null)
  const { error, setError, guard } = useErrorLine()
  const load = () => {
    const list = (p: Promise<Asset[]>, set: (a: Asset[]) => void) =>
      p.then(set, e => {
        set([])
        setError(String(e))
      })
    list(api.libraryList(project.root), setUsed)
    list(api.libraryList(), setLibrary)
  }
  useEffect(load, [project.root])

  const inProject = new Set(used?.map(a => a.id))
  const change = async (p: Promise<unknown>) => {
    await guard(p)
    load()
    refresh()
  }
  // Models only mean something in a 3D world
  const kinds: AssetKind[] = project.track === '3d' ? ['model', 'sound'] : ['sound']

  const row = (a: Asset, action: React.ReactNode) => (
    <div key={a.id} className="asset-row">
      {a.kind === 'sound'
        ? <PlayButton file={async () => a.file} onError={setError} />
        : <span className="asset-row-thumb">{a.thumb ? <img src={fileUrl(a.thumb)} alt="" /> : <Icon name="cube" size={16} />}</span>}
      <span className="asset-row-text">
        <strong className="ellipsis">{a.name}</strong>
        <span className="small muted ellipsis">{a.license}{a.author ? ` · ${a.author}` : ''}{a.kind === 'sound' && a.duration ? ` · ${formatSeconds(a.duration)}` : ''}</span>
      </span>
      {action}
    </div>
  )
  const of = (list: Asset[] | null, kind: AssetKind) => list?.filter(a => a.kind === kind) ?? null

  return (
    <div className="assets-panel">
      <ErrorText error={error} as="div" className="error-box small" />
      {kinds.map(kind => {
        const mine = of(used, kind)
        const sound = kind === 'sound'
        return (
          <section key={kind}>
            {kinds.length > 1 && <h2 className="assets-kind">{t(sound ? 'library.kind.sounds' : 'library.kind.models')}</h2>}
            <h3>{t('assets.inProject')}</h3>
            {mine?.length
              ? mine.map(a => row(a, (
                <button className="icon-button" title={t('plan.remove')} onClick={() => change(api.libraryUnuse(project.root, a.id))}><Icon name="x" size={14} /></button>
              )))
              : <p className="small muted">{t(sound ? 'assets.noneSounds' : 'assets.noneInProject')}</p>}
            {mine?.length ? <p className="hint">{t(sound ? 'assets.tellAiSound' : 'assets.tellAi', { name: mine[0].name })}</p> : null}

            <h3>{t('assets.fromLibrary')}</h3>
            {library === null && Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="asset-row skeleton" aria-busy>
                <span className="asset-row-thumb sk-block" />
                <span className="asset-row-text"><span className="sk-line w60" /><span className="sk-line w40" /></span>
              </div>
            ))}
            {of(library, kind)?.length === 0 && <p className="small muted">{t(sound ? 'assets.emptyLibrarySounds' : 'assets.emptyLibrary')}</p>}
            {of(library, kind)?.filter(a => !inProject.has(a.id)).map(a => row(a, (
              <button className="small" onClick={() => change(api.libraryUse(project.root, a.id))}><Icon name="plus" size={12} /> {t('assets.add')}</button>
            )))}
          </section>
        )
      })}
    </div>
  )
}
