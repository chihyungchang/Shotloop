import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onProjectChanged, onQueue, type Job, type Project } from './api'
import { Home } from './components/Home'
import { LibraryPage } from './components/LibraryPage'
import { PlanPage } from './components/plan/PlanPage'
import { Projects } from './components/Projects'
import { SettingsPage } from './components/SettingsPage'
import { Sidebar, type Page } from './components/Sidebar'
import { Studio } from './components/studio/Studio'
import { remember } from './recent'
import { useTheme } from './theme/theme'
import { t, useLanguage } from './i18n'

// Two layouts, as in open-design: the workspace (sidebar + Home, All
// projects, Settings) and the Studio, one project full-window.
export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [project, setProject] = useState<Project | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState<string | null>(null)
  const root = useRef<string | null>(null)
  const theme = useTheme()
  // Changing the language re-renders the whole tree with the new strings
  const language = useLanguage()

  const refresh = useCallback(async () => {
    if (!root.current) return
    try {
      setProject(await api.status(root.current))
    } catch (e) {
      setError(String(e))
    }
  }, [])

  // A project opens in the studio, or on its planning page when it is new
  const [view, setView] = useState<'studio' | 'plan'>('studio')
  const open = useCallback(async (path: string, plan = false) => {
    setError(null)
    try {
      const p = await api.openProject(path)
      root.current = p.root
      remember(p.root)
      setView(plan ? 'plan' : 'studio')
      setProject(p)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const close = () => {
    root.current = null
    setProject(null)
  }

  useEffect(() => {
    api.initialProject().then(p => {
      if (p) open(p)
    })
  }, [open])

  useEffect(() => {
    api.jobs().then(setJobs)
    const subs = [
      onQueue(setJobs),
      onProjectChanged(r => {
        if (r === root.current) refresh()
      })
    ]
    // Files may change outside the app (an editor, git): re-read on focus
    // and every few seconds
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const timer = setInterval(refresh, 5000)
    return () => {
      subs.forEach(s => s.then(u => u()))
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
    }
  }, [refresh])

  // The menu bar menu speaks the UI's language
  const active = jobs.filter(j => j.state === 'running' || j.state === 'queued').length
  useEffect(() => {
    api.setTrayText(active ? t('sidebar.queue', { n: active }) : t('tray.idle'), t('tray.show'), t('tray.quit'), t('notify.done'), t('notify.failed')).catch(() => {})
  }, [active, language.lang])

  // Settings takes the whole window, with its own section list (as in
  // open-design); from a project, Back returns to it
  if (page === 'settings') return <SettingsPage key={language.lang} theme={theme} language={language} back={() => setPage('home')} />

  if (project && view === 'plan') {
    return <PlanPage key={language.lang} project={project} jobs={jobs} refresh={refresh} back={close} toStudio={() => setView('studio')} openSettings={() => setPage('settings')} />
  }
  if (project) return <Studio key={language.lang} project={project} jobs={jobs} refresh={refresh} close={close} theme={theme} openSettings={() => setPage('settings')} openPlan={() => setView('plan')} />

  return (
    <div className="workspace-shell" key={language.lang}>
      <Sidebar page={page} setPage={setPage} open={open} jobs={jobs} theme={theme} />
      <main className="workspace-main">
        {error && <p className="error banner">{error}</p>}
        {page === 'home' && <Home open={open} openSettings={() => setPage('settings')} />}
        {page === 'projects' && <Projects open={open} />}
        {page === 'library' && <LibraryPage openSettings={() => setPage('settings')} />}
      </main>
    </div>
  )
}
