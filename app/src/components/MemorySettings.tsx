import { useCallback, useEffect, useState } from 'react'
import { api, type Memory } from '../api'
import { lang, t } from '../i18n'
import { useErrorLine } from '../hooks'
import { Icon } from './Icon'
import { ErrorText } from './ErrorDialog'

// Settings → Memory: what every AI task reads. The person's own notes,
// which they write here, and the lessons the AI kept while building; any
// of them can be deleted
export function MemorySettings() {
  const [list, setList] = useState<Memory[] | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const { error, guard } = useErrorLine()
  const load = useCallback(() => {
    guard(api.memory()).then(l => l && setList(l))
  }, [guard])
  useEffect(load, [load])

  const add = async () => {
    setAdding(true)
    if (await guard(api.addMemory(draft))) {
      setDraft('')
      load()
    }
    setAdding(false)
  }
  const remove = async (id: string) => {
    await guard(api.removeMemory(id))
    load()
  }

  const mine = list?.filter(m => m.by === 'user') ?? []
  const learned = list?.filter(m => m.by === 'ai') ?? []
  return (
    <section className="settings-block">
      <h3>{t('settings.memory')}</h3>
      <p className="hint">{t('memory.intro')}</p>
      <ErrorText error={error} className="error small" />
      <div className="memory-add">
        <textarea rows={2} value={draft} placeholder={t('memory.placeholder')} onChange={e => setDraft(e.target.value)} />
        <button className="primary" onClick={add} disabled={!draft.trim() || adding}>
          {adding ? <span className="spinner small" /> : <Icon name="plus" size={13} />} {t('memory.add')}
        </button>
      </div>
      {!list ? <p className="muted">{t('common.loading')}</p> : (
        <>
          <h4>{t('memory.mine')} <span className="muted">{mine.length}</span></h4>
          {mine.length ? mine.map(m => <Row key={m.id} m={m} remove={remove} />) : <p className="hint">{t('memory.emptyMine')}</p>}
          <h4>{t('memory.learned')} <span className="muted">{learned.length}</span></h4>
          <p className="hint">{t('memory.learnedNote')}</p>
          {learned.length ? learned.map(m => <Row key={m.id} m={m} remove={remove} />) : <p className="hint">{t('memory.emptyLearned')}</p>}
        </>
      )}
    </section>
  )
}

function Row({ m, remove }: { m: Memory; remove: (id: string) => void }) {
  const when = m.created ? new Date(m.created).toLocaleDateString(lang()) : null
  // A note of the person's is for every video; a lesson says which
  const scope = m.by === 'ai' && (m.track === 'all' ? t('memory.all') : m.track.toUpperCase())
  return (
    <div className="pref-row boxed memory-row">
      <div>
        <p>{m.text}</p>
        <p className="hint memory-meta">
          {scope && <span className="tag">{scope}</span>}
          {[m.from && t('memory.from', { title: m.from }), when].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button className="icon-button" onClick={() => remove(m.id)} title={t('memory.delete')} aria-label={t('memory.delete')}>
        <Icon name="trash" size={14} />
      </button>
    </div>
  )
}
