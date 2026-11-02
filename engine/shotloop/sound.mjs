// The film's sound beyond the music and the voice: an ambience under the
// whole film and sound effects on the picture's beats. Both are made here
// by a small deterministic synth (no samples, no downloads, nothing to
// license), like the music bed (synth.mjs).
//
//   shots/<id>/sounds.json   the shot's effects, written with its code, so
//                            they land on its animation:
//                            [{ "at": 1.2, "sound": "click", "gain": 1, "pan": 0 }]
//                            (at: shot seconds; pan -1 left … 1 right)
//   shotloop.json "sound":   what the person chose:
//                            { "ambience": "room", "ambienceGain": 1, "chosen": true,
//                              "effects": true, "effectsGain": 1,
//                              "off": ["<shot>@<at>:<sound>", "kind:<sound>"] }
//
// With a voice-over the voice comes first: the ambience dips with the
// music while a line is spoken, quiet effects sit a little lower under it,
// and a loud one landing on a line moves into the nearest pause (up to
// 0.3 s) or plays at half its level.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cachedFile } from './cache.mjs'
import { emit, ffmpeg } from './compose.mjs'
import { readJson, writeJson } from './files.mjs'
import { wav } from './synth.mjs'

const RATE = 44100
const TAU = Math.PI * 2
// Bump when a sound or the mix changes, so every film mixes again
const SOUND_VERSION = 1

// Deterministic noise per sound, so a film sounds the same every export
function noiseFrom(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s / 2147483647) * 2 - 1
  }
}

const buffer = seconds => new Float32Array(Math.round(seconds * RATE))
// A one-pole low pass, a in 0..1 (higher: brighter)
const lowpass = a => {
  let y = 0
  return x => (y += (x - y) * a)
}

// Each effect: its length, how loud it is (loud ones are kept off the
// voice), how long before `at` it starts (a riser ends on its beat), and
// how it is made
const EFFECTS = {
  click: { len: 0.06, loud: false, make: (b, n) => b.forEach((_, i) => (b[i] = (n() * Math.exp(-i / 60) + Math.sin(TAU * 3200 * i / RATE) * Math.exp(-i / 300)) * 0.7)) },
  tick: { len: 0.04, loud: false, make: (b, n) => b.forEach((_, i) => (b[i] = (n() * 0.4 * Math.exp(-i / 40) + Math.sin(TAU * 2100 * i / RATE) * Math.exp(-i / 200)) * 0.45)) },
  pop: { len: 0.12, loud: false, make: b => { let ph = 0; b.forEach((_, i) => { ph += TAU * (200 + 500 * Math.exp(-i / 900)) / RATE; b[i] = Math.sin(ph) * Math.exp(-i / 1500) * 0.7 }) } },
  ding: { len: 1.6, loud: false, make: b => b.forEach((_, i) => { const t = i / RATE; b[i] = [[880, 1], [2.4 * 880, 0.45], [3.9 * 880, 0.2]].reduce((v, [f, a]) => v + a * Math.sin(TAU * f * t), 0) * Math.exp(-t * 3) * 0.35 }) },
  glass: { len: 0.7, loud: false, make: b => b.forEach((_, i) => { const t = i / RATE; b[i] = [[2300, 1], [3700, 0.6], [5600, 0.35]].reduce((v, [f, a]) => v + a * Math.sin(TAU * f * t), 0) * Math.exp(-t * 7) * 0.25 }) },
  beep: { len: 0.14, loud: false, make: b => b.forEach((_, i) => (b[i] = Math.sin(TAU * 1000 * i / RATE) * Math.min(1, i / 200, (b.length - i) / 400) * 0.35)) },
  thud: { len: 0.45, loud: true, make: (b, n) => { let ph = 0; const lp = lowpass(0.05); b.forEach((_, i) => { ph += TAU * (40 + 50 * Math.exp(-i / 2500)) / RATE; b[i] = (Math.sin(ph) + lp(n()) * 0.5) * Math.exp(-i / 6000) * 0.9 }) } },
  impact: { len: 1.0, loud: true, make: (b, n) => { let ph = 0; const lp = lowpass(0.12); b.forEach((_, i) => { ph += TAU * (35 + 70 * Math.exp(-i / 3000)) / RATE; b[i] = (Math.sin(ph) * Math.exp(-i / 9000) + lp(n()) * 1.6 * Math.exp(-i / 5000)) * 0.9 }) } },
  whoosh: {
    len: 0.7, loud: true,
    make: (b, n) => {
      // Noise through a band that sweeps up and back, swelling then fading
      let lo = 0, hi = 0
      b.forEach((_, i) => {
        const k = i / b.length, a = 0.02 + 0.25 * Math.sin(Math.PI * k)
        const x = n()
        lo += (x - lo) * a
        hi += (lo - hi) * a * 0.5
        b[i] = (lo - hi) * Math.sin(Math.PI * k) ** 2 * 2.2
      })
    }
  },
  riser: {
    len: 1.4, loud: true, lead: 1.4,
    make: (b, n) => {
      let ph = 0
      const lp = lowpass(0.02)
      b.forEach((_, i) => {
        const k = i / b.length
        ph += TAU * (180 + 900 * k * k) / RATE
        b[i] = (Math.sin(ph) * 0.3 + lp(n()) * (0.2 + 1.2 * k)) * k * k * 0.8
      })
    }
  },
  hum: { len: 1.4, loud: false, make: b => b.forEach((_, i) => { const t = i / RATE; b[i] = (Math.sin(TAU * 110 * t) + 0.5 * Math.sin(TAU * 220 * t) + 0.25 * Math.sin(TAU * 330 * t)) * Math.min(1, t / 0.15) * Math.min(1, (1.4 - t) / 0.5) * 0.18 }) }
}
export const EFFECT_NAMES = Object.keys(EFFECTS)

// Ambiences: a long, quiet bed for the whole film, from noise and a drone
const AMBIENCES = {
  room: (b, n) => { const lp = lowpass(0.008); b.forEach((_, i) => (b[i] = lp(n()) * 1.2 + Math.sin(TAU * 50 * i / RATE) * 0.004)) },
  wind: (b, n) => { const lp = lowpass(0.02), gust = lowpass(0.00003); b.forEach((_, i) => (b[i] = lp(n()) * (0.5 + 3 * Math.abs(gust(n()))) * 1.2)) },
  space: (b, n) => { const lp = lowpass(0.004); b.forEach((_, i) => { const t = i / RATE; b[i] = (Math.sin(TAU * 41 * t) + Math.sin(TAU * 41.7 * t) + 0.6 * Math.sin(TAU * 55 * t)) * 0.05 + lp(n()) * 0.8 }) },
  machine: (b, n) => { const lp = lowpass(0.01); b.forEach((_, i) => { const t = i / RATE; b[i] = lp(n()) * 0.9 + Math.sin(TAU * 60 * t) * 0.02 * (1 + 0.3 * Math.sin(TAU * 0.5 * t)) }) },
  night: (b, n) => {
    // A soft wind and crickets chirping in bursts
    const lp = lowpass(0.006)
    b.forEach((_, i) => {
      const t = i / RATE, chirp = Math.max(0, Math.sin(TAU * 0.7 * t)) ** 8 * Math.max(0, Math.sin(TAU * 28 * t))
      b[i] = lp(n()) * 0.8 + Math.sin(TAU * 4600 * t) * chirp * 0.03
    })
  }
}
export const AMBIENCE_NAMES = Object.keys(AMBIENCES)

const soundDir = project => path.join(project.state, 'sound')
const settings = project => ({ ambience: null, ambienceGain: 1, effects: true, effectsGain: 1, off: [], ...(project.config.sound ?? {}) })
const cueKey = (shot, at, sound) => `${shot}@${Number(at).toFixed(2)}:${sound}`

// One effect as a WAV, made once
async function effectFile(project, sound) {
  const e = EFFECTS[sound]
  const key = createHash('sha256').update(`${SOUND_VERSION}:${sound}:${e.make}`).digest('hex').slice(0, 12)
  return cachedFile(path.join(soundDir(project), 'fx', `${sound}-${key}.wav`), part => {
    const b = buffer(e.len)
    e.make(b, noiseFrom(1 + EFFECT_NAMES.indexOf(sound)))
    fs.writeFileSync(part, wav({ L: b, rate: RATE }))
  })
}

// Every effect the shots ask for, in film time, each with its key and
// whether the person has it on
export function soundCues(project) {
  const s = settings(project)
  const off = new Set(s.off)
  return project.shots.flatMap(shot => {
    const file = path.join(shot.dir, 'sounds.json')
    let list = []
    try {
      list = readJson(file, [])
    } catch (err) {
      emit({ type: 'log', message: `${shot.id}: sounds.json left out (${err.message})` })
    }
    return (Array.isArray(list) ? list : []).flatMap(c => {
      if (!EFFECTS[c?.sound] || !(c.at >= 0 && c.at <= shot.duration)) {
        emit({ type: 'log', message: `${shot.id}: sound ${JSON.stringify(c?.sound)} at ${c?.at} s left out (sounds: ${EFFECT_NAMES.join(', ')}; at within the shot)` })
        return []
      }
      const key = cueKey(shot.id, c.at, c.sound)
      return [{
        key, shot: shot.id, at: shot.start + Number(c.at), sound: c.sound,
        gain: Math.min(2, Math.max(0, Number(c.gain ?? 1))), pan: Math.min(1, Math.max(-1, Number(c.pan ?? 0))),
        on: !off.has(key) && !off.has(`kind:${c.sound}`)
      }]
    })
  })
}

// The person's choices: the ambience and its level, effects on or off and
// their level, one effect (by key) or every effect of a kind on or off
export function setSound(project, { ambience, ambienceGain, effects, effectsGain, cue, kind, on } = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(project.root, 'shotloop.json'), 'utf8'))
  const s = { ...settings(project) }
  if (ambience !== undefined) {
    if (ambience && !AMBIENCES[ambience]) throw new Error(`ambience is one of ${AMBIENCE_NAMES.join(', ')} or none`)
    s.ambience = ambience || null
    // The person's choice: a later plan keeps it
    s.chosen = true
  }
  if (ambienceGain !== undefined) s.ambienceGain = Math.min(2, Math.max(0, Number(ambienceGain)))
  if (effects !== undefined) s.effects = !!effects
  if (effectsGain !== undefined) s.effectsGain = Math.min(2, Math.max(0, Number(effectsGain)))
  const flip = id => { s.off = on ? s.off.filter(x => x !== id) : [...new Set([...s.off, id])] }
  if (cue) flip(cue)
  if (kind) {
    if (!EFFECTS[kind]) throw new Error(`no sound ${kind}`)
    flip(`kind:${kind}`)
  }
  writeJson(path.join(project.root, 'shotloop.json'), { ...cfg, sound: s })
  return { ...s, cues: soundCues({ ...project, config: { ...cfg, sound: s } }) }
}

// The ambience under the music: the bed the voice ducks. Without one
// chosen, the music as it was
export async function withAmbience(project, music) {
  const { ambience, ambienceGain } = settings(project)
  if (!ambience || !AMBIENCES[ambience]) return music
  const d = project.duration
  const key = createHash('sha256').update(`${SOUND_VERSION}:${ambience}:${ambienceGain}:${d}:${AMBIENCES[ambience]}:${music ? path.basename(music) : ''}`).digest('hex').slice(0, 16)
  return cachedFile(path.join(soundDir(project), 'bed', `${key}.wav`), async part => {
    const amb = part.replace(/\.wav$/, '.amb.wav')
    try {
      const b = buffer(d)
      AMBIENCES[ambience](b, noiseFrom(7 + AMBIENCE_NAMES.indexOf(ambience)))
      // Fades in and out with the film; made to a fixed peak, then set low
      const f = Math.min(b.length / 4, RATE * 0.8)
      for (let i = 0; i < f; i++) { b[i] *= i / f; b[b.length - 1 - i] *= i / f }
      const peak = b.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1
      fs.writeFileSync(amb, wav({ L: b, norm: 0.5 / peak, rate: RATE }))
      // About 26 dB under full scale: felt more than heard
      const level = (0.1 * ambienceGain).toFixed(3)
      await ffmpeg(music
        ? ['-i', music, '-i', amb, '-filter_complex', `[1]volume=${level},aformat=channel_layouts=stereo[a];[0][a]amix=inputs=2:normalize=0:duration=first[o]`, '-map', '[o]', '-ar', '44100', part]
        : ['-i', amb, '-af', `volume=${level},aformat=channel_layouts=stereo`, '-ar', '44100', part])
    } finally {
      fs.rmSync(amb, { force: true })
    }
  })
}

// Where a loud effect plays: off the spoken lines, into the nearest pause
// within 0.3 s, else where it was at half its level
function placed(c, lines) {
  const e = EFFECTS[c.sound]
  const start = c.at - (e.lead ?? 0)
  const speaking = (a, b) => lines.some(l => a < l.end && b > l.at)
  if (!e.loud || !speaking(start, start + Math.min(e.len, 0.4))) return { ...c, start, under: !e.loud && speaking(start, start + e.len) }
  for (const dt of [0.05, -0.05, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.25, -0.25, 0.3, -0.3]) {
    if (!speaking(start + dt, start + dt + Math.min(e.len, 0.4))) return { ...c, start: start + dt, under: false }
  }
  return { ...c, start, gain: c.gain * 0.5, under: true }
}

// The effects over the film's sound (the voice and its ducked bed, or the
// bed alone); lines: the spoken lines' times, [] without a voice
export async function withEffects(project, audio, lines) {
  const s = settings(project)
  const cues = s.effects ? soundCues(project).filter(c => c.on) : []
  if (!cues.length) return audio
  const plan = cues.map(c => placed(c, lines))
  const key = createHash('sha256').update(JSON.stringify([SOUND_VERSION, audio ? path.basename(audio) : null, s.effectsGain, project.duration,
    plan.map(c => [c.sound, c.start.toFixed(3), c.gain, c.pan, c.under])])).digest('hex').slice(0, 16)
  const files = Object.fromEntries(await Promise.all([...new Set(plan.map(c => c.sound))].map(async k => [k, await effectFile(project, k)])))
  return cachedFile(path.join(soundDir(project), 'mix', `${key}.wav`), part => {
    const inputs = [...(audio ? ['-i', audio] : ['-f', 'lavfi', '-t', String(project.duration), '-i', 'anullsrc=r=44100:cl=stereo']), ...plan.flatMap(c => ['-i', files[c.sound]])]
    // Quiet effects under a spoken line sit a little lower (about 4 dB)
    const legs = plan.map((c, i) => {
      const g = (c.gain * s.effectsGain * (c.under ? 0.63 : 1) * 0.45).toFixed(3)
      const ms = Math.max(0, Math.round(c.start * 1000))
      const l = (Math.min(1, 1 - c.pan)).toFixed(2), r = (Math.min(1, 1 + c.pan)).toFixed(2)
      return `[${i + 1}]volume=${g},pan=stereo|c0=${l}*c0|c1=${r}*c0,adelay=${ms}|${ms}[e${i}]`
    })
    const mix = `[0]${plan.map((_, i) => `[e${i}]`).join('')}amix=inputs=${plan.length + 1}:normalize=0:duration=first,alimiter=limit=0.95[o]`
    return ffmpeg([...inputs, '-filter_complex', [...legs, mix].join(';'), '-map', '[o]', '-ar', '44100', '-t', String(project.duration), part])
  })
}
