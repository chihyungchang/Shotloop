import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api, fileUrl, type ProjectSummary } from '../api'
import { formatSeconds } from '../model'
import { baseName, projectsFolder, setProjectsFolder } from '../recent'
import { Icon } from './Icon'
import type { Key } from '../i18n/en'
import { t, tSplit } from '../i18n'

type Track = '2d' | '3d'
type Aspect = '9:16' | '16:9'

const TRACKS: Record<Track, { word: Key; hint: Key; idea: Key }> = {
  '2d': { word: 'home.track.2d', hint: 'home.hint.2d', idea: 'home.idea.2d' },
  '3d': { word: 'home.track.3d', hint: 'home.hint.3d', idea: 'home.idea.3d' }
}
const LENGTHS = [15, 30, 45, 60]

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
    const dir = await pick({ directory: true, title: t('home.dialog.folder') })
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
    const src = await pick({ directory: true, title: t('home.dialog.legacy') })
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

  const [before, after] = tSplit('home.hero', 'mark')

  return (
    <div className="home">
      <h1 className="hero">
        {before}<mark>{t(TRACKS[track].word)}</mark>{after}
      </h1>
      <p className="hero-sub muted">{t('home.sub')}</p>

      <div className="composer">
        <textarea
          value={idea}
          rows={3}
          placeholder={t('home.placeholder', { example: t(TRACKS[track].idea) })}
          onChange={e => setIdea(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create()
          }}
        />
        <div className="composer-bar">
          <div className="chips">
            <div className="chip-group" role="radiogroup" aria-label={t('home.aria.track')}>
              {(['2d', '3d'] as Track[]).map(tr => (
                <button key={tr} role="radio" aria-checked={track === tr} className={`chip${track === tr ? ' on' : ''}`}
                  onClick={() => setTrack(tr)} title={t(TRACKS[tr].hint)}>
                  {tr.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="chip-group" role="radiogroup" aria-label={t('home.aria.aspect')}>
              {(['9:16', '16:9'] as Aspect[]).map(a => (
                <button key={a} role="radio" aria-checked={aspect === a} className={`chip${aspect === a ? ' on' : ''}`} onClick={() => setAspect(a)}>
                  <span className={`aspect-glyph a${a.replace(':', '')}`} /> {a}
                </button>
              ))}
            </div>
            <div className="chip-group" role="radiogroup" aria-label={t('home.aria.length')}>
              {LENGTHS.map(l => (
                <button key={l} role="radio" aria-checked={length === l} className={`chip${length === l ? ' on' : ''}`} onClick={() => setLength(l)}>
                  {t('unit.s', { n: l })}
                </button>
              ))}
            </div>
          </div>
          <button className="send" onClick={create} disabled={!idea.trim() || busy} aria-label={t('home.create')} title={t('home.create')}>
            {busy ? <span className="spinner" /> : <Icon name="send" size={18} />}
          </button>
        </div>
        <div className="composer-foot">
          <button className="link-muted" onClick={chooseFolder}>
            <Icon name="folder" size={14} /> {folder ?? t('home.chooseFolder')}
          </button>
          <span className="muted small">{t(TRACKS[track].hint)}</span>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {examples.length > 0 && (
        <section className="examples">
          <span className="section-label">{t('home.examples')}</span>
          {examples.map(p => (
            <button key={p.root} className="example" onClick={() => open(p.root)}>
              <div className={`example-poster${p.size.width > p.size.height ? ' wide' : ''}`}>
                {p.poster ? <img src={fileUrl(p.poster)} alt="" /> : <Icon name="film" size={20} />}
              </div>
              <div>
                <strong><Icon name="spark" size={14} /> {p.title}</strong>
                <span className="muted small">
                  {p.track.toUpperCase()} · {t('common.shots', { n: p.shots })} · {formatSeconds(p.duration)} · {p.size.width > p.size.height ? '16:9' : '9:16'}
                </span>
              </div>
            </button>
          ))}
          <button className="link-muted convert" onClick={convert}>
            <Icon name="refresh" size={14} /> {t('home.convert')}
          </button>
        </section>
      )}
    </div>
  )
}
