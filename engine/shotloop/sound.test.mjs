import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { newProject } from './create.mjs'
import { loadProject } from './project.mjs'
import { setSound, soundCues, withEffects } from './sound.mjs'

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
