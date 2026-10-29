import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onProjectChanged, onQueue, type Job, type Project as ProjectData } from './api'
import { ProjectScreen } from './components/ProjectScreen'
import { StartScreen } from './components/StartScreen'

const RECENT = 'shotloop.recent'

export function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]')
  } catch {
    return []
  }
}

function remember(path: string) {
  try {
    localStorage.setItem(RECENT, JSON.stringify([path, ...readRecent().filter(p => p !== path)].slice(0, 8)))
  } catch {
    // storage unavailable: recents are a convenience
  }
}

export default function App() {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState<string | null>(null)
  const root = useRef<string | null>(null)

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

  if (!project) return <StartScreen onOpen={open} error={error} jobs={jobs} />
  return (
    <ProjectScreen
      project={project}
      jobs={jobs}
      refresh={refresh}
      close={() => {
        root.current = null
        setProject(null)
      }}
    />
  )
}
