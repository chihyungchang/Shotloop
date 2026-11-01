// A lock file between processes, holding its owner's pid: one process
// downloads a model (models.mjs) or starts the Chinese voice's server
// (cosyvoice.mjs) while the others wait. A lock its owner left behind is
// taken over: the owner is dead, the file holds no pid (cut short), or
// it hasn't been touched for STALE (the pid was reused by another
// process). The owner touches it every BEAT while it holds it.

import fs from 'node:fs'

const BEAT = 30_000
// Long enough that a busy owner (a synchronous tar of a large archive)
// still touches it in time
const STALE = 5 * 60_000
const GRACE = 2000

const alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: the process exists but belongs to someone else
    return err.code === 'EPERM'
  }
}

function stale(lock) {
  let pid, st
  try {
    st = fs.statSync(lock)
    pid = Number(fs.readFileSync(lock, 'utf8').trim())
  } catch (err) {
    // Released between our failed take and this look: free now
    if (err.code === 'ENOENT') return { ino: null }
    throw err
  }
  const age = Date.now() - st.mtimeMs
  // A file without a pid is one whose owner died before writing it; one
  // just made may not have it yet, hence the moment's grace
  const unowned = !Number.isInteger(pid) || pid <= 0
  const dead = unowned ? age > GRACE : !alive(pid) || age > STALE
  return dead ? { ino: st.ino } : null
}

// Creates the lock file with our pid, or false when it exists
function take(lock) {
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' })
    return true
  } catch (err) {
    if (err.code === 'EEXIST') return false
    throw err
  }
}

const sameFile = (file, ino) => {
  try {
    return fs.statSync(file).ino === ino
  } catch {
    return false
  }
}

// Takes the lock: returns its release function, or null while
// another live process holds it
export function tryLock(lock) {
  if (!take(lock)) {
    const old = stale(lock)
    if (!old) return null
    // Removed only if it is still the file judged stale, so a lock another
    // waiter took over a moment ago is left alone
    if (old.ino !== null && sameFile(lock, old.ino)) fs.rmSync(lock, { force: true })
    if (!take(lock)) return null
  }
  const beat = setInterval(() => {
    const now = new Date()
    try {
      fs.utimesSync(lock, now, now)
    } catch {
      // Gone (removed by hand): nothing left to keep fresh
    }
  }, BEAT)
  beat.unref()
  return () => {
    clearInterval(beat)
    fs.rmSync(lock, { force: true })
  }
}
