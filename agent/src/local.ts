// Models through an OpenAI-compatible chat API: local servers (Ollama,
// LM Studio, llama.cpp, vLLM…) and hosted ones (OpenAI, Gemini, DeepSeek,
// OpenRouter, Qwen, GLM, Kimi…): the same narrow tools and the same loop as
// the Anthropic backend. Checks need a vision model (Qwen2.5-VL, Gemma 3,
// Llama 3.2 Vision…): stills go back to the model as images.

import { reason } from './events.ts'
import { runTool, TOOLS, type ToolContext, type ToolOutput } from './tools.ts'
import { MAX_TURNS, runTurns } from './turns.ts'

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

// One answer may take long on a local machine (a big model, a long
// prompt, stills to look at); one that takes longer than this has hung
const REQUEST_TIMEOUT_MIN = 15

async function post(m: LocalModel, path: string, body: unknown) {
  const res = await fetch(`${base(m.url)}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(m.apiKey ? { authorization: `Bearer ${m.apiKey}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MIN * 60_000)
  }).catch(err => {
    if (err?.name === 'TimeoutError') throw new Error(`${m.url}: no answer within ${REQUEST_TIMEOUT_MIN} minutes`)
    throw err
  })
  if (!res.ok) throw new Error(`${m.url}: ${res.status} ${(await res.text()).slice(0, 400)}`)
  return res.json()
}

// Not chat models: embeddings, speech, images, video, moderation…
const NOT_CHAT = /embed|moderation|rerank|whisper|tts|transcri|speech|dall-e|stable-diffusion|flux|image-|imagen|veo|sora|bge-|\b(t2i|i2v|asr|ocr)\b/i

// The chat models a server offers (GET /models)
export async function listModels(url: string, apiKey?: string): Promise<string[]> {
  const res = await fetch(`${base(url)}/models`, {
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`${url}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { data?: { id: string }[] }
  return (body.data ?? []).map(d => d.id.replace(/^models\//, '')).filter(id => !NOT_CHAT.test(id)).sort()
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

export async function runLocal(m: LocalModel, system: string, prompt: string, ctx: ToolContext, maxTurns = MAX_TURNS): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ]
  return runTurns(maxTurns, async say => {
    const res = await post(m, '/chat/completions', { model: m.model, messages, tools, tool_choice: 'auto' })
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
