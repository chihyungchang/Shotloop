import { useEffect, useState } from 'react'
import { api, relPath, type Project, type Shot } from '../../api'

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
  return (
    <div className="shot-notes">
      <div className="notes-col">
        <span className="section-label">Shot {index + 1} / {project.shots.length} · must show</span>
        <p className="small">{must || <span className="muted">Nothing written yet (notes.md).</span>}</p>
      </div>
      <div className="notes-col">
        <span className="section-label">
          Checks{checks ? ` · ${new Date(checks.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : ''}
        </span>
        {checks ? (
          <ul className="check-list">
            {checks.results.map(r => (
              <li key={r.rule} className={r.pass ? 'pass' : 'fail'} title={r.note}>
                <span className="dot" /> <code>{r.rule}</code> <span className="muted ellipsis">{r.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Not checked yet. Run checks from the agent panel.</p>
        )}
      </div>
    </div>
  )
}
