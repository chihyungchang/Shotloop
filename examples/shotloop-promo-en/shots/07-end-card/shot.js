// 07-end-card: the end card, the last beat: lime field, logo + SHOTLOOP, the line to remember.
import { load, depth, endCard, source } from '../../world/screens.js'

export const setup = () => load('repo/logo.png')

export default function render(t, { window }) {
  depth(
    endCard(t, {
      name: 'SHOTLOOP',
      line: 'Fix one shot.',
      logo: 'repo/logo.png',
      at: -0.5, // settled by the first frame; shot 06's wipe carries the cut
      meta: ['Free and open source', 'macOS, Apple silicon', 'oliverz.dev/products/shotloop'],
    }),
    source(t, {
      text: 'https://oliverz.dev/products/shotloop — free, open source (Apache 2.0), macOS on Apple silicon',
      at: 0.4,
    }),
  )
  window.kit.stage('')
}
