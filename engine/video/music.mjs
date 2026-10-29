// A small deterministic synth that writes a music bed as WAV, so every
// video in engine/video ships original, license-free audio that lands
// on its cuts. No samples, no downloads: oscillators, noise and a filter.
//
//   node engine/video/music.mjs <music.json> <out.wav>
//
// music.json:
//   bpm, duration (s), chords: [[midi, ...], ...] one per bar, looped
//   sections: [{ from, to, layers: ["pad","bass","arp","kick","hat"] }]
//   hits: [s, ...]      an impact on a cut
//   risers: [[from, to], ...]  a noise sweep that resolves at `to`
//   fadeIn, fadeOut (s), gain (master, default 1)

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const RATE = 44100
const TAU = Math.PI * 2
const mtof = m => 440 * 2 ** ((m - 69) / 12)

// Deterministic noise: the same file every run
let seed = 1
const noise = () => {
  seed = (seed * 16807) % 2147483647
  return (seed / 2147483647) * 2 - 1
}

const saw = p => 2 * (p - Math.floor(p + 0.5))
const square = p => (p % 1 < 0.5 ? 1 : -1)

export function render(cfg) {
  const n = Math.ceil(cfg.duration * RATE)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const beat = 60 / cfg.bpm
  const bar = beat * 4
  const active = (layer, t) =>
    cfg.sections.some(
      s => t >= s.from && t < s.to && s.layers.includes(layer)
    )
  const chordAt = t => cfg.chords[Math.floor(t / bar) % cfg.chords.length]
  const add = (i, v, pan = 0) => {
    if (i < 0 || i >= n) return
    L[i] += v * (1 - pan) * 0.5 + v * 0.5
    R[i] += v * (1 + pan) * 0.5 + v * 0.5
  }

  // Pad: detuned saws per chord tone, one-pole low-pass, slow swell
  {
    const phases = new Map()
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / RATE
      if (!active('pad', t)) {
        lp *= 0.999
        continue
      }
      const pos = (t % bar) / bar
      const swell = Math.min(1, pos * 6) * (1 - Math.max(0, pos - 0.85) * 4)
      let v = 0
      for (const m of chordAt(t)) {
        for (const d of [-0.08, 0.08]) {
          const key = `${m}${d}`
          const p = (phases.get(key) ?? 0) + mtof(m + 12 + d) / RATE
          phases.set(key, p)
          v += saw(p)
        }
      }
      lp += (v - lp) * 0.06
      add(i, lp * 0.035 * swell)
    }
  }

  // Bass: eighth-note plucks on the chord root, two octaves down
  {
    let p = 0
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / RATE
      if (!active('bass', t)) continue
      const e = (t % (beat / 2)) / (beat / 2)
      const f = mtof(chordAt(t)[0] - 24)
      p += f / RATE
      const env = Math.exp(-e * 5)
      lp += (saw(p) - lp) * (0.02 + env * 0.08)
      add(i, lp * 0.32 * env)
    }
  }

  // Arp: sixteenths over the chord an octave up, panned side to side
  {
    let p = 0
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / RATE
      if (!active('arp', t)) continue
      const step = Math.floor(t / (beat / 4))
      const e = (t % (beat / 4)) / (beat / 4)
      const chord = chordAt(t)
      const m = chord[step % chord.length] + 12 + (step % 8 >= 4 ? 12 : 0)
      p += mtof(m) / RATE
      lp += (square(p) - lp) * 0.12
      add(i, lp * 0.05 * Math.exp(-e * 6), step % 2 ? 0.4 : -0.4)
    }
  }

  // Kick on every beat, hat on the off-beats
  const drum = (t0, kind) => {
    const start = Math.round(t0 * RATE)
    if (kind === 'kick') {
      let p = 0
      for (let j = 0; j < RATE * 0.35; j++) {
        const s = j / RATE
        p += (45 + 90 * Math.exp(-s * 30)) / RATE
        add(start + j, Math.sin(TAU * p) * Math.exp(-s * 9) * 0.55)
      }
    } else {
      let prev = 0
      for (let j = 0; j < RATE * 0.05; j++) {
        const x = noise()
        add(start + j, (x - prev) * Math.exp(-(j / RATE) * 90) * 0.07, 0.2)
        prev = x
      }
    }
  }
  for (let t = 0; t < cfg.duration; t += beat / 2) {
    const onBeat = Math.round(t / (beat / 2)) % 2 === 0
    if (onBeat && active('kick', t)) drum(t, 'kick')
    if (!onBeat && active('hat', t)) drum(t, 'hat')
  }

  // Hits: a deep boom plus a short noise burst on a cut
  for (const h of cfg.hits ?? []) {
    const start = Math.round(h * RATE)
    let p = 0
    for (let j = 0; j < RATE * 1.6; j++) {
      const s = j / RATE
      p += (38 + 60 * Math.exp(-s * 12)) / RATE
      add(start + j, Math.sin(TAU * p) * Math.exp(-s * 2.2) * 0.6)
      if (s < 0.25) add(start + j, noise() * Math.exp(-s * 18) * 0.18)
    }
  }

  // Risers: filtered noise that opens up and swells into a cut
  for (const [from, to] of cfg.risers ?? []) {
    let lp = 0
    const a = Math.round(from * RATE)
    const b = Math.round(to * RATE)
    for (let i = a; i < b && i < n; i++) {
      const k = (i - a) / (b - a)
      lp += (noise() - lp) * (0.01 + k * k * 0.5)
      add(i, lp * k * k * 0.22)
    }
  }

  // Master: fades, soft clip, normalise to -1 dBFS
  const fadeIn = (cfg.fadeIn ?? 0.3) * RATE
  const fadeOut = (cfg.fadeOut ?? 1.5) * RATE
  let peak = 0
  for (let i = 0; i < n; i++) {
    const g =
      Math.min(1, i / fadeIn) * Math.min(1, (n - i) / fadeOut) * (cfg.gain ?? 1)
    L[i] = Math.tanh(L[i] * g * 1.4)
    R[i] = Math.tanh(R[i] * g * 1.4)
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  }
  const norm = peak ? 0.89 / peak : 1
  return { L, R, norm }
}

export function wav({ L, R, norm }) {
  const n = L.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(2, 22) // stereo
  buf.writeUInt32LE(RATE, 24)
  buf.writeUInt32LE(RATE * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4)
  }
  return buf
}

// Compare as URLs: a raw path with spaces never equals import.meta.url
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [config, out] = process.argv.slice(2)
  if (!config || !out) {
    console.error('usage: music.mjs <music.json> <out.wav>')
    process.exit(1)
  }
  const cfg = JSON.parse(fs.readFileSync(config, 'utf8'))
  fs.writeFileSync(out, wav(render(cfg)))
  console.log(`${out} (${cfg.duration}s at ${cfg.bpm} bpm)`)
}
