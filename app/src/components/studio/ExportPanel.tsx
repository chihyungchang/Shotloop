import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { agentError } from '../../ai/errors'
import { api, fileUrl, type ExportResult, type Job, type Mode, type MusicInfo, type Project } from '../../api'
import { estimate, formatSeconds } from '../../model'
import type { Key } from '../../i18n/en'
import { t } from '../../i18n'
import { Icon } from '../Icon'

const ASPECTS: { id: string; label: Key; note: Key }[] = [
  { id: '9:16', label: 'export.portrait', note: 'export.portraitFor' },
  { id: '16:9', label: 'export.landscape', note: 'export.landscapeFor' }
]
const PRESETS = ['calm', 'bright', 'groove', 'tech'] as const

// Export (docs/PRD.md §7.9, §7.10): quality, aspects and music, then the
// film from cached shots (only the changed ones re-render), with its
// progress in plain sight; then the publish copy, per platform, ready to
// copy.
export function ExportPanel({ project, jobs, refresh, openSettings }: {
  project: Project
  jobs: Job[]
  refresh: () => void
  openSettings: () => void
}) {
  // The last choices for this project, kept on this Mac
  const prefsKey = `shotloop.export.${project.root}`
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(prefsKey) ?? 'null') as { mode?: Mode; aspects?: string[] } | null
    } catch {
      return null
    }
  })()
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'final')
  const [aspects, setAspects] = useState<string[]>(saved?.aspects?.length ? saved.aspects : ['9:16', '16:9'])
  useEffect(() => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify({ mode, aspects }))
    } catch {
      // storage unavailable: the choice lasts while the panel is open
    }
  }, [prefsKey, mode, aspects])
  const [latest, setLatest] = useState<ExportResult | null>(null)
  const [publish, setPublish] = useState<string | null>(null)
  const [music, setMusic] = useState<MusicInfo | null>(null)
  // How many renders the current export started with, for its progress
  const [batch, setBatch] = useState(0)

  const mine = jobs.filter(j => j.project === project.root)
  const exportJob = mine.filter(j => j.kind === 'export').at(-1)
  const publishJob = mine.filter(j => j.kind === 'publish').at(-1)
  const exporting = !!exportJob && (exportJob.state === 'running' || exportJob.state === 'queued')
  const renders = mine.filter(j => j.kind === 'render' && (j.state === 'running' || j.state === 'queued'))
  const rendering = renders.find(j => j.state === 'running')

  useEffect(() => {
    api.readText(project.root, 'out/latest.json').then(t => setLatest(JSON.parse(t)), () => setLatest(null))
    if (project.files.publish) api.readText(project.root, 'publish.md').then(setPublish, () => setPublish(null))
  }, [project, exportJob?.state, publishJob?.state])
  useEffect(() => {
    api.music(project.root).then(setMusic, () => setMusic(null))
  }, [project.root])

  // Shots whose frames for this mode are out of date
  const pending = project.shots.filter(s => s[mode].state !== 'cached')
  const time = pending.reduce((t, s) => t + estimate(project, s, mode), 0)

  const run = () => {
    // One job per shot, so the queue shows them one at a time; the export
    // job then only joins the cached clips
    setBatch(pending.length)
    for (const s of pending) api.enqueue({ kind: 'render', project: project.root, shot: s.id, mode, stills: false })
    api.enqueue({ kind: 'export', project: project.root, mode, aspects })
  }
  const changeMusic = async (change: Parameters<typeof api.music>[1]) => {
    setMusic(await api.music(project.root, change))
    refresh()
  }
  const chooseFile = async () => {
    const file = await pick({ title: t('music.dialog'), filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'aiff', 'flac'] }] })
    if (typeof file === 'string') changeMusic({ file })
  }

  // Progress: the shots still to render, then the joining
  const done = Math.max(0, batch - renders.length)
  const step = renders.length
    ? t('export.stepRender', { done: Math.min(done + 1, batch), total: batch })
    : t('export.stepJoin')
  const fraction = renders.length
    ? (done + (rendering?.progress ? rendering.progress.done / Math.max(1, rendering.progress.total) : 0)) / Math.max(1, batch + 1)
    : (batch + (exportJob?.progress ? exportJob.progress.done / Math.max(1, exportJob.progress.total) : 0.3)) / Math.max(1, batch + 1)

  return (
    <div className="export">
      <fieldset disabled={exporting} className="export-options">
        <section>
          <h3>{t('studio.quality')}</h3>
          <div className="segmented">
            {(['draft', 'final'] as Mode[]).map(m => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{t(m === 'draft' ? 'mode.Draft' : 'mode.Final')}</button>
            ))}
          </div>
          {project.track === '3d' && mode === 'final' && <Samples project={project} refresh={refresh} />}
        </section>

        <section>
          <h3>{t('export.aspects')}</h3>
          <div className="aspect-cards">
            {ASPECTS.map(a => {
              const on = aspects.includes(a.id)
              return (
                <button key={a.id} className={`aspect-card${on ? ' on' : ''}`} aria-pressed={on}
                  onClick={() => setAspects(on ? aspects.filter(x => x !== a.id) : ['9:16', '16:9'].filter(x => x === a.id || aspects.includes(x)))}>
                  <span className={`aspect-shape a${a.id.replace(':', '')}`} />
                  <strong>{t(a.label)} <span className="muted">{a.id}</span></strong>
                  <span className="small muted">{t(a.note)}</span>
                  {on && <span className="aspect-check"><Icon name="check" size={11} /></span>}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3>{t('music.title')}</h3>
          <div className="music-chips">
            <button className={`provider-chip${music?.kind === 'none' ? ' on' : ''}`} onClick={() => changeMusic({ none: true })}>{t('music.none')}</button>
            {PRESETS.map(p => (
              <button key={p} className={`provider-chip${music?.kind === 'preset' && music.preset === p ? ' on' : ''}`} onClick={() => changeMusic({ preset: p })}>
                {t(`music.${p}`)}
              </button>
            ))}
            {music?.kind === 'preset' && !PRESETS.includes(music.preset as (typeof PRESETS)[number]) && (
              <button className="provider-chip on">{t('music.custom')}</button>
            )}
            <button className={`provider-chip${music?.kind === 'file' ? ' on' : ''}`} onClick={chooseFile} title={music?.name}>
              <Icon name="folder" size={12} /> {music?.kind === 'file' ? music.name : t('music.file')}
            </button>
          </div>
          {music && music.kind !== 'none' && (
            <label className="volume">
              <Icon name="volume" size={14} />
              <input type="range" min={0} max={1.5} step={0.05} defaultValue={music.gain} key={`${music.kind}-${music.preset ?? music.name}`}
                onChange={e => e.currentTarget.parentElement?.setAttribute('data-value', e.currentTarget.value)}
                onPointerUp={e => changeMusic({ gain: Number(e.currentTarget.value) })}
                onKeyUp={e => changeMusic({ gain: Number(e.currentTarget.value) })} aria-label={t('music.volume')} />
            </label>
          )}
          <p className="hint">{t('music.hint')}</p>
        </section>
      </fieldset>

      {exporting
        ? (
          <div className="export-progress" role="status">
            <div className="row gap"><span className="spinner small" /> <strong>{t('export.exporting')}</strong></div>
            <span className="small muted">{step}</span>
            <div className="bar"><i style={{ width: `${Math.round(Math.min(0.98, fraction) * 100)}%` }} /></div>
            <span className="small muted">{t('export.keepWorking')}</span>
          </div>
        )
        : (
          <>
            <p className="small muted">
              {pending.length
                ? t('export.renders', { n: pending.length, total: project.shots.length, time: formatSeconds(time), ids: pending.map(s => s.id).join(', ') })
                : t('export.allCached', { total: project.shots.length, mode: t(`mode.${mode}`) })}
            </p>
            <button className="primary wide" onClick={run} disabled={!aspects.length}>
              <Icon name="export" size={14} /> {t('export.button', { mode: t(`mode.${mode}`) })}
            </button>
          </>
        )}
      {exportJob?.state === 'failed' && <pre className="error-box small">{exportJob.error}</pre>}

      {latest && !exporting && (
        <div className="latest">
          <h3>{t('export.latest')} <span className="muted small">{t(`mode.${latest.mode}`)} · {latest.at}</span></h3>
          <div className="latest-files">
            {latest.films.map(f => (
              <div key={f.file} className="latest-file">
                <span className={`aspect-shape small a${f.aspect.replace(':', '')}`} />
                <strong>{f.aspect}</strong>
                <span className="spacer" />
                <button className="small" onClick={() => api.openPath(f.file)}><Icon name="play" size={12} /> {t('export.open')}</button>
                <button className="small ghost" onClick={() => api.reveal(f.file)}>{t('export.show')}</button>
              </div>
            ))}
          </div>
          {latest.cover && (
            <img className="cover" src={fileUrl(latest.cover)} alt={t('export.cover')} onClick={() => api.openPath(latest.cover!)} />
          )}
        </div>
      )}

      <section className="publish-section">
        <h3>{t('export.publish')}</h3>
        <p className="hint">{t('export.publishNote')}</p>
        <button
          onClick={() => api.enqueue({ kind: 'publish', project: project.root })}
          disabled={publishJob?.state === 'running' || publishJob?.state === 'queued'}
        >
          {publishJob?.state === 'running' || publishJob?.state === 'queued' ? <span className="spinner small" /> : <Icon name="spark" size={13} />}
          {' '}{publishJob?.state === 'running' ? t('export.writing') : t(publish ? 'export.rewrite' : 'export.write')}
        </button>
        {publishJob?.state === 'failed' && (
          <div className="error-box small">
            {agentError(publishJob.error).text}
            {agentError(publishJob.error).setup && <button className="small" onClick={openSettings}>{t('agent.openSettings')}</button>}
          </div>
        )}
        {publish && <PublishCards text={publish} />}
      </section>
    </div>
  )
}

// publish.md as cards: one per platform ("## Platform"), each copyable
// block (a fenced code block) with its label and a Copy button
function PublishCards({ text }: { text: string }) {
  const sections = text.split(/^## /m).slice(1).map(chunk => {
    const [name, ...rest] = chunk.split('\n')
    const blocks: { label: string; body: string }[] = []
    const lines = rest
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('```')) {
        const start = i + 1
        let end = start
        while (end < lines.length && !lines[end].startsWith('```')) end++
        let j = i - 1
        while (j >= 0 && !lines[j].trim()) j--
        const label = j >= 0 ? lines[j].replace(/[:：]\s*$/, '').replace(/\(.*?\)/g, '').trim() : ''
        blocks.push({ label, body: lines.slice(start, end).join('\n').trim() })
        i = end
      }
    }
    return { name: name.trim(), blocks }
  }).filter(s => s.blocks.length)
  if (!sections.length) return <pre className="publish">{text}</pre>
  return (
    <div className="publish-cards">
      {sections.map(s => (
        <div key={s.name} className="publish-card">
          <strong>{s.name}</strong>
          {s.blocks.map((b, i) => <CopyBlock key={i} label={b.label} body={b.body} />)}
        </div>
      ))}
    </div>
  )
}

function CopyBlock({ label, body }: { label: string; body: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="copy-block">
      <div className="row between">
        <span className="small muted">{label}</span>
        <button className="small ghost" onClick={() => {
          navigator.clipboard?.writeText(body)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}>
          <Icon name={copied ? 'check' : 'copy'} size={12} /> {t(copied ? 'export.copied' : 'export.copy')}
        </button>
      </div>
      <p>{body}</p>
    </div>
  )
}

const SAMPLE_PRESETS = [
  { n: 16, label: 'samples.fast' },
  { n: 24, label: 'samples.standard' },
  { n: 64, label: 'samples.fine' }
] as const

// 3D final quality, for those who want it: EEVEE samples per frame. More
// cleans up glossy reflections and fast motion, at more time a frame
function Samples({ project, refresh }: { project: Project; refresh: () => void }) {
  const current = project.samples ?? 24
  const preset = SAMPLE_PRESETS.some(p => p.n === current)
  const [custom, setCustom] = useState(!preset)
  const [draft, setDraft] = useState(String(current))
  const set = async (change: { samples?: number; reset?: boolean }) => {
    await api.quality(project.root, change)
    refresh()
  }
  const commit = () => {
    const n = Math.round(Number(draft))
    if (n >= 4 && n <= 512 && n !== current) set({ samples: n })
    else setDraft(String(current))
  }
  return (
    <div className="samples">
      <div className="row between">
        <span className="small">{t('samples.title')}</span>
        <span className="small muted">{t('samples.perFrame', { s: (0.35 + 0.028 * current).toFixed(1) })}</span>
      </div>
      <div className="music-chips">
        {SAMPLE_PRESETS.map(p => (
          <button key={p.n} className={`provider-chip${!custom && current === p.n ? ' on' : ''}`}
            onClick={() => { setCustom(false); setDraft(String(p.n)); set(p.n === 24 ? { reset: true } : { samples: p.n }) }}>
            {t(p.label)} <span className="muted">{p.n}</span>
          </button>
        ))}
        {custom
          ? (
            <label className="provider-chip on samples-input">
              <input type="number" min={4} max={512} step={1} value={draft} autoFocus aria-label={t('samples.title')}
                onChange={e => setDraft(e.target.value)} onBlur={commit}
                onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
            </label>
          )
          : <button className="provider-chip" onClick={() => setCustom(true)}>{t('samples.custom')}</button>}
      </div>
      <p className="hint">{t('samples.hint')}</p>
    </div>
  )
}
