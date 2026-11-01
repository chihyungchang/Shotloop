import { Fragment, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'

// Reading aids for the shot's files on the code tab: shot.js coloured by
// a small tokenizer (enough for the shots' plain JavaScript, no parser),
// notes.md laid out as the headings, lists and paragraphs it is written in.

// Comments, strings (template strings whole), numbers, words, the rest
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'while', 'do', 'break', 'continue', 'switch', 'case',
  'default', 'new', 'export', 'import', 'from', 'async', 'await', 'class', 'extends', 'typeof', 'instanceof', 'try', 'catch', 'finally', 'throw'
])
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'this', 'NaN', 'Infinity'])

// One token as a span, by class
type Span = { cls: string | null; text: string }

// A word followed by "(" is a call
const CALL = /\s*\(/y

function tokens(source: string): Span[] {
  const out: Span[] = []
  for (const m of source.matchAll(TOKEN)) {
    const [text, comment, string, number, word] = m
    CALL.lastIndex = m.index + text.length
    const next = word && CALL.test(source)
    const cls = comment ? 'c' : string ? 's' : number ? 'n'
      : word ? (KEYWORDS.has(word) ? 'k' : LITERALS.has(word) ? 'l' : next ? 'f' : null) : null
    out.push({ cls, text })
  }
  return out
}

// The source as lines of spans: a comment or string over several lines
// is split at its line breaks, so each line can be its own block
function highlightLines(source: string): Span[][] {
  const lines: Span[][] = [[]]
  for (const span of tokens(source)) {
    span.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ cls: span.cls, text: part })
    })
  }
  return lines
}

// The code, editable: a plain textarea with transparent text over the
// same text coloured and numbered by line, both wrapping alike and
// scrolled together
export function CodeArea({ value, onChange, onKeyDown }: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const lines = useMemo(() => highlightLines(value), [value])
  const back = useRef<HTMLPreElement>(null)
  return (
    <div className="code-area">
      <pre ref={back} aria-hidden>
        {lines.map((line, i) => (
          <div key={i} className="code-line">
            {line.map((s, j) => (s.cls ? <span key={j} className={`tk-${s.cls}`}>{s.text}</span> : s.text))}
          </div>
        ))}
      </pre>
      <textarea
        spellCheck={false}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={e => {
          back.current!.scrollTop = e.currentTarget.scrollTop
          back.current!.scrollLeft = e.currentTarget.scrollLeft
        }}
      />
    </div>
  )
}

// `code` and **bold** inside a line of Markdown
function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 1 ? <code key={i}>{part.slice(1, -1)}</code>
      : part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <Fragment key={i}>{part}</Fragment>)
}

// The Markdown the notes are written in: headings, bullet lists,
// paragraphs; anything else reads as a paragraph
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>)
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>)
    para = []
    list = []
  }
  for (const line of source.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.*)/)
    const item = line.match(/^\s*[-*]\s+(.*)/)
    if (heading) {
      flush()
      const H = heading[1].length === 1 ? 'h2' : 'h3'
      blocks.push(<H key={blocks.length}>{inline(heading[2])}</H>)
    } else if (item) {
      if (para.length) flush()
      list.push(item[1])
    } else if (!line.trim()) {
      flush()
    } else {
      if (list.length) flush()
      para.push(line.trim())
    }
  }
  flush()
  return <div className="md">{blocks}</div>
}
