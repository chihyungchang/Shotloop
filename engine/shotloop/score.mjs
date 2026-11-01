// A music bed composed for one film: the mood (calm, bright, groove,
// tech, tense) sets the range, and a seed picks this bed inside it — key,
// tempo, chord progression, bass, arp and drum patterns — then arranges
// it to the film's cuts: a lighter intro up to the first cut, the full
// bed, a break before a cut near the middle of a longer film, and an
// outro that thins out. The same seed gives the same bed; a new seed,
// another one in the same mood. engine/video/music.mjs plays it.

import { MOODS, round } from './data.mjs'

// Seeded random (mulberry32)
function random(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The film's cuts: where each shot after the first starts
export const cutTimes = project => project.shots.slice(1).map(s => s.start)

export const newSeed = () => Math.floor(Math.random() * 2 ** 31)

// Scales as semitones; progressions as scale degrees, one chord a bar
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const PROGRESSIONS = {
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 0, 4, 5], [0, 3, 5, 4], [5, 3, 0, 4], [0, 2, 3, 4], [0, 3, 0, 4], [0, 4, 5, 3, 0, 4, 3, 3]],
  minor: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 6, 5, 6], [0, 5, 3, 4], [0, 2, 5, 6], [0, 3, 4, 0]]
}

// Rhythms, one bar of sixteenths. Bass: semitones above the root, null
// lets the note ring
const _ = null
const BASS = {
  long: [[0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], [0, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _], [0, _, _, _, _, _, _, _, 0, _, _, _, 12, _, _, _]],
  eighths: [[0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _], [0, _, 0, _, 12, _, 0, _, 0, _, 0, _, 12, _, 7, _], [0, _, _, 0, _, _, 0, _, 0, _, _, 0, _, _, 7, _]],
  syncopated: [[0, _, _, 0, _, _, 0, _, _, _, 0, _, 12, _, 0, _], [0, _, _, _, _, _, 0, _, 0, _, _, 12, _, _, 0, _], [0, _, 12, _, _, 0, _, _, 0, _, 7, _, _, 0, _, _]],
  // A driving sixteenth pulse on the root, leaning a semitone up at the
  // end of the bar: the news bed's tension
  pulse: [[0, _, 0, 0, 0, _, 0, 0, 0, _, 0, 0, 0, _, 1, _], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, _], [0, _, 0, 0, 12, _, 0, 0, 0, _, 0, 0, 1, _, 0, 0]]
}
const ARP = {
  slow: [{ rate: 1, order: [0, 1, 2, 1] }, { rate: 2, order: [0, 2, 1, 2] }, { rate: 2, order: [0, 1, 2, 3] }],
  fast: [{ rate: 4, order: [0, 1, 2, 3, 4, 5, 4, 3] }, { rate: 4, order: [0, 2, 1, 3, 2, 4, 3, 5] }, { rate: 4, order: [5, 4, 3, 2, 1, 0, 1, 2] },
    { rate: 3, order: [0, 1, 2, 3, 2, 1] }, { rate: 2, order: [0, 2, 3, 1] }]
}
const KICK = {
  four: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  broken: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  half: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]
}
const HAT = {
  off: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  eighths: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  busy: [0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1],
  sparse: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]
}

export function composeBed(mood, { seed = newSeed(), duration, cuts = [] }) {
  const m = MOODS[mood]
  if (!m) throw new Error(`unknown music mood ${mood}`)
  const rnd = random(seed)
  const pick = list => list[Math.floor(rnd() * list.length)]
  const chance = p => rnd() < p

  const bpm = Math.round(m.bpm[0] + rnd() * (m.bpm[1] - m.bpm[0]))
  const minor = chance(m.minor)
  const scale = minor ? MINOR : MAJOR
  const tonic = Math.floor(rnd() * 12)
  const sevenths = chance(m.sevenths)
  // Triads (with a seventh in some beds) on the scale's degrees; the
  // root first and in one octave (48–59), as the bass plays chord[0]
  const chords = pick(PROGRESSIONS[minor ? 'minor' : 'major']).map(d => {
    const tone = k => scale[(d + k) % 7] + 12 * Math.floor((d + k) / 7)
    const root = 48 + ((tonic + scale[d]) % 12)
    return [0, 2, 4, ...(sevenths ? [6] : [])].map(k => root + tone(k) - scale[d])
  })

  const layers = [...m.layers]
  if (m.bassChance != null && chance(m.bassChance)) layers.push('bass')
  if (m.kickChance != null && chance(m.kickChance)) layers.push('kick')
  if (!layers.includes('arp') && chance(m.arpChance)) layers.push('arp')
  if (!layers.includes('hat') && chance(m.hatChance)) layers.push('hat')
  const bed = {
    mood, seed, bpm, duration, chords,
    bass: pick(BASS[pick(m.bass)]),
    arp: pick(ARP[pick(m.arp)]),
    kick: KICK[pick(m.kick.length ? m.kick : ['four'])],
    hat: HAT[pick(m.hat)],
    sections: [], hits: [], risers: [], fadeIn: 0.2, fadeOut: 1.5
  }

  // The arrangement, on the film's cuts
  const bar = 240 / bpm
  const inside = cuts.filter(c => c > bar && c < duration - bar)
  const introEnd = inside.find(c => c <= duration * 0.4) ?? Math.min(2 * bar, duration / 3)
  const intro = m.intro.filter(l => layers.includes(l))
  const quiet = layers.filter(l => l !== 'kick' && l !== 'bass')
  const outroFrom = Math.max(introEnd, duration - 2 * bar)
  const marks = [{ at: 0, layers: intro.length ? intro : ['pad'] }, { at: introEnd, layers }]
  // A break of a bar or two before a cut near the middle, in a longer film
  const middle = inside.filter(c => c > introEnd + 2 * bar && c < outroFrom - bar)
    .sort((a, b) => Math.abs(a - duration / 2) - Math.abs(b - duration / 2))[0]
  if (duration >= 24 && middle != null && quiet.length < layers.length) {
    const from = Math.max(introEnd + bar, middle - (chance(0.5) ? 2 : 1) * bar)
    marks.push({ at: from, layers: quiet }, { at: middle, layers })
    if (chance(m.riser)) bed.risers.push([from, middle])
  }
  if (outroFrom < duration - bar / 2) marks.push({ at: outroFrom, layers: layers.filter(l => l !== 'kick' && l !== 'arp') })
  if (introEnd > bar && chance(m.riser)) bed.risers.push([Math.max(0, introEnd - bar), introEnd])
  marks.sort((a, b) => a.at - b.at)
  bed.sections = marks.map((mk, i) => ({ from: round(mk.at), to: round(marks[i + 1]?.at ?? duration), layers: mk.layers }))
    .filter(s => s.to > s.from)
  bed.risers = bed.risers.map(([a, b]) => [round(a), round(b)])
  return bed
}
