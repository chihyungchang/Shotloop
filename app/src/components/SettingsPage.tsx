import { useCallback, useEffect, useState } from 'react'
import { api, KEY_PAGES, type About, type Job, type Settings, type Machine, type VoiceModel } from '../api'
import { checkForUpdate, useUpdate } from '../update'
import { LANGS, t, type LangPref, type useLanguage } from '../i18n'
import type { Key } from '../i18n/en'
import { formatMB, isActive } from '../model'
import { patchSettings, useSettings } from '../settings'
import { useErrorLine } from '../hooks'
import { privacyUrl } from '../telemetry'
import type { useTheme } from '../theme/theme'
import { AiSettings } from './AiSettings'
import { Icon } from './Icon'
import { MemorySettings } from './MemorySettings'
import { RulesSettings } from './RulesSettings'
import { Setup } from './Setup'
import { ThemeToggle } from './ThemeToggle'
import { VoiceDownload } from './VoiceDownload'
import licenses from '../licenses.json'
import { ErrorText } from './ErrorDialog'
import { showUpdateNotes } from './UpdateDialog'

export type Section = 'ai' | 'rules' | 'memory' | 'assets' | 'general' | 'deps' | 'about'

const SECTIONS: [Section, Key, Parameters<typeof Icon>[0]['name']][] = [
  ['ai', 'settings.ai', 'spark'],
  ['rules', 'settings.rules', 'rules'],
  ['memory', 'settings.memory', 'book'],
  ['assets', 'settings.assets', 'cube'],
  ['general', 'settings.general', 'settings'],
  ['deps', 'setup.deps', 'cpu'],
  ['about', 'settings.about', 'info']
]

type Patch = Partial<Settings>
type SavePref = (patch: Patch) => void

// Settings, after open-design's: the whole window, a back link and a
// section list on the ground, one section at a time on the card.
// General applies at once; the AI backend, tool paths and asset keys are
// edits kept here until Save, which saves only the fields edited (a
// General switch saved meanwhile stays as it is).
export function SettingsPage({ theme, language, jobs, back, start = 'ai', focus, backLabel = 'settings.back' }: {
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
  jobs: Job[]
  back: () => void
  // The section to open on (an "add your key" button points at its own)
  start?: Section
  // A rule to show in Settings → Rules (a check's reference)
  focus?: string
  backLabel?: Key
}) {
  const [section, setSection] = useState<Section>(start)
  const { settings: saved } = useSettings()
  const [edits, setEdits] = useState<Patch>({})
  const [saving, setSaving] = useState(false)
  const { error, guard } = useErrorLine()

  const update = (s: Patch) => setEdits(cur => ({ ...cur, ...s }))
  const dirty = !!saved && Object.entries(edits).some(([k, v]) => JSON.stringify(v) !== JSON.stringify(saved[k as keyof Settings]))
  const save = async () => {
    setSaving(true)
    if (await guard(patchSettings(edits))) setEdits({})
    setSaving(false)
  }
  // A General switch: saved at once, on its own
  const savePref = (patch: Patch) => void guard(patchSettings(patch))

  const settings = saved && { ...saved, ...edits }
  return (
    <div className="settings-shell">
      <nav className="settings-nav" aria-label={t('settings.title')}>
        <button className="settings-back" onClick={back}><Icon name="back" size={16} /> {t(backLabel)}</button>
        {SECTIONS.map(([id, label, icon]) => (
          <button key={id} className={`settings-nav-item${section === id ? ' on' : ''}`} aria-current={section === id} onClick={() => setSection(id)}>
            <Icon name={icon} size={16} /> {t(label)}
          </button>
        ))}
      </nav>
      <main className="settings-card">
        <div className="settings-body">
          <ErrorText error={error} className="error banner" />
          {settings && (section === 'ai' || section === 'deps' || section === 'assets') && (
            <div className="settings-savebar">
              <span className="muted small">{dirty ? t('settings.unsaved') : ''}</span>
              <button className="primary" onClick={save} disabled={!dirty || saving}>
                {saving && <span className="spinner small" />} {dirty ? t('setup.save') : t('common.saved')}
              </button>
            </div>
          )}
          {/* Not read (yet, or at all: the app's banner says why) */}
          {!settings && section !== 'about' && section !== 'memory' && section !== 'rules' && <p className="muted">{t('common.loading')}</p>}
          {settings && section === 'ai' && <AiSettings settings={settings} update={update} />}
          {settings && section === 'general' && <General settings={settings} savePref={savePref} theme={theme} language={language} />}
          {settings && section === 'deps' && <><Setup settings={settings} update={update} jobs={jobs} /><VoiceModels jobs={jobs} /></>}
          {settings && section === 'assets' && <AssetSources settings={settings} update={update} />}
          {section === 'rules' && <RulesSettings focus={focus} />}
          {section === 'memory' && <MemorySettings />}
          {section === 'about' && <AboutSection />}
        </div>
      </main>
    </div>
  )
}

function General({ settings, savePref, theme, language }: {
  settings: Settings
  savePref: SavePref
  theme: ReturnType<typeof useTheme>
  language: ReturnType<typeof useLanguage>
}) {
  const { error, guard } = useErrorLine()
  const privacy = useErrorLine()
  const toggle = (key: 'notifySound' | 'notifyDesktop', label: Key) => (
    <div className="pref-row">
      <span>{t(label)}</span>
      <div className="seg-control" role="radiogroup" aria-label={t(label)}>
        <button role="radio" aria-checked={settings[key]} className={settings[key] ? 'on' : ''} onClick={() => savePref({ [key]: true })}>{t('settings.on')}</button>
        <button role="radio" aria-checked={!settings[key]} className={settings[key] ? '' : 'on'} onClick={() => savePref({ [key]: false })}>{t('settings.off')}</button>
      </div>
    </div>
  )
  return (
    <>
      <section className="settings-block">
        <h3>{t('settings.language')}</h3>
        <select className="inline-select" value={language.pref} onChange={e => language.setPref(e.target.value as LangPref)}>
          <option value="system">{t('lang.system')}</option>
          {LANGS.map(l => <option key={l.id} value={l.id}>{l.name} · {l.id}</option>)}
        </select>
      </section>
      <section className="settings-block">
        <h3>{t('theme.label')}</h3>
        <div className="pref-row">
          <span>{t('settings.mode')}</span>
          <ThemeToggle pref={theme.pref} setPref={theme.setPref} />
        </div>
      </section>
      <Parallel settings={settings} savePref={savePref} />
      <ShotEffort settings={settings} savePref={savePref} />
      <section className="settings-block">
        <h3>{t('settings.alerts')}</h3>
        <p className="hint">{t('settings.alertsNote')}</p>
        {toggle('notifySound', 'settings.sound')}
        {toggle('notifyDesktop', 'settings.desktop')}
        <button className="link try" onClick={() => guard(api.testAlert())}><Icon name="play" size={11} /> {t('activity.try')}</button>
        <ErrorText error={error} className="error small" />
      </section>
      <section className="settings-block">
        <h3>{t('telemetry.title')}</h3>
        <p className="hint">{t('telemetry.note')}</p>
        <div className="pref-row">
          <span>{t('telemetry.send')}</span>
          <div className="seg-control" role="radiogroup" aria-label={t('telemetry.send')}>
            <button role="radio" aria-checked={!settings.telemetryOff} className={settings.telemetryOff ? '' : 'on'} onClick={() => savePref({ telemetryOff: false, telemetryTold: true })}>{t('settings.on')}</button>
            <button role="radio" aria-checked={settings.telemetryOff} className={settings.telemetryOff ? 'on' : ''} onClick={() => savePref({ telemetryOff: true, telemetryTold: true })}>{t('settings.off')}</button>
          </div>
        </div>
        <button className="link try" onClick={() => privacy.guard(api.openUrl(privacyUrl()))}>{t('telemetry.privacy')} →</button>
        <ErrorText error={privacy.error} className="error small" />
      </section>
    </>
  )
}

// How many shots the AI builds at once: auto (by this Mac) or 1–5
function Parallel({ settings, savePref }: { settings: Settings; savePref: SavePref }) {
  const [m, setM] = useState<Machine | null>(null)
  useEffect(() => {
    // Without the machine's numbers, auto shows the usual 3
    api.machine().then(setM, () => setM(null))
  }, [])
  const value = settings.parallel >= 1 && settings.parallel <= 5 ? settings.parallel : 0
  const auto = m?.autoParallel ?? 3
  // Auto shows the machine's number; an arrow makes it a manual choice
  const n = value || auto
  const step = (d: number) => savePref({ parallel: Math.min(5, Math.max(1, n + d)) })
  return (
    <section className="settings-block">
      <h3>{t('settings.parallel')}</h3>
      <p className="hint">{t('settings.parallelNote')}</p>
      <div className="pref-row">
        <span>{t('settings.parallelLabel')}</span>
        <div className="pref-end">
          {value !== 0 && <button className="link" onClick={() => savePref({ parallel: 0 })}>{t('settings.parallelReset', { n: auto })}</button>}
          <div className="stepper-control" role="group" aria-label={t('settings.parallelLabel')}>
            <button className="icon-button prev" onClick={() => step(-1)} disabled={n <= 1} aria-label={t('settings.parallelLess')} title={t('settings.parallelLess')}><Icon name="chevron" size={14} /></button>
            <span className="stepper-value" aria-live="polite">
              <strong>{n}</strong>
              {value === 0 && <small>{t('settings.parallelAuto')}</small>}
            </span>
            <button className="icon-button next" onClick={() => step(1)} disabled={n >= 5} aria-label={t('settings.parallelMore')} title={t('settings.parallelMore')}><Icon name="chevron" size={14} /></button>
          </div>
        </div>
      </div>
      {m && <p className="hint">{t('settings.parallelMachine', { cores: m.cores, memory: m.memoryGb, n: m.autoParallel })}</p>}
    </section>
  )
}

// How hard the AI thinks building each shot: low (the default, quick)
// to high (slower and costlier, for a little more)
const EFFORTS = ['low', 'medium', 'high'] as const
function ShotEffort({ settings, savePref }: { settings: Settings; savePref: SavePref }) {
  const value = settings.shotEffort || 'low'
  return (
    <section className="settings-block">
      <h3>{t('settings.effort')}</h3>
      <p className="hint">{t('settings.effortNote')}</p>
      <div className="pref-row">
        <span>{t('settings.effortLabel')}</span>
        <div className="seg" role="radiogroup" aria-label={t('settings.effortLabel')}>
          {EFFORTS.map(e => (
            <button key={e} role="radio" aria-checked={value === e} className={value === e ? 'on' : ''}
              title={t(`settings.effort.${e}Hint` as Key)} onClick={() => value !== e && savePref({ shotEffort: e === 'low' ? '' : e })}>
              {t(`settings.effort.${e}` as Key)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutSection() {
  const [about, setAbout] = useState<About | null>(null)
  const { error, guard } = useErrorLine()
  useEffect(() => {
    guard(api.about()).then(a => a && setAbout(a))
  }, [guard])
  if (error && !about) return <ErrorText error={error} className="error" />
  if (!about) return <p className="muted">{t('common.loading')}</p>
  const rows: [Key, string][] = [
    ['about.version', about.version],
    ['about.runtime', t(about.bundled ? 'about.bundled' : 'about.source')],
    ['about.platform', about.os === 'macos' ? t('about.macos') : about.os],
    ['about.arch', about.arch === 'aarch64' ? t('about.appleSilicon') : about.arch],
    ['about.engine', about.root]
  ]
  return (
    <section className="settings-block about">
      <h3>{t('settings.about')}</h3>
      {rows.map(([k, v]) => (
        <div key={k} className="about-row"><span className="muted">{t(k)}</span><span className="ellipsis" title={v}>{v}</span></div>
      ))}
      <UpdateRow version={about.version} />
      {about.data && (
        <div className="pref-row boxed">
          <div><strong>{t('about.data')}</strong><p className="hint">{about.data}</p></div>
          <button className="small" onClick={() => guard(api.reveal(about.data!))}>{t('studio.finder')}</button>
        </div>
      )}
      <ErrorText error={error} className="error small" />
      <ThirdParty />
    </section>
  )
}

// The third-party software the app carries or fetches, with versions and
// licenses (app/scripts/licenses.mjs writes the list at build time)
const GROUPS: Record<string, { title: Key; note?: Key }> = {
  programs: { title: 'oss.programs', note: 'oss.programsNote' },
  models: { title: 'oss.models', note: 'oss.modelsNote' },
  libraries: { title: 'oss.libraries', note: 'oss.librariesNote' },
  chineseVoice: { title: 'oss.chineseVoice', note: 'oss.chineseVoiceNote' },
  npm: { title: 'oss.npm' },
  crates: { title: 'oss.crates' }
}
function ThirdParty() {
  const { error, guard } = useErrorLine()
  return (
    <div className="oss">
      <h4>{t('oss.title')}</h4>
      <p className="hint">{t('oss.intro')}</p>
      <ErrorText error={error} className="error small" />
      {licenses.groups.map(g => (
        <details key={g.id} className="oss-group" open={g.id === 'programs' || g.id === 'libraries' || g.id === 'models' || g.id === 'chineseVoice'}>
          <summary><strong>{t(GROUPS[g.id]?.title ?? 'oss.npm')}</strong> <span className="muted">{g.items.length}</span></summary>
          {GROUPS[g.id]?.note && <p className="hint">{t(GROUPS[g.id].note!)}</p>}
          <ul>
            {g.items.map(i => (
              <li key={`${i.name}@${i.version}`}>
                <span className="ellipsis">{i.name}{i.version && <span className="muted"> {i.version}</span>}</span>
                <button className="link" onClick={() => guard(api.openUrl(i.url))}>{i.license}</button>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

// Settings → Dependencies: the voice-over's speech models. They don't ship
// with the app: each downloads the first time its languages speak (or
// here, ahead of time), then works offline
function VoiceModels({ jobs }: { jobs: Job[] }) {
  const [list, setList] = useState<{ dir: string; models: VoiceModel[] } | null>(null)
  const { error, guard } = useErrorLine()
  const load = useCallback(() => {
    guard(api.voiceModels()).then(l => l && setList(l))
  }, [guard])
  useEffect(load, [load])
  if (error && !list) return <ErrorText error={error} className="error small" />
  if (!list) return null
  return (
    <section className="settings-block">
      <h3>{t('voiceDl.title')}</h3>
      <p className="hint">{t('voiceDl.intro')}</p>
      {list.models.map(m => (
        <div key={m.id} className="pref-row boxed voice-model">
          <div>
            <strong>{m.name}</strong>
            <p className="hint">{m.langs.map(l => LANGS.find(x => x.id === l)?.name ?? l).join(' · ')}</p>
            <p className="hint">{formatMB(m.bytes)} · <button className="link" onClick={() => guard(api.openUrl(m.home))}>{m.license}</button></p>
          </div>
          {m.installed && !jobs.some(j => j.kind === 'voiceModel' && j.model === m.id && isActive(j))
            ? <span className="tag ok"><Icon name="check" size={11} /> {t('voiceDl.installed')}</span>
            : <VoiceDownload model={m} jobs={jobs} onDone={load} />}
        </div>
      ))}
      <div className="pref-row boxed">
        <div><strong>{t('voiceDl.folder')}</strong><p className="hint">{list.dir}</p></div>
        <button className="small" onClick={() => guard(api.reveal(list.dir))}>{t('studio.finder')}</button>
      </div>
      <ErrorText error={error} className="error small" />
    </section>
  )
}

// The asset library's sources and the person's keys for them
function AssetSources({ settings, update }: { settings: Settings; update: (s: Patch) => void }) {
  const { error, guard } = useErrorLine()
  const rows: { key: 'polypizzaKey' | 'smithsonianKey'; name: string; note: Key; url: string; hint: string }[] = [
    { key: 'polypizzaKey', name: 'Poly Pizza', note: 'assets.polypizzaNote', url: KEY_PAGES.polypizza, hint: '' },
    { key: 'smithsonianKey', name: 'Smithsonian Open Access', note: 'assets.smithsonianNote', url: KEY_PAGES.smithsonian, hint: 'DEMO_KEY' }
  ]
  return (
    <section className="settings-block">
      <h3>{t('settings.assets')}</h3>
      <p className="hint">{t('assets.intro')}</p>
      <ErrorText error={error} className="error small" />
      {rows.map(r => (
        <label key={r.key} className="field">
          <span className="row between">
            {r.name}
            <button type="button" className="link" onClick={() => guard(api.openUrl(r.url))}>{t('ai.getKey')} <Icon name="arrow" size={12} /></button>
          </span>
          <input type="password" value={settings[r.key]} placeholder={r.hint} onChange={e => update({ [r.key]: e.target.value })} />
          <small className="muted">{t(r.note)}</small>
        </label>
      ))}
    </section>
  )
}

// Settings → About: the version, and a check for a newer one on GitHub
function UpdateRow({ version }: { version: string }) {
  const u = useUpdate()
  const status =
    u.kind === 'checking' ? t('update.checking')
    : u.kind === 'none' ? t('update.latest', { v: version })
    : u.kind === 'available' ? t('update.available', { v: u.version })
    : u.kind === 'downloading' ? t('update.downloading')
    : u.kind === 'restarting' ? t('update.restarting')
    : u.kind === 'failed' ? t('update.failed')
    : u.kind === 'busy' ? t('update.busy')
    : t('update.current', { v: version })
  return (
    <div className="pref-row boxed">
      <div>
        <strong>{t('update.title')}</strong>
        <p className="hint">{status}</p>
        <ErrorText error={u.kind === 'failed' && u.error} className="hint error" />
      </div>
      {u.kind === 'available'
        ? <button className="primary small" onClick={showUpdateNotes}>{t('update.whatsNew')}</button>
        : <button className="small" onClick={() => checkForUpdate()} disabled={u.kind === 'checking' || u.kind === 'downloading' || u.kind === 'restarting'}>
            {u.kind === 'checking' ? <span className="spinner small" /> : null} {t('update.check')}
          </button>}
    </div>
  )
}
