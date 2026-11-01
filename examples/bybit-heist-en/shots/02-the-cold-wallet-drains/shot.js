// 02-the-cold-wallet-drains: The cold wallet drains.
// On "emptied", one transfer takes the lot: the Bybit cold wallet's balance
// drops to zero, its border turns red, an alarm flashes. On "401,000" the
// number lands at the top; the loot keeps moving on all along: outgoing
// transfers (illustrative) land row by row from the drain and scroll past.
// Shot-local time: t = 0 is this shot's first frame.
import { sourceLine, ETH_TAKEN, eth, when, FILM } from '../../world/parts.js'

// Made-up transfers: the first takes the lot, the rest split it
const AMOUNTS = [401000, 10000, 10000, 8000, 10000, 5000, 10000, 2500, 10000, 7500, 10000, 4000, 10000, 9000, 6000, 10000]

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { C, rise, ease, clamp, lerp } = kit
  const EMPTY = when(voice, 'emptied', 0.6)
  const NUMBER = when(voice, '401,000', 3.3)
  kit.frame({ head: '*≈401,000 ETH*', typed: rise(t, NUMBER, 0.4), progress: (start + t) / FILM })

  const left = lerp(ETH_TAKEN, 0, ease(clamp((t - EMPTY) / 0.6)))
  const red = left < ETH_TAKEN
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 4))
  const rows = AMOUNTS.map((a, i) => ({
    time: '#' + (i + 1),
    from: i === 0 ? 'cold wallet' : kit.txid(7, 3),
    to: kit.txid(i + 20, 3),
    amount: eth(a),
    flag: i === 0 || a >= 10000
  }))

  kit.stage(
    '<g data-keep="wallet" opacity="' + (red ? pulse : 1) + '" transform="translate(360 330) scale(1.35) translate(-360 -330)">' +
    kit.wallet(360, 330, { label: 'Bybit cold wallet', amount: eth(left), coin: 'eth', w: 340, color: red ? C.hue.red : C.line, p: rise(t, 0, 0.4) }) + '</g>' +
    kit.arrow(360, 390, 360, 450, { color: C.hue.red, width: 5 }) +
    '<text x="40" y="490" font-family="' + kit.FONT + '" font-size="15" font-weight="800" fill="' + C.muted + '" letter-spacing="2">OUTGOING TRANSFERS · ILLUSTRATIVE</text>' +
    kit.ledger({ x: 40, y: 506, w: 640, rows, t, at: EMPTY, step: 0.22, max: 7 }) +
    sourceLine(kit, 'Elliptic, 21 Feb 2025 · transfers and hashes illustrative') +
    kit.alarm(t, EMPTY, { d: 0.5 })
  )
}
