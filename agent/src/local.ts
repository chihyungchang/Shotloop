// Models through an OpenAI-compatible chat API: local servers (Ollama,
// LM Studio, llama.cpp, vLLM…) and hosted ones (OpenAI, Gemini, DeepSeek,
// OpenRouter, Qwen, GLM, Kimi…): the same narrow tools and the same loop as
// the Anthropic backend. Checks need a vision model (Qwen2.5-VL, Gemma 3,
// Llama 3.2 Vision…): stills go back to the model as images.

import { emit } from './events.ts'
import { runTool, TOOLS, type ToolContext } from './tools.ts'

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

async function post(m: LocalModel, path: string, body: unknown) {
  const res = await fetch(`${base(m.url)}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(m.apiKey ? { authorization: `Bearer ${m.apiKey}` } : {}) },
    body: JSON.stringify(body)
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

export async function runLocal(m: LocalModel, system: string, prompt: string, ctx: ToolContext, maxTurns = 40): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ]
  let last = ''
  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await post(m, '/chat/completions', { model: m.model, messages, tools, tool_choice: 'auto' })
    const msg = res.choices?.[0]?.message as { content: string | null; tool_calls?: ToolCall[] } | undefined
    if (!msg) throw new Error('the model returned no message')
    if (msg.content?.trim()) {
      last = msg.content.trim()
      emit({ type: 'text', text: last })
    }
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
    if (!msg.tool_calls?.length) return last

    // Tool messages carry text only; stills follow as one user message
    const images: Part[] = []
    for (const call of msg.tool_calls) {
      let content: string
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
        const result = await runTool(ctx, call.function.name, args)
        if (typeof result === 'string' || result == null) content = result ?? ''
        else {
          content = result.filter(b => b.type === 'text').map(b => (b.type === 'text' ? b.text : '')).join(' ')
          for (const b of result) {
            if (b.type === 'image' && b.source.type === 'base64') {
              images.push({ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } })
            }
          }
          if (images.length) content += ' (the stills follow as images)'
        }
      } catch (err) {
        content = `Error: ${err instanceof Error ? err.message : String(err)}`
        emit({ type: 'tool', name: call.function.name, summary: `failed: ${content.split('\n')[0]}` })
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content })
    }
    if (images.length) messages.push({ role: 'user', content: [{ type: 'text', text: 'Stills from render_stills, in order start, middle, end:' }, ...images] })
  }
  throw new Error(`stopped after ${maxTurns} turns without finishing`)
}
