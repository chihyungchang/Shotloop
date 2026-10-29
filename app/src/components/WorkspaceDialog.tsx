import { open as pick } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { t } from '../i18n'
import { Icon } from './Icon'

// The first time a project needs a home: a folder of the person's choice,
// or, if they skip it, ~/Documents/Shotloop. Either way it is remembered.
export function WorkspaceDialog({ done }: { done: (dir: string) => void }) {
  const [fallback, setFallback] = useState<string | null>(null)
  useEffect(() => {
    api.defaultWorkspace().then(setFallback, () => setFallback(null))
  }, [])
  const useDefault = () => fallback && done(fallback)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useDefault()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const choose = async () => {
    const dir = await pick({ directory: true, title: t('home.dialog.folder') })
    if (typeof dir === 'string') done(dir)
  }
  return (
    <div className="dialog-backdrop">
      <div className="dialog workspace-dialog" role="dialog" aria-label={t('workspace.title')}>
        <span className="workspace-icon"><Icon name="folder" size={20} /></span>
        <strong>{t('workspace.title')}</strong>
        <p className="muted small">{t('workspace.note')}</p>
        {fallback && <code className="small workspace-path">{fallback.replace(/^\/Users\/[^/]+/, '~')}</code>}
        <div className="dialog-actions">
          <button className="ghost" onClick={useDefault} disabled={!fallback}>{t('workspace.default')}</button>
          <button className="primary" onClick={choose}>{t('workspace.choose')}</button>
        </div>
      </div>
    </div>
  )
}

// Leaving a draft: save it into the workspace, or throw it away
export function LeaveDraftDialog({ busy, save, discard, cancel }: { busy: boolean; save: () => void; discard: () => void; cancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])
  return (
    <div className="dialog-backdrop" onClick={cancel}>
      <div className="dialog workspace-dialog" role="dialog" aria-label={t('draft.leaveTitle')} onClick={e => e.stopPropagation()}>
        <strong>{t('draft.leaveTitle')}</strong>
        <p className="muted small">{t('draft.leaveNote')}</p>
        <div className="dialog-actions">
          <button className="ghost danger-text" onClick={discard} disabled={busy}>{t('draft.discard')}</button>
          <button className="primary" onClick={save} disabled={busy}>{busy ? <span className="spinner small" /> : null} {t('draft.save')}</button>
        </div>
      </div>
    </div>
  )
}
