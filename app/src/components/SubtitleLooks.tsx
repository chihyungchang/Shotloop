import { useEffect, useMemo, useRef, useState } from 'react'
import { spacesWords, SUBTITLE_STYLES, subtitleRules } from '../../../engine/shotloop/data.mjs'
import { splitWords, wordsHtml } from '../../../engine/shotloop/voiceover/words.mjs'
import { useDismiss } from '../hooks'
import { lang, t } from '../i18n'
import type { Key } from '../i18n/en'
import { Icon } from './Icon'
import { Tile, useMenuInView } from './LookPicker'

// The voice-over subtitles' looks (engine/shotloop/data.mjs
// SUBTITLE_STYLES), each playing in a small frame with the rules the film
// is burned with: the word being said moves on with a beat

// A look as the swatches read it (spaced: only some looks have it)
type Look = { words: string; pop: number[] | null; spaced?: boolean } | null
const lookOf = (id: string) => (SUBTITLE_STYLES as Record<string, Look>)[id]
const LOOKS = Object.keys(SUBTITLE_STYLES)
const lookName = (id: string) => t(`subs.look.${id}` as Key)

// Every look's rules at the frames' size, under its data-look
const SIZE = 10
const CSS = Object.entries(SUBTITLE_STYLES)
  .map(([id, look]) => (look ? subtitleRules(`.sub-sample[data-look="${id}"]`, look, SIZE) : ''))
  .join('\n')

// A beat while the looks are on screen
function useBeat(on = true) {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setBeat(b => b + 1), 450)
    return () => clearInterval(id)
  }, [on])
  return beat
}

// A look for spaced words shows English words when the interface's
// language doesn't space them: what such a film's subtitles would be
const SPACED_SAMPLE = 'One word at a time'

// A look over a stand-in picture, on the beat's word: a chunk with that
// word lit, that word alone, or the whole chunk
function SubtitleSample({ look, beat }: { look: string; beat: number }) {
  const l = lookOf(look)
  const english = !!l?.spaced && !spacesWords(lang())
  const sample = english ? SPACED_SAMPLE : t('subs.sample')
  const words = useMemo(() => splitWords(sample, english ? 'en' : lang()), [sample, english])
  const i = beat % words.length
  const html = !l ? '' : l.words === 'follow' ? wordsHtml(words, i) : l.words === 'line' ? wordsHtml(words) : wordsHtml([words[i]], 0)
  return (
    <span className="sub-frame">
      {l && <span className={`sub-sample${l.pop ? ' pops' : ''}`} data-look={look} dangerouslySetInnerHTML={{ __html: html }} />}
    </span>
  )
}

// A look the film's language can't take (one for spaced words in Chinese
// or Japanese): shown, not offered
const unfit = (id: string, spaced: boolean) => !spaced && !!lookOf(id)?.spaced
const fitTitle = (id: string) => (lookOf(id)?.spaced ? t('subs.spacedOnly') : undefined)

// The looks to switch between (the studio's voice-over settings), for a
// film in lang
export function SubtitleLooks({ value, lang: filmLang, disabled, pick }: { value: string; lang: string; disabled?: boolean; pick: (look: string) => void }) {
  const spaced = spacesWords(filmLang)
  const beat = useBeat()
  return (
    <div className="sub-looks" role="radiogroup" aria-label={t('subs.look')}>
      <style>{CSS}</style>
      {LOOKS.map(id => (
        <button key={id} role="radio" aria-checked={id === value} className={`sub-look${id === value ? ' on' : ''}`}
          disabled={disabled || unfit(id, spaced)} title={fitTitle(id)} onClick={() => id !== value && pick(id)}>
          <SubtitleSample look={id} beat={beat} />
          <span className="sub-name">{lookName(id)}</span>
        </button>
      ))}
    </div>
  )
}

// The subtitles' look for a new video: a chip that opens a grid of looks,
// each playing; '' lets the AI pick. spaced: the idea is written in a
// language that spaces its words; disabled: no voice-over to subtitle
export function SubtitlePicker({ value, onChange, spaced, disabled }: { value: string; onChange: (id: string) => void; spaced: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useMenuInView(menu, open)
  useDismiss(ref, open, () => setOpen(false))
  const beat = useBeat(open)
  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }
  return (
    // The why on the wrapper: a disabled button shows no tooltip in WebKit
    <div className="look-picker" ref={ref} title={disabled ? t('subs.needsVoice') : undefined}>
      <button className={`chip-button${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} disabled={disabled}
        title={disabled ? undefined : t('subs.look')}>
        <Icon name={value ? 'subtitles' : 'spark'} size={13} />
        <span>{value ? lookName(value) : t('subs.look')}</span>
        <Icon name="chevron" size={12} />
      </button>
      {open && !disabled && (
        <div className="menu tile-menu" role="menu" ref={menu}>
          <style>{CSS}</style>
          <Tile on={!value} name={t('subs.autoName')} title={t('subs.autoAbout')} onClick={() => pick('')} mosaic={[]} />
          {LOOKS.map(id => (
            <Tile key={id} on={value === id} name={lookName(id)} pic={<SubtitleSample look={id} beat={beat} />} disabled={unfit(id, spaced)}
              title={fitTitle(id)} onClick={() => pick(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
