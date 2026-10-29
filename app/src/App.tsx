import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onProjectChanged, onQueue, type Job, type Project } from './api'
import { Home } from './components/Home'
import { LibraryPage } from './components/LibraryPage'
import { PlanPage } from './components/plan/PlanPage'
import { Projects } from './components/Projects'
import { SettingsPage, type Section } from './components/SettingsPage'
import { Sidebar, type Page } from './components/Sidebar'
import { Studio } from './components/studio/Studio'
import { LeaveDraftDialog, WorkspaceDialog } from './components/WorkspaceDialog'
import { projectsFolder, remember, setProjectsFolder } from './recent'
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

  // Settings, opened at a section; Back returns where it was opened from
  const [settingsAt, setSettingsAt] = useState<Section>('ai')
  const [settingsFrom, setSettingsFrom] = useState<Page>('home')
  const openSettings = (at: Section = 'ai', from: Page = 'home') => {
    setSettingsAt(at)
    setSettingsFrom(from)
    setPage('settings')
  }

  // A project opens in the studio, or on its planning page when it is new.
  // An example opens as a draft: a copy kept only if the person saves it
  const [view, setView] = useState<'studio' | 'plan'>('studio')
  const [copying, setCopying] = useState(false)
  // The workspace (the folder projects go to): asked for the first time it
  // is needed; skipping it means ~/Documents/Shotloop
  const [askFolder, setAskFolder] = useState<((dir: string) => void) | null>(null)
  const ensureFolder = useCallback(async () => {
    const saved = projectsFolder()
    if (saved) return saved
    const dir = await new Promise<string>(resolve => setAskFolder(() => resolve))
    setAskFolder(null)
    setProjectsFolder(dir)
    return dir
  }, [])
  const open = useCallback(async (path: string, plan = false) => {
    setError(null)
    try {
      let p = await api.openProject(path)
      if (p.example) {
        await ensureFolder()
        setCopying(true)
        try {
          p = await api.openProject((await api.openExample(p.root)).root)
        } finally {
          setCopying(false)
        }
      }
      root.current = p.root
      // Drafts are not projects yet: not in the recent list
      if (!p.draft) remember(p.root)
      setView(plan ? 'plan' : 'studio')
      setProject(p)
    } catch (e) {
      setError(String(e))
    }
  }, [ensureFolder])

  // A draft: saved into the workspace, or thrown away on leaving
  const [leaving, setLeaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const busyJobs = (r: string) => jobs.filter(j => j.project === r && (j.state === 'running' || j.state === 'queued'))
  const saveDraft = async (thenClose = false) => {
    if (!project?.draft) return
    if (busyJobs(project.root).length) return setError(t('draft.busy'))
    setSaving(true)
    try {
      const to = await ensureFolder()
      const r = await api.saveDraft(project.root, to)
      setLeaving(false)
      if (thenClose) {
        remember(r.root)
        root.current = null
        setProject(null)
      } else {
        const p = await api.openProject(r.root)
        root.current = p.root
        remember(p.root)
        setProject(p)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }
  const discardDraft = async () => {
    if (!project?.draft) return
    for (const j of busyJobs(project.root)) await api.cancel(j.id)
    await api.discardDraft(project.root).catch(() => {})
    setLeaving(false)
    root.current = null
    setProject(null)
  }

  const openPlan = () => setView('plan')

  const close = () => {
    if (project?.draft) return setLeaving(true)
    root.current = null
    setProject(null)
  }

  const dialogs = (
    <>
      {askFolder && <WorkspaceDialog done={askFolder} />}
      {leaving && <LeaveDraftDialog busy={saving} save={() => saveDraft(true)} discard={discardDraft} cancel={() => setLeaving(false)} />}
    </>
  )

  // ⌘O opens a project folder from anywhere
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'o') return
      e.preventDefault()
      const { open: pick } = await import('@tauri-apps/plugin-dialog')
      const dir = await pick({ directory: true, title: t('dialog.openProject') })
      if (typeof dir === 'string') open(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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
  if (page === 'settings') return <SettingsPage key={language.lang} theme={theme} language={language} start={settingsAt} back={() => setPage(settingsFrom)} backLabel={settingsFrom === 'library' ? 'settings.backLibrary' : 'settings.back'} />

  if (project && view === 'plan') {
    return <>{dialogs}<PlanPage key={language.lang} project={project} jobs={jobs} refresh={refresh} back={close} toStudio={() => setView('studio')} openSettings={() => openSettings()} /></>
  }
  if (project) {
    return (
      <>
        {dialogs}
        {error && project.draft && <p className="error banner floating" onClick={() => setError(null)}>{error}</p>}
        <Studio key={language.lang} project={project} jobs={jobs} refresh={refresh} close={close} theme={theme} openSettings={() => openSettings()} openPlan={openPlan}
          save={project.draft ? () => saveDraft(false) : undefined} saving={saving} />
      </>
    )
  }

  return (
    <div className="workspace-shell" key={language.lang}>
      {dialogs}
      <Sidebar page={page} setPage={setPage} open={open} jobs={jobs} theme={theme} />
      <main className="workspace-main">
        {error && <p className="error banner">{error}</p>}
        {copying && <p className="banner copying"><span className="spinner small" /> {t('example.copying')}</p>}
        {page === 'home' && <Home open={open} openSettings={() => openSettings()} ensureFolder={ensureFolder} />}
        {page === 'projects' && <Projects open={open} />}
        {page === 'library' && <LibraryPage openSettings={() => openSettings('assets', 'library')} />}
      </main>
    </div>
  )
}
