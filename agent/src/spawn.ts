// A child process read line by line, as the engine CLI and the CLI agents
// are: stdout split into lines, the tail of stderr kept for the error.

import { spawn, type SpawnOptions } from 'node:child_process'

export interface Run {
  code: number
  stderr: string
  // Killed after the timeout
  timedOut: boolean
}

export function spawnLines(
  bin: string,
  args: string[],
  opts: Pick<SpawnOptions, 'cwd' | 'env'> & { timeoutMs?: number },
  onLine: (line: string) => void
): Promise<Run> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd: opts.cwd, env: opts.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let buf = ''
    let stderr = ''
    let timedOut = false
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          p.kill('SIGTERM')
        }, opts.timeoutMs)
      : null
    p.stdout!.on('data', d => {
      buf += d
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        onLine(buf.slice(0, nl))
        buf = buf.slice(nl + 1)
      }
    })
    p.stderr!.on('data', d => {
      stderr = (stderr + d).slice(-4000)
    })
    p.on('error', err => {
      if (timer) clearTimeout(timer)
      reject(err)
    })
    p.on('close', code => {
      if (timer) clearTimeout(timer)
      if (buf) onLine(buf)
      resolve({ code: code ?? 1, stderr, timedOut })
    })
  })
}

// The last line of a failed run's stderr, or how it ended
export const failure = (r: Run) => r.stderr.trim().split('\n').at(-1) || `exited ${r.code}`
