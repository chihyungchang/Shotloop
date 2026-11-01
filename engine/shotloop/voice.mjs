// The voice-over: what each shot says (shotloop.json shots[].say), spoken
// on this Mac (voice/, Kokoro or Supertonic) and laid on the film's
// timeline. The voice leads the cut: a shot lasts as long as its line
// needs (fitVoice), and its timing is written into shotloop.json
// (shots[].cues, shot-local seconds per sentence), so renders, cache keys
// and subtitles read it without speaking again.
//
//   shotloop.json  "voice": { "on": true, "voice": "af_heart", "speed": 1, "gain": 1 }
//                  "lang": "en"                    the language spoken
//                  shots[].say                     the shot's line
//                  shots[].cues                    [{ at, end }] per sentence (fitVoice)
//
//   .shotloop/voice/<key>.wav|json   one spoken sentence, trimmed, cached by
//                                    text, language, voice and speed

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { wav } from '../video/music.mjs'
import { readJson, writeJson } from './files.mjs'
import { emit, ffmpeg, progress } from './compose.mjs'
import { sentences, voiceOn } from './cues.mjs'
import { loadProject, updateConfig } from './project.mjs'
import { isStarter } from './storyboard.mjs'
import { dressClips } from './subtitles.mjs'

// The picture comes first: a line starts this far into its shot, and the
// cut waits this long after it ends
const LEAD = 0.2
const TAIL = 0.45
// Between two sentences of one shot
const GAP = 0.25
// How much faster a line may be spoken to keep a built shot's length
const MAX_SPEEDUP = 1.08
// A shot with a line lasts at least this long
const MIN_SHOT = 1.5

// Bump when a change should speak every line again
const VOICE_VERSION = 1

const HERE = path.dirname(fileURLToPath(import.meta.url))
// The voice package sits next to the engine, in the repository as in the app
const VOICE_PKG = path.resolve(HERE, '..', '..', 'voice', 'src', 'index.mjs')

let pkg = null
async function voicePackage() {
  if (!pkg) {
    if (!fs.existsSync(VOICE_PKG)) throw new Error('the voice-over is not installed (voice/)')
    pkg = await import(VOICE_PKG)
  }
  return pkg
}

const round2 = x => Math.round(x * 100) / 100
const ceil1 = x => Math.ceil(x * 10 - 1e-6) / 10

// The language spoken: the project's, else read from its lines
export function voiceLang(project) {
  if (project.config.lang) return project.config.lang
  const text = project.shots.map(s => s.say ?? '').join(' ')
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja'
  if (/\p{Script=Hangul}/u.test(text)) return 'ko'
  if (/\p{Script=Han}/u.test(text)) return 'zh-CN'
  if (/\p{Script=Cyrillic}/u.test(text)) return 'ru'
  return 'en'
}

const voiceConfig = project => project.config.voice ?? null

// The chosen voice when it speaks the language, else the language's first
const voiceFor = (v, cfg, lang) => (cfg?.voice && v.voicesFor(lang).some(x => x.id === cfg.voice) ? cfg.voice : v.defaultVoice(lang))

const lineKey = (text, lang, voice, speed) => createHash('sha256')
  .update(JSON.stringify([VOICE_VERSION, lang, voice, Math.round(speed * 1000), text])).digest('hex').slice(0, 16)

// A model download's progress, as MB a step: progress events for the
// app's queue bar (the last step once the model is unpacked in place)
function downloadTicker(stage, bytes) {
  const total = Math.round(bytes / 1e6)
  const tick = progress({ stage }, total)
  let last = -1
  return done => {
    const mb = Math.min(Math.floor(done / 1e6), done >= bytes ? total : total - 1)
    if (mb !== last) tick((last = mb))
  }
}

// The speech without the silence the model leaves around it (a little
// air kept, so no word is clipped)
function trim(samples, rate) {
  const loud = x => Math.abs(x) > 0.012
  let a = samples.findIndex(loud)
  if (a < 0) return samples.subarray(0, 0)
  let b = samples.findLastIndex(loud)
  const pad = Math.round(0.03 * rate)
  return samples.subarray(Math.max(0, a - pad), Math.min(samples.length, b + pad))
}

const voiceDir = project => path.join(project.state, 'voice')

// One sentence spoken (cached): { file, duration }
export async function speak(project, text, { lang, voice, speed = 1 }) {
  const key = lineKey(text, lang, voice, speed)
  const file = path.join(voiceDir(project), `${key}.wav`)
  const meta = readJson(path.join(voiceDir(project), `${key}.json`), null)
  if (meta && fs.existsSync(file)) return { file, duration: meta.duration }
  const v = await voicePackage()
  // The model downloads here only when nothing fetched it first (the app
  // queues the download as a job of its own)
  let tick = null
  const out = await v.synthesize(text, {
    lang, voice, speed,
    onProgress: (done, total) => {
      if (!tick) emit({ type: 'log', message: 'downloading the voice model (once)' })
      tick ??= downloadTicker('voice-model', total)
      tick(done)
    }
  })
  const samples = trim(out.samples, out.sampleRate)
  fs.mkdirSync(voiceDir(project), { recursive: true })
  fs.writeFileSync(`${file}.${process.pid}`, wav({ L: samples, rate: out.sampleRate }))
  fs.renameSync(`${file}.${process.pid}`, file)
  const duration = samples.length / out.sampleRate
  writeJson(path.join(voiceDir(project), `${key}.json`), { text, lang, voice, speed, duration, sampleRate: out.sampleRate })
  return { file, duration }
}

// A shot's line spoken at a speed: its sentences and their length
async function speakShot(project, shot, opts) {
  const parts = []
  for (const text of sentences(shot.say)) parts.push({ text, ...(await speak(project, text, opts)) })
  const speech = parts.reduce((t, p) => t + p.duration, 0) + GAP * Math.max(0, parts.length - 1)
  return { parts, speech }
}

// Sentences laid out from LEAD on, GAP apart
function cuesOf(parts) {
  let t = LEAD
  return parts.map(p => {
    const cue = { at: round2(t), end: round2(t + p.duration) }
    t += p.duration + GAP
    return cue
  })
}

// Speaks every line and fits the shots to them, written to shotloop.json:
// a shot gets the time its line needs. A shot not built yet (its starter
// code) lasts exactly what its line needs; a built one keeps its length
// when its line fits, a line up to 8% too long is spoken faster, and only
// a longer one makes the shot longer. Returns the changes, and the words
// the voice would drop (English names it can't read), for the person.
export async function fitVoice(project) {
  const cfg = voiceConfig(project)
  if (!cfg?.on) throw new Error('the voice-over is off for this project')
  const v = await voicePackage()
  const lang = voiceLang(project)
  if (!v.speaks(lang)) throw new Error(`no voice for the language "${lang}"`)
  const voice = voiceFor(v, cfg, lang)
  const base = cfg.speed ?? 1
  const spoken = project.shots.filter(s => s.say?.trim())
  const tick = progress({ stage: 'voice' }, spoken.length)
  tick(0)
  const changes = []
  const unspoken = []
  let n = 0
  // What the fit sets, per shot: its length and its line's timing (a shot
  // without a line loses any timing it had)
  const fitted = new Map()
  for (const shot of project.shots) {
    if (!shot.say?.trim()) {
      fitted.set(shot.id, { say: shot.say, fit: { duration: shot.duration } })
      continue
    }
    const words = v.unspoken(shot.say, lang)
    if (words.length) {
      unspoken.push({ shot: shot.id, words })
      emit({ type: 'log', message: `${shot.id}: the voice can't say ${words.join(', ')}; respell them as they sound` })
    }
    let { parts, speech } = await speakShot(project, shot, { lang, voice, speed: base })
    const fits = sp => LEAD + sp + TAIL <= duration + 1e-6
    let duration = shot.duration
    let speed = base
    const free = !fs.existsSync(shot.code) || isStarter(shot.code)
    if (free) duration = Math.max(MIN_SHOT, ceil1(LEAD + speech + TAIL))
    else if (!fits(speech)) {
      // Faster, a little, rather than a longer built shot; if the faster
      // line still doesn't fit (speed isn't linear), the shot grows
      const room = duration - LEAD - TAIL
      if (speech / MAX_SPEEDUP <= room) {
        speed = round2(base * Math.min(MAX_SPEEDUP, speech / room) + 0.005)
        ;({ parts, speech } = await speakShot(project, shot, { lang, voice, speed }))
      }
      if (!fits(speech)) duration = Math.max(MIN_SHOT, ceil1(LEAD + speech + TAIL))
    }
    if (duration !== shot.duration) changes.push({ shot: shot.id, from: shot.duration, to: duration })
    fitted.set(shot.id, { say: shot.say, fit: { duration, cues: cuesOf(parts), ...(speed !== base ? { sayFast: speed } : {}) } })
    tick(++n)
  }
  // Into shotloop.json as it is now: speaking took a while, and a shot
  // whose line changed meanwhile keeps what it has (the next fit times it)
  const { shots } = updateConfig(project.root, c => ({
    ...c, lang, voice: { ...c.voice, voice },
    shots: c.shots.map(s => {
      const f = fitted.get(s.id)
      if (!f || f.say !== s.say) return s
      const { cues, sayFast, ...rest } = s
      return { ...rest, ...f.fit }
    })
  }))
  syncStoryboard(project.root, shots)
  return { lang, voice, changes, unspoken, duration: round2(shots.reduce((t, s) => t + s.duration, 0)) }
}

// The plan page shows storyboard.json: its durations follow the fit
function syncStoryboard(root, shots) {
  const file = path.join(root, 'storyboard.json')
  const sb = readJson(file, null)
  if (!sb?.shots || sb.shots.length !== shots.length) return
  sb.shots = sb.shots.map((s, i) => ({ ...s, duration: shots[i].duration, say: shots[i].say ?? s.say }))
  writeJson(file, sb)
}

// Every sentence of the film on its timeline: { shot, text, at, end, file }
// (film seconds). Lines not spoken yet are spoken now; a shot whose
// cues are missing or don't match its sentences is laid out on the spot
export async function voiceLines(project) {
  const cfg = voiceConfig(project)
  const lang = voiceLang(project)
  const v = await voicePackage()
  const voice = voiceFor(v, cfg, lang)
  const out = []
  for (const shot of project.shots) {
    const texts = sentences(shot.say)
    if (!texts.length) continue
    const speed = shot.sayFast ?? cfg.speed ?? 1
    const parts = []
    for (const text of texts) parts.push({ text, ...(await speak(project, text, { lang, voice, speed })) })
    const cues = shot.cues?.length === parts.length ? shot.cues : cuesOf(parts)
    parts.forEach((p, i) => out.push({ shot: shot.id, text: p.text, at: shot.start + cues[i].at, end: shot.start + cues[i].at + p.duration, file: p.file }))
  }
  return out
}

// The voice track's identity: its lines and their places
const trackKey = (project, lines) => createHash('sha256')
  .update(JSON.stringify([2, lines.map(l => [path.basename(l.file), l.at]), voiceConfig(project).gain ?? 1, project.duration])).digest('hex').slice(0, 16)

// The voice track of the whole film (44.1 kHz stereo WAV) written to out
async function renderTrack(project, lines, out) {
  const gain = voiceConfig(project).gain ?? 1
  const inputs = lines.flatMap(l => ['-i', l.file])
  const delays = lines.map((l, i) => `[${i}:a]aresample=44100,adelay=${Math.round(l.at * 1000)}:all=1[a${i}]`)
  // At a speech loudness for phones (-16 LUFS), whatever the model's level
  const mix = `${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,volume=${gain},apad,atrim=0:${project.duration},aformat=channel_layouts=stereo[v]`
  await ffmpeg([...inputs, '-filter_complex', [...delays, mix].join(';'), '-map', '[v]', '-ar', '44100', out])
}

// The voice track kept as the film's sound (a film without music), cached
async function voiceTrack(project, lines) {
  const file = path.join(voiceDir(project), 'track', `${trackKey(project, lines)}.wav`)
  if (fs.existsSync(file)) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const part = `${file}.${process.pid}.wav`
  await renderTrack(project, lines, part)
  fs.renameSync(part, file)
  return file
}

// How loud the music sits under a voice-over: a little lower between
// lines, far lower while a line is spoken (about 17 dB under the voice)
const BED_GAIN = 0.5
const BED_UNDER_VOICE = 0.16
// The bed dips this long before a line and comes back this long after
const DUCK_IN = 0.2
const DUCK_OUT = 0.4

// The spans the voice speaks, lines close together joined (so the music
// doesn't swell for a breath between two sentences)
function voicedSpans(lines) {
  const spans = []
  for (const l of [...lines].sort((x, y) => x.at - y.at)) {
    const last = spans.at(-1)
    if (last && l.at - last.end < DUCK_IN + DUCK_OUT + 0.3) last.end = Math.max(last.end, l.end)
    else spans.push({ at: l.at, end: l.end })
  }
  return spans
}

// The bed's volume over the film, as an ffmpeg expression of t
function duckCurve(lines) {
  const ramps = voicedSpans(lines).map(s =>
    `clip((t-${(s.at - DUCK_IN).toFixed(3)})/${DUCK_IN},0,1)*clip((${(s.end + DUCK_OUT).toFixed(3)}-t)/${DUCK_OUT},0,1)`)
  const dip = ramps.reduce((e, r) => (e ? `max(${e},${r})` : r), '')
  return `${BED_GAIN}-${(BED_GAIN - BED_UNDER_VOICE).toFixed(3)}*(${dip || '0'})`
}

// The film's sound: the music ducked under the voice, or the voice alone.
// With music, the voice track is only a step on the way: made, mixed and
// dropped (the mix is what plays and what is cached)
async function soundtrack(project, music, lines) {
  if (!lines.length) return music
  if (!music) return voiceTrack(project, lines)
  const curve = duckCurve(lines)
  const key = createHash('sha256').update(`4:${path.basename(music)}:${trackKey(project, lines)}:${curve}`).digest('hex').slice(0, 16)
  const file = path.join(voiceDir(project), 'mix', `${key}.wav`)
  if (fs.existsSync(file)) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const voice = `${file}.${process.pid}.voice.wav`
  const part = `${file}.${process.pid}.wav`
  try {
    await renderTrack(project, lines, voice)
    // The bed follows the lines' times (not a compressor on the voice's
    // level), so it dips the same for every word and never pumps
    await ffmpeg(['-i', music, '-i', voice, '-filter_complex',
      `[0:a]volume='${curve}':eval=frame[bed];[bed][1:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.9[a]`,
      '-map', '[a]', '-ar', '44100', part])
    fs.renameSync(part, file)
  } finally {
    fs.rmSync(voice, { force: true })
    fs.rmSync(part, { force: true })
  }
  return file
}

// The film as it plays: each shot's clip with its subtitles, and the
// sound (music ducked under the voice). clips: one per shot, in order
// (null for a shot not wanted). strict: a voice-over that fails fails the
// call (an export); else the film plays with its music alone, and says so
export async function withVoice(project, mode, clips, music, { strict = false } = {}) {
  if (!voiceOn(project)) return { clips, audio: music }
  try {
    const lines = await voiceLines(project)
    const { clips: dressed, subs } = await dressClips(project, mode, clips, lines)
    const audio = await soundtrack(project, music, lines)
    // What the film plays now, for pruneVoice to keep
    writeJson(path.join(voiceDir(project), `used-${mode}.json`), [...dressed, audio, subs].filter(Boolean))
    return { clips: dressed, audio }
  } catch (err) {
    if (strict) throw err
    emit({ type: 'log', message: `voice-over left out: ${err.message}` })
    return { clips, audio: music }
  }
}

// The speech models, for Settings: each with its languages, size,
// license and whether it is on this Mac yet; download: fetch one, with
// progress in MB (the app's queue shows it as a bar)
export async function voiceModels({ download } = {}) {
  const v = await voicePackage()
  if (download) {
    if (!v.MODELS[download]) throw new Error(`no speech model "${download}"`)
    await v.ensureModel(download, downloadTicker('download', v.MODELS[download].bytes))
  }
  return {
    dir: v.VOICES_DIR,
    models: Object.entries(v.MODELS).map(([id, m]) => ({
      id, name: m.name, license: m.license, home: m.home, langs: m.langs, bytes: m.bytes, installed: v.installed(id)
    }))
  }
}

// The voice-over's settings, and the voices of the project's language
// (none when no voice speaks it), for the app
export async function voiceInfo(project) {
  const cfg = voiceConfig(project) ?? { on: false }
  const lang = voiceLang(project)
  let voices = []
  let available = false
  let model = null
  let voice = null
  try {
    const v = await voicePackage()
    available = v.speaks(lang)
    voices = v.voicesFor(lang)
    voice = available ? voiceFor(v, cfg, lang) : null
    const e = v.engineFor(lang)
    if (e) model = { id: e.model, name: v.MODELS[e.model].name, bytes: v.MODELS[e.model].bytes, installed: v.installed(e.model) }
  } catch (err) {
    // Without the voice package (a build without voice/) no voice speaks:
    // the settings still read, and the app says the voice isn't available
    emit({ type: 'log', message: `voice-over unavailable: ${err.message}` })
  }
  return {
    on: !!cfg.on, voice, speed: cfg.speed ?? 1, gain: cfg.gain ?? 1,
    lang, available, voices, model,
    lines: project.shots.filter(s => s.say?.trim()).length
  }
}

// A sample of the voice, to choose one by ear: the film's first line (or
// a stock sentence in its language), as the film would speak it
const SAMPLE = {
  en: 'This is how your film will sound.', zh: '这是你的视频的配音效果。', ja: 'これがあなたの動画のナレーションです。',
  ko: '이것이 영상의 내레이션입니다.', es: 'Así sonará tu video.', pt: 'É assim que o seu vídeo vai soar.',
  fr: 'Voici comment votre vidéo sonnera.', de: 'So wird dein Video klingen.', it: 'Ecco come suonerà il tuo video.',
  ru: 'Так будет звучать ваше видео.', tr: 'Videonuz böyle duyulacak.', vi: 'Đây là giọng đọc cho video của bạn.',
  id: 'Beginilah suara video Anda.'
}
export async function sampleVoice(project) {
  const cfg = voiceConfig(project) ?? {}
  const lang = voiceLang(project)
  const v = await voicePackage()
  const voice = voiceFor(v, cfg, lang)
  const text = sentences(project.shots.find(s => s.say?.trim())?.say)[0] ?? SAMPLE[lang.split('-')[0]] ?? SAMPLE.en
  return (await speak(project, text, { lang, voice, speed: cfg.speed ?? 1 })).file
}

// Drops the voice-over's cached files the film no longer uses (older
// lines, tracks, mixes, subtitle sets and dressed clips). Kept: what the
// last preview or export in each mode played (used-<mode>.json, written by
// withVoice) and the lines the film says now. Nothing is spoken or encoded
// here, and files younger than ten minutes are left alone (a render may
// be writing them)
export async function pruneVoice(project) {
  const dir = voiceDir(project)
  if (!fs.existsSync(dir)) return 0
  const keep = new Set(['draft', 'final'].flatMap(m => [path.join(dir, `used-${m}.json`), ...readJson(path.join(dir, `used-${m}.json`), [])]))
  if (voiceOn(project)) {
    const v = await voicePackage()
    const cfg = voiceConfig(project)
    const lang = voiceLang(project)
    const voice = voiceFor(v, cfg, lang)
    for (const shot of project.shots) {
      for (const text of sentences(shot.say)) {
        const key = lineKey(text, lang, voice, shot.sayFast ?? cfg.speed ?? 1)
        keep.add(path.join(dir, `${key}.wav`)).add(path.join(dir, `${key}.json`))
      }
    }
  }
  const recent = Date.now() - 10 * 60 * 1000
  let removed = 0
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      // A subtitle set is one entry; the other folders hold the files
      if (e.isDirectory() && path.basename(d) !== 'subs') {
        walk(p)
        continue
      }
      if (keep.has(p) || fs.statSync(p).mtimeMs > recent) continue
      fs.rmSync(p, { recursive: true, force: true })
      removed++
    }
  }
  walk(dir)
  return removed
}

// Turns the voice-over on or off, or changes its voice, speed or volume
export function setVoice(project, { on, voice, speed, gain } = {}) {
  const change = {}
  if (on != null) change.on = !!on
  if (voice != null) change.voice = String(voice)
  if (speed != null) {
    change.speed = Number(speed)
    if (!(change.speed >= 0.8 && change.speed <= 1.25)) throw new Error('speed must be 0.8–1.25')
  }
  if (gain != null) {
    change.gain = Number(gain)
    if (!(change.gain >= 0 && change.gain <= 2)) throw new Error('gain must be 0–2')
  }
  updateConfig(project.root, cfg => ({ ...cfg, voice: { on: false, ...cfg.voice, ...change } }))
  return loadProject(project.root)
}
