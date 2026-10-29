import { open as pick } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import type { Job } from '../api'
import { api } from '../api'
import { readRecent } from '../App'
import { Setup } from './Setup'

export function StartScreen({ onOpen, error, jobs }: { onOpen: (path: string) => void; error: string | null; jobs: Job[] }) {
  const [converting, setConverting] = useState<string | null>(null)
  const [convertError, setConvertError] = useState<string | null>(null)
  const recent = readRecent()
  const busy = jobs.filter(j => j.state === 'running').length

  const openFolder = async () => {
    const dir = await pick({ directory: true, title: 'Open a Shotloop project' })
    if (typeof dir === 'string') onOpen(dir)
  }

  // A legacy episode (engine/video/explainers/…) becomes a project next
  // to a folder the person picks
  const convert = async () => {
    setConvertError(null)
    const src = await pick({ directory: true, title: 'Legacy episode (with scene.py or index.html)' })
    if (typeof src !== 'string') return
    const parent = await pick({ directory: true, title: 'Where to create the project' })
    if (typeof parent !== 'string') return
    const dst = `${parent}/${src.split('/').filter(Boolean).at(-1)}`
    setConverting(dst)
    try {
      const r = await api.convert(src, dst)
      onOpen(r.dst)
    } catch (e) {
      setConvertError(String(e))
    } finally {
      setConverting(null)
    }
  }

  return (
    <div className="start">
      <header className="start-head">
        <div className="logo" aria-hidden>
          <span />
        </div>
        <div>
          <h1>Shotloop</h1>
          <p className="muted">Fix one shot, not the whole film.</p>
        </div>
      </header>

      <div className="start-grid">
        <section className="panel">
          <h2>Projects</h2>
          <div className="row gap">
            <button className="primary" onClick={openFolder}>Open project…</button>
            <button onClick={convert} disabled={!!converting}>
              {converting ? 'Converting…' : 'Convert legacy episode…'}
            </button>
          </div>
          {(error || convertError) && <p className="error">{error ?? convertError}</p>}
          {recent.length > 0 && (
            <>
              <h3>Recent</h3>
              <ul className="recent">
                {recent.map(p => (
                  <li key={p}>
                    <button className="link" onClick={() => onOpen(p)}>
                      <strong>{p.split('/').at(-1)}</strong>
                      <span className="muted small">{p}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {busy > 0 && <p className="muted small">{busy} job(s) still running in the background.</p>}
        </section>
        <Setup />
      </div>
    </div>
  )
}
