import { ModelMark } from '../ai/BrandIcon'
import { aiSummary, useDetected } from '../ai/backends'
import { useSettings } from '../settings'
import { Icon } from './Icon'

// The AI at work, by its maker's mark (or the aurora disc when no AI is
// set up): the same in the studio and on the plan page. busy: a ring
// turns around it while it works
export function AgentAvatar({ large, busy }: { large?: boolean; busy?: boolean }) {
  const { settings } = useSettings()
  const detected = useDetected()
  const ai = settings && aiSummary(settings, detected)
  return (
    <span className={`agent-avatar${ai ? ' brand' : ''}${large ? ' large' : ''}${busy ? ' busy' : ''}`} aria-hidden>
      {ai ? <ModelMark ai={ai} size={large ? 26 : 16} /> : <Icon name="spark" size={large ? 22 : 15} />}
    </span>
  )
}
