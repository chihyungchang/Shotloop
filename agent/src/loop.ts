// The agent loop: Claude calls the tools in tools.ts until the task is
// done. One request per turn; every tool call of a turn is answered in
// one user message.

import Anthropic from '@anthropic-ai/sdk'
import { runTool, TOOLS, type ToolContext, type ToolOutput } from './tools.ts'
import { MAX_TURNS, runTurns } from './turns.ts'

export const MODELS = {
  // Planning and scene code
  code: 'claude-opus-5-5',
  // Routine edits and checks
  routine: 'claude-sonnet-5-5',
  // The copy and storyboard
  copy: 'claude-opus-5-5'
} as const

export interface AgentOptions {
  model: string
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  system: string
  prompt: string
  ctx: ToolContext
  maxTurns?: number
  // Another Anthropic-compatible endpoint (MiniMax, DeepSeek, a proxy)
  // and its key; by default Anthropic's own API and ANTHROPIC_API_KEY
  baseURL?: string
  apiKey?: string
}

// A tool's output as a tool_result: text alone as a string, images each
// after its label
export function toToolResult(id: string, out: ToolOutput): Anthropic.Beta.BetaToolResultBlockParam {
  const content = out.images.length
    ? [
        ...out.text.map(text => ({ type: 'text' as const, text })),
        ...out.images.flatMap(i => [
          ...(i.label ? [{ type: 'text' as const, text: `${i.label}:` }] : []),
          { type: 'image' as const, source: { type: 'base64' as const, media_type: i.mediaType, data: i.data } }
        ])
      ]
    : out.text.join('\n')
  return { type: 'tool_result', tool_use_id: id, content, ...(out.isError ? { is_error: true } : {}) }
}

// Returns the agent's last text: its summary for the person
export async function runAgent({ model, effort, system, prompt, ctx, maxTurns = MAX_TURNS, baseURL, apiKey }: AgentOptions): Promise<string> {
  // The user's own key, from the app; Anthropic-only request options are
  // sent to Anthropic's API only
  const client = new Anthropic({ ...(apiKey ? { apiKey } : {}), ...(baseURL ? { baseURL } : {}) })
  const official = !baseURL || new URL(baseURL).hostname.endsWith('anthropic.com')
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }]

  return runTurns(maxTurns, async say => {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      tools: TOOLS,
      messages,
      ...(official
        ? {
            output_config: { effort },
            cache_control: { type: 'ephemeral' as const },
            // If a safety classifier declines, the API retries on a fallback model
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default' as const
          }
        : {})
    })

    for (const block of res.content) if (block.type === 'text') say(block.text)
    if (res.stop_reason === 'refusal') throw new Error('the request was declined by the model')
    if (res.stop_reason === 'max_tokens') throw new Error('the response hit max_tokens before finishing')

    messages.push({ role: 'assistant', content: res.content })
    if (res.stop_reason === 'pause_turn') return true

    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (!calls.length) return false
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of calls) results.push(toToolResult(call.id, await runTool(ctx, call.name, call.input as Record<string, unknown>)))
    messages.push({ role: 'user', content: results })
    return true
  })
}
