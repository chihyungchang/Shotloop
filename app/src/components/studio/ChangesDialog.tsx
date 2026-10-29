import { useEffect } from 'react'
import type { Mode, Project, Shot } from '../../api'
import { t } from '../../i18n'
import type { Key } from '../../i18n/en'
import { estimate, formatEta } from '../../model'
import { Icon } from '../Icon'

const REASON: Record<string, Key> = {
  code: 'changes.code', scene: 'changes.scene', captions: 'changes.captions', timing: 'changes.timing',
  engine: 'changes.engine', unknown: 'changes.unknown', missing: 'changes.missing', failed: 'changes.failed'
}

// Why each shot's frames are out of date in this mode, in words
function reasons(shot: Shot, mode: Mode, failed: boolean): string[] {
  if (failed) return ['failed']
  const e = shot[mode]
  if (e.state === 'missing') return ['missing']
  return e.changed?.length ? e.changed : ['unknown']
}

// Before watching or exporting: the shots whose frames are out of date,
// what changed in each, what updating them costs, and the choices
export function ChangesDialog({ project, shots, mode, failed = [], title, note, actions, close }: {
  project: Project
  shots: Shot[]
  mode: Mode
  failed?: string[]
  title: string
  note: string
  actions: { label: string; onClick: () => void; primary?: boolean; disabled?: boolean; hint?: string }[]
  close: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  const time = shots.reduce((s, x) => s + estimate(project, x, mode), 0)
  const hint = actions.find(a => a.disabled && a.hint)?.hint
  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog changes-dialog" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="row between">
          <strong>{title}</strong>
          <button className="icon-button" onClick={close} aria-label={t('common.close')}><Icon name="x" size={14} /></button>
        </div>
        <p className="muted small">{note}</p>
        <ul className="changes-list">
          {shots.map(s => (
            <li key={s.id}>
              <span className="ellipsis" title={s.title ?? s.id}>{s.id}</span>
              <span className="changes-tags">
                {reasons(s, mode, failed.includes(s.id)).map(r => <span key={r} className={`tag${r === 'failed' ? ' danger' : ''}`}>{t(REASON[r] ?? 'changes.unknown')}</span>)}
              </span>
            </li>
          ))}
        </ul>
        <p className="small muted">{t('changes.time', { n: shots.length, time: formatEta(time) })}</p>
        {hint && <p className="small warn-note">{hint}</p>}
        <div className="dialog-actions">
          {actions.map(a => (
            <button key={a.label} className={a.primary ? 'primary' : 'ghost'} disabled={a.disabled} onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
