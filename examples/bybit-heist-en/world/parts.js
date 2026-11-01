// What every shot of this film shares: its length, the small source line
// under the picture (below the subtitle band), the cold wallet's balance
// in ETH (shots 2 and 4), and when the voice says a phrase

export const FILM = 32

export function sourceLine(kit, text) {
  return '<text x="360" y="1024" text-anchor="middle" font-family="' + kit.FONT + '" font-size="13" fill="' + kit.C.muted + '" opacity=".85">' +
    'Source: ' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'
}

export const ETH_TAKEN = 401000
export const eth = n => Math.round(n).toLocaleString('en-US') + ' ETH'

// Shot seconds at which the voice reaches a phrase: its sentence's start
// plus the phrase's share of the sentence's words; fallback when the shot
// has no such line (a voice-over turned off)
export function when(voice, phrase, fallback) {
  for (const s of voice) {
    const i = s.text.toLowerCase().indexOf(phrase.toLowerCase())
    if (i < 0) continue
    const words = s.text.split(/\s+/).length
    const before = s.text.slice(0, i).split(/\s+/).filter(Boolean).length
    return s.at + (s.end - s.at) * before / words
  }
  return fallback
}
