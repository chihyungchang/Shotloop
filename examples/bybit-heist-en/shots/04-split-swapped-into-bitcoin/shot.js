// 04-split-swapped-into-bitcoin: Split, swapped into bitcoin.
// The money trail splits as the voice says "split": the cold wallet's node
// branches into 4, 16, 64 wallets, coins running down; "thousands of
// addresses" lands under it; on "swapped" the coins swirl through a mixer
// in ETH blue and leave as bitcoin orange, the last row going dark.
// Shot-local time: t = 0 is this shot's first frame.
import { sourceLine, when, FILM } from '../../world/parts.js'

export default function render(t, { window, start, voice = [] }) {
  const kit = window.kit
  const { C, COIN, rise, clamp, FONT } = kit
  const SPLIT = when(voice, 'split', 0.6)
  const THOUSANDS = when(voice, 'thousands', 1.4)
  const SWAP = when(voice, 'swapped', 2.4)
  const BTC = when(voice, 'bitcoin', 3.6)
  kit.frame({ head: 'Into *bitcoin*', typed: rise(t, BTC, 0.35), progress: (start + t) / FILM })

  const label = (x, y, text, p, color = C.text, anchor = 'middle') =>
    '<text x="' + x + '" y="' + y + '" text-anchor="' + anchor + '" font-family="' + FONT + '" font-size="19" font-weight="800" fill="' + color + '" opacity="' + p + '" letter-spacing="1">' + text + '</text>'

  kit.stage(
    kit.trail({ x: 40, y: 300, w: 640, h: 260, levels: [1, 4, 16, 64], t, p: clamp((t - SPLIT + 0.3) / (THOUSANDS - SPLIT + 0.6)), coin: 'eth', fade: rise(t, BTC + 0.4, 1) }) +
    '<circle cx="360" cy="300" r="26" fill="none" stroke="' + C.hue.red + '" stroke-width="4"/>' + kit.icon('eth', 360, 300, 34) +
    label(410, 306, 'cold wallet', rise(t, 0), C.hue.red, 'start') +
    label(360, 600, 'THOUSANDS OF ADDRESSES', rise(t, THOUSANDS)) +
    kit.mixer(320, 730, 70, t, { p: rise(t, SWAP, 0.6), from: COIN.eth, to: COIN.btc }) +
    kit.icon('btc', 580, 760, 72, { p: rise(t, BTC, 0.5) }) +
    label(580, 830, 'swapped to bitcoin', rise(t, BTC + 0.2), COIN.btc) +
    sourceLine(kit, 'FBI PSA I-022625-PSA, 26 Feb 2025 · trail and mixer illustrative')
  )
}
