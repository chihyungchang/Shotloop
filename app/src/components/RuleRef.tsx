import { useEffect, useState } from 'react'
import { api, type Rules } from '../api'
import { t } from '../i18n'
import { ruleName } from '../rules'
import { Icon } from './Icon'

// The rules, read once a session for the checks to name (a change in
// Settings → Rules forgets them, so the next view reads them again)
let rules: Promise<Rules> | null = null
export const forgetRules = () => {
  rules = null
}

// The rule a check result answers to: its kind (fixed or taste) and name,
// a click from its place in Settings → Rules. A rule no longer there (the
// person's own, removed) is its id alone
export function RuleRef({ id, open }: { id: string; open: (id: string) => void }) {
  const [all, setAll] = useState<Rules | null>(null)
  useEffect(() => {
    rules ??= api.rules()
    // Unreadable rules: the check still shows, by its id
    rules.then(setAll, () => setAll(null))
  }, [])
  const fixed = all?.fixed.find(r => r.id === id)
  const taste = all?.taste.find(r => r.id === id)
  const rule = fixed ?? taste
  if (!rule) return <code>{id}</code>
  const name = rule.builtIn === false ? rule.rule ?? id : ruleName(rule.id, rule.name)
  return (
    <button className="rule-ref" onClick={() => open(id)} title={t('rules.open')}>
      <span className={`rule-kind${fixed ? ' fixed' : ''}`}>{t(fixed ? 'rules.fixed' : 'rules.taste')}</span>
      <span className="ellipsis">{name}</span>
      <Icon name="arrow" size={10} />
    </button>
  )
}
