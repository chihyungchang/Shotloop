import { useEffect, useState } from 'react'
import type { Job } from '../api'
import { baseName, cleanRecent, readRecent } from '../recent'
import { installUpdate, useUpdate } from '../update'
import type { useTheme } from '../theme/theme'
import { aiSummary, useSettings } from '../ai/useSettings'
import { api } from '../api'
import { BrandIcon, hasBrand } from '../ai/BrandIcon'
import { BrandMark } from './BrandMark'
import { ActivityBell } from './ActivityBell'
import { Icon } from './Icon'
import { ThemeToggle } from './ThemeToggle'
import type { Key } from '../i18n/en'
import { t } from '../i18n'

const REPO = 'https://github.com/chihyungchang/Shotloop'

export type Page = 'home' | 'projects' | 'library' | 'settings'

const NAV: [Page, Key, Parameters<typeof Icon>[0]['name']][] = [
  ['home', 'nav.home', 'home'],
  ['projects', 'nav.projects', 'grid'],
  ['library', 'nav.library', 'cube'],
  ['settings', 'nav.settings', 'settings']
]

export function Sidebar({ page, setPage, open, jobs, theme }: {
  page: Page
  setPage: (p: Page) => void
  open: (path: string) => void
  jobs: Job[]
  theme: ReturnType<typeof useTheme>
}) {
  const settings = useSettings()
  const ai = settings && aiSummary(settings)
  const [recent, setRecent] = useState(readRecent)
  useEffect(() => {
    cleanRecent().then(setRecent)
  }, [])

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><BrandMark /></span>
        <strong>Shotloop</strong>
      </div>
      <nav>
        {NAV.map(([id, label, icon]) => (
          <button key={id} className={`nav-item${page === id ? ' on' : ''}`} onClick={() => setPage(id)}>
            <Icon name={icon} size={18} /> {t(label)}
          </button>
        ))}
      </nav>
      {recent.length > 0 && (
        <div className="recent">
          <span className="section-label">{t('nav.recent')}</span>
          {recent.slice(0, 8).map(p => (
            <button key={p} className="nav-item small" onClick={() => open(p)} title={p}>
              <Icon name="film" size={16} /> <span className="ellipsis">{baseName(p)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="sidebar-foot">
        <UpdateNote />
        <div className="foot-links">
          <button className="icon-button" onClick={() => api.openUrl(REPO)} title="GitHub" aria-label="GitHub">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </button>
          <ThemeToggle pref={theme.pref} setPref={theme.setPref} plain />
        </div>
        {ai && settings && (
          <div className="foot-row">
            <button className="mode-pill" onClick={() => setPage('settings')} title={t('ai.change')}>
              {hasBrand(ai.brand)
                ? <span className="mode-tile brand"><BrandIcon id={ai.brand} size={16} /></span>
                : <span className={`mode-tile ${ai.mode}`}><Icon name={ai.mode === 'local' ? 'cpu' : 'spark'} size={13} /></span>}
              <span className="mode-text">
                <strong className="ellipsis">{ai.name}</strong>
                <span className="ellipsis">{t(`ai.mode.${ai.mode}`)}</span>
              </span>
              {!ai.ready && <span className="dot warn" />}
            </button>
            <ActivityBell jobs={jobs} settings={settings} />
          </div>
        )}
      </div>
    </aside>
  )
}

// A new version on GitHub: say so above the foot, and install it in place
function UpdateNote() {
  const u = useUpdate()
  if (u.kind === 'available') {
    return (
      <button className="update-note" onClick={installUpdate} title={u.notes || undefined}>
        <Icon name="download" size={14} />
        <span><strong>{t('update.available', { v: u.version })}</strong><span className="small">{t('update.install')}</span></span>
      </button>
    )
  }
  if (u.kind === 'busy') {
    return <div className="update-note busy"><Icon name="clock" size={14} /><span className="small">{t('update.busy')}</span></div>
  }
  if (u.kind === 'downloading' || u.kind === 'restarting') {
    const pct = u.kind === 'downloading' && u.total ? Math.round((u.done / u.total) * 100) : null
    return (
      <div className="update-note busy">
        <span className="spinner small" />
        <span className="small">{u.kind === 'restarting' ? t('update.restarting') : pct != null ? t('update.downloadingPct', { pct }) : t('update.downloading')}</span>
      </div>
    )
  }
  return null
}
