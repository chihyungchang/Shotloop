// 3D track: Blender builds the world (world/world.py) and the shot's
// camera (shots/<id>/shot.py), then renders the shot's frames; see
// blender/run_shot.py for the contract between the two scripts.
//
// world/screen.html (optional) is a page drawn onto a screen in the
// world: it is rendered to an image sequence numbered by film frame,
// which the world script finds through $SHOTLOOP_OUT/screen/.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSETS, KIT_3D } from './cache.mjs'
import { capture, frameName, openRenderPage, progress, run } from './compose.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'

async function renderScreen(project, shot, frames) {
  const file = path.join(project.world, 'screen.html')
  if (!fs.existsSync(file)) return null
  const key = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12)
  const base = path.join(project.state, 'screen', key)
  const dir = path.join(base, 'screen')
  fs.mkdirSync(dir, { recursive: true })
  const first = Math.round(shot.start * project.fps)
  const wanted = frames.map(f => first + f).filter(f => !fs.existsSync(path.join(dir, frameName(f))))
  if (wanted.length) {
    const page = await openRenderPage(file, { width: 1024, height: 640, scale: 1 })
    const tick = progress({ shot: shot.id, stage: 'screen' }, wanted.length)
    try {
      for (const [n, f] of wanted.entries()) {
        await page.evaluate(`render(${(f - 1) / project.fps})`)
        fs.writeFileSync(path.join(dir, frameName(f)), await capture(page))
        tick(n + 1)
      }
    } finally {
      await page.close()
    }
  }
  return base
}

export async function renderFrames3d(project, shot, mode, framesDir, frames) {
  const world = path.join(project.world, 'world.py')
  if (!fs.existsSync(world)) throw new Error('3D project needs world/world.py')
  if (!fs.existsSync(shot.code)) throw new Error(`missing ${path.relative(project.root, shot.code)}`)
  if (!fs.existsSync(BLENDER)) throw new Error(`Blender not found at ${BLENDER} (brew install --cask blender, or set BLENDER)`)
  fs.mkdirSync(framesDir, { recursive: true })

  const screen = await renderScreen(project, shot, frames)
  const tick = progress({ shot: shot.id, stage: 'frames' }, frames.length)
  let done = 0
  tick(0)
  await run(BLENDER, [
    '-b', '--python-exit-code', '1', '-P', path.join(HERE, 'blender', 'run_shot.py'), '--',
    '--world', world, '--shot', shot.code, '--kit', KIT_3D,
    '--start', String(shot.start), '--duration', String(shot.duration), '--fps', String(project.fps),
    '--size', `${project.size.width}x${project.size.height}`,
    '--out', framesDir, '--shot-frames', frames.join(','),
    ...(mode === 'draft' ? ['--draft'] : [])
  ], {
    env: {
      SHOTLOOP_ASSETS: ASSETS,
      SHOTLOOP_PROJECT: project.root,
      ...(screen ? { SHOTLOOP_OUT: screen } : {})
    },
    onStdout: s => {
      for (const _ of s.matchAll(/SHOTLOOP_FRAME \d+/g)) tick(++done)
    }
  })
}
