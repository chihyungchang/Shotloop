// Models through an OpenAI-compatible chat API: local servers (Ollama,
// LM Studio, llama.cpp, vLLM…) and hosted ones (OpenAI, Gemini, DeepSeek,
// OpenRouter, Qwen, GLM, Kimi…): the same narrow tools and the same loop as
// the Anthropic backend. Checks need a vision model (Qwen2.5-VL, Gemma 3,
// Llama 3.2 Vision…): stills go back to the model as images.

import http from 'node:http'
import https from 'node:https'
import { reason } from './events.ts'
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
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
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
// prompt, stills to look at); one silent for longer than this has hung
const REQUEST_TIMEOUT_MIN = 15

// A plain request, not fetch: Node's fetch gives up on a server that
// sends no headers within five minutes ("fetch failed"), and a local
// model reading a long prompt before answering can take longer
async function post(m: LocalModel, path: string, body: unknown) {
  const url = new URL(`${base(m.url)}${path}`)
  const data = JSON.stringify(body)
  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...auth(m.apiKey) },
      timeout: REQUEST_TIMEOUT_MIN * 60_000
    }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', d => (text += d))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error(`no answer within ${REQUEST_TIMEOUT_MIN} minutes`)))
    req.on('error', err => reject(new Error(`${m.url}: ${reason(err)}`)))
    req.end(data)
  })
  if (status < 200 || status >= 300) throw new Error(`${m.url}: ${status} ${text.slice(0, 400)}`)
  return JSON.parse(text)
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

// meter: filled with the tokens the server reports (when it does)
export async function runLocal(m: LocalModel, system: string, prompt: string, ctx: ToolContext, maxTurns = MAX_TURNS, meter?: AiMeter): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ]
  return runTurns(maxTurns, async say => {
    const res = await post(m, '/chat/completions', { model: m.model, messages, tools, tool_choice: 'auto' })
    if (meter) {
      const u = res.usage as { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined
      const cached = u?.prompt_tokens_details?.cached_tokens ?? 0
      meter.input += (u?.prompt_tokens ?? 0) - cached
      meter.cacheRead += cached
      meter.output += u?.completion_tokens ?? 0
      meter.turns += 1
      meter.model = m.model
    }
    const msg = res.choices?.[0]?.message as { content: string | null; tool_calls?: ToolCall[] } | undefined
    if (!msg) throw new Error('the model returned no message')
    say(msg.content)
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
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
