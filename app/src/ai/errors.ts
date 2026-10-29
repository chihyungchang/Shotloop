import { t } from '../i18n'

// An agent error in the person's words: a missing backend becomes a
// pointer to Settings instead of the raw message
export function agentError(error: string | null | undefined): { text: string; setup: boolean } {
  const raw = (error ?? '').trim()
  if (/no api key|no cli chosen|no local model|no model chosen|no api base url|is not installed/i.test(raw)) {
    return { text: t('agent.noKey'), setup: true }
  }
  return { text: raw, setup: false }
}
