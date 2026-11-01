import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api, fileUrl, type CoverTemplate, type Job, type Project } from '../../../api'
import { t } from '../../../i18n'
import { activityLine, isActive, sizeText } from '../../../model'
import { readStored, writeStored } from '../../../storage'
import { AgentError } from '../../AgentError'
import { Icon } from '../../Icon'

// The cover is a 9:16 frame at this size, whatever the film's aspect
export const COVER_SIZE = { width: 1080, height: 1920 }

// The cover preview (.shotloop/cover.png) both views show: rendered from
// the cover page when the dialog opens, replaced by each of the AI's
// renders while it designs
export function useCover(project: Project, jobs: Job[]) {
  const job = jobs.filter(j => j.project === project.root && j.kind === 'cover').at(-1)
  const busy = !!job && isActive(job)
  const file = `${project.root}/.shotloop/cover.png`
  const [rendered, setRendered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.coverPreview(project.root).then(() => setRendered(Date.now()), e => setError(String(e)))
  }, [project.root])
  const version = busy ? job.log.length : `${job?.finishedAt ?? 0}-${rendered}`
  return { job, busy, file, error, src: rendered || job ? fileUrl(file, `${job?.id ?? 0}-${version}`) : null }
}

// How the cover was last made, in words ('' when unknown)
export function coverSource(project: Project) {
  const m = project.coverMade
  if (!m) return ''
  if (m.how === 'default') return t('xd.coverDefault')
  if (m.how === 'template') return t('xd.coverTemplate', { name: m.template ?? '' })
  return t(m.how === 'reference' ? 'xd.coverReference' : 'xd.coverFree')
}

type Style = { kind: 'free' } | { kind: 'template'; id: string } | { kind: 'reference' }
type Crop = 'none' | '3:4' | '1:1'
// The share of the 9:16 cover a crop keeps, as top and bottom insets
const CROPS: Record<Exclude<Crop, 'none'>, string> = { '3:4': '12.5%', '1:1': '21.875%' }
const TEMPLATE = 'shotloop.cover.template'

// Editing the cover, inside the export dialog: the cover large on the
// stage with the platforms' crops, and on the side the style (the AI's
// own design, a saved template, or an uploaded image to follow), what to
// change, the background frame and saving it as a template
export function CoverEditor({ project, cover, openSettings }: { project: Project; cover: ReturnType<typeof useCover>; openSettings: () => void }) {
  const { job, busy } = cover
  const [crop, setCrop] = useState<Crop>('3:4')
  const [error, setError] = useState<string | null>(null)

  // Saved templates; the one chosen last is chosen again (the next video
  // of a series starts from it)
  const [templates, setTemplates] = useState<CoverTemplate[]>([])
  const loadTemplates = () => api.coverTemplates().then(setTemplates, e => setError(String(e)))
  useEffect(() => {
    loadTemplates()
  }, [])
  const [style, setStyle] = useState<Style>(() => {
    const id = readStored(TEMPLATE)
    return id ? { kind: 'template', id } : { kind: 'free' }
  })
  const choose = (s: Style) => {
    setStyle(s)
    writeStored(TEMPLATE, s.kind === 'template' ? s.id : null)
  }
  // A template deleted since: back to the AI's own design
  const current: Style = style.kind === 'template' && templates.length && !templates.some(x => x.id === style.id) ? { kind: 'free' } : style

  const [request, setRequest] = useState('')
  const generate = async (s: Style = current) => {
    const r = request.trim()
    setError(null)
    try {
      await api.enqueue({
        kind: 'cover', project: project.root, ...(r ? { request: r } : {}),
        ...(s.kind === 'template' ? { template: s.id } : s.kind === 'reference' ? { reference: true } : {})
      })
      setRequest('')
    } catch (e) {
      setError(String(e))
    }
  }

  // An image to follow: into the project, then designed after at once
  const [reference, setReference] = useState<string | null>(null)
  const fromImage = async () => {
    const file = await pick({ title: t('cover.importDialog'), filters: [{ name: t('filter.image'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
    if (typeof file !== 'string') return
    setError(null)
    try {
      setReference(await api.coverReference(project.root, file))
      choose({ kind: 'reference' })
      generate({ kind: 'reference' })
    } catch (err) {
      setError(String(err))
    }
  }

  const [removing, setRemoving] = useState<string | null>(null)
  const remove = async (id: string) => {
    setRemoving(null)
    setError(null)
    await api.removeCoverTemplate(id).catch(e => setError(String(e)))
    loadTemplates()
  }

  // Saving: a name, then the cover page and its preview into the templates
  const [naming, setNaming] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.saveCoverTemplate(project.root, naming?.trim() || project.title)
      setTemplates(await api.coverTemplates())
      choose({ kind: 'template', id: saved.id })
      setNaming(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const label = current.kind === 'template' ? 'ce.generateTemplate' : current.kind === 'reference' ? 'ce.generateReference' : 'ce.generate'
  const frame = project.coverFrame

  return (
    <div className="ce">
      <div className="ce-stage">
        <div className="ce-view">
          {cover.src && (
            <div className="ce-frame">
              <img src={cover.src} alt={t('export.cover')} />
              {crop !== 'none' && <div className="crop" style={{ top: CROPS[crop], bottom: CROPS[crop] }}><span>{t(crop === '3:4' ? 'ce.crop34' : 'ce.crop11')}</span></div>}
              {busy && <span className="shimmer sweep" />}
            </div>
          )}
        </div>
        <div className="ce-foot">
          {t('ce.crop')}
          {(['none', '3:4', '1:1'] as const).map(c => (
            <button key={c} className={`chip${crop === c ? ' on' : ''}`} aria-pressed={crop === c} onClick={() => setCrop(c)}>
              {c === 'none' ? t('ce.cropNone') : c}
            </button>
          ))}
          <span className="spacer" />
          {sizeText(COVER_SIZE)}
        </div>
      </div>

      <div className="ce-side">
        <h4>{t('ce.style')}</h4>
        <div className="tgrid" role="radiogroup" aria-label={t('ce.style')}>
          <button className={`tcell${current.kind === 'free' ? ' on' : ''}`} role="radio" aria-checked={current.kind === 'free'} onClick={() => choose({ kind: 'free' })}>
            <span className="t"><Icon name="spark" size={18} /></span>{t('ce.free')}
          </button>
          {templates.map(x => {
            const on = current.kind === 'template' && current.id === x.id
            return (
              <div key={x.id} className={`tcell${on ? ' on' : ''}`}>
                <button className="t" role="radio" aria-checked={on} onClick={() => choose({ kind: 'template', id: x.id })}
                  title={x.from ? t('cover.from', { title: x.from }) : x.name}>
                  {x.preview ? <img src={fileUrl(x.preview, x.created ?? undefined)} alt="" /> : <Icon name="image" size={18} />}
                </button>
                <span className="ellipsis" title={x.name}>{x.name}</span>
                {removing === x.id
                  ? <button className="tcell-remove confirm" onClick={() => remove(x.id)}>{t('cover.removeConfirm')}</button>
                  : <button className="tcell-remove" onClick={() => setRemoving(x.id)} title={t('cover.remove')} aria-label={t('cover.remove')}><Icon name="x" size={10} /></button>}
              </div>
            )
          })}
          {reference && (
            <button className={`tcell${current.kind === 'reference' ? ' on' : ''}`} role="radio" aria-checked={current.kind === 'reference'} onClick={() => choose({ kind: 'reference' })}>
              <span className="t"><img src={fileUrl(reference, job?.id ?? 0)} alt="" /></span>{t('ce.reference')}
            </button>
          )}
          <button className="tcell" onClick={fromImage} disabled={busy}>
            <span className="t"><Icon name="image" size={18} /></span>{t('ce.fromImage')}
          </button>
        </div>

        <div className="ask">
          {busy
            ? <span className="small muted ce-status"><span className="spinner small" /> {job!.log.length ? activityLine(job!.log.at(-1)!) : t('cover.designing')}</span>
            : <textarea rows={2} value={request} onChange={e => setRequest(e.target.value)} placeholder={t('cover.ask')} aria-label={t('cover.ask')}
                onKeyDown={e => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && generate()} />}
          <div className="ask-foot">
            {busy
              ? <button className="small ghost" onClick={() => api.cancel(job!.id).catch(e => setError(String(e)))}>{t('queue.stop')}</button>
              : <button className="small primary" onClick={() => generate()}><Icon name="spark" size={12} /> {t(label)}</button>}
          </div>
        </div>
        <AgentError job={job} openSettings={openSettings} />

        <h4>{t('ce.frame')}</h4>
        <p className="small muted ce-frame-line">
          {frame ? t('ce.frameAt', { shot: frame.shot, time: frame.time }) : t('ce.frameNone')}
        </p>

        <div className="ce-save">
          {naming != null
            ? (
              <div className="cover-save">
                <input value={naming} autoFocus onChange={e => setNaming(e.target.value)} placeholder={t('cover.templateName')} aria-label={t('cover.templateName')}
                  onKeyDown={e => (e.key === 'Enter' ? save() : e.key === 'Escape' && (e.stopPropagation(), setNaming(null)))} />
                <button className="small primary" onClick={save} disabled={saving}>{saving ? <span className="spinner small" /> : t('cover.save')}</button>
                <button className="small ghost" onClick={() => setNaming(null)}>{t('plan.cancel')}</button>
              </div>
            )
            : <button className="small ghost" onClick={() => setNaming(project.title)} disabled={busy}>{t('cover.saveTemplate')}</button>}
          {(error ?? cover.error) && <span className="small error">{error ?? cover.error}</span>}
        </div>
      </div>
    </div>
  )
}
