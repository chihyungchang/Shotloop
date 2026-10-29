import { useEffect, useState } from 'react'
import { api, relPath, type Project, type Shot } from '../../api'
import { formatDate, t } from '../../i18n'
import { Icon } from '../Icon'

const OPEN = 'shotloop.notes.open'

// Under the filmstrip, like a deck's speaker notes: what the shot must
// show (notes.md) and how it fared against the checklist
export function ShotNotes({ project, shot }: { project: Project; shot: Shot }) {
  const [must, setMust] = useState<string | null>(null)
  const index = project.shots.findIndex(s => s.id === shot.id)

  useEffect(() => {
    api.readText(project.root, relPath(project, shot.notes)).then(
      t => setMust(t.match(/## Must show\s*\n([\s\S]*?)(\n## |$)/)?.[1].trim() ?? null),
      () => setMust(null)
    )
  }, [project, shot.notes, shot.fixes.length])

  const checks = shot.checks
  const passed = checks?.results.filter(r => r.pass).length ?? 0
  const failing = checks ? checks.results.length - passed : 0
  // Folded or open, remembered on this Mac for every shot
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN) !== '0'
    } catch {
      return true
    }
  })
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(OPEN, open ? '0' : '1')
    } catch {
      // storage unavailable: folded for this visit only
    }
  }

  return (
    <div className={`shot-notes${open ? ' open' : ''}`}>
      <button className="notes-bar" onClick={toggle} aria-expanded={open}>
        <Icon name="chevron" size={12} />
        <span>{t('notes.bar', { i: index + 1, n: project.shots.length })}</span>
        {checks
          ? <span className={`check-pill ${failing ? 'bad' : 'ok'}`}>{failing ? t('notes.failing', { n: failing }) : t('notes.allPass', { n: passed })}</span>
          : <span className="muted small">{t('notes.unchecked')}</span>}
        {checks && <span className="muted small notes-when">{formatDate(checks.at, { dateStyle: 'short', timeStyle: 'short' })}</span>}
      </button>
      {open && (
        <div className="notes-body">
          <div className="notes-col">
            <span className="section-label">{t('notes.must')}</span>
            <p className="small">{must || <span className="muted">{t('notes.empty')}</span>}</p>
          </div>
          <div className="notes-col">
            <span className="section-label">{t('notes.checks')}</span>
            {checks ? (
              <ul className="check-list">
                {checks.results.map(r => (
                  <li key={r.rule} className={r.pass ? 'pass' : 'fail'}>
                    <span className="dot" />
                    <span className="check-text"><code>{r.rule}</code> <span className="muted">{r.note}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">{t('notes.notChecked')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
