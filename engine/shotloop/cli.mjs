#!/usr/bin/env node
// Shotloop engine CLI: the commands the desktop app runs, usable on
// their own from a terminal.
//
//   shotloop status   <project>                          shots, cache state, takes
//   shotloop render   <project> --shot <id> [--final] [--stills] [--force]
//   shotloop assemble <project> [--final] [--aspect 9:16,16:9]
//   shotloop export   <project> [--draft] [--aspect 9:16,16:9]
//   shotloop cover    <project>
//   shotloop convert  <legacy episode dir> <project dir> [--force]
//   shotloop new      <project dir> --idea "…" [--title] [--track 2d|3d] [--aspect 9:16|16:9] [--duration 30]
//   shotloop list     <project dir>… [--examples]           summaries for project cards
//   shotloop prune    <project>                          drop unused cache entries
//   shotloop doctor                                      Chrome, ffmpeg, Blender
//
// --json prints one JSON event per line (start, progress, log, done,
// error, result) for the app instead of human-readable output.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { prune, status, worldKey } from './cache.mjs'
import { emit, setJson } from './compose.mjs'
import { convert } from './convert.mjs'
import { newProject, projectsIn, summaries } from './create.mjs'
import { assemble, exportFilm, renderCover } from './film.mjs'
import { findShot, loadProject } from './project.mjs'
import { BLENDER } from './render3d.mjs'
import { renderShot } from './render.mjs'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    shot: { type: 'string' },
    final: { type: 'boolean' },
    draft: { type: 'boolean' },
    stills: { type: 'boolean' },
    force: { type: 'boolean' },
    aspect: { type: 'string' },
    title: { type: 'string' },
    idea: { type: 'string' },
    track: { type: 'string' },
    duration: { type: 'string' },
    examples: { type: 'boolean' },
    json: { type: 'boolean' }
  }
})
setJson(!!values.json)
const [cmd, ...args] = positionals

const result = value => {
  if (values.json) emit({ type: 'result', value })
  else console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

// The first `name` on PATH, as the shell would run it
const onPath = name =>
  (process.env.PATH ?? '').split(path.delimiter).map(d => path.join(d, name)).find(f => fs.existsSync(f)) ?? null

function doctor() {
  const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const version = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0].trim()
    } catch {
      return null
    }
  }
  return {
    node: process.version,
    chrome: fs.existsSync(CHROME) ? { path: CHROME, version: version(CHROME, ['--version']) } : null,
    ffmpeg: version('ffmpeg', ['-version']) ? { path: onPath('ffmpeg') ?? 'ffmpeg', version: version('ffmpeg', ['-version']) } : null,
    blender: fs.existsSync(BLENDER) ? { path: BLENDER, version: version(BLENDER, ['-v']) } : null,
    install: {
      chrome: 'Install Google Chrome, or set CHROME to a Chrome or headless shell binary',
      ffmpeg: 'brew install ffmpeg',
      blender: 'brew install --cask blender (3D projects only), or set BLENDER'
    }
  }
}

function projectStatus(project) {
  return {
    root: project.root,
    title: project.title,
    slug: project.slug,
    track: project.track,
    fps: project.fps,
    size: project.size,
    duration: project.duration,
    world: worldKey(project),
    files: {
      captions: project.captions,
      music: project.music,
      cover: project.cover,
      publish: project.publish
    },
    shots: project.shots.map(s => ({
      id: s.id,
      title: s.title ?? null,
      start: s.start,
      duration: s.duration,
      code: s.code,
      notes: s.notes,
      ...status(project, s)
    }))
  }
}

const aspects = () => values.aspect?.split(',')

try {
  switch (cmd) {
    case 'status':
      result(projectStatus(loadProject(args[0])))
      break
    case 'render': {
      const project = loadProject(args[0])
      if (!values.shot) throw new Error('render needs --shot <id>')
      const shot = findShot(project, values.shot)
      result(await renderShot(project, shot, {
        mode: values.final ? 'final' : 'draft',
        stills: !!values.stills,
        force: !!values.force
      }))
      break
    }
    case 'assemble': {
      const project = loadProject(args[0])
      result(await assemble(project, { mode: values.final ? 'final' : 'draft', aspects: aspects() }))
      break
    }
    case 'export': {
      const project = loadProject(args[0])
      result(await exportFilm(project, { mode: values.draft ? 'draft' : 'final', aspects: aspects() }))
      break
    }
    case 'cover':
      result(await renderCover(loadProject(args[0])))
      break
    case 'convert':
      if (args.length < 2) throw new Error('convert needs <legacy episode dir> <project dir>')
      result(convert(args[0], args[1], { force: !!values.force }))
      break
    case 'new':
      if (!args[0]) throw new Error('new needs <project dir>')
      result(newProject(args[0], {
        title: values.title,
        idea: values.idea,
        track: values.track ?? '2d',
        aspect: values.aspect ?? '9:16',
        duration: Number(values.duration ?? 30)
      }))
      break
    case 'list':
      result(summaries([
        ...args,
        ...(values.examples ? projectsIn(fileURLToPath(new URL('../../examples', import.meta.url))) : [])
      ]))
      break
    case 'prune':
      result({ removed: prune(loadProject(args[0])) })
      break
    case 'doctor':
      result(doctor())
      break
    default:
      console.error(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 17).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
      process.exit(cmd ? 1 : 0)
  }
  // Chrome sessions and sockets can keep the event loop alive
  process.exit(0)
} catch (err) {
  emit({ type: 'error', message: err.message })
  process.exit(1)
}
