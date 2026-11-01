#!/usr/bin/env node
// Shotloop engine CLI: the commands the desktop app runs, usable on
// their own from a terminal.
//
//   shotloop status   <project>                          shots, cache state, takes
//   shotloop render   <project> --shot <id> [--draft|--final] [--stills] [--force]
//                     (neither: the editor's quality, draft for 3D and final for 2D)
//   shotloop assemble <project> [--final] [--aspect 9:16,16:9]
//   shotloop export   <project> [--draft] [--aspect 9:16,16:9] [--no-video] [--no-cover] [--no-publish]
//                     [--to <folder> [--name <work>] [--lang <ui language>]]   (--to: into a new folder there)
//   shotloop deliver-copy <project> --to <export folder> [--name] [--lang]   the publish copy, written later
//   shotloop cover    <project> [--frame <shot>@<seconds> | --none] [--preview]
//                     (--frame/--none: set the background frame first; --preview: to .shotloop/cover.png)
//   shotloop new      <project dir> --idea "…" [--title] [--track 2d|3d|auto] [--aspect 9:16|16:9] [--duration 30|auto] [--look <id>] [--style <2D style id>] [--no-voice]
//   shotloop list     <project dir>… [--examples]           summaries for project cards
//   shotloop fork     <project> --to <folder>               copy a project (an example) to change it
//   shotloop move     <project> --to <folder>               move a project (a draft being saved)
//   shotloop discard  <draft>                               delete a draft (only under $SHOTLOOP_DRAFTS)
//   shotloop quality  <project> [--samples N | --reset]     3D final render samples
//   shotloop preview  <project> [--draft|--final]             the whole film to watch (cached)
//   shotloop storyboard <project> [--derive]             apply storyboard.json to the project
//                     (--derive: write it from the project's shots and notes instead)
//   shotloop title    <project> <title>                  rename the project
//   shotloop style    <project> <style id>               the visual style (styles.mjs), kept by the planner
//   shotloop library  search --source polypizza|smithsonian --query … [--key] [--cursor] [--all]
//                     get --item '<search result>' | list [<project>] | remove <id>
//                     use <project> <id> | unuse <project> <id> | import <file.glb> [--title]   the 3D asset library
//   shotloop voice    <project> [--on|--off] [--voice <id>] [--speed 0.8–1.25] [--gain 0–2] [--fit]
//                     the voice-over: settings, the voices for the project's language,
//                     --fit: speak every line and fit the shots to them (a new voice or speed fits too)
//                     --sample: a WAV of the voice saying the first line, to choose by ear
//   shotloop voice-models [--download <id>]                the speech models: languages, size, license,
//                     on this Mac or not; --download fetches one (progress in MB)
//   shotloop check-subtitles <project> [--shot <id>]      what the voice-over's subtitles would cover
//                     (text, data-keep elements, subtitles.keep regions); fails when it covers anything
//   shotloop pick     <project> --shot <id>             what is where on a 2D shot's three stills,
//                     for the person to point at what the agent should change
//   shotloop music    <project> [--preset calm|bright|groove|tech|tense | --shuffle | --file <audio> | --none] [--gain 0–2] [--bed]
//   shotloop covers   list | save <project> [--title <name>] | apply <project> <id> | remove <id>
//                     | reference <project> --file <image>     cover templates, an image to design after
//   shotloop memory   list | add --text "…" | remove <id>       the AI's memory: the person's notes, its lessons
//   shotloop prune    <project>                          drop unused cache entries (shots and voice-over)
//   shotloop doctor                                      Chrome, ffmpeg, Blender
//
// --json prints one JSON event per line (start, progress, log, done,
// error, result) for the app instead of human-readable output.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHROME } from '../lib/chrome.mjs'
import { exit, parseFlags } from '../lib/jsonl.mjs'
import { editMode, prune, status, worldKey } from './cache.mjs'
import { readJson, writeJson } from './files.mjs'
import { deliverCopy } from './deliver.mjs'
import { emit, setJson } from './compose.mjs'
import { newProject, projectsIn, summaries } from './create.mjs'
import { isStarterCover } from './starters.mjs'
import { assemble, exportFilm, filmPreview, renderCover, setCoverFrame } from './film.mjs'
import { finalSamples, findShot, loadProject } from './project.mjs'
import { musicInfo, samplesInfo, setMusic, setSamples, setStyle, setTitle } from './settings.mjs'
import { applyStoryboard, deriveStoryboard } from './storyboard.mjs'
import * as covers from './covers.mjs'
import * as library from './library.mjs'
import * as memory from './memory.mjs'
import { BLENDER } from './render3d.mjs'
import { renderShot } from './render.mjs'
import { pickMap } from './pick.mjs'
import { musicBed } from './bed.mjs'
import { fitVoice, pruneVoice, sampleVoice, setVoice, voiceInfo, voiceModels } from './voice.mjs'
import { voiceCues, voiceOn } from './cues.mjs'
import { checkSubtitles, describeIssues } from './check.mjs'

const OPTIONS = {
    shot: { type: 'string' },
    final: { type: 'boolean' },
    draft: { type: 'boolean' },
    stills: { type: 'boolean' },
    force: { type: 'boolean' },
    preset: { type: 'string' },
    shuffle: { type: 'boolean' },
    source: { type: 'string' },
    query: { type: 'string' },
    key: { type: 'string' },
    cursor: { type: 'string' },
    item: { type: 'string' },
    category: { type: 'string' },
    derive: { type: 'boolean' },
    on: { type: 'boolean' },
    off: { type: 'boolean' },
    voice: { type: 'string' },
    speed: { type: 'string' },
    fit: { type: 'boolean' },
    sample: { type: 'boolean' },
    download: { type: 'string' },
    'no-voice': { type: 'boolean' },
    to: { type: 'string' },
    reset: { type: 'boolean' },
    bed: { type: 'boolean' },
    samples: { type: 'string' },
    all: { type: 'boolean' },
    file: { type: 'string' },
    none: { type: 'boolean' },
    gain: { type: 'string' },
    aspect: { type: 'string' },
    title: { type: 'string' },
    idea: { type: 'string' },
    text: { type: 'string' },
    track: { type: 'string' },
    duration: { type: 'string' },
    look: { type: 'string' },
    style: { type: 'string' },
    examples: { type: 'boolean' },
    frame: { type: 'string' },
    preview: { type: 'boolean' },
    'no-cover': { type: 'boolean' },
    'no-video': { type: 'boolean' },
    'no-publish': { type: 'boolean' },
    name: { type: 'string' },
    lang: { type: 'string' },
    json: { type: 'boolean' }
}

const { values, positionals } = parseFlags(process.argv.slice(2), OPTIONS)
setJson(!!values.json)
const [cmd, ...args] = positionals

const result = value => {
  if (values.json) emit({ type: 'result', value })
  else console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

// The example projects: $SHOTLOOP_EXAMPLES (the app's writable copy) or the repository's
const EXAMPLES = process.env.SHOTLOOP_EXAMPLES ?? fileURLToPath(new URL('../../examples', import.meta.url))
const isExample = dir => path.resolve(dir).startsWith(path.resolve(EXAMPLES) + path.sep)
// Drafts: examples opened and not saved yet ($SHOTLOOP_DRAFTS, the app's)
const DRAFTS = process.env.SHOTLOOP_DRAFTS ?? path.join(os.homedir(), '.shotloop', 'drafts')
const isDraft = dir => path.resolve(dir).startsWith(path.resolve(DRAFTS) + path.sep)

// A folder for a project that is not taken yet: <slug>, <slug>-2, …
function freeDir(parent, slug) {
  let dest = path.join(parent, slug)
  for (let n = 2; fs.existsSync(dest); n++) dest = path.join(parent, `${slug}-${n}`)
  return dest
}

// A moved project's last export names its files by absolute path (the
// app opens them as they are): its out/ files now sit in the new place.
// The cache's records need nothing: they are read in the project they
// are in (project.mjs localPath)
function relocateLatest(dest, from) {
  const latest = readJson(path.join(dest, 'out', 'latest.json'), null)
  if (!latest) return
  const out = path.join(from, 'out') + path.sep
  const moved = f => (typeof f === 'string' && f.startsWith(out) ? path.join(dest, 'out', f.slice(out.length)) : f)
  writeJson(path.join(dest, 'out', 'latest.json'), { ...latest, cover: moved(latest.cover), publish: moved(latest.publish),
    films: latest.films?.map(f => ({ ...f, file: moved(f.file) })) })
}

// The first `name` on PATH, as the shell would run it
const onPath = name =>
  (process.env.PATH ?? '').split(path.delimiter).map(d => path.join(d, name)).find(f => fs.existsSync(f)) ?? null

function doctor() {
  const version = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0].trim()
    } catch {
      // Not installed, or not runnable: doctor reports it as missing
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
    lang: project.config.lang ?? null,
    voice: project.config.voice ?? null,
    // The voice-over plays (on, with lines): the agent's rules follow it
    voiced: voiceOn(project),
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
      say: s.say ?? null,
      // The voice-over's sentences and times, as the shot's code sees them
      cues: voiceCues(project, s),
      code: s.code,
      notes: s.notes,
      ...status(project, s)
    }))
  }
}

const aspects = () => values.aspect?.split(',')

// How the cover was made: the AI's record, else "default" while it is
// still the page a new project starts with; null when nobody knows
function coverMade(project) {
  const made = readJson(path.join(project.state, 'cover.json'), null)
  if (made) return made
  return project.cover && fs.existsSync(project.cover) && isStarterCover(fs.readFileSync(project.cover, 'utf8')) ? { how: 'default' } : null
}

try {
  switch (cmd) {
    case 'status':
      {
        const project = loadProject(args[0])
        result({ ...projectStatus(project), example: isExample(args[0]), draft: isDraft(args[0]), samples: project.track === '3d' ? finalSamples(project) : null, look: project.config.look ?? null,
          // The cover: its background frame, and how the AI last made it (.shotloop/cover.json)
          coverFrame: project.config.coverFrame ?? null, coverMade: coverMade(project),
          // The visual style (styles.mjs), and what the planner still decides
          style: project.config.style ?? null, styleChosen: !!project.config.styleChosen, trackAuto: !!project.config.trackAuto, lengthAuto: !!project.config.lengthAuto })
      }
      break
    case 'render': {
      const project = loadProject(args[0])
      if (!values.shot) throw new Error('render needs --shot <id>')
      const shot = findShot(project, values.shot)
      result(await renderShot(project, shot, {
        mode: values.final ? 'final' : values.draft ? 'draft' : editMode(project),
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
      result(await exportFilm(project, {
        mode: values.draft ? 'draft' : 'final', aspects: aspects(),
        video: !values['no-video'], cover: !values['no-cover'], publish: !values['no-publish'],
        to: values.to, name: values.name, lang: values.lang
      }))
      break
    }
    case 'deliver-copy': {
      const project = loadProject(args[0])
      if (!values.to) throw new Error('deliver-copy needs --to <export folder>')
      const file = deliverCopy(project, values.to, { name: values.name, lang: values.lang })
      // The last export now has its copy
      const latest = readJson(path.join(project.out, 'latest.json'), null)
      if (latest?.folder === values.to) writeJson(path.join(project.out, 'latest.json'), { ...latest, publish: file })
      result(file)
      break
    }
    case 'library': {
      // library search|get|list|remove|use|unuse …
      const [sub, a, b] = args
      if (sub === 'search') result(await library.search(values.source ?? 'polypizza', values.query ?? '', { key: values.key, cursor: values.cursor, cc0Only: !values.all, category: values.category }))
      else if (sub === 'get') result(await library.download(JSON.parse(values.item ?? 'null'), values.key))
      else if (sub === 'list') result(a ? library.projectAssets(loadProject(a)) : library.list())
      else if (sub === 'remove') result(library.remove(a))
      else if (sub === 'import') result(library.importFile(a, { name: values.title }))
      else if (sub === 'use') result(library.use(loadProject(a), b))
      else if (sub === 'unuse') result(library.unuse(loadProject(a), b))
      else throw new Error('library search|get|list|remove|use|unuse')
      break
    }
    case 'covers': {
      const [sub, a] = args
      if (sub === 'list') result(covers.list())
      else if (sub === 'save') result(await covers.save(loadProject(a), values.title))
      else if (sub === 'apply') result(covers.apply(loadProject(a), args[2]))
      else if (sub === 'reference') result(await covers.reference(loadProject(a), values.file))
      else if (sub === 'remove') result(covers.remove(a))
      else throw new Error('covers list|save|apply|reference|remove')
      break
    }
    case 'memory': {
      const [sub, a] = args
      if (sub === 'list') result(memory.list())
      else if (sub === 'add') result(memory.add({ text: values.text }))
      else if (sub === 'remove') result(memory.remove(a))
      else throw new Error('memory list|add|remove')
      break
    }
    case 'storyboard':
      result(values.derive ? deriveStoryboard(loadProject(args[0])) : applyStoryboard(loadProject(args[0])))
      break
    case 'title':
      result(setTitle(loadProject(args[0]), args[1]))
      break
    case 'style':
      result(setStyle(loadProject(args[0]), args[1]))
      break
    case 'music': {
      const project = loadProject(args[0])
      const change = values.preset || values.shuffle || values.file || values.none || values.gain != null
      const info = change ? setMusic(project, { preset: values.preset, shuffle: values.shuffle, file: values.file, none: values.none, gain: values.gain }) : musicInfo(project)
      // --bed: the bed itself, to listen to (made now if needed)
      result(values.bed ? { ...info, bed: await musicBed(loadProject(args[0])) } : info)
      break
    }
    case 'voice': {
      let project = loadProject(args[0])
      const change = values.on || values.off || values.voice || values.speed != null || values.gain != null
      if (change) project = setVoice(project, { on: values.on ? true : values.off ? false : null, voice: values.voice, speed: values.speed, gain: values.gain })
      // A new voice or speed speaks every line again, so the shots are fitted
      // to it (as when asked); a project without lines keeps its timing
      const refit = values.fit || values.on || values.voice || values.speed != null
      const fitted = refit && voiceOn(project) ? await fitVoice(project) : null
      const sample = values.sample ? await sampleVoice(loadProject(args[0])) : null
      result({ ...(await voiceInfo(loadProject(args[0]))), ...(fitted ? { fit: fitted } : {}), ...(sample ? { sample } : {}) })
      break
    }
    case 'voice-models':
      result(await voiceModels({ download: values.download }))
      break
    case 'check-subtitles': {
      const { checked, issues } = await checkSubtitles(loadProject(args[0]), { shot: values.shot })
      result({ checked, issues, lines: describeIssues(issues) })
      if (issues.length) {
        emit({ type: 'error', message: `subtitles cover what the viewer must see:\n${describeIssues(issues).join('\n')}` })
        exit(1)
      }
      break
    }
    case 'pick': {
      const project = loadProject(args[0])
      if (!values.shot) throw new Error('pick needs --shot <id>')
      result(await pickMap(project, findShot(project, values.shot)))
      break
    }
    case 'quality': {
      // 3D final samples: read, set (--samples N) or back to the default (--reset)
      const project = loadProject(args[0])
      result(values.reset ? setSamples(project, null)
        : values.samples ? setSamples(project, values.samples)
        : samplesInfo(project))
      break
    }
    case 'preview':
      {
        const project = loadProject(args[0])
        result(await filmPreview(project, { mode: values.final ? 'final' : values.draft ? 'draft' : editMode(project) }))
      }
      break
    case 'cover': {
      let project = loadProject(args[0])
      if (values.frame) {
        const at = values.frame.lastIndexOf('@')
        if (at < 1) throw new Error('--frame is <shot>@<seconds>, e.g. 02-scale@1.5')
        project = setCoverFrame(project, { shot: values.frame.slice(0, at), time: values.frame.slice(at + 1) })
      } else if (values.none) project = setCoverFrame(project, null)
      result(await renderCover(project, { preview: !!values.preview }))
      break
    }
    case 'new':
      if (!args[0]) throw new Error('new needs <project dir>')
      // A taken folder (two ideas with the same name) gets -2, -3, …
      if (fs.existsSync(args[0]) && fs.readdirSync(args[0]).length) args[0] = freeDir(path.dirname(args[0]), path.basename(args[0]))
      result(newProject(args[0], {
        title: values.title,
        idea: values.idea,
        track: values.track ?? '2d',
        aspect: values.aspect ?? '9:16',
        duration: values.duration === 'auto' ? 'auto' : Number(values.duration ?? 30),
        look: values.look ?? '',
        style: values.style ?? '',
        voice: !values['no-voice']
      }))
      break
    case 'list':
      result(summaries([
        ...args,
        ...(values.examples ? projectsIn(EXAMPLES) : [])
      ]).map(s => ({ ...s, example: isExample(s.root), draft: isDraft(s.root) })))
      break
    case 'fork': {
      // A copy of a project (an example, as a draft to change freely);
      // its frames come along, so it plays at once; exports don't
      const project = loadProject(args[0])
      if (!values.to) throw new Error('fork needs --to <folder>')
      const dest = freeDir(values.to, project.slug)
      fs.cpSync(project.root, dest, { recursive: true, filter: src => path.relative(project.root, src) !== 'out' })
      result({ root: dest })
      break
    }
    case 'move': {
      // A draft saved: the whole project moved into a folder
      const project = loadProject(args[0])
      if (!isDraft(project.root)) throw new Error('only drafts can be moved')
      if (!values.to) throw new Error('move needs --to <folder>')
      const dest = freeDir(values.to, project.slug)
      fs.mkdirSync(values.to, { recursive: true })
      fs.cpSync(project.root, dest, { recursive: true })
      relocateLatest(dest, project.root)
      fs.rmSync(project.root, { recursive: true, force: true })
      result({ root: dest })
      break
    }
    case 'discard': {
      // A draft thrown away; only ever inside the drafts folder
      const root = path.resolve(args[0] ?? '')
      if (!isDraft(root)) throw new Error('only drafts can be discarded')
      fs.rmSync(root, { recursive: true, force: true })
      result({ removed: root })
      break
    }
    case 'prune': {
      // Shot renders no take refers to, and the voice-over's unused files
      const project = loadProject(args[0])
      const removed = prune(project)
      result({ removed, voice: await pruneVoice(project) })
      break
    }
    case 'doctor':
      result(doctor())
      break
    default:
      console.error(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, all) => all.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
      exit(cmd ? 1 : 0)
  }
  // Chrome sessions and sockets can keep the event loop alive
  exit(0)
} catch (err) {
  emit({ type: 'error', message: err.message })
  exit(1)
}
