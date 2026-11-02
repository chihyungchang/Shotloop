import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { exposure } from './exposure.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotloop-exposure-'))
after(() => fs.rmSync(dir, { recursive: true, force: true }))

// A dark 540×960 frame: a white patch 160 px square (a blown surface) and
// three white strokes 6 px thick (a headline's letters)
function frame(file, patch) {
  const boxes = [
    ...(patch ? ['drawbox=x=200:y=500:w=160:h=160:color=white:t=fill'] : []),
    ...[0, 1, 2].map(i => `drawbox=x=${60 + i * 40}:y=80:w=6:h=70:color=white:t=fill`)
  ]
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x202830:s=540x960', '-frames:v', '1', '-vf', boxes.join(','), '-q:v', '2', file])
}

test('exposure: a blown area is found and striped; thin bright text is not', async () => {
  const blown = path.join(dir, 'blown.jpg'), clean = path.join(dir, 'clean.jpg')
  frame(blown, true)
  frame(clean, false)
  const [a, b] = await exposure([blown, clean])
  assert.equal(a.areas.length, 1)
  const [area] = a.areas
  assert.ok(area.x >= 192 && area.x <= 208 && area.w >= 144 && area.w <= 176, JSON.stringify(area))
  assert.ok(fs.existsSync(a.zebra))
  assert.deepEqual(b, { still: clean, areas: [], zebra: null })
})
