import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api, fileUrl, type ProjectSummary } from '../api'
import { formatSeconds } from '../model'
import { baseName, projectsFolder, setProjectsFolder } from '../recent'
import { Icon } from './Icon'

type Track = '2d' | '3d'
type Aspect = '9:16' | '16:9'

const TRACKS: Record<Track, { word: string; hint: string }> = {
  '2d': { word: '2D explainer', hint: 'Numbers, comparisons, lists, text: an HTML page, recorded in Chrome.' },
  '3d': { word: '3D explainer', hint: 'Places, objects and journeys: a Blender scene, one camera move per shot.' }
}
const LENGTHS = [15, 30, 45, 60]

const IDEAS = [
  'How long would a hacker need to crack your password?',
  'What happens when you press Enter in Claude Code?',
  'Why does your phone battery wear out?',
  'How does a GPU draw one frame of a game?'
]

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-') || 'untitled'

// Home: start a short from an idea (open-design's composer, for video),
// or open one of the examples
export function Home({ open }: { open: (path: string) => void }) {
  const [idea, setIdea] = useState('')
  const [track, setTrack] = useState<Track>('2d')
  const [aspect, setAspect] = useState<Aspect>('9:16')
  const [length, setLength] = useState(30)
  const [folder, setFolder] = useState(projectsFolder())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [examples, setExamples] = useState<ProjectSummary[]>([])

  useEffect(() => {
    api.listProjects([], true).then(setExamples, () => setExamples([]))
  }, [])

  const chooseFolder = async () => {
    const dir = await pick({ directory: true, title: 'Where new projects go' })
    if (typeof dir === 'string') {
      setProjectsFolder(dir)
      setFolder(dir)
      return dir
    }
    return null
  }

  const create = async () => {
    if (!idea.trim() || busy) return
    setError(null)
    const parent = folder ?? (await chooseFolder())
    if (!parent) return
    setBusy(true)
    try {
      const title = idea.trim().split(/[.?!\n]/)[0].slice(0, 60)
      const r = await api.createProject({
        dir: `${parent}/${slugify(title)}`,
        idea: idea.trim(),
        title,
        track,
        aspect,
        duration: length
      })
      open(r.root)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const convert = async () => {
    setError(null)
    const src = await pick({ directory: true, title: 'Legacy episode (with scene.py or index.html)' })
    if (typeof src !== 'string') return
    const parent = folder ?? (await chooseFolder())
    if (!parent) return
    try {
      const r = await api.convert(src, `${parent}/${baseName(src)}`)
      open(r.dst)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="home">
      <h1 className="hero">
        Let’s make a short <mark>{TRACKS[track].word}</mark>
      </h1>
      <p className="hero-sub muted">One idea, a handful of shots, each fixed on its own.</p>

      <div className="composer">
        <textarea
          value={idea}
          rows={3}
          placeholder={`${IDEAS[track === '2d' ? 0 : 1]} — what is the video about?`}
          onChange={e => setIdea(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create()
          }}
        />
        <div className="composer-bar">
          <div className="chips">
            <div className="chip-group" role="radiogroup" aria-label="Track">
              {(['2d', '3d'] as Track[]).map(t => (
                <button key={t} role="radio" aria-checked={track === t} className={`chip${track === t ? ' on' : ''}`}
                  onClick={() => setTrack(t)} title={TRACKS[t].hint}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="chip-group" role="radiogroup" aria-label="Aspect">
              {(['9:16', '16:9'] as Aspect[]).map(a => (
                <button key={a} role="radio" aria-checked={aspect === a} className={`chip${aspect === a ? ' on' : ''}`} onClick={() => setAspect(a)}>
                  <span className={`aspect-glyph a${a.replace(':', '')}`} /> {a}
                </button>
              ))}
            </div>
            <div className="chip-group" role="radiogroup" aria-label="Length">
              {LENGTHS.map(l => (
                <button key={l} role="radio" aria-checked={length === l} className={`chip${length === l ? ' on' : ''}`} onClick={() => setLength(l)}>
                  {l} s
                </button>
              ))}
            </div>
          </div>
          <button className="send" onClick={create} disabled={!idea.trim() || busy} aria-label="Create project" title="Create project (⌘↵)">
            {busy ? <span className="spinner" /> : <Icon name="send" size={18} />}
          </button>
        </div>
        <div className="composer-foot">
          <button className="link-muted" onClick={chooseFolder}>
            <Icon name="folder" size={14} /> {folder ? folder : 'Choose where projects go'}
          </button>
          <span className="muted small">{TRACKS[track].hint}</span>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {examples.length > 0 && (
        <section className="examples">
          <span className="section-label">Start from an example</span>
          {examples.map(p => (
            <button key={p.root} className="example" onClick={() => open(p.root)}>
              <div className={`example-poster${p.size.width > p.size.height ? ' wide' : ''}`}>
                {p.poster ? <img src={fileUrl(p.poster)} alt="" /> : <Icon name="film" size={20} />}
              </div>
              <div>
                <strong><Icon name="spark" size={14} /> {p.title}</strong>
                <span className="muted small">
                  {p.track.toUpperCase()} · {p.shots} shots · {formatSeconds(p.duration)} · {p.size.width > p.size.height ? '16:9' : '9:16'}
                </span>
              </div>
            </button>
          ))}
          <button className="link-muted convert" onClick={convert}>
            <Icon name="refresh" size={14} /> Convert a legacy episode (engine/video/explainers)…
          </button>
        </section>
      )}
    </div>
  )
}
