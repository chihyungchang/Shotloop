// A product promo's shots drafted from its plan, before any AI is asked:
// each beat's code with its frame, the cards, the desktop and its actions,
// every control the actions click found in its picture by its words
// (text.mjs, macOS's Vision), so a shot plays its task from the start and
// the agent that builds it refines the timing and the words instead of
// working the kit out. A draft is still a starter (its first line says
// so): a shot the agent has written is never drafted over.
//
// An action the plan writes as "click <words on the control>" is found by
// those words (quoted ones first); one with no words (an icon) is left at
// the picture's centre, marked for the agent to place.

import fs from 'node:fs'
import path from 'node:path'
import { readJson, writeAtomic } from '../project/files.mjs'
import { isStarter } from '../project/starters.mjs'
import { imageSize } from './images.mjs'
import { findText } from './text.mjs'

const js = v => JSON.stringify(v)
// A picture's size, or null when the plan names one that isn't there
const sizeOf = (root, file) => (file && fs.existsSync(path.join(root, file)) ? imageSize(path.join(root, file)) : null)
const round = r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) })

// The product's name and its logo, as the material has them
function product(root) {
  const repo = readJson(path.join(root, 'repo', 'repo.json'), null)
  const site = readJson(path.join(root, 'site', 'brief.json'), null)
  const logo = ['repo/logo.png', 'site/logo.png'].find(f => fs.existsSync(path.join(root, f))) ?? ''
  return { name: repo?.name || site?.name || '', logo }
}

// A control by the words on it, in a picture: the quoted words first, then
// the action's own words less its verb and the usual nouns; null when the
// picture has none of them
async function control(root, picture, said) {
  const quoted = [...said.matchAll(/["“]([^"”]{3,})["”]/g)].map(m => m[1])
  // A long quote may not be read as written (a dash, a line break): its
  // first words find it too
  const starts = quoted.map(q => q.split(/\s+/).slice(0, 4).join(' ')).filter(q => !quoted.includes(q))
  // The action's own words only when it quotes none: a quote's words are
  // the control's, the rest describe it
  const plain = quoted.length ? '' : said.replace(/\b(the|a|an|field|button|tab|chip|icon|menu|link|row|box|input|on|of|to|in|right|left|top|bottom|next)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  for (const words of [...quoted, ...starts, plain].filter(w => w.length >= 3)) {
    const [hit] = await findText(root, picture, words).catch(() => [])
    if (hit) return round(hit)
  }
  return null
}

// A screen beat's steps from its actions, each click found in the picture
// on screen at that moment
async function screenSteps(root, plan) {
  let picture = plan.picture
  const out = []
  for (const a of plan.actions ?? []) {
    const [verb, ...rest] = String(a).trim().split(/\s+/)
    const said = rest.join(' ')
    if (/^click$/i.test(verb)) {
      const size = sizeOf(root, picture)
      const box = size ? await control(root, picture, said) : null
      out.push(box
        ? `    { click: ${js(box)} }, // ${said}`
        : `    { click: ${js({ x: Math.round((size?.width ?? 2) / 2 - 30), y: Math.round((size?.height ?? 2) / 2 - 30), w: 60, h: 60 })} }, // PLACE: ${said} (no words found for it in ${picture})`)
    } else if (/^type$/i.test(verb)) out.push(`    { type: ${js(said)} },`)
    else if (/^show$/i.test(verb)) {
      picture = said
      out.push(`    { show: ${js(said)} },`)
    }
  }
  return out
}

function head(shot, plan, what) {
  return `// ${shot.id}: ${plan.title ?? shot.title}. Starter shot drafted by the engine from the plan (${what}): build on it, keep what works.
// Shot-local time: t = 0 is this shot's first frame.`
}

const lines = text => String(text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
const chapterTitle = title => String(title ?? '').replace(/^\s*\d+\s*[—–\-.:)]*\s*/, '')
// A chapter's number: the plan's own ("03 — …"), else its place among
// the chapters (the title card isn't one)
const chapterNumber = (plans, i) => Number(String(plans[i].title ?? '').match(/^\s*(\d+)/)?.[1]) ||
  plans.slice(0, i + 1).filter(p => p.beat !== 'title' && p.beat !== 'end').length

// One beat's draft, or null for a beat the engine doesn't draft
async function draft(root, shot, plan, number, { name, logo }) {
  const text = lines(plan.text)
  const load = files => `export const setup = () => load(${[...new Set(files.filter(Boolean))].map(js).join(', ')})`
  if (plan.beat === 'title' || plan.beat === 'end') {
    const card = plan.beat === 'title' ? 'titleCard' : 'endCard'
    return `${head(shot, plan, 'its card')}
import { load, depth, ${card} } from '../../world/screens.js'

${load([logo])}

export default function render(t, { window }) {
  depth(${card}(t, { name: ${js(text[0] ?? name)}, line: ${js(text.slice(1).join(' '))}, logo: ${js(logo)}, at: -0.4${plan.beat === 'end' ? ', meta: []' : ''} }))
  window.kit.stage('')
}
`
  }
  const words = `chapter(t, { number: ${number}, title: ${js(chapterTitle(plan.title))}, name: ${js(name)} }),
    headline(t, { lines: ${js(text)}, x: f.words.x, y: f.words.y, width: f.words.width, size: f.words.size }),
    source(t, { text: ${js(plan.source ?? '')}, y: f.source.y })`
  if (plan.beat === 'screen' && plan.picture) {
    const size = sizeOf(root, plan.picture) ?? { width: 2880, height: 1800 }
    const steps = await screenSteps(root, plan)
    const shown = (plan.actions ?? []).filter(a => /^show\s/i.test(a)).map(a => a.replace(/^show\s+/i, '').trim())
    return `${head(shot, plan, 'its frame, the desktop and its actions, each control found in its picture')}
import { load, depth, frame, chapter, headline, source, desktop, act } from '../../world/screens.js'

const START = { file: ${js(plan.picture)}, width: ${size.width}, height: ${size.height} }
${load([plan.picture, ...shown, logo])}

export default function render(t, { window }) {
  const f = frame()
  const w = f.desktop.w
  const windows = [{ ...START, x: w * 0.04, y: w * 0.035, w: w * 0.92, title: ${js(name)} }]
  const a = act(t, { box: f.desktop, windows, at: 0.3, steps: [
${steps.join('\n')}
  ] })
  const d = desktop({ box: f.desktop, windows: a.windows, view: a.view, app: ${js(name)}, dock: ${js(logo)} })
  depth(d.html,
    ${words})
  window.kit.stage(a.cursor(d))
}
`
  }
  if (plan.beat === 'problem') {
    return `${head(shot, plan, 'its frame and words; the drawing is yours')}
import { load, depth, frame, chapter, headline, source } from '../../world/screens.js'

${load([])}

export default function render(t, { window }) {
  const f = frame()
  // The problem's drawing sits in f.picture (at least 60% of its width and
  // 40% of its height, balanced in it)
  depth(${words})
  window.kit.stage('')
}
`
  }
  return null
}

// Every starter shot of a promo whose plan says its beats, drafted;
// gives back the ids drafted
export async function draftShots(project) {
  const plan = readJson(path.join(project.root, 'storyboard.json'), null)
  if (!plan?.shots || plan.shots.length !== project.shots.length || !plan.shots.every(s => s.beat)) return []
  const known = product(project.root)
  const done = []
  for (const [i, shot] of project.shots.entries()) {
    if (fs.existsSync(shot.code) && !isStarter(shot.code)) continue
    const code = await draft(project.root, shot, plan.shots[i], chapterNumber(plan.shots, i), known)
    if (!code) continue
    fs.mkdirSync(path.dirname(shot.code), { recursive: true })
    writeAtomic(shot.code, code)
    done.push(shot.id)
  }
  return done
}
