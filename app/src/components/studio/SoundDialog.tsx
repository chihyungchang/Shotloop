import { useState } from 'react'
import { api, type Project, type SoundInfo, type SoundPart } from '../../api'
import { useErrorLine, useEscape } from '../../hooks'
import { t } from '../../i18n'
import type { Key } from '../../i18n/en'
import { Icon } from '../Icon'

// The lane each part fills, for its colour
const LANE: Record<SoundPart, string> = { effects: 'effects', ambience: 'ambience', narration: 'voice' }
// Feelings to start a wish from, a click away
const IDEAS: Key[] = ['soundAsk.idea.calm', 'soundAsk.idea.punchy', 'soundAsk.idea.cinematic']

// Before the AI's pass over the film's sound: what it makes (the others
// stay as they are), what each part has now, and a wish in the person's
// words. Narration only for a film without a voice-over
export function SoundDialog({ project, sound, ambienceName, close }: {
  project: Project
  sound: SoundInfo | null
  ambienceName: (a: string | null | undefined) => string
  close: () => void
}) {
  useEscape(close)
  const parts: SoundPart[] = project.voiced ? ['effects', 'ambience'] : ['effects', 'ambience', 'narration']
  const [chosen, setChosen] = useState<SoundPart[]>(['effects', 'ambience'])
  const [request, setRequest] = useState('')
  const { error, guard } = useErrorLine()
  // What each part has now (null: nothing yet)
  const now: Record<SoundPart, string | null> = {
    effects: sound?.cues.length ? t('soundAsk.hasEffects', { n: sound.cues.length }) : null,
    ambience: sound?.ambience ? ambienceName(sound.ambience) : null,
    narration: null
  }
  const replaces = chosen.some(p => now[p])
  const toggle = (p: SoundPart) => setChosen(c => (c.includes(p) ? c.filter(x => x !== p) : [...c, p]))
  const idea = (k: Key) => setRequest(r => (r.trim() ? `${r.trim()}, ${t(k)}` : t(k)))
  const start = async () => {
    const id = await guard(api.enqueue({ kind: 'sound', project: project.root, parts: parts.filter(p => chosen.includes(p)), request: request.trim() || undefined }))
    if (id != null) close()
  }
  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog column sound-ask" role="dialog" aria-label={t('audio.make')} onClick={e => e.stopPropagation()}>
        <div className="row between">
          <div className="sound-ask-title">
            <strong>{t('audio.make')}</strong>
            <span className="small muted">{t('audio.whole')} · {t('common.shots', { n: project.shots.length })}</span>
          </div>
          <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" size={14} /></button>
        </div>
        <div className="sound-ask-parts">
          {parts.map(p => (
            <label key={p} className={`sound-ask-part lane-${LANE[p]}${chosen.includes(p) ? ' on' : ''}`}>
              <input type="checkbox" checked={chosen.includes(p)} onChange={() => toggle(p)} />
              <span className="sound-ask-text">
                <span className="sound-ask-name">{t(`soundAsk.${p}` as Key)}</span>
                <span className="small muted">{t(`soundAsk.${p}Note` as Key)}</span>
              </span>
              <span className={`tag${now[p] ? '' : ' faint'}`}>{now[p] ?? t('soundAsk.none')}</span>
            </label>
          ))}
        </div>
        {replaces && <p className="small muted sound-ask-note"><Icon name="info" size={12} /> {t('soundAsk.replace')}</p>}
        <div className="sound-ask-wish">
          <span className="small sound-ask-label">{t('soundAsk.wishLabel')}</span>
          <textarea rows={2} value={request} onChange={e => setRequest(e.target.value)} placeholder={t('soundAsk.wish')} aria-label={t('soundAsk.wishLabel')} />
          <div className="chips">
            {IDEAS.map(k => <button key={k} className="sound-ask-idea" onClick={() => idea(k)}><Icon name="plus" size={10} /> {t(k)}</button>)}
          </div>
        </div>
        {error && <p className="small error">{error}</p>}
        <div className="dialog-actions sound-ask-foot">
          <span className="small muted">{t('soundAsk.background')}</span>
          <button className="ghost" onClick={close}>{t('common.cancel')}</button>
          <button className="primary" disabled={!chosen.length} onClick={start}><Icon name="spark" size={12} /> {t('soundAsk.start')}</button>
        </div>
      </div>
    </div>
  )
}
