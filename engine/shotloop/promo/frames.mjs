// A product promo's frames, from its plan: each beat's boxes (the words,
// the film's one desktop, a drawing's place, the steps, the cards), laid
// out by kits/promo-layout.js, the code the screens kit and the app's
// wireframes run too. Written to world/frames.json when the plan is
// applied, for the shots to take with frame(); no AI is asked to lay a
// beat out.
//
// The plan says, per shot: "beat" (title, problem, screen or end),
// "steps" (the chips under its headline) and its "text" (the headline,
// a line each), read by promo-layout.js planBeats. A plan without beats
// (one planned before) gets no frames.

import fs from 'node:fs'
import path from 'node:path'
import { pageLayout } from '../data.mjs'
import { filmFrames, pageOf, planBeats } from '../kits/promo-layout.js'
import { readJson, writeJson } from '../project/files.mjs'

const FRAMES_FILE = 'world/frames.json'

// The applied plan's frames, written beside the kit; removed when the
// plan has no beats, so no shot takes a stale one
export function writeFrames(project) {
  const file = path.join(project.root, FRAMES_FILE)
  const plan = readJson(path.join(project.root, 'storyboard.json'), null)
  const beats = plan && planBeats(plan.shots ?? [], project.shots.map(s => s.id))
  if (!beats || beats.length !== project.shots.length) {
    fs.rmSync(file, { force: true })
    return null
  }
  const frames = filmFrames(pageOf(pageLayout(project.size)), beats)
  writeJson(file, frames)
  return frames
}
