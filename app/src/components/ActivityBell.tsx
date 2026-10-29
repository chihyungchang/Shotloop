import { useEffect, useRef, useState } from 'react'
import { SAVED } from '../ai/useSettings'
import { api, type Job, type Settings } from '../api'
import { t } from '../i18n'
import { jobLabel } from '../model'
import { Icon } from './Icon'

// The sidebar's bell: a quiet ring and a count while jobs run; it opens
// the running and queued jobs, and the completion alerts switch
export function ActivityBell({ jobs, settings }: { jobs: Job[]; settings: Settings }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = jobs.filter(j => j.state === 'running' || j.state === 'queued')
  const alerts = settings.notifySound || settings.notifyDesktop

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const setAlerts = async (on: boolean) => {
    await api.saveSettings({ ...settings, notifySound: on, notifyDesktop: on })
    window.dispatchEvent(new Event(SAVED))
  }

  return (
    <div className="activity" ref={ref}>
      <button className={`icon-button bell${active.length ? ' busy' : ''}${open ? ' on' : ''}`} onClick={() => setOpen(!open)}
        aria-expanded={open} aria-label={t('activity.title')}
        title={active.length ? t('sidebar.queue', { n: active.length }) : t('activity.title')}>
        {active.length > 0 && <span className="bell-ring" aria-hidden />}
        <Icon name={alerts ? 'bellOn' : 'bell'} size={17} />
        {active.length > 0 && <span className="bell-count">{active.length}</span>}
      </button>
      {open && (
        <div className="activity-pop" role="dialog" aria-label={t('activity.title')}>
          <strong>{active.length ? t('sidebar.queue', { n: active.length }) : t('activity.idle')}</strong>
          {active.length > 0 && (
            <ul className="activity-jobs">
              {active.slice(0, 6).map(j => {
                const p = j.progress
                return (
                  <li key={j.id}>
                    <span className="ellipsis">{jobLabel(j)}</span>
                    {j.state === 'running'
                      ? <span className="bar"><i style={{ width: `${p ? (p.done / Math.max(1, p.total)) * 100 : 8}%` }} /></span>
                      : <span className="small muted">{t('queue.waiting')}</span>}
                  </li>
                )
              })}
              {active.length > 6 && <li className="small muted">{t('activity.more', { n: active.length - 6 })}</li>}
            </ul>
          )}
          <label className="activity-alerts">
            <span>
              <strong>{t('settings.alerts')}</strong>
              <span className="small muted">{t('activity.alertsNote')}</span>
            </span>
            <input type="checkbox" className="switch" checked={alerts} onChange={e => setAlerts(e.target.checked)} />
          </label>
        </div>
      )}
    </div>
  )
}
