import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useEscape } from '../hooks'
import { lang, t } from '../i18n'
import { installUpdate, useUpdate } from '../update'
import { Icon } from './Icon'

// A new version's notes in a dialog, opened from the sidebar's note or
// Settings → About, with the install there. Mounted once beside the app

let open = false
const listeners = new Set<(o: boolean) => void>()
const set = (o: boolean) => {
  open = o
  listeners.forEach(l => l(o))
}
export const showUpdateNotes = () => set(true)

// A release's notes are written in English, then "---", then Chinese
// (app/scripts/release.mjs): the part in the person's language, without
// the first-launch note an installed app no longer needs
export function notesFor(body: string, uiLang: string) {
  const parts = body.split(/^---$/m).map(p => p.trim()).filter(Boolean)
  const han = (p: string) => (p.match(/\p{Script=Han}/gu) ?? []).length
  const part = uiLang.startsWith('zh') ? parts.reduce((a, b) => (han(b) > han(a) ? b : a), parts[0] ?? '') : parts[0] ?? ''
  return part.split(/\n{2,}/).filter(p => !p.includes('com.apple.quarantine')).join('\n\n')
}

// The few marks the notes use: **bold**, `code`
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((s, i) =>
    s.startsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong>
    : s.startsWith('`') ? <code key={i}>{s.slice(1, -1)}</code>
    : <Fragment key={i}>{s}</Fragment>)
}

// Paragraphs and "- " lists
function Notes({ text }: { text: string }) {
  return (
    <div className="update-notes">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n')
        const items = lines.filter(l => l.startsWith('- '))
        const head = lines.filter(l => !l.startsWith('- ')).join(' ')
        return (
          <Fragment key={i}>
            {head && <p>{inline(head)}</p>}
            {items.length > 0 && <ul>{items.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>}
          </Fragment>
        )
      })}
    </div>
  )
}

export function UpdateDialogHost() {
  const [shown, setShown] = useState(open)
  const u = useUpdate()
  useEffect(() => {
    listeners.add(setShown)
    return () => {
      listeners.delete(setShown)
    }
  }, [])
  const working = u.kind === 'downloading' || u.kind === 'restarting'
  useEscape(() => set(false), shown && !working)
  if (!shown || (u.kind !== 'available' && u.kind !== 'busy' && !working)) return null
  const pct = u.kind === 'downloading' && u.total ? Math.round((u.done / u.total) * 100) : null
  return (
    <div className="dialog-backdrop" onClick={e => e.target === e.currentTarget && !working && set(false)}>
      <div className="dialog column update-dialog" role="dialog" aria-label={t('update.title')}>
        <strong className="update-dialog-title"><Icon name="download" size={16} /> {u.kind === 'restarting' ? t('update.restarting') : t('update.available', { v: 'version' in u ? u.version : '' })}</strong>
        {u.kind === 'available' && u.notes && <Notes text={notesFor(u.notes, lang())} />}
        {u.kind === 'busy' && <p className="warn-note small">{t('update.busy')}</p>}
        {working && (
          <div className="update-progress">
            <div className="update-progress-bar" style={{ width: `${u.kind === 'restarting' ? 100 : pct ?? 0}%` }} />
          </div>
        )}
        <div className="dialog-actions">
          <button className="ghost" onClick={() => set(false)} disabled={working}>{t('update.later')}</button>
          <button className="primary" onClick={installUpdate} disabled={u.kind !== 'available'}>
            {working ? <span className="spinner small" /> : null}
            {u.kind === 'downloading' ? (pct != null ? t('update.downloadingPct', { pct }) : t('update.downloading')) : t('update.installNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
