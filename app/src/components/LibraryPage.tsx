import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { POLY_CATEGORIES } from '../../../engine/shotloop/data.mjs'
import { api, fileUrl, KEY_PAGES, type Asset, type LibraryItem } from '../api'
import { useErrorLine } from '../hooks'
import { t } from '../i18n'
import type { Key } from '../i18n/en'
import { formatMB, formatNumber } from '../model'
import { Icon } from './Icon'

type Tab = 'search' | 'mine'
type Source = LibraryItem['source']

const SOURCES: { id: Source; name: string; note: Key }[] = [
  { id: 'polypizza', name: 'Poly Pizza', note: 'assets.polypizzaShort' },
  { id: 'smithsonian', name: 'Smithsonian', note: 'assets.smithsonianShort' }
]

// A preview, or a quiet placeholder when there is none or it won't load
function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="asset-thumb">
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Icon name="cube" size={28} />}
    </div>
  )
}

// Results already fetched this session, by source, query, page and filter
const seen = new Map<string, { results: LibraryItem[]; cursor: string | null }>()

// Cards in outline while results load
function AssetSkeleton() {
  return <div className="asset-grid" aria-busy>{Array.from({ length: 8 }, (_, i) => <div key={i} className="asset-card skeleton"><span className="shimmer" /></div>)}</div>
}

// The asset library: 3D models found on free sources and downloaded once
// to this Mac, then added to the 3D projects that use them (in the
// studio's Assets drawer)
export function LibraryPage({ openSettings }: { openSettings: () => void }) {
  const [tab, setTab] = useState<Tab>('search')
  const [mine, setMine] = useState<Asset[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = () => api.libraryList().then(setMine, e => {
    setMine([])
    setError(String(e))
  })
  useEffect(() => {
    reload()
  }, [])

  return (
    <div className="library-page">
      <div className="row between">
        <h1>{t('library.title')}</h1>
        <div className="subtabs" role="tablist">
          <button role="tab" aria-selected={tab === 'search'} className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>{t('library.search')}</button>
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
            {t('library.mine')}{mine?.length ? <span className="count soft">{mine.length}</span> : null}
          </button>
        </div>
      </div>
      <p className="hint">{t('library.intro')}</p>
      {error && <div className="error-box small">{error}</div>}
      {tab === 'search'
        ? <Search have={new Set(mine?.map(a => a.id))} onAdded={reload} openSettings={openSettings} />
        : <Mine assets={mine} reload={reload} />}
    </div>
  )
}

function Search({ have, onAdded, openSettings }: { have: Set<string>; onAdded: () => void; openSettings: () => void }) {
  const [source, setSource] = useState<Source>('polypizza')
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const [results, setResults] = useState<LibraryItem[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Per result: downloading, or why it failed
  const [getting, setGetting] = useState<Record<string, { busy: true } | { error: string }>>({})
  const [category, setCategory] = useState<string | null>(null)
  // The search asked last: a slower answer to an earlier one is dropped
  const asked = useRef(0)

  const run = async (more = false, q = query, cat = category) => {
    const n = ++asked.current
    if (!more) {
      setResults(null)
      setCursor(null)
    }
    // Poly Pizza needs a keyword or a category
    if (source === 'polypizza' && !q.trim() && !cat) return
    setBusy(true)
    setError(null)
    try {
      const c = source === 'polypizza' && !q.trim() ? cat : null
      const key = JSON.stringify([source, q.trim().toLowerCase(), more ? cursor : null, all, c])
      const r = seen.get(key) ?? (await api.librarySearch(source, q, more ? cursor : null, all, c))
      seen.set(key, r)
      if (n !== asked.current) return
      setResults(cur => (more && cur ? [...cur, ...r.results] : r.results))
      setCursor(r.cursor)
    } catch (e) {
      if (n !== asked.current) return
      setError(String(e))
      if (!more) setResults([])
    } finally {
      if (n === asked.current) setBusy(false)
    }
  }
  useEffect(() => {
    setError(null)
    run()
  }, [source, all])

  const get = async (it: LibraryItem) => {
    setGetting(g => ({ ...g, [it.id]: { busy: true } }))
    try {
      await api.libraryGet(it)
      setGetting(g => {
        const { [it.id]: _, ...rest } = g
        return rest
      })
      onAdded()
    } catch (e) {
      setGetting(g => ({ ...g, [it.id]: { error: String(e) } }))
    }
  }
  const needsKey = error && /api key|needs an api key/i.test(error)

  return (
    <>
      <div className="library-bar">
        <div className="seg-control" role="radiogroup">
          {SOURCES.map(s => (
            <button key={s.id} role="radio" aria-checked={source === s.id} className={source === s.id ? 'on' : ''} onClick={() => setSource(s.id)}>{s.name}</button>
          ))}
        </div>
        <label className="library-search">
          <Icon name="search" size={15} />
          <input value={query} placeholder={t('library.placeholder')} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
            if (e.key === 'Enter') {
              setCategory(null)
              run(false, query, null)
            }
          }} />
        </label>
        {source === 'polypizza' && (
          <label className="check-inline">
            <input type="checkbox" checked={!all} onChange={e => setAll(!e.target.checked)} /> {t('library.cc0Only')}
          </label>
        )}
      </div>
      <p className="small muted">{t(SOURCES.find(s => s.id === source)!.note)}</p>
      {needsKey
        ? (
          <div className="connect-card">
            <span className="connect-logo"><Icon name="cube" size={22} /></span>
            <div className="connect-text">
              <strong>{t('library.connectTitle')}</strong>
              <p className="muted">{t('library.connectNote')}</p>
            </div>
            <div className="connect-actions">
              <button className="ghost" onClick={() => api.openUrl(KEY_PAGES.polypizza).catch(e => setError(String(e)))}>{t('ai.getKey')} <Icon name="arrow" size={12} /></button>
              <button className="primary" onClick={openSettings}><Icon name="key" size={14} /> {t('library.addKey')}</button>
            </div>
          </div>
        )
        : error && <div className="error-box small">{error}</div>}
      {source === 'polypizza' && !query.trim() && !needsKey && (
        <div className="suggest">
          <span className="small muted">{t('library.browse')}</span>
          {POLY_CATEGORIES.map(c => (
            <button key={c} className={`provider-chip${category === c ? ' on' : ''}`} onClick={() => { setCategory(c); run(false, '', c) }}>{t(`library.cat.${c}` as Key)}</button>
          ))}
        </div>
      )}
      {busy && !results?.length && <AssetSkeleton />}
      {results && results.length === 0 && !busy && !error && <p className="empty">{t('library.none')}</p>}
      <div className="asset-grid">
        {results?.map(it => {
          const owned = have.has(it.id)
          const state = getting[it.id]
          const size = it.size ? formatMB(it.size, 1) : null
          return (
            <div key={it.id} className="asset-card">
              <Thumb src={it.thumb ? (it.thumb.startsWith('/') ? fileUrl(it.thumb) : it.thumb) : null} />
              <div className="asset-meta">
                <strong className="ellipsis" title={it.name}>{it.name}</strong>
                <span className="small muted ellipsis">{it.author}{it.triangles ? ` · ${formatNumber(it.triangles)} △` : ''}{size ? ` · ${size}` : ''}</span>
              </div>
              <div className="asset-foot">
                <span className={`license${/^cc0/i.test(it.license) ? ' cc0' : ''}`}>{it.license || '?'}</span>
                {it.page && (
                  <button className="icon-button" title={t('library.openPage')} onClick={() => api.openUrl(it.page!).catch(e => setError(String(e)))}><Icon name="arrow" size={13} /></button>
                )}
                {owned
                  ? <span className="small ok-note"><Icon name="check" size={12} /> {t('library.have')}</span>
                  : (
                    <button className="small" onClick={() => get(it)} disabled={!!state && 'busy' in state} title={state && 'error' in state ? state.error : undefined}>
                      {state && 'busy' in state ? <span className="spinner small" /> : <Icon name="download" size={12} />} {t(state && 'error' in state ? 'plan.retry' : 'library.get')}
                    </button>
                  )}
              </div>
            </div>
          )
        })}
      </div>
      {cursor && results?.length ? (
        <button className="ghost load-more" onClick={() => run(true)} disabled={busy}>{busy ? <span className="spinner small" /> : null} {t('library.more')}</button>
      ) : null}
    </>
  )
}

function Mine({ assets, reload }: { assets: Asset[] | null; reload: () => void }) {
  const { error, guard } = useErrorLine()
  const importFile = async () => {
    const file = await pick({ title: t('library.import'), filters: [{ name: t('filter.glb'), extensions: ['glb'] }] })
    if (typeof file === 'string' && (await guard(api.libraryImport(file)))) reload()
  }
  const remove = async (id: string) => {
    await guard(api.libraryRemove(id))
    reload()
  }
  const bar = (
    <div className="row between">
      <span className="small muted">{t('library.importNote')}</span>
      <button onClick={importFile}><Icon name="plus" size={13} /> {t('library.import')}</button>
    </div>
  )
  if (!assets) return <AssetSkeleton />
  if (!assets.length) return <>{bar}{error && <div className="error-box small">{error}</div>}<p className="empty">{t('library.emptyMine')}</p></>
  return (
    <>
    {bar}
    {error && <div className="error-box small">{error}</div>}
    <div className="asset-grid">
      {assets.map(a => (
        <div key={a.id} className="asset-card">
          <Thumb src={a.thumb ? fileUrl(a.thumb) : null} />
          <div className="asset-meta">
            <strong className="ellipsis" title={a.name}>{a.name}</strong>
            <span className="small muted ellipsis">{a.author}</span>
          </div>
          <div className="asset-foot">
            <span className={`license${/^cc0/i.test(a.license) ? ' cc0' : ''}`}>{a.license}</span>
            <span className="row">
              <button className="icon-button" title={t('studio.revealFinder')} onClick={() => guard(api.reveal(a.model))}><Icon name="folder" size={14} /></button>
              <button className="icon-button" title={t('plan.remove')} onClick={() => remove(a.id)}><Icon name="x" size={14} /></button>
            </span>
          </div>
        </div>
      ))}
    </div>
    </>
  )
}
