import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { api, EMPTY_SETTINGS, fileUrl, type ProjectSummary } from '../api'
import { formatSeconds } from '../model'
import { BrandIcon, hasBrand } from '../ai/BrandIcon'
import { aiSummary, useSettings } from '../ai/useSettings'
import { baseName, cleanRecent, projectsFolder, setProjectsFolder } from '../recent'
import { Icon } from './Icon'
import { ExampleGallery } from './ExampleGallery'
import { LookPicker } from './LookPicker'
import { StylePicker } from './StylePicker'
import { lookFits, STYLES, styleName } from '../styles'
import type { Key } from '../i18n/en'
import { t, tSplit } from '../i18n'

type Track = 'auto' | '2d' | '3d'
type Aspect = '9:16' | '16:9'

// word: the headline's highlight; chip: the option (what the frame is);
// hint: what it suits
const TRACKS: Record<Track, { word: Key; chip: Key; hint: Key; idea: Key }> = {
  auto: { word: 'home.track.2d', chip: 'home.chip.auto', hint: 'home.hint.auto', idea: 'home.idea.2d' },
  '2d': { word: 'home.track.2d', chip: 'home.chip.2d', hint: 'home.hint.2d', idea: 'home.idea.2d' },
  '3d': { word: 'home.track.3d', chip: 'home.chip.3d', hint: 'home.hint.3d', idea: 'home.idea.3d' }
}
// 'auto': the planner sets the length from the content
const LENGTHS = ['auto', '15', '30', '45', '60']

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-') || 'untitled'

// Home: start a short from an idea (open-design's composer, for video),
// or open one of the examples
export function Home({ open, openSettings, ensureFolder }: { open: (path: string, plan?: boolean) => void; openSettings: () => void; ensureFolder: () => Promise<string> }) {
  const settings = useSettings()
  const ai = settings && aiSummary(settings)
  const [idea, setIdea] = useState('')
  const [track, setTrack] = useState<Track>('auto')
  const [aspect, setAspect] = useState<Aspect>('9:16')
  const [length, setLength] = useState('auto')
  // 2D: a look, or '' for the AI to pick one that fits the idea
  const [look, setLook] = useState('')
  // 2D: a visual style, or '' for the AI to pick one that fits the idea
  const [style, setStyle] = useState('')
  // A 2D style settles the track; Auto leaves the style to the AI too
  const chooseStyle = (id: string) => {
    setStyle(id)
    if (look && !lookFits(id, look)) setLook('')
    if (id && track === 'auto') setTrack('2d')
  }
  const chooseTrack = (tr: Track) => {
    setTrack(tr)
    if (tr === 'auto') setStyle('')
  }
  // An example's style for the next video: back to the composer to write it
  const ideaBox = useRef<HTMLTextAreaElement>(null)
  const pickStyle = (id: string) => {
    if (id === '3d') {
      setTrack('3d')
      setStyle('')
    } else {
      chooseStyle(id)
      setTrack('2d')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    ideaBox.current?.closest('.home')?.scrollTo?.({ top: 0, behavior: 'smooth' })
    ideaBox.current?.focus({ preventScroll: true })
  }
  const [folder, setFolder] = useState(projectsFolder())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [examples, setExamples] = useState<ProjectSummary[] | null>(null)
  // 3D needs Blender: null until checked, 'missing' shows the install prompt
  const [blender, setBlender] = useState<null | 'missing' | 'stillMissing'>(null)

  const [mine, setMine] = useState<ProjectSummary[] | null>(null)
  useEffect(() => {
    api.listProjects([], true).then(list => setExamples(examplesFor(list)), () => setExamples([]))
    // The person's own recent projects, newest first
    cleanRecent()
      .then(recent => api.listProjects(recent.slice(0, 4)).then(list => recent.slice(0, 4).map(p => list.find(x => x.root === p)).filter((x): x is ProjectSummary => !!x)))
      .then(setMine, () => setMine([]))
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

  const hasBlender = async () => !!(await api.doctor()).blender

  // `anyway` creates a 3D project without Blender (install it before rendering)
  const create = async (anyway = false) => {
    if (!idea.trim() || busy) return
    setError(null)
    if (track === '3d' && !anyway) {
      setBusy(true)
      const ok = await hasBlender().catch(() => false)
      setBusy(false)
      if (!ok) return setBlender('missing')
    }
    setBlender(null)
    const parent = folder ?? (await ensureFolder())
    setFolder(parent)
    setBusy(true)
    try {
      // The first sentence, cut at a word (as the engine's firstLine)
      const first = idea.trim().split(/[.?!\n。？！]/)[0].trim()
      const cut = first.slice(0, 59)
      const space = cut.lastIndexOf(' ')
      const title = first.length <= 60 ? first : (space > 30 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, '') + '…'
      const r = await api.createProject({
        dir: `${parent}/${slugify(title)}`,
        idea: idea.trim(),
        title,
        track,
        aspect,
        duration: length,
        look: track === '3d' ? '' : look,
        style: track === '3d' ? '' : style
      })
      // A new project starts on its planning page: copy and storyboard first
      open(r.root, true)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const checkBlender = async () => {
    if (await hasBlender().catch(() => false)) create(true)
    else setBlender('stillMissing')
  }

  // Blender.app, or the binary inside it; saved as the Blender tool path
  const locateBlender = async () => {
    const picked = await pick({ title: t('blender.dialog'), defaultPath: '/Applications', filters: [{ name: 'Blender', extensions: ['app'] }] })
    if (typeof picked !== 'string') return
    const path = picked.endsWith('.app') ? `${picked}/Contents/MacOS/Blender` : picked
    const saved = await api.getSettings()
    await api.saveSettings({ ...EMPTY_SETTINGS, ...saved, blender: path })
    checkBlender()
  }

  const [before, after] = tSplit('home.hero', 'mark')

  return (
    <div className="home">
      <h1 className="hero">
        {before}{track === 'auto'
          ? <Rotating words={[t('home.track.2d'), t('home.track.3d')]} />
          : <mark>{t(TRACKS[track].word)}</mark>}{after}
      </h1>
      <p className="hero-sub muted">{t('home.sub')}</p>

      <div className="composer">
        <div className="composer-card">
        <textarea
          ref={ideaBox}
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
              {(['auto', '2d', '3d'] as Track[]).map(tr => (
                <button key={tr} role="radio" aria-checked={track === tr} className={`chip${track === tr ? ' on' : ''}`}
                  onClick={() => chooseTrack(tr)} title={t(TRACKS[tr].hint)}>
                  {track === tr && <Icon name="spark" size={12} />}{t(TRACKS[tr].chip)}
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
            {/* Length as one chip with a menu: four buttons would wrap the row */}
            <label className="chip-select" title={t('home.aria.length')}>
              <Icon name="clock" size={13} />
              <select value={length} onChange={e => setLength(e.target.value)} aria-label={t('home.aria.length')}>
                {LENGTHS.map(l => <option key={l} value={l}>{l === 'auto' ? t('home.lengthAuto') : t('unit.s', { n: l })}</option>)}
              </select>
            </label>
            {track !== '3d' && <span className="bar-divider" aria-hidden />}
            {track !== '3d' && <StylePicker value={style} onChange={chooseStyle} />}
            {track !== '3d' && <LookPicker value={look} onChange={setLook} style={style} />}
          </div>
          {ai && (
            // Just the AI's mark: its name and model are in the tooltip
            <button className="model-chip icon-only" onClick={openSettings} title={`${ai.name}${ai.model ? ` · ${ai.model}` : ''} · ${t('ai.change')}`} aria-label={`${ai.name}${ai.model ? ` · ${ai.model}` : ''}`}>
              {hasBrand(ai.brand) ? <BrandIcon id={ai.brand} size={16} /> : <Icon name={ai.mode === 'local' ? 'cpu' : 'spark'} size={15} />}
              {!ai.ready && <span className="dot warn" />}
            </button>
          )}
          <button className="send" onClick={() => create()} disabled={!idea.trim() || busy} aria-label={t('home.create')} title={t('home.create')}>
            {busy ? <span className="spinner" /> : <Icon name="send" size={18} />}
          </button>
        </div>
        </div>
        <div className="composer-foot">
          <button className="workdir" onClick={chooseFolder} title={folder ?? ''}>
            <Icon name="folder" size={14} /> <span className="ellipsis">{folder ? baseName(folder) : t('home.chooseFolder')}</span> <Icon name="chevron" size={12} />
          </button>
          <span className="muted small">{t(TRACKS[track].hint)}</span>
        </div>
      </div>
      {blender && track === '3d' && (
        <div className="panel blender-needed" role="alert">
          <strong>{t('blender.title')}</strong>
          <p className="muted">{t('blender.body')}</p>
          {blender === 'stillMissing' && <p className="error small">{t('blender.notFound')}</p>}
          <div className="row">
            <button className="primary" onClick={() => api.openBlenderDownload()}>{t('blender.download')}</button>
            <button onClick={locateBlender}>{t('blender.locate')}</button>
            <button className="ghost" onClick={checkBlender}>{t('setup.checkAgain')}</button>
            <button className="ghost" onClick={() => create(true)}>{t('blender.anyway')}</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {mine === null || examples === null
        ? <RowsSkeleton />
        : mine.length > 0 && (
        <section className="examples">
          <span className="section-label">{t('home.mine')}</span>
          <div className="example-list">
            {mine.map(p => <ProjectCard key={p.root} p={p} onClick={() => open(p.root, !p.poster)} />)}
          </div>
        </section>
      )}

      {examples && examples.length > 0 && (
        <ExampleGallery examples={examples} open={p => open(p.root)} pickStyle={pickStyle} />
      )}
    </div>
  )
}

// The examples (in English, for every UI language), grouped by visual
// style in the styles' order
export function examplesFor(list: ProjectSummary[]) {
  const order = (p: ProjectSummary) => {
    const i = STYLES.findIndex(s => s.id === p.style)
    return i < 0 ? STYLES.length : i
  }
  return list.filter(p => p.example).sort((a, b) => order(a) - order(b))
}

// A project as a card: its poster, title and shape; a draft (nothing
// rendered yet) says so
// The lists of projects in outline while they load
function RowsSkeleton() {
  return (
    <section className="examples" aria-busy>
      <span className="sk-line w20" />
      <div className="example-list">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="example skeleton">
            <span className="example-poster sk-block" />
            <span className="example-text"><span className="sk-line w50" /><span className="sk-line w80" /><span className="sk-line w30" /></span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProjectCard({ p, onClick }: { p: ProjectSummary; onClick: () => void }) {
  return (
    <button className="example" onClick={onClick}>
      <div className={`example-poster${p.size.width > p.size.height ? ' wide' : ''}`}>
        {p.poster ? <img src={fileUrl(p.poster)} alt="" /> : <Icon name="film" size={20} />}
      </div>
      <div className="example-text">
        <strong>{p.title}{!p.example && !p.poster && <span className="tag draft-tag">{t('home.draft')}</span>}</strong>
        {p.description && <span className="example-desc ellipsis">{p.description}</span>}
        <span className="example-meta">
          {p.style && p.style !== '3d' && <span className="tag style-tag">{styleName(p.style)}</span>}
          {p.track.toUpperCase()} · {t('common.shots', { n: p.shots })} · {formatSeconds(p.duration)} · {p.size.width > p.size.height ? '16:9' : '9:16'}
        </span>
      </div>
      <span className="example-go"><Icon name="arrow" size={14} /></span>
    </button>
  )
}

// The headline's word while the AI picks 2D or 3D: the two take turns
function Rotating({ words }: { words: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI(n => (n + 1) % words.length), 2200)
    return () => window.clearInterval(id)
  }, [words.length])
  return <mark className="rotating" aria-label={words.join(' / ')}><span key={i} className="rotating-word" aria-hidden>{words[i]}</span></mark>
}
