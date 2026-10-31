// 01-blue-sky-red-sunset: Blue sky, red sunset. The hook: one Sun sinks over
// a hill while the sky floods from deep blue to orange-red.
// Shot-local time: t = 0 is this shot's first frame.

const DUR = 4
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const mixHex = (a, b, k) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(', ') + ')' }
const mixRgb = (a, b, k) => { const A = a.split(',').map(Number), B = b.split(',').map(Number); return A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(', ') }

// Sky stops: [offset, noon, sunset]
const SKY = [[0, '#06143f', '#140a26'], [0.4, '#123a8c', '#4a1740'], [0.6, '#2f6cc4', '#b23a3a'], [0.68, '#6aa6e6', '#ff7a2e'], [1, '#2a4f86', '#5a1e22']]

// A soft cloud wisp: a stretched glow
function wisp(kit, x, y, w, h, rgb, a) {
  const { c } = kit
  c.save()
  c.translate(x, y)
  c.scale(1, h / w)
  const g = c.createRadialGradient(0, 0, 0, 0, 0, w)
  g.addColorStop(0, 'rgba(' + rgb + ', ' + a + ')')
  g.addColorStop(0.5, 'rgba(' + rgb + ', ' + a * 0.4 + ')')
  g.addColorStop(1, 'rgba(' + rgb + ', 0)')
  c.fillStyle = g
  c.fillRect(-w, -w, w * 2, w * 2)
  c.restore()
}

// A ridge line as a filled silhouette down to the bottom
function ridge(kit, y0, amp, seed, fill, from = -200, to = 920) {
  const { c } = kit
  c.beginPath()
  c.moveTo(from, 1500)
  for (let x = from; x <= to; x += 8) {
    const y = y0 + amp * (Math.sin(x * 0.011 + seed) * 0.6 + Math.sin(x * 0.027 + seed * 2.1) * 0.3 + Math.sin(x * 0.061 + seed * 3.7) * 0.1)
    c.lineTo(x, y)
  }
  c.lineTo(to, 1500)
  c.closePath()
  c.fillStyle = fill
  c.fill()
}

export default function render(t, { window }) {
  const kit = window.kit
  const { c, W, H, clamp, lerp, ease, rise, halo } = kit

  // The Sun's descent and the sky's flood follow it
  const u = clamp(t / DUR)
  const q = 0.35 * u + 0.65 * ease(u)
  const p = ease(clamp((q - 0.08) / 0.88))

  kit.stage(t, { camera: { x: W / 2 + 6 * t, y: H / 2 + 10 * t, zoom: 1 + 0.035 * t }, specks: 0 })

  // Sky, in screen space
  kit.depth(0, () => {
    const g = c.createLinearGradient(0, 0, 0, H)
    for (const [o, a, b] of SKY) g.addColorStop(o, mixHex(a, b, p))
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  })

  // The Sun on a far layer: arcs from the upper third to the horizon
  const sx = lerp(470, 395, q) + 26 * Math.sin(Math.PI * q)
  const sy = lerp(470, 838, Math.pow(q, 1.15))
  const sr = lerp(34, 58, p)
  const sunRgb = mixRgb('255, 214, 150', '255, 80, 40', p)
  kit.depth(0.6, () => {
    // Horizon glow gathering under the sinking Sun
    halo(sx, 850, 520, '255, 110, 50', 0.45 * p)
    halo(sx, sy, 300, sunRgb, 0.25 + 0.2 * p)
    kit.light(t, sx, sy, sr, { color: sunRgb, glow: 1 + 0.3 * p, rays: 1 - 0.4 * p, streak: 1 + 0.8 * p })
    // Redden the disc itself as it sinks
    if (p > 0) {
      const g = c.createRadialGradient(sx - sr * 0.15, sy - sr * 0.15, 0, sx, sy, sr)
      g.addColorStop(0, 'rgba(255, 200, 120, ' + 0.35 * p + ')')
      g.addColorStop(0.6, 'rgba(255, 110, 50, ' + 0.7 * p + ')')
      g.addColorStop(1, 'rgba(240, 60, 40, ' + 0.9 * p + ')')
      kit.disc(sx, sy, sr, g)
    }
  })

  // Cloud wisps at several depths, lit pink-orange as the Sun sinks
  const cloudRgb = mixRgb('225, 236, 255', '255, 140, 95', p)
  const clouds = [[120, 560, 170, 0.5, 0.22], [560, 620, 210, 0.6, 0.2], [300, 700, 240, 0.7, 0.26], [640, 470, 150, 0.55, 0.14], [60, 760, 200, 0.8, 0.2]]
  for (const [x, y, w, d, a] of clouds) {
    kit.depth(d, () => {
      const dx = x + t * 14 * d
      wisp(kit, dx, y, w, w * 0.12, cloudRgb, a)
      wisp(kit, dx + w * 0.35, y + 8, w * 0.6, w * 0.08, cloudRgb, a * 0.8)
      wisp(kit, dx - w * 0.3, y - 6, w * 0.5, w * 0.07, cloudRgb, a * 0.7)
    })
  }

  // Distant hills, hazy, then a darker middle range
  kit.depth(0.72, () => ridge(kit, 862, 26, 1.3, mixHex('#1d4a85', '#4a1a36', p)))
  kit.depth(0.88, () => ridge(kit, 905, 34, 4.2, mixHex('#0d2550', '#250b1e', p)))

  // Foreground hill with a lone tree, rim-lit from the Sun
  const rim = mixRgb('170, 210, 255', '255, 130, 70', p)
  kit.depth(1.25, () => {
    c.beginPath()
    c.moveTo(-200, 1500)
    c.lineTo(-200, 1000)
    c.bezierCurveTo(40, 940, 140, 925, 210, 930)
    c.bezierCurveTo(330, 940, 520, 1010, 920, 1030)
    c.lineTo(920, 1500)
    c.closePath()
    c.fillStyle = '#03050b'
    c.fill()
    c.strokeStyle = 'rgba(' + rim + ', 0.55)'
    c.lineWidth = 1.5
    c.stroke()

    // Tree: rim layer offset toward the Sun, black silhouette on top
    const rnd = kit.prng(41)
    const blobs = Array.from({ length: 16 }, () => [178 + (rnd() - 0.5) * 110, 842 + (rnd() - 0.5) * 34, 14 + rnd() * 14])
    const tree = (ox, oy, fill) => {
      c.fillStyle = fill
      c.beginPath()
      c.moveTo(196 + ox, 931 + oy)
      c.lineTo(190 + ox, 880 + oy)
      c.lineTo(162 + ox, 852 + oy)
      c.lineTo(168 + ox, 849 + oy)
      c.lineTo(192 + ox, 870 + oy)
      c.lineTo(200 + ox, 846 + oy)
      c.lineTo(206 + ox, 848 + oy)
      c.lineTo(202 + ox, 880 + oy)
      c.lineTo(206 + ox, 931 + oy)
      c.closePath()
      c.fill()
      for (const [bx, by, br] of blobs) {
        const sway = 1.5 * Math.sin(t * 1.4 + bx * 0.05)
        c.beginPath()
        c.ellipse(bx + ox + sway, by + oy, br * 1.3, br * 0.75, 0, 0, 6.283)
        c.fill()
      }
    }
    tree(1.8, -1.2, 'rgba(' + rim + ', 0.6)')
    tree(0, 0, '#03050b')
  })

  // Dust motes drifting in the light, near the camera
  kit.depth(1.4, () => {
    kit.particles(t, { n: 46, seed: 11, x: 20, y: 480, w: 680, h: 460, size: 1.5, color: mixRgb('230, 240, 255', '255, 190, 120', p), vx: 16, vy: -7, life: 3.2 })
  })

  // Title, rising in line by line with a glow
  const lines = ['Same Sun.', '<span style="color:#7fb2ff;text-shadow:0 0 24px rgba(80,150,255,0.9)">Blue sky,</span>', '<b>red sunset</b> — why?']
  lines.forEach((html, i) => kit.block({ y: 150 + i * 70, p: rise(t, 0.1 + i * 0.1, 0.5), cls: 'head', style: 'font-size:60px', html }))
}
