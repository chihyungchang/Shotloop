// Models through an OpenAI-compatible chat API: local servers (Ollama,
// LM Studio, llama.cpp, vLLM…) and hosted ones (OpenAI, Gemini, DeepSeek,
// OpenRouter, Qwen, GLM, Kimi…): the same narrow tools and the same loop as
// the Anthropic backend. Checks need a vision model (Qwen2.5-VL, Gemma 3,
// Llama 3.2 Vision…): stills go back to the model as images.

import http from 'node:http'
import https from 'node:https'
import { emit, reason } from './events.ts'
import { runTool, TOOLS, type ToolContext, type ToolOutput } from './tools.ts'
import { MAX_TURNS, runTurns } from './turns.ts'
import type { AiMeter } from '../../engine/shotloop/protocol.d.ts'

export interface LocalModel {
  url: string // base URL ending in /v1, e.g. http://localhost:11434/v1
  model: string
  apiKey?: string
}

type Message =
  | { role: 'system' | 'user'; content: string | Part[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }
  | { role: 'tool'; tool_call_id: string; content: string }
type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const base = (url: string) => url.replace(/\/+$/, '')
const auth = (apiKey?: string): Record<string, string> => (apiKey ? { authorization: `Bearer ${apiKey}` } : {})

// One answer may take long on a local machine (a big model, a long
// prompt, stills to look at); one silent for longer than this has hung.
// A streamed reply is silent only while the server reads the prompt,
// which on a slow machine with a long context can take many minutes
const REQUEST_TIMEOUT_MIN = 30

interface Usage { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
// reasoning: the model's thinking, when the server sends it
interface Reply { content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string; usage?: Usage }
// What the model is doing as a reply streams in: reading the prompt (no
// token yet), thinking, or writing its answer; n: its tokens so far
export type Stage = 'read' | 'think' | 'write'

// Turns thinking off where the server lets a request say so: LM Studio
// and Ollama read reasoning_effort, vLLM and llama.cpp the chat template's
// switch. A model that doesn't think ignores both
const NO_THINKING = { reasoning_effort: 'none', chat_template_kwargs: { enable_thinking: false } }

// One chat request, streamed: the reply put together from its pieces,
// `on` told how far the model is as they come. A plain request, not
// fetch: Node's fetch gives up on a server that sends no headers within
// five minutes ("fetch failed"), and a local model reading a long prompt
// can take longer. A server that answers in one piece is read as such
async function chat(m: LocalModel, body: Record<string, unknown>, on: (stage: Stage, n: number) => void = () => {}): Promise<Reply> {
  const url = new URL(`${base(m.url)}/chat/completions`)
  const data = JSON.stringify({ ...body, stream: true, stream_options: { include_usage: true } })
  on('read', 0)
  return new Promise<Reply>((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...auth(m.apiKey) },
      timeout: REQUEST_TIMEOUT_MIN * 60_000
    }, res => {
      res.setEncoding('utf8')
      const status = res.statusCode ?? 0
      const streamed = /event-stream/.test(res.headers['content-type'] ?? '')
      const reply = new StreamedReply(on)
      let text = ''
      res.on('data', (d: string) => {
        if (status < 200 || status >= 300 || !streamed) text += d
        else {
          try {
            reply.feed(d)
          } catch (err) {
            req.destroy(err as Error)
          }
        }
      })
      res.on('end', () => {
        if (status < 200 || status >= 300) return reject(new Error(`${m.url}: ${status} ${text.slice(0, 400)}`))
        try {
          if (streamed) return resolve(reply.done())
          const whole = JSON.parse(text)
          const message = whole.choices?.[0]?.message
          if (!message) throw new Error('the model returned no message')
          resolve({ ...message, usage: whole.usage })
        } catch (err) {
          reject(err)
        }
      })
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error(`no answer within ${REQUEST_TIMEOUT_MIN} minutes`)))
    req.on('error', err => reject(new Error(`${m.url}: ${reason(err)}`)))
    req.end(data)
  })
}

// A streamed reply's server-sent events, put back together: the text,
// each tool call's name and arguments (in pieces, by index), the usage
class StreamedReply {
  private buffer = ''
  private content = ''
  private reasoning = ''
  private calls: ToolCall[] = []
  private usage: Usage | undefined
  private thought = 0
  private written = 0
  private on: (stage: Stage, n: number) => void
  constructor(on: (stage: Stage, n: number) => void) {
    this.on = on
  }

  feed(chunk: string) {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.match(/^data:\s*(.*)$/)?.[1]
      if (!data || data === '[DONE]') continue
      const ev = JSON.parse(data)
      if (ev.error) throw new Error(typeof ev.error === 'string' ? ev.error : ev.error.message ?? JSON.stringify(ev.error))
      if (ev.usage) this.usage = ev.usage
      const delta = ev.choices?.[0]?.delta
      if (!delta) continue
      if (delta.reasoning_content || delta.reasoning) {
        this.reasoning += delta.reasoning_content || delta.reasoning
        this.on('think', ++this.thought)
      }
      if (delta.content) this.content += delta.content
      for (const piece of delta.tool_calls ?? []) {
        const call = (this.calls[piece.index ?? 0] ??= { id: '', type: 'function', function: { name: '', arguments: '' } })
        if (piece.id) call.id = piece.id
        if (piece.function?.name) call.function.name += piece.function.name
        if (piece.function?.arguments) call.function.arguments += piece.function.arguments
      }
      if (delta.content || delta.tool_calls) this.on('write', ++this.written)
    }
  }

  done(): Reply {
    // Some servers leave a call's id out: the tool message needs one
    const calls = this.calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }))
    return { content: this.content || null, tool_calls: calls.length ? calls : undefined, reasoning_content: this.reasoning || undefined, usage: this.usage }
  }
}

// Not chat models: embeddings, speech, images, video, moderation…
const NOT_CHAT = /embed|moderation|rerank|whisper|tts|transcri|speech|dall-e|stable-diffusion|flux|image-|imagen|veo|sora|bge-|\b(t2i|i2v|asr|ocr)\b/i

// The chat models a server offers (GET /models)
export async function listModels(url: string, apiKey?: string): Promise<string[]> {
  const res = await fetch(`${base(url)}/models`, {
    headers: auth(apiKey),
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`${url}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { data?: { id: string }[] }
  return (body.data ?? []).map(d => d.id.replace(/^models\//, '')).filter(id => !NOT_CHAT.test(id)).sort()
}

// Local servers load a model with a small window unless told otherwise
// (LM Studio 4096), less than the system prompt and tools alone; a run
// with stills needs far more
export const MIN_CONTEXT = 32768

// The context window the server loaded the model with, where it tells:
// LM Studio's own API, vLLM's model list, llama.cpp's props, Ollama's
// running models. null when none does (or the model isn't loaded yet)
export async function contextLength(m: LocalModel): Promise<number | null> {
  const root = base(m.url).replace(/\/v1$/, '')
  const get = async (url: string): Promise<any> => {
    try {
      const res = await fetch(url, { headers: auth(m.apiKey), signal: AbortSignal.timeout(5000) })
      return res.ok ? await res.json() : null
    } catch {
      // Not this kind of server: another answer may tell
      return null
    }
  }
  const [lmstudio, models, props, ollama] = await Promise.all([
    get(`${root}/api/v0/models`),
    get(`${base(m.url)}/models`),
    get(`${root}/props`),
    get(`${root}/api/ps`)
  ])
  const n = lmstudio?.data?.find((d: any) => d.id === m.model)?.loaded_context_length
    ?? models?.data?.find((d: any) => d.id === m.model)?.max_model_len
    ?? props?.default_generation_settings?.n_ctx
    ?? ollama?.models?.find((d: any) => d.name === m.model || d.model === m.model)?.context_length
  return typeof n === 'number' && n > 0 ? n : null
}

// Fails before the first request when the window is known to be too small
export async function checkContext(m: LocalModel) {
  const n = await contextLength(m)
  if (n !== null && n < MIN_CONTEXT) throw new Error(`${m.model} is loaded with a context length of ${n} tokens; Shotloop needs at least ${MIN_CONTEXT}`)
  return n
}

const tools = TOOLS.map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema }
}))

// A tool's output for the chat API: tool messages carry text only, so its
// images go into the user message that follows the turn's tool messages,
// each after the tool's name and its own label
export function toToolMessage(call: ToolCall, out: ToolOutput): { message: Message; images: Part[] } {
  const text = out.text.join('\n')
  const images = out.images.flatMap((i, n): Part[] => [
    { type: 'text', text: `${call.function.name} (${call.id}) ${i.label ?? `image ${n + 1}`}:` },
    { type: 'image_url', image_url: { url: `data:${i.mediaType};base64,${i.data}` } }
  ])
  const content = out.isError ? `Error: ${text}` : `${text}${images.length ? `${text ? ' ' : ''}(the images follow)` : ''}`
  return { message: { role: 'tool', tool_call_id: call.id, content }, images }
}

// The model's arguments are JSON text: bad JSON goes back as the error
async function callTool(ctx: ToolContext, call: ToolCall): Promise<ToolOutput> {
  let args: Record<string, unknown>
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
  } catch (err) {
    return { text: [`the arguments are not valid JSON: ${reason(err)}`], images: [], isError: true }
  }
  return runTool(ctx, call.function.name, args)
}

// How the tokens of one request are shown: what the model is doing and
// how many it has made, at most every second
function progress() {
  let last = 0
  return (stage: Stage, n: number) => {
    const now = Date.now()
    if (stage !== 'read' && now - last < 1000) return
    last = now
    emit({ type: 'progress', stage, done: n, total: 0, eta: null })
  }
}

// One request: thinking off when asked, and again without
// reasoning_effort if the server refuses that field (it is newer than the
// chat template's switch)
async function ask(m: LocalModel, body: Record<string, unknown>, think: boolean, on?: (stage: Stage, n: number) => void) {
  if (think) return chat(m, body, on)
  try {
    return await chat(m, { ...body, ...NO_THINKING }, on)
  } catch (err) {
    if (!/\b400\b.*reasoning/i.test(reason(err))) throw err
    return chat(m, { ...body, chat_template_kwargs: NO_THINKING.chat_template_kwargs }, on)
  }
}

// meter: filled with the tokens the server reports (when it does)
// think: false turns the model's thinking off (local servers); true
// leaves it to the server
export async function runLocal(m: LocalModel, system: string, prompt: string, ctx: ToolContext, { maxTurns = MAX_TURNS, meter, think = true }: { maxTurns?: number; meter?: AiMeter; think?: boolean } = {}): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ]
  const on = progress()
  return runTurns(maxTurns, async say => {
    const msg = await ask(m, { model: m.model, messages, tools, tool_choice: 'auto' }, think, on)
    if (meter) {
      const u = msg.usage
      const cached = u?.prompt_tokens_details?.cached_tokens ?? 0
      meter.input += (u?.prompt_tokens ?? 0) - cached
      meter.cacheRead += cached
      meter.output += u?.completion_tokens ?? 0
      meter.turns += 1
      meter.model = m.model
    }
    say(msg.content)
    // The thinking goes back with the turn: models that always think
    // (Kimi K3, DeepSeek) want it in a tool loop
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls, ...(msg.reasoning_content ? { reasoning_content: msg.reasoning_content } : {}) })
    if (!msg.tool_calls?.length) return false

    const images: Part[] = []
    for (const call of msg.tool_calls) {
      const out = toToolMessage(call, await callTool(ctx, call))
      messages.push(out.message)
      images.push(...out.images)
    }
    if (images.length) messages.push({ role: 'user', content: [{ type: 'text', text: 'Images from the tools above (render_stills: start, middle, end):' }, ...images] })
    return true
  })
}

// What a plan takes the model to write, thinking included: Claude's plans
// run about 13,000 tokens over a dozen turns (a project's ai-usage.jsonl)
const PLAN_TOKENS = 13_000

// The model's speed as the person will get it: tokens a second over a
// short answer, once the first token is out, and what that makes a plan
export async function measureSpeed(m: LocalModel, think: boolean) {
  let first = 0
  let n = 0
  await ask(m, { model: m.model, messages: [{ role: 'user', content: 'Count from 1 to 80 in words, separated by commas.' }], max_tokens: 160 }, think, stage => {
    if (stage === 'read') return
    if (!first) first = Date.now()
    n++
  })
  const seconds = (Date.now() - first) / 1000
  if (n < 10 || seconds <= 0) return null
  const perSecond = (n - 1) / seconds
  return { perSecond: Math.round(perSecond * 10) / 10, planMinutes: Math.ceil(PLAN_TOKENS / perSecond / 60) }
}
