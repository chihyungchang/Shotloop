import { getVersion } from '@tauri-apps/api/app'
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { api, REPO } from '../api'
import { useCopy, useEscape } from '../hooks'
import { t } from '../i18n'
import { Icon } from './Icon'

// Errors in one place. Where one happens it reads as one line (ErrorText);
// the whole of it (an engine's stack, the stderr tail) opens in a dialog
// to read and copy, with the app's version and the time, or to report on
// GitHub as an issue filled in with it. Errors nobody caught (a script error, a
// rejected promise, a view that crashed) open the dialog by themselves.

interface Shown { text: string; title: string | null; at: Date }

let shown: Shown | null = null
const listeners = new Set<(s: Shown | null) => void>()
const set = (s: Shown | null) => {
  shown = s
  listeners.forEach(l => l(s))
}

// An error as text, its stack with it when it has one
export function errorText(error: unknown) {
  if (error instanceof Error) return error.stack?.includes(error.message) ? error.stack : `${error.message}\n${error.stack ?? ''}`.trim()
  return String(error)
}

// Opens the dialog on an error; title: what was being done, when known
export const showError = (error: unknown, title: string | null = null) => set({ text: errorText(error), title, at: new Date() })

// The line a person reads first: the error's own sentence (a Node error
// prints its code frame before it and its stack after), else the first line
export function errorSummary(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const named = lines.find(l => /^(Error|[A-Z]\w*Error)\b/.test(l) && !/^Error:?$/.test(l))
  return (named ?? lines.find(l => !/^at\s/.test(l)) ?? text).replace(/^Error:\s*/, '')
}

// An error where it happened: its summary (or the person's words for it),
// and "Details" opening the whole when there is more to it. Nothing
// without an error
export function ErrorText({ error, summary, as: Tag = 'p', className = 'error small', title }: {
  error: string | null | undefined | false
  summary?: string
  as?: 'p' | 'span' | 'div'
  className?: string
  title?: string
}) {
  if (!error) return null
  const line = summary ?? errorSummary(error)
  return (
    <Tag className={className} title={line}>
      {line}
      {line !== error.trim() && <> <button className="link error-details" onClick={() => showError(error, title ?? null)}>{t('error.details')}</button></>}
    </Tag>
  )
}

// The dialog, mounted once beside the app; it also takes the errors no
// view caught
export function ErrorDialogHost() {
  const [current, setCurrent] = useState(shown)
  const { copied, copy } = useCopy()
  const [version, setVersion] = useState('')
  useEffect(() => {
    listeners.add(setCurrent)
    const onError = (e: ErrorEvent) => showError(e.error ?? e.message, t('error.unexpected'))
    const onRejection = (e: PromiseRejectionEvent) => showError(e.reason, t('error.unexpected'))
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    getVersion().then(setVersion, () => setVersion('?'))
    return () => {
      listeners.delete(setCurrent)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  useEscape(() => set(null), !!current)
  if (!current) return null
  const report = [
    `Shotloop ${version} · ${current.at.toISOString()}`,
    navigator.userAgent,
    ...(current.title ? ['', current.title] : []),
    '',
    current.text
  ].join('\n')
  // A new issue on GitHub, its title and body filled in (the text cut
  // short so the address stays within what a browser takes)
  const issue = () => api.openUrl(`${REPO}/issues/new?${new URLSearchParams({
    title: errorSummary(current.text).slice(0, 120),
    body: `${report.slice(0, 6000)}\n\n<!-- ${t('error.issueNote')} -->`
  })}`).catch(e => showError(e))
  return (
    <div className="dialog-backdrop" onClick={e => e.target === e.currentTarget && set(null)}>
      <div className="dialog column error-dialog" role="alertdialog" aria-label={current.title ?? t('error.title')}>
        <strong className="error-dialog-title"><Icon name="info" size={16} /> {current.title ?? t('error.title')}</strong>
        <p className="error-dialog-summary">{errorSummary(current.text)}</p>
        <pre className="error-dialog-text">{current.text}</pre>
        <p className="muted small">{t('error.reportHint')}</p>
        <div className="dialog-actions">
          <button className="ghost" onClick={() => set(null)}>{t('error.close')}</button>
          <button className="ghost" onClick={() => copy(report)}>
            <Icon name={copied === true ? 'check' : 'copy'} size={13} /> {t(copied === true ? 'export.copied' : copied === 'failed' ? 'export.copyFailed' : 'error.copy')}
          </button>
          <button className="primary" onClick={issue}>{t('error.report')}</button>
        </div>
      </div>
    </div>
  )
}

// A view that crashed while drawing: its error in the dialog, and a way
// back instead of an empty window
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    showError(`${errorText(error)}\n\nComponent stack:${info.componentStack ?? ''}`, t('error.unexpected'))
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="error-fallback">
        <p>{t('error.crashed')}</p>
        <button className="primary" onClick={() => location.reload()}>{t('error.reload')}</button>
      </div>
    )
  }
}
