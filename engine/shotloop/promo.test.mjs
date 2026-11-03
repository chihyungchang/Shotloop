import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { keyParts } from './cache.mjs'
import { newProject } from './create.mjs'
import { loadProject } from './project.mjs'
import { imageSize, promoImages } from './images.mjs'
import { siteUrl } from './site.mjs'
import { githubRepo, readRepo } from './repo.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'))

// The smallest headers that carry a size
function png(w, h) {
  const b = Buffer.alloc(33)
  b.writeUInt32BE(0x89504e47, 0)
  b.writeUInt32BE(0x0d0a1a0a, 4)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12)
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}
function jpeg(w, h) {
  // SOI, an APP0 segment to skip, then SOF0 with the size
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00])
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof])
}

test('a picture\'s size comes from its PNG or JPEG header', () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'a.png'), png(2880, 1800))
  fs.writeFileSync(path.join(dir, 'b.jpg'), jpeg(1170, 2532))
  fs.writeFileSync(path.join(dir, 'c.png'), 'not a picture')
  assert.deepEqual(imageSize(path.join(dir, 'a.png')), { width: 2880, height: 1800 })
  assert.deepEqual(imageSize(path.join(dir, 'b.jpg')), { width: 1170, height: 2532 })
  assert.equal(imageSize(path.join(dir, 'c.png')), null)
})

test('a product page is an http address, typed with or without its scheme', () => {
  assert.equal(siteUrl('raycast.com'), 'https://raycast.com/')
  assert.equal(siteUrl(' http://example.com/pro '), 'http://example.com/pro')
  assert.equal(siteUrl(''), null)
  assert.throws(() => siteUrl('file:///etc/passwd'), /http/)
})

test('a promo is a 2D project with the screenshot kit and its page to read', () => {
  const root = path.join(tmp(), 'p')
  newProject(root, { idea: 'A promo for Raycast', promo: true, site: 'raycast.com' })
  const config = JSON.parse(fs.readFileSync(path.join(root, 'shotloop.json'), 'utf8'))
  assert.equal(config.track, '2d')
  assert.equal(config.trackAuto, undefined)
  assert.deepEqual(config.promo, { site: 'https://raycast.com/', repo: null })
  // Wide whatever was asked: a product's screens don't read in a tall frame
  assert.deepEqual(config.size, { width: 1920, height: 1080 })
  assert.ok(fs.existsSync(path.join(root, 'world', 'screens.js')))
  // The person's pictures and the page's, by their place in the project
  fs.mkdirSync(path.join(root, 'images'))
  fs.writeFileSync(path.join(root, 'images', '01-app.png'), png(1440, 900))
  fs.mkdirSync(path.join(root, 'site', 'framed'), { recursive: true })
  fs.writeFileSync(path.join(root, 'site', 'framed', '00-hero.png'), png(3136, 2128))
  assert.deepEqual(promoImages(root), [
    { file: 'images/01-app.png', width: 1440, height: 900, from: 'person' },
    { file: 'site/framed/00-hero.png', width: 3136, height: 2128, from: 'site' }
  ])
})

test('a product promo is 2D for now and never drawn on a canvas page', () => {
  assert.throws(() => newProject(path.join(tmp(), 'a'), { idea: 'x', promo: true, track: '3d' }), /2D/)
  // Auto settles on 2D
  const auto = path.join(tmp(), 'd')
  newProject(auto, { idea: 'x', promo: true, track: 'auto' })
  assert.equal(JSON.parse(fs.readFileSync(path.join(auto, 'shotloop.json'), 'utf8')).trackAuto, undefined)
  assert.throws(() => newProject(path.join(tmp(), 'b'), { idea: 'x', promo: true, style: 'infographic' }), /no style/)
  assert.throws(() => newProject(path.join(tmp(), 'l'), { idea: 'x', promo: true, look: 'midnight' }), /brand/)
  assert.throws(() => newProject(path.join(tmp(), 'c'), { idea: 'x', site: 'raycast.com' }), /product promo/)
})

test('a promo\'s shots are stale when a picture they may show changes', () => {
  const root = path.join(tmp(), 'p')
  newProject(root, { idea: 'A promo', promo: true })
  fs.mkdirSync(path.join(root, 'images'))
  const file = path.join(root, 'images', '01-app.png')
  fs.writeFileSync(file, png(1440, 900))
  const scene = () => { const p = loadProject(root); return keyParts(p, p.shots[0], 'draft').scene }
  const before = scene()
  fs.writeFileSync(file, png(1440, 901))
  assert.notEqual(scene(), before)
})

test('a GitHub address names a repository, given as the page or on its own', () => {
  assert.deepEqual(githubRepo('https://github.com/chihyungchang/Shotloop.git'), { owner: 'chihyungchang', name: 'Shotloop' })
  assert.deepEqual(githubRepo('github.com/a/b/tree/main'), { owner: 'a', name: 'b' })
  assert.equal(githubRepo('raycast.com'), null)
  const root = path.join(tmp(), 'g')
  newProject(root, { idea: 'x', promo: true, site: 'github.com/a/b' })
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'shotloop.json'), 'utf8')).promo, { site: null, repo: 'github.com/a/b' })
  assert.throws(() => newProject(path.join(tmp(), 'h'), { idea: 'x', promo: true, repo: '/no/such/folder' }), /repository/)
})

test('a repository on this Mac is read: its words, and its screenshots but not its icons', async () => {
  const repo = tmp()
  fs.writeFileSync(path.join(repo, 'README.md'), '# Tool\n\n[![ci](https://x/badge.svg)](https://x)\n\nIt does one thing well.\n')
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'tool', description: 'A tool', homepage: 'https://tool.dev' }))
  fs.mkdirSync(path.join(repo, 'docs', 'screenshots'), { recursive: true })
  fs.writeFileSync(path.join(repo, 'docs', 'screenshots', 'app.png'), png(1440, 900))
  fs.writeFileSync(path.join(repo, 'docs', 'screenshots', 'tiny.png'), png(64, 64))
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), '## 1.0\n\nFirst release.\n')
  const root = path.join(tmp(), 'p')
  newProject(root, { idea: 'x', promo: true, repo })
  const read = await readRepo(root, repo)
  assert.deepEqual(read, { name: 'tool', homepage: 'https://tool.dev', docs: 1, pictures: 1 })
  const brief = fs.readFileSync(path.join(root, 'repo', 'brief.md'), 'utf8')
  assert.match(brief, /It does one thing well/)
  assert.doesNotMatch(brief, /badge/)
  assert.match(brief, /## CHANGELOG.md/)
  assert.deepEqual(promoImages(root).map(p => p.file), ['repo/pictures/01-app.png'])
})

test('a promo\'s screenshot kit is kept as the engine has it', async () => {
  const { freshScreens } = await import('./starters.mjs')
  const root = path.join(tmp(), 'k')
  newProject(root, { idea: 'x', promo: true })
  const file = path.join(root, 'world', 'screens.js')
  const kit = fs.readFileSync(new URL('./screens.js', import.meta.url), 'utf8')
  fs.writeFileSync(file, '// an older kit\n')
  freshScreens(root)
  assert.equal(fs.readFileSync(file, 'utf8'), kit)
  // An explainer has none
  const other = path.join(tmp(), 'e')
  newProject(other, { idea: 'x' })
  freshScreens(other)
  assert.equal(fs.existsSync(path.join(other, 'world', 'screens.js')), false)
})
