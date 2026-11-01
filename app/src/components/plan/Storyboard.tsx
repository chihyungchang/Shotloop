import { round } from '../../../../engine/shotloop/data.mjs'
import type { Project, Storyboard as Plan, StoryShot } from '../../api'
import { t } from '../../i18n'
import { isWide } from '../../model'
import { LOOKS, lookAbout, lookName, lookPreview } from '../../looks'
import { lookFits, STYLES, styleName } from '../../styles'
import { Icon } from '../Icon'
import { AutoText, ShotSketch } from './ShotSketch'

// One hue per shot on the timeline, from the logo's aurora
const SHOT_HUES = ['#2dd4bf', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#5eead4', '#7dd3fc', '#c4b5fd']
export const shotHue = (i: number) => SHOT_HUES[i % SHOT_HUES.length]

// The storyboard half of the plan: the style and look, the shots on a
// timeline, and each shot's card
export function Storyboard({ project, sb, edit, planning, chooseStyle }: {
  project: Project
  sb: Plan
  edit: (next: Plan) => void
  planning: boolean
  // Another style: the person's pick, and the pictures planned again for it
  chooseStyle: (id: string) => void
}) {
  const target = sb.target ?? project.duration
  const total = round(sb.shots.reduce((t, s) => t + (Number(s.duration) || 0), 0), 1)
  return (
    <section className="plan-board">
      <div className="plan-head">
        <h3>{t('plan.board')}</h3>
        <span className={`small ${Math.abs(total - target) > 0.5 ? 'warn-note' : 'muted'}`}>{t('plan.total', { n: sb.shots.length, s: total, target })}</span>
      </div>
      {sb.style && (project.track === '2d' || project.trackAuto) && <StyleRow project={project} sb={sb} planning={planning} choose={chooseStyle} />}
      {project.track === '2d' && sb.style !== '3d' && <LookRow sb={sb} edit={edit} />}
      <div className="timeline" aria-hidden>
        {sb.shots.map((s, i) => (
          <i key={i} style={{ flex: Math.max(0.5, Number(s.duration) || 0), background: shotHue(i) }} title={`${i + 1}. ${s.title}`}>
            <b>{i + 1}</b><span>{t('unit.s', { n: Number(s.duration) || 0 })}</span>
          </i>
        ))}
      </div>
      <ShotCards project={project} sb={sb} edit={edit} />
    </section>
  )
}

// The style the AI picked and why; another one re-plans the pictures for it
function StyleRow({ project, sb, planning, choose }: { project: Project; sb: Plan; planning: boolean; choose: (id: string) => void }) {
  return (
    <div className="style-row">
      <div className="look-row" role="radiogroup" aria-label={t('style.label')}>
        <span className="small muted">{t('style.label')}</span>
        {STYLES.filter(s => s.track === '2d' || project.trackAuto).map(s => {
          const on = sb.style === s.id
          return (
            <button key={s.id} role="radio" aria-checked={on} className={`look-card style-card${on ? ' on' : ''}`} disabled={planning} onClick={() => !on && choose(s.id)}>
              {styleName(s.id)}{!on && s.id === sb.styleAlt && <span className="tag">{t('style.alt')}</span>}
            </button>
          )
        })}
      </div>
      {sb.styleWhy && <p className="small muted style-why"><Icon name="spark" size={12} /> {sb.styleWhy}</p>}
    </div>
  )
}

// The 2D look, each a frame it renders in the plan's style
function LookRow({ sb, edit }: { sb: Plan; edit: (next: Plan) => void }) {
  return (
    <div className="look-row" role="radiogroup" aria-label={t('look.label')}>
      <span className="small muted">{t('look.label')}</span>
      {LOOKS.map(l => {
        const fits = lookFits(sb.style, l.id)
        return (
          <button key={l.id} role="radio" aria-checked={sb.look === l.id} className={`look-card${sb.look === l.id ? ' on' : ''}`} disabled={!fits}
            onClick={() => edit({ ...sb, look: l.id })} title={fits ? lookAbout(l.id) : t('style.lookNo', { name: styleName(sb.style ?? '') })}>
            <img className="look-thumb" src={lookPreview(l.id, sb.style) ?? ''} alt="" /> <span>{lookName(l.id)}</span>
          </button>
        )
      })}
    </div>
  )
}

// Each shot as a card: its sketch, title and length, order, and what it
// says, shows and does
function ShotCards({ project, sb, edit }: { project: Project; sb: Plan; edit: (next: Plan) => void }) {
  const wide = isWide(project.size)
  const setShot = (i: number, patch: Partial<StoryShot>) => edit({ ...sb, shots: sb.shots.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  const moveShot = (i: number, d: number) => {
    const shots = [...sb.shots]
    const [s] = shots.splice(i, 1)
    shots.splice(i + d, 0, s)
    edit({ ...sb, shots })
  }
  return (
    <div className="shot-cards">
      {sb.shots.map((s, i) => (
        <div key={i} className="shot-card">
          <ShotSketch look={project.track === '2d' ? sb.look : null} text={s.text || s.title} n={i + 1} total={sb.shots.length} wide={wide} />
          <div className="shot-main">
            <div className="shot-card-head">
              <span className="shot-no" style={{ background: shotHue(i) }}>{i + 1}</span>
              <input className="shot-title" value={s.title} onChange={e => setShot(i, { title: e.target.value })} aria-label={t('plan.shotTitle')} />
              <label className="duration" title={t('plan.sec')}>
                <input type="number" min={1} max={30} step={0.5} value={s.duration} onChange={e => setShot(i, { duration: Number(e.target.value) })} />
                <span className="muted small">{t('plan.sec')}</span>
              </label>
              <div className="shot-actions">
                <button className="icon-button" disabled={i === 0} onClick={() => moveShot(i, -1)} aria-label={t('plan.up')} title={t('plan.up')}><Icon name="chevron" size={14} /></button>
                <button className="icon-button down" disabled={i === sb.shots.length - 1} onClick={() => moveShot(i, 1)} aria-label={t('plan.down')} title={t('plan.down')}><Icon name="chevron" size={14} /></button>
                <button className="icon-button" disabled={sb.shots.length < 2} onClick={() => edit({ ...sb, shots: sb.shots.filter((_, k) => k !== i) })} aria-label={t('plan.remove')} title={t('plan.remove')}><Icon name="x" size={14} /></button>
              </div>
            </div>
            {/* With the voice-over: what the voice says over the shot,
                first; it sets the shot's length when the film is built */}
            {project.voice?.on && (
              <label className="shot-field onscreen say">
                <span><Icon name="mic" size={12} /> {t('plan.say')}</span>
                <AutoText value={s.say ?? ''} onChange={v => setShot(i, { say: v })} />
              </label>
            )}
            <label className="shot-field onscreen">
              <span>{t('plan.text')}</span>
              <AutoText value={s.text} onChange={v => setShot(i, { text: v })} />
            </label>
            <div className="shot-fields">
              <label className="shot-field"><span>{t('plan.show')}</span><AutoText value={s.show} onChange={v => setShot(i, { show: v })} /></label>
              <label className="shot-field"><span>{t('plan.motion')}</span><AutoText value={s.motion} onChange={v => setShot(i, { motion: v })} /></label>
            </div>
          </div>
        </div>
      ))}
      <button className="add-shot" onClick={() => edit({ ...sb, shots: [...sb.shots, { title: t('plan.newShot'), duration: 4, show: '', text: '', motion: '' }] })}>
        <Icon name="plus" size={14} /> {t('plan.addShot')}
      </button>
    </div>
  )
}
