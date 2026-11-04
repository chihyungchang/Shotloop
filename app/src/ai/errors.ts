import { t } from '../i18n'

// An agent error in the person's words: a missing backend becomes a
// pointer to Settings, a model server's too small window says how to
// load it, anything else is the raw message
export function agentError(error: string | null | undefined): { text: string; setup: boolean } {
  const raw = (error ?? '').trim()
  if (/no api key|no cli chosen|no local model|no model chosen|no api base url|is not installed/i.test(raw)) {
    return { text: t('agent.noKey'), setup: true }
  }
  // Found before the run (local.ts checkContext), or the server's own
  // refusal: LM Studio, llama.cpp and vLLM wordings
  const small = raw.match(/context length of (\d+) tokens; Shotloop needs at least (\d+)/)
  if (small) return { text: t('agent.contextSmall', { n: Number(small[1]).toLocaleString(), min: Number(small[2]).toLocaleString() }), setup: false }
  if (/context (length|size|window)/i.test(raw)) return { text: t('agent.contextFull'), setup: false }
  return { text: raw, setup: false }
}
