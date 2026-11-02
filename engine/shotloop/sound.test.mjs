import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { newProject } from './create.mjs'
import { loadProject } from './project.mjs'
import { spawnSync } from 'node:child_process'
import { setSound, soundCues, withAmbience, withEffects } from './sound.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-sound-'))
after(() => fs.rmSync(dir, { recursive: true, force: true }))
const root = path.join(dir, 'film')
newProject(root, { idea: 'A gear clicks', track: '3d', duration: 12, voice: false })
const cues = list => fs.writeFileSync(path.join(root, 'shots', '01-hook', 'sounds.json'), JSON.stringify(list))

test('sound: a shot\'s effects in film time; one, or a kind, switched off; bad ones left out', () => {
  cues([{ at: 0.5, sound: 'whoosh' }, { at: 1.5, sound: 'click' }, { at: 2, sound: 'boom' }, { at: 1.8, sound: 'click', pan: 3 }])
  const p = loadProject(root)
  const all = soundCues(p)
  assert.deepEqual(all.map(c => c.key), ['01-hook@0.50:whoosh', '01-hook@1.50:click', '01-hook@1.80:click'])
  assert.equal(all[2].pan, 1)
  setSound(p, { cue: '01-hook@0.50:whoosh', on: false })
  setSound(loadProject(root), { kind: 'click', on: false })
  assert.deepEqual(soundCues(loadProject(root)).map(c => c.on), [false, false, false])
  setSound(loadProject(root), { kind: 'click', on: true })
  assert.deepEqual(soundCues(loadProject(root)).map(c => c.on), [false, true, true])
  assert.throws(() => setSound(loadProject(root), { ambience: 'rain' }), /ambience is one of/)
  assert.equal(setSound(loadProject(root), { ambience: 'space' }).chosen, true)
})

test('sound: with nothing to add, the film sounds as it did', async () => {
  cues([])
  const p = loadProject(root)
  assert.equal(await withEffects(p, '/the/music.wav', []), '/the/music.wav')
})

// A file's length in seconds, from ffmpeg's report
const seconds = file => {
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr)
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

test('sound: a sound from the asset library plays as an effect and loops as the ambience', async () => {
  // As `library use` leaves it: assets/<id>/ with its file and asset.json
  const asset = path.join(root, 'assets', 'local-tone')
  fs.mkdirSync(asset, { recursive: true })
  spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', path.join(asset, 'sound.wav')])
  fs.writeFileSync(path.join(asset, 'asset.json'), JSON.stringify({ id: 'local-tone', kind: 'sound', file: 'sound.wav', name: 'Tone', license: 'CC0' }))
  cues([{ at: 1, sound: 'local-tone' }])
  const p = loadProject(root)
  assert.deepEqual(soundCues(p).map(c => [c.sound, c.on]), [['local-tone', true]])
  const mixed = await withEffects(p, null, [])
  assert.ok(Math.abs(seconds(mixed) - p.duration) < 0.05)
  // Longer than its source: the 2 s tone repeats under the whole film
  const now = loadProject(root)
  setSound(now, { ambience: 'local-tone' })
  const bed = await withAmbience(loadProject(root), null)
  assert.ok(Math.abs(seconds(bed) - p.duration) < 0.05)
  assert.throws(() => setSound(loadProject(root), { kind: 'local-gone', on: false }), /no sound/)
  // The sound taken out of the project again: the film keeps its music
  fs.rmSync(asset, { recursive: true })
  assert.equal(await withAmbience(loadProject(root), '/the/music.wav'), '/the/music.wav')
})
