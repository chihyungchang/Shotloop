import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onProjectChanged, onQueue, type Job, type Project } from './api'
import { Home } from './components/Home'
import { Projects } from './components/Projects'
import { SettingsPage } from './components/SettingsPage'
import { Sidebar, type Page } from './components/Sidebar'
import { Studio } from './components/studio/Studio'
import { remember } from './recent'
import { useTheme } from './theme/theme'
import { useLanguage } from './i18n'

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

  const open = useCallback(async (path: string) => {
    setError(null)
    try {
      const p = await api.openProject(path)
      root.current = p.root
      remember(p.root)
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

  if (project) return <Studio key={language.lang} project={project} jobs={jobs} refresh={refresh} close={close} theme={theme} />

  return (
    <div className="workspace-shell" key={language.lang}>
      <Sidebar page={page} setPage={setPage} open={open} jobs={jobs} theme={theme} />
      <main className="workspace-main">
        {error && <p className="error banner">{error}</p>}
        {page === 'home' && <Home open={open} />}
        {page === 'projects' && <Projects open={open} />}
        {page === 'settings' && <SettingsPage theme={theme} language={language} />}
      </main>
    </div>
  )
}
