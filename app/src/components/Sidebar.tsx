import { open as pick } from '@tauri-apps/plugin-dialog'
import type { Job } from '../api'
import { baseName, readRecent } from '../recent'
import type { useTheme } from '../theme/theme'
import { aiSummary, useSettings } from '../ai/useSettings'
import { BrandMark } from './BrandMark'
import { Icon } from './Icon'
import { ThemeToggle } from './ThemeToggle'
import type { Key } from '../i18n/en'
import { t } from '../i18n'

export type Page = 'home' | 'projects' | 'settings'

const NAV: [Page, Key, Parameters<typeof Icon>[0]['name']][] = [
  ['home', 'nav.home', 'home'],
  ['projects', 'nav.projects', 'grid'],
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
  const recent = readRecent()
  const running = jobs.filter(j => j.state === 'running' || j.state === 'queued').length

  const openFolder = async () => {
    const dir = await pick({ directory: true, title: t('dialog.openProject') })
    if (typeof dir === 'string') open(dir)
  }

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
        <button className="nav-item" onClick={openFolder}>
          <Icon name="folder" size={18} /> {t('nav.openFolder')}
        </button>
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
        {running > 0 && <span className="small queue-note"><span className="dot info pulse" /> {t('sidebar.queue', { n: running })}</span>}
        {ai && (
          <button className="mode-pill" onClick={() => setPage('settings')} title={t('ai.change')}>
            <Icon name={ai.mode === 'cli' ? 'terminal' : ai.mode === 'local' ? 'cpu' : 'cloud'} size={16} />
            <span className="ellipsis">{t(`ai.mode.${ai.mode}`)} · {ai.name}</span>
            <span className={`dot ${ai.ready ? 'ok' : 'warn'}`} />
          </button>
        )}
        <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
      </div>
    </aside>
  )
}
