// 3D track: Blender builds the world (world/world.py) and the shot's
// camera (shots/<id>/shot.py), then renders the shot's frames; see
// blender/run_shot.py for the contract between the two scripts.
//
// world/screen.html (optional) is a page drawn onto a screen in the
// world: it is rendered to an image sequence numbered by film frame,
// which the world script finds through $SHOTLOOP_OUT/screen/.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSETS, KIT_3D, screenKey } from './cache.mjs'
import { frameName, openRenderPage, progress, renderPageFrames, run } from './compose.mjs'
import { finalSamples } from './project.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'

// The screen page's frames this shot needs, drawn once per version of
// the page (cache.mjs screenKey) and numbered by film frame
async function renderScreen(project, shot, frames) {
  const key = screenKey(project)
  if (!key) return null
  const base = path.join(project.state, 'screen', key)
  const dir = path.join(base, 'screen')
  fs.mkdirSync(dir, { recursive: true })
  const first = Math.round(shot.start * project.fps)
  const wanted = frames.map(f => first + f).filter(f => !fs.existsSync(path.join(dir, frameName(f))))
  if (wanted.length) {
    const page = await openRenderPage(path.join(project.world, 'screen.html'), { width: 1024, height: 640, scale: 1 })
    await renderPageFrames(page, wanted.map(f => (f - 1) / project.fps), (t, i) => path.join(dir, frameName(wanted[i])),
      progress({ shot: shot.id, stage: 'screen' }, wanted.length))
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
    ...(mode === 'draft' ? ['--draft'] : ['--samples', String(finalSamples(project))])
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
