import { useEffect, useRef } from 'react'
import { fileUrl } from '../../api'

// The timeline's tracks played together through Web Audio, each through a
// gain of its own: a volume changed is heard at once, with nothing
// rendered again (the engine renders each track once, at gain 1). Files
// are named by their content, so a decoded track is kept by its file and
// a new timeline loads only the tracks that changed
export function useMix<K extends string>(gains: Record<K, number>) {
  const ctx = useRef<AudioContext | null>(null)
  const decoded = useRef(new Map<string, Promise<AudioBuffer>>())
  const nodes = useRef(new Map<K, GainNode>())
  const sources = useRef<AudioBufferSourceNode[]>([])
  // Where playing started: the context's time then, and the film's second
  const started = useRef<{ at: number; from: number } | null>(null)
  // The latest start asked for: an earlier one still loading gives way
  const asked = useRef(0)
  const latest = useRef(gains)
  latest.current = gains

  const audio = () => (ctx.current ??= new AudioContext())
  const load = (file: string) => {
    let buffer = decoded.current.get(file)
    if (!buffer) {
      buffer = fetch(fileUrl(file)).then(r => r.arrayBuffer()).then(b => audio().decodeAudioData(b))
      // A failed load is tried again next time, not kept
      buffer.catch(() => decoded.current.delete(file))
      decoded.current.set(file, buffer)
    }
    return buffer
  }
  const gain = (k: K) => {
    let node = nodes.current.get(k)
    if (!node) {
      node = audio().createGain()
      node.connect(audio().destination)
      nodes.current.set(k, node)
    }
    return node
  }

  const mix = useRef({
    // The film's second playing now; null while stopped
    now: () => (started.current ? started.current.from + audio().currentTime - started.current.at : null),
    stop: () => {
      asked.current++
      for (const s of sources.current) s.stop()
      sources.current = []
      started.current = null
    },
    // Every track from a film second (the tracks loaded first); false
    // when a later start or a stop came while they loaded
    start: async (tracks: [K, string][], from: number) => {
      const c = audio()
      const n = ++asked.current
      await c.resume()
      const buffers = await Promise.all(tracks.map(([, f]) => load(f)))
      if (n !== asked.current) return false
      mix.stop()
      asked.current = n
      const at = c.currentTime + 0.03
      tracks.forEach(([k], i) => {
        const g = gain(k)
        g.gain.value = latest.current[k]
        const s = c.createBufferSource()
        s.buffer = buffers[i]
        s.connect(g)
        s.start(at, Math.min(from, buffers[i].duration))
        sources.current.push(s)
      })
      started.current = { at, from }
      return true
    }
  }).current

  // A volume moved: the track follows it at once, smoothly (no click)
  const key = JSON.stringify(gains)
  useEffect(() => {
    if (!ctx.current) return
    for (const [k, node] of nodes.current) node.gain.setTargetAtTime(latest.current[k], ctx.current.currentTime, 0.02)
  }, [key])
  // Gone: the context closed, a new one made if the view comes back
  useEffect(() => () => {
    mix.stop()
    ctx.current?.close()
    ctx.current = null
    nodes.current.clear()
  }, [mix])
  return mix
}
