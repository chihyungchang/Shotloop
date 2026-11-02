import { useEffect, useMemo, useState } from 'react'
import { api, type Job, type Project, type SoundInfo, type TracksResult } from '../../api'
import { useErrorLine } from '../../hooks'
import { t } from '../../i18n'
import type { Key } from '../../i18n/en'
import { isActive } from '../../model'
import { Icon } from '../Icon'
import { PlayButton } from '../PlayButton'
import { Music, Sound, Voice } from './export/parts'

// The tracks to listen to, each alone, and all of them as the film plays
const TRACKS: { id: keyof TracksResult; label: Key }[] = [
  { id: 'mix', label: 'sound.track.mix' },
  { id: 'voice', label: 'voice.title' },
  { id: 'music', label: 'music.title' },
  { id: 'ambience', label: 'sound.ambience' },
  { id: 'effects', label: 'sound.effects' }
]

// The film's sound in one place, beside the stage: made by the AI once the
// shots look right (the effects and the ambience, and a narration when
// asked), then each track to listen to and to change, before any export
export function SoundPanel({ project, jobs, refresh }: { project: Project; jobs: Job[]; refresh: () => void }) {
  const [narrate, setNarrate] = useState(false)
  const [sound, setSound] = useState<SoundInfo | null>(null)
  const { error, setError, guard } = useErrorLine()
  const ours = jobs.filter(j => j.kind === 'sound' && j.project === project.root)
  const running = ours.some(isActive)
  // A finished sound pass, or a change made here, makes new tracks and
  // new settings: both are read again
  const [changes, setChanges] = useState(0)
  const done = ours.filter(j => !isActive(j)).length
  const changed = () => {
    setChanges(n => n + 1)
    refresh()
  }
  useEffect(() => {
    guard(api.sound(project.root)).then(s => s && setSound(s))
  }, [project.root, done, changes, guard])
  // The tracks, made on the first listen (they can take a moment) and kept
  // until something changes
  const tracks = useMemo(() => {
    let made: Promise<TracksResult> | null = null
    return () => (made ??= api.soundTracks(project.root))
  }, [project.root, done, changes])
  const made = !!sound && (sound.cues.length > 0 || !!sound.ambience)

  const start = () => guard(api.enqueue({ kind: 'sound', project: project.root, narrate: narrate || undefined }))
  return (
    <div className="sound-panel">
      <section className="sound-make">
        <p className="small muted">{t('sound.dialogNote')}</p>
        {!project.voiced && (
          <label className="check-inline">
            <input type="checkbox" checked={narrate} onChange={e => setNarrate(e.target.checked)} disabled={running} /> {t('sound.narrate')}
          </label>
        )}
        {!project.voiced && narrate && <p className="small muted">{t('sound.narrateNote')}</p>}
        <button className={made ? '' : 'primary'} onClick={start} disabled={running}>
          {running ? <span className="spinner small" /> : <Icon name="spark" size={13} />} {t(running ? 'sound.running' : made ? 'sound.again' : 'sound.start')}
        </button>
      </section>

      <h3>{t('sound.tracks')}</h3>
      <div className="track-list" key={`${done}-${changes}`}>
        {TRACKS.map(k => <Track key={k.id} label={t(k.label)} file={async () => (await tracks())[k.id]} onError={setError} />)}
      </div>
      {error && <p className="small error">{error}</p>}

      <div className="sound-controls" key={done}>
        <Voice project={project} jobs={jobs} refresh={changed} />
        <Music project={project} refresh={changed} />
        <Sound project={project} refresh={changed} />
      </div>
    </div>
  )
}

// One track: played alone; one the film doesn't have says so once asked
function Track({ label, file, onError }: { label: string; file: () => Promise<string | null>; onError: (e: string) => void }) {
  const [absent, setAbsent] = useState(false)
  const find = async () => {
    const f = await file()
    setAbsent(!f)
    return f
  }
  return (
    <div className={`track${absent ? ' absent' : ''}`}>
      <PlayButton file={find} onError={onError} disabled={absent} />
      <span>{label}</span>
      {absent && <span className="small muted">{t('sound.none')}</span>}
    </div>
  )
}
