import { open as pick } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentProps, type Ref } from 'react'
import { firstLine } from '../../../engine/shotloop/data.mjs'
import { api, fileUrl, isBroken, type ListEntry, type ProjectSummary } from '../api'
import { aspectOf, formatSeconds, isWide } from '../model'
import { ModelMark } from '../ai/BrandIcon'
import { aiSummary, useDetected } from '../ai/backends'
import { baseName, listRecent, projectsFolder, setProjectsFolder } from '../recent'
import { useSettings } from '../settings'
import { Icon } from './Icon'
import { ExampleGallery } from './ExampleGallery'
import { LookPicker } from './LookPicker'
import { StylePicker } from './StylePicker'
import { SubtitlePicker } from './SubtitleLooks'
import { DropOverlay, PromoMaterial, usePictureDrop, usePromoImages } from './PromoMaterial'
import { examplesFor, lookFits, styleName } from '../styles'
import type { Key } from '../i18n/en'
import { t, tSplit } from '../i18n'
import { ErrorText } from './ErrorDialog'

type Track = 'auto' | '2d' | '3d'
type Aspect = '9:16' | '16:9'

// word: the headline's highlight; chip: the option (what the frame is);
// hint: what it suits
const TRACKS: Record<Track, { word: Key; chip: Key; hint: Key; idea: Key; icon: ComponentProps<typeof Icon>['name'] }> = {
  auto: { word: 'home.track.2d', chip: 'home.chip.auto', hint: 'home.hint.auto', idea: 'home.idea.2d', icon: 'spark' },
  '2d': { word: 'home.track.2d', chip: 'home.chip.2d', hint: 'home.hint.2d', idea: 'home.idea.2d', icon: 'image' },
  '3d': { word: 'home.track.3d', chip: 'home.chip.3d', hint: 'home.hint.3d', idea: 'home.idea.3d', icon: 'cube' }
}
const NEXT_TRACK: Record<Track, Track> = { auto: '2d', '2d': '3d', '3d': 'auto' }
// A product promo is drawn in 2D for now: the chip skips 3D
const NEXT_PROMO_TRACK: Record<Track, Track> = { auto: '2d', '2d': 'auto', '3d': 'auto' }
// 'auto': the planner sets the length from the content; any other length
// in seconds is typed in (the engine takes 6–180 s)
// An idea written in Chinese or Japanese: no spaces between its words
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u
const LENGTHS = ['auto', '15', '30', '45', '60']
const CUSTOM = 'custom'
const lengthLabel = (l: string) => l === 'auto' ? t('home.lengthAutoShort') : t('unit.s', { n: l })
const MIN_LENGTH = 6, MAX_LENGTH = 180

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-') || 'untitled'

type Open = (path: string, plan?: boolean) => void

// Home: start a short from an idea (open-design's composer, for video),
// or open one of the person's projects or the examples
export function Home({ open, openSettings, ensureFolder }: { open: Open; openSettings: () => void; ensureFolder: () => Promise<string> }) {
  const composer = useRef<ComposerHandle>(null)
  const [examples, setExamples] = useState<ProjectSummary[] | null>(null)
  const [mine, setMine] = useState<ListEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    // Examples are bundled (and checked by the engine's tests): one that
    // can't be read is left out of the gallery rather than shown broken
    api.listProjects([], true).then(list => setExamples(examplesFor(list).filter(p => !isBroken(p)) as ProjectSummary[]), e => {
      setExamples([])
      setError(String(e))
    })
    listRecent(4).then(setMine, e => {
      setMine([])
      setError(String(e))
    })
  }, [])

  return (
    <div className="home">
      <Composer ref={composer} open={open} openSettings={openSettings} ensureFolder={ensureFolder} />
      <ErrorText error={error} className="error" />
      {mine === null || examples === null
        ? <RowsSkeleton />
        : mine.length > 0 && (
        <section className="examples">
          <span className="section-label">{t('home.mine')}</span>
          <div className="example-list">
            {mine.map(p => (isBroken(p)
              ? <BrokenRow key={p.root} root={p.root} error={p.error} />
              : <ProjectRow key={p.root} p={p} onClick={() => open(p.root, !p.poster)} />))}
          </div>
        </section>
      )}
      {examples && examples.length > 0 && (
        <ExampleGallery examples={examples} open={p => open(p.root)} pickStyle={id => composer.current?.pickStyle(id)} />
      )}
    </div>
  )
}

// An example's "Use this style", from the gallery below
type ComposerHandle = { pickStyle: (id: string) => void }

// The idea box with what kind of film to make, and the new project
function Composer({ ref, open, openSettings, ensureFolder }: {
  ref: Ref<ComposerHandle>
  open: Open
  openSettings: () => void
  ensureFolder: () => Promise<string>
}) {
  const { settings } = useSettings()
  const detected = useDetected()
  const ai = settings && aiSummary(settings, detected)
  const [idea, setIdea] = useState('')
  const [track, setTrack] = useState<Track>('auto')
  const [aspect, setAspect] = useState<Aspect>('9:16')
  const [length, setLength] = useState('auto')
  // The voice-over: off for a new film unless turned on here (then the
  // picture is timed to it)
  const [voice, setVoice] = useState(false)
  // The voice-over subtitles' look, or '' for the AI to pick one
  const [subtitles, setSubtitles] = useState('')
  // A typed length, kept within what the engine takes once it is left
  const custom = !LENGTHS.includes(length)
  const clampLength = () => {
    const n = Math.round(Number(length))
    setLength(String(Number.isFinite(n) ? Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n)) : 30))
  }
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
  // What the film is about: an explainer, or a promo of the person's
  // software or website from its page and pictures (2D, in a style its
  // screenshot kit draws on)
  const [promo, setPromo] = useState(false)
  const choosePromo = (on: boolean) => {
    setPromo(on)
    if (!on) return
    // A promo is narrated (its taste): the voice-over comes on with it
    setVoice(true)
    if (track === '3d') setTrack('2d')
    // Its look follows the product: no style or colours to choose
    setStyle('')
    setLook('')
  }
  // A promo's product page and pictures; a picture pasted or dropped into
  // the idea makes the film a promo
  const [site, setSite] = useState('')
  const [repo, setRepo] = useState('')
  const promoImages = usePromoImages()
  const takePictures = (files: File[]) => {
    if (!files.some(f => f.type.startsWith('image/'))) return false
    if (!promo) choosePromo(true)
    promoImages.add(files)
    return true
  }
  const drop = usePictureDrop(takePictures)
  // A promo is wide: a product's screens don't read in a tall frame
  const frame = promo ? '16:9' : aspect
  const ideaBox = useRef<HTMLTextAreaElement>(null)
  // An example's style for the next video: back to the composer to write it
  const pickStyle = (id: string) => {
    setPromo(false)
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
  useImperativeHandle(ref, () => ({ pickStyle }))

  // The track sits at the start of the idea, as its label: the text runs
  // in a column beside it (every line aligned), however long the label is
  // in this language. Measured on whichever chip is mounted, so a chip
  // that is replaced (a hot reload) never leaves the text under it
  const [indent, setIndent] = useState(0)
  const trackChip = useCallback((el: HTMLButtonElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(() => setIndent(Math.ceil(el.getBoundingClientRect().width) + 8))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // The idea box grows with the text instead of scrolling inside: the chip
  // stays over the first line, which a scrolled box would slide under it
  useEffect(() => {
    const ta = ideaBox.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [idea, indent])

  const [folder, setFolder] = useState(projectsFolder())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chooseFolder = async () => {
    const dir = await pick({ directory: true, title: t('home.dialog.folder') })
    if (typeof dir !== 'string') return
    setProjectsFolder(dir)
    setFolder(dir)
  }

  // A promo can start from its page or pictures alone
  const ready = !!idea.trim() || (promo && (!!site.trim() || !!repo || promoImages.images.length > 0))
  const create = async () => {
    if (!ready || busy) return
    setError(null)
    setBusy(true)
    try {
      const parent = folder ?? (await ensureFolder())
      setFolder(parent)
      // A promo without words: the idea names the product, in the person's language
      const text = idea.trim() || t('promo.idea', { name: siteName(site) || repo.split('/').filter(Boolean).at(-1) || t('promo.product') })
      const title = firstLine(text)
      const r = await api.createProject({
        dir: `${parent}/${slugify(title)}`,
        idea: text,
        title,
        track,
        aspect: frame,
        duration: length,
        look: track === '3d' || promo ? '' : look,
        style: track === '3d' || promo ? '' : style,
        voice,
        subtitles: voice ? subtitles : '',
        promo,
        site: promo ? site.trim() : '',
        repo: promo ? repo : ''
      })
      // Saved before the plan starts, which looks at them
      if (promo) for (const i of promoImages.images) await api.addImage(r.root, i.name, i.bytes)
      // A new project starts on its planning page: copy and storyboard first
      open(r.root, true)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const [before, after] = tSplit('home.hero', 'mark')
  const model = ai ? `${ai.name}${ai.model ? ` · ${ai.model}` : ''}` : ''

  return (
    <>
      <h1 className="hero">
        {before}{promo
          ? <mark>{t('home.track.promo')}</mark>
          : track === 'auto'
          ? <Rotating words={[t('home.track.2d'), t('home.track.3d')]} />
          : <mark>{t(TRACKS[track].word)}</mark>}{after}
      </h1>
      <p className="hero-sub muted">{t('home.sub')}</p>

      <div className="composer">
        {/* What the film is about, beside how it is drawn (the track chip) */}
        <div className="kind-switch chip-group" role="radiogroup" aria-label={t('home.aria.kind')}>
          {([false, true] as const).map(on => (
            <button key={String(on)} role="radio" aria-checked={promo === on} className={`chip${promo === on ? ' on' : ''}`} onClick={() => choosePromo(on)}
              title={on ? t('home.hint.promo') : undefined}>
              <Icon name={on ? 'monitor' : 'book'} size={13} /> {t(on ? 'home.kind.promo' : 'home.kind.explainer')}
            </button>
          ))}
        </div>
        <div className={`composer-card${drop.over ? ' dropping' : ''}`} {...drop.handlers}
          onPaste={e => { if (takePictures([...e.clipboardData.files])) e.preventDefault() }}>
          {drop.over && <DropOverlay />}
          {/* What kind of film, as the idea's prefix: a click steps Auto → 2D → 3D */}
          <button type="button" className={`track-chip${track === 'auto' ? ' auto' : ''}`} ref={trackChip} title={t(TRACKS[track].hint)}
            aria-label={`${t('home.aria.track')}: ${t(TRACKS[track].chip)}`} onClick={() => chooseTrack((promo ? NEXT_PROMO_TRACK : NEXT_TRACK)[track])}>
            <Icon name={TRACKS[track].icon} size={12} />
            {t(TRACKS[track].chip)}
            <Icon name="refresh" size={10} />
          </button>
          <textarea
            ref={ideaBox}
            value={idea}
            rows={3}
            style={{ paddingLeft: indent }}
            placeholder={t('home.placeholder', { example: t(promo ? 'home.idea.promo' : TRACKS[track].idea) })}
            onChange={e => setIdea(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create()
            }}
          />
          {promo && <PromoMaterial site={site} setSite={setSite} repo={repo} setRepo={setRepo} images={promoImages.images} add={promoImages.add} remove={promoImages.remove} />}
          <div className="composer-bar">
            <div className="chips">
              {promo
                ? <span className="chip static" title={t('promo.wideOnly')}><span className="aspect-glyph a169" /> 16:9</span>
                : (
                  <div className="chip-group" role="radiogroup" aria-label={t('home.aria.aspect')}>
                    {(['9:16', '16:9'] as Aspect[]).map(a => (
                      <button key={a} role="radio" aria-checked={aspect === a} className={`chip${aspect === a ? ' on' : ''}`} onClick={() => setAspect(a)}>
                        <span className={`aspect-glyph a${a.replace(':', '')}`} /> {a}
                      </button>
                    ))}
                  </div>
                )}
              {/* Length as one chip with a menu: four buttons would wrap the row.
                  "Custom" opens a box for any length in seconds. The menu lies
                  invisibly over its label: a native select is as wide as its
                  longest option */}
              <label className="chip-select" title={t('home.aria.length')}>
                <span className="chip-menu">
                  <Icon name="clock" size={13} />
                  {custom ? t('home.lengthCustom') : lengthLabel(length)}
                  <Icon name="chevron" size={11} />
                  <select value={custom ? CUSTOM : length} onChange={e => setLength(e.target.value === CUSTOM ? '20' : e.target.value)} aria-label={t('home.aria.length')}>
                    {LENGTHS.map(l => <option key={l} value={l}>{lengthLabel(l)}</option>)}
                    <option value={CUSTOM}>{t('home.lengthCustom')}</option>
                  </select>
                </span>
                {custom && (
                  <span className="length-input">
                    <input type="number" min={MIN_LENGTH} max={MAX_LENGTH} step={1} value={length} onChange={e => setLength(e.target.value)} onBlur={clampLength}
                      aria-label={t('home.aria.lengthSeconds')} />
                    {t('home.lengthUnit')}
                  </span>
                )}
              </label>
              {/* The voice-over: a round toggle, its state in the icon and the tooltip */}
              <button className={`chip-toggle${voice ? ' on' : ''}`} aria-pressed={voice} onClick={() => setVoice(!voice)}
                title={`${t('home.voice')} · ${t(voice ? 'home.voiceOnHint' : 'home.voiceOffHint')}`} aria-label={t('home.voice')}>
                <Icon name={voice ? 'mic' : 'micOff'} size={14} />
              </button>
              {/* Subtitles come with the voice: picked once it is on */}
              <SubtitlePicker value={subtitles} onChange={setSubtitles} spaced={!UNSPACED.test(idea)} disabled={!voice} />
              {/* A promo has neither: it is drawn in the product's own system,
                  its colours and fonts read from the product */}
              {track !== '3d' && !promo && <span className="bar-divider" aria-hidden />}
              {track !== '3d' && !promo && <StylePicker value={style} onChange={chooseStyle} />}
              {track !== '3d' && !promo && <LookPicker value={look} onChange={setLook} style={style} />}
            </div>
            {ai && (
              // Just the model maker's mark: the tool and model are in the tooltip
              <button className="model-chip icon-only" onClick={openSettings} title={`${model} · ${t('ai.change')}`} aria-label={model}>
                <ModelMark ai={ai} />
                {!ai.ready && <span className="dot warn" />}
              </button>
            )}
            <button className="send" onClick={() => create()} disabled={!ready || busy} aria-label={t('home.create')} title={t('home.create')}>
              {busy ? <span className="spinner" /> : <Icon name="send" size={18} />}
            </button>
          </div>
        </div>
        <div className="composer-foot">
          <button className="workdir" onClick={chooseFolder} title={folder ?? ''}>
            <Icon name="folder" size={14} /> <span className="ellipsis">{folder ? baseName(folder) : t('home.chooseFolder')}</span> <Icon name="chevron" size={12} />
          </button>
          <span className="muted small">{t(promo ? 'home.hint.promo' : TRACKS[track].hint)}</span>
        </div>
      </div>
      <ErrorText error={error ?? promoImages.error} className="error" />
    </>
  )
}

// A product's name from its address ("www.raycast.com/pro" → raycast.com,
// "github.com/owner/app" → app)
function siteName(site: string) {
  const s = site.trim()
  if (!s) return ''
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`)
    const host = url.host.replace(/^www\./, '')
    return host === 'github.com' ? url.pathname.split('/')[2] || host : host
  } catch {
    // Not an address yet: the engine says so when the project is made
    return s
  }
}

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

// A project as a row: its poster, title and shape; a draft (nothing
// rendered yet) says so
function ProjectRow({ p, onClick }: { p: ProjectSummary; onClick: () => void }) {
  return (
    <button className="example" onClick={onClick}>
      <div className={`example-poster${isWide(p.size) ? ' wide' : ''}`}>
        {p.poster ? <img src={fileUrl(p.poster)} alt="" /> : <Icon name="film" size={20} />}
      </div>
      <div className="example-text">
        <strong>{p.title}{!p.example && !p.poster && <span className="tag draft-tag">{t('home.draft')}</span>}</strong>
        {p.description && <span className="example-desc ellipsis">{p.description}</span>}
        <span className="example-meta">
          {p.promo
            ? <span className="tag style-tag">{t('home.kind.promo')}</span>
            : p.style && p.style !== '3d' && <span className="tag style-tag">{styleName(p.style)}</span>}
          {p.track.toUpperCase()} · {t('common.shots', { n: p.shots })} · {formatSeconds(p.duration)} · {aspectOf(p.size)}
        </span>
      </div>
      <span className="example-go"><Icon name="arrow" size={14} /></span>
    </button>
  )
}

// A recent project that can't be read: its folder and why
function BrokenRow({ root, error }: { root: string; error: string }) {
  return (
    <div className="example broken" title={root}>
      <div className="example-poster"><Icon name="info" size={20} /></div>
      <div className="example-text">
        <strong>{baseName(root)} <span className="tag danger">{t('projects.broken')}</span></strong>
        <span className="example-desc ellipsis" title={error}>{error}</span>
      </div>
    </div>
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
