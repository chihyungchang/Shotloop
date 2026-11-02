import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onCheckUpdate, onJob, onProjectChanged, onQueue, type Job, type Project } from './api'
import { Home } from './components/Home'
import { LibraryPage } from './components/LibraryPage'
import { PlanPage } from './components/plan/PlanPage'
import { Projects } from './components/Projects'
import { SettingsPage, type Section } from './components/SettingsPage'
import { Sidebar, type Page } from './components/Sidebar'
import { Studio } from './components/studio/Studio'
import { SettingsProblem } from './components/SettingsProblem'
import { TelemetryNotice } from './components/TelemetryNotice'
import { LeaveDraftDialog, WorkspaceDialog } from './components/WorkspaceDialog'
import { checkForUpdate } from './update'
import { startTelemetry } from './telemetry'
import { isActive } from './model'
import { pickProject, projectsFolder, remember, setProjectsFolder } from './recent'
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
    const r = root.current
    if (!r) return
    try {
      const p = await api.status(r)
      // Closed or switched while it was read: drop it
      if (root.current === r) setProject(p)
    } catch (e) {
      if (root.current === r) setError(String(e))
    }
  }, [])

  // Settings, opened at a section; Back returns where it was opened from
  const [settingsAt, setSettingsAt] = useState<Section>('ai')
  const [settingsFrom, setSettingsFrom] = useState<Page>('home')
  // A rule to show there (a check's reference)
  const [ruleFocus, setRuleFocus] = useState<string | undefined>()
  const openSettings = (at: Section = 'ai', from: Page = 'home', rule?: string) => {
    setSettingsAt(at)
    setSettingsFrom(from)
    setRuleFocus(rule)
    setPage('settings')
  }

  // Anonymous usage counts: a report about once a day (src/telemetry.ts)
  useEffect(startTelemetry, [])

  // Check for Updates… in the menus: Settings → About, checking
  useEffect(() => {
    const off = onCheckUpdate(() => {
      openSettings('about')
      checkForUpdate()
    })
    return () => {
      off.then(f => f())
    }
  }, [])

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
  const busyJobs = (r: string) => jobs.filter(j => j.project === r && isActive(j))
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
    try {
      for (const j of busyJobs(project.root)) await api.cancel(j.id)
      await api.discardDraft(project.root)
    } catch (e) {
      // Left behind in the drafts folder, which the app empties itself;
      // the person still hears it did not go
      setError(String(e))
    }
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
      <SettingsProblem />
    </>
  )

  // A project folder from the system dialog: ⌘O from anywhere, or All projects' button
  const openPicked = useCallback(async () => {
    const dir = await pickProject()
    if (dir) open(dir)
  }, [open])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'o') return
      e.preventDefault()
      openPicked()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPicked])

  // Once, even when development mounts effects twice
  const initial = useRef(false)
  useEffect(() => {
    if (initial.current) return
    initial.current = true
    api.initialProject().then(p => {
      if (p) open(p)
    }, e => setError(String(e)))
  }, [open])

  useEffect(() => {
    api.jobs().then(setJobs, e => setError(String(e)))
    const subs = [
      onQueue(setJobs),
      // A running job's progress: that job replaced, the rest kept
      onJob(job => setJobs(list => list.map(j => (j.id === job.id ? job : j)))),
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
  const active = jobs.filter(isActive).length
  useEffect(() => {
    // The menu keeps its last words if this fails (no tray on this Mac);
    // nothing in the window depends on it
    api.setTrayText(active ? t('sidebar.queue', { n: active }) : t('tray.idle'), t('tray.show'), t('tray.quit'), t('notify.done'), t('notify.failed'), t('update.menu')).catch(() => undefined)
  }, [active, language.lang])

  // Settings takes the whole window, with its own section list (as in
  // open-design); from a project, Back returns to it
  if (page === 'settings') return <>{dialogs}<SettingsPage key={`${language.lang}-${settingsAt}-${ruleFocus ?? ''}`} theme={theme} language={language} jobs={jobs} start={settingsAt} focus={ruleFocus} back={() => setPage(settingsFrom)} backLabel={settingsFrom === 'library' ? 'settings.backLibrary' : 'settings.back'} /></>

  if (project && view === 'plan') {
    return <>{dialogs}<PlanPage key={language.lang} project={project} jobs={jobs} refresh={refresh} back={close} toStudio={() => setView('studio')} openSettings={() => openSettings()} /></>
  }
  if (project) {
    return (
      <>
        {dialogs}
        {error && <p className="error banner floating" onClick={() => setError(null)}>{error}</p>}
        <Studio key={language.lang} project={project} jobs={jobs} refresh={refresh} close={close} theme={theme} openSettings={() => openSettings()} openPlan={openPlan}
          openRule={id => openSettings('rules', 'home', id)}
          save={project.draft ? () => saveDraft(false) : undefined} saving={saving} />
      </>
    )
  }

  return (
    <div className="workspace-shell" key={language.lang}>
      {dialogs}
      <Sidebar page={page} setPage={setPage} open={open} jobs={jobs} theme={theme} openSettings={openSettings} />
      <TelemetryNotice />
      <main className="workspace-main">
        {error && <p className="error banner">{error}</p>}
        {copying && <p className="banner copying"><span className="spinner small" /> {t('example.copying')}</p>}
        {page === 'home' && <Home open={open} openSettings={() => openSettings()} ensureFolder={ensureFolder} />}
        {page === 'projects' && <Projects open={open} openFolder={openPicked} />}
        {page === 'library' && <LibraryPage jobs={jobs} openSettings={() => openSettings('assets', 'library')} />}
      </main>
    </div>
  )
}
