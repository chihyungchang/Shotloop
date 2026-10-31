// 07-same-air-different-path: end card. Noon (blue, short path) above a soft
// diagonal, sunset (red, long path) below it, the same Sun in both.
// Shot-local time: t = 0 is this shot's first frame.
import { earthSection, STRANDS } from '../../world/parts.js'

const SLOPE = 0.22
const diag = x => 600 + (x - 360) * SLOPE
const LABEL = 'Rayleigh scattering'

export default function render(t, { window }) {
  const k = window.kit
  const { c, W, H, clamp, rise, ease, halo } = k
  const BLUE = STRANDS[0].rgb, RED = STRANDS[4].rgb, ORANGE = STRANDS[3].rgb

  k.stage(t, { camera: { x: W / 2 + 4 * t, y: H / 2 + 6 * t, zoom: 1 + 0.025 * t }, drift: t * 10 })

  // Starts already part way in, so the first frame is not empty
  const slide = ease(clamp(0.3 + t / 1.2))
  const pulse = 1 + 0.12 * Math.sin(t * 4)

  // Clip to one side of the diagonal (world coords, generous margins)
  const half = (upper, dx, draw) => {
    c.save()
    c.beginPath()
    c.moveTo(-200, diag(-200))
    c.lineTo(W + 200, diag(W + 200))
    c.lineTo(W + 200, upper ? -400 : H + 400)
    c.lineTo(-200, upper ? -400 : H + 400)
    c.closePath()
    c.clip()
    c.translate(dx, 0)
    c.globalAlpha = clamp(slide * 1.5)
    draw()
    c.restore()
  }

  // Upper half: noon, blue sky, short vertical path
  half(true, -90 * (1 - slide), () => {
    halo(250, 470, 430, BLUE, 0.32)
    k.particles(t, { n: 34, seed: 71, x: 0, y: 300, w: W, h: 340, size: 1.6, color: BLUE, vx: 18, vy: -6, life: 2.4 })
    earthSection(k, { t, x: 250, y: 548, R: 520, shell: 100, sunHigh: 108, sun: 0, sunR: 24 * pulse,
      sunGlow: pulse, noon: rise(t, 0.25, 0.8) })
  })

  // Lower half: sunset, red air, long slanted path
  half(false, 90 * (1 - slide), () => {
    halo(470, 800, 420, ORANGE, 0.26)
    halo(520, 820, 220, RED, 0.22)
    k.particles(t, { n: 30, seed: 72, x: 0, y: 640, w: W, h: 300, size: 1.6, color: ORANGE, vx: -16, vy: 4, life: 2.6 })
    earthSection(k, { t, x: 300, y: 880, R: 520, shell: 100, sun: 1, warm: 1, dusk: 0.8, sunR: 24 * pulse,
      sunGlow: pulse, sunset: rise(t, 0.45, 1.1) })
  })

  // The glowing seam
  const seam = rise(t, 0.2, 0.7)
  if (seam > 0) {
    const g = c.createLinearGradient(0, 0, W, 0)
    g.addColorStop(0, 'rgba(' + BLUE + ', 0)')
    g.addColorStop(0.5, 'rgba(255, 200, 120, 1)')
    g.addColorStop(1, 'rgba(' + RED + ', 0)')
    c.save()
    c.globalCompositeOperation = 'lighter'
    c.lineCap = 'round'
    for (const [w, a] of [[44, 0.12], [14, 0.35], [3, 1]]) {
      c.globalAlpha = a * seam * (0.85 + 0.15 * Math.sin(t * 3))
      c.strokeStyle = g
      c.lineWidth = w
      c.beginPath()
      const reach = W * 0.6 * seam
      c.moveTo(360 - reach, diag(360 - reach))
      c.lineTo(360 + reach, diag(360 + reach))
      c.stroke()
    }
    c.restore()
  }

  // Gold label typing along the diagonal
  const typed = Math.round(LABEL.length * clamp((t - 0.9) / 0.9))
  if (t > 0.85) {
    const [sx, sy] = k.screen(360, diag(360))
    const html = LABEL.slice(0, typed) + '<span style="opacity:0">' + LABEL.slice(typed) + '</span>'
    k.block({ x: sx - 160, y: sy - 36, w: 320, p: 1, dy: 0,
      style: 'text-align:center;font:600 24px/1 ' + k.FONT + ';letter-spacing:0.06em;color:' + k.C.accent +
        ';text-shadow:0 0 6px rgba(0,0,0,0.95), 0 0 16px rgba(' + k.C.rgb.accent + ', 0.8);transform:rotate(' +
        (Math.atan(SLOPE) * 180 / Math.PI).toFixed(2) + 'deg);transform-origin:50% 50%',
      html })
  }

  k.caption({ head: ['Same air,', '*different path*'], p: rise(t, 0.05, 0.5), y: 140 })
}
