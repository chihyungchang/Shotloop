// A shot's voice-over as its code sees it (render2d's ctx.voice) and as
// its cache key counts it: one { text, at, end } per sentence, shot-local
// seconds, from shotloop.json (voice.mjs fitVoice writes the cues). Kept
// apart from voice.mjs so the renderers, the cache and the subtitle check
// need nothing else (no speech engine, no model).

// Where the subtitles sit, as fractions of the frame's height (the
// subtitle layer, subtitles.mjs, and the agent's rules read it here)
export const SUBTITLE_BAND = { portrait: [0.68, 0.79], landscape: [0.72, 0.84] }

// The picture comes first: a line starts VOICE_LEAD into its shot, and the
// cut waits VOICE_TAIL after it ends (voice.mjs fits shots with them; the
// agent plans durations with them)
export const VOICE_LEAD = 0.2
export const VOICE_TAIL = 0.45

// The language spoken (and written in the subtitles): the project's, else
// read from its lines
export function voiceLang(project) {
  if (project.config.lang) return project.config.lang
  const text = project.shots.map(s => s.say ?? '').join(' ')
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja'
  if (/\p{Script=Hangul}/u.test(text)) return 'ko'
  if (/\p{Script=Han}/u.test(text)) return 'zh-CN'
  if (/\p{Script=Cyrillic}/u.test(text)) return 'ru'
  return 'en'
}

// The voice-over plays: switched on, and at least one shot has a line
export const voiceOn = project => !!project.config.voice?.on && project.shots.some(s => s.say?.trim())

// Short words with a stop that don't end a sentence (U.S., Dr., e.g.)
const ABBREVIATION = /(?:\b[A-Z]|\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|approx|No))\.$/

// A line's sentences: a stop followed by a space (so 2.6 stays one
// number, and U.S. one word), or a CJK stop, or a new line
export function sentences(text) {
  const out = []
  for (const part of String(text ?? '').split(/(?<=[.!?…])\s+|(?<=[。！？])\s*|\n+/u)) {
    const s = part.trim()
    if (out.length && ABBREVIATION.test(out.at(-1))) out[out.length - 1] += ` ${s}`
    else out.push(s)
  }
  return out.filter(s => /[\p{L}\p{N}]/u.test(s))
}

export function voiceCues(project, shot) {
  if (!project.config.voice?.on || !shot.cues?.length) return []
  const texts = sentences(shot.say)
  if (texts.length !== shot.cues.length) return []
  return shot.cues.map((c, i) => ({ text: texts[i], at: c.at, end: c.end }))
}

// Every timed sentence of the film: { shot, text, at, end } in film seconds
export const timedLines = project => project.shots.flatMap(s =>
  voiceCues(project, s).map(c => ({ shot: s.id, text: c.text, at: s.start + c.at, end: s.start + c.end })))
