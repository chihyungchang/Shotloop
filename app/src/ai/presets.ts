// Hosted model providers, after open-design's BYOK presets: each is a
// protocol, a base URL and the models that suit Shotloop, best first.
// Only providers with such a model are listed: a build writes long
// drawing code, looks at its stills and fixes them over many tool calls,
// so a model must read images, call tools reliably and write code well.
// "anthropic" speaks /v1/messages (base URL without /v1; empty for
// Anthropic's own API); "openai" speaks chat completions (base URL with
// its version path). Any other endpoint goes through "custom".

export type Protocol = 'anthropic' | 'openai'

export interface Preset {
  id: string
  name: string
  protocol: Protocol
  url: string
  models: string[]
  keyUrl?: string
  keyHint?: string
  region: 'global' | 'cn'
}

// Where each provider lists its models, to check the presets against
// (llms.txt: the docs as plain text, for reading them whole):
//   Anthropic   platform.claude.com/llms.txt
//   OpenAI      developers.openai.com/api/docs/models · developers.openai.com/llms.txt
//   Gemini      aistudio.google.com/docs/models · aistudio.google.com/llms.txt
//   OpenRouter  openrouter.ai/api/v1/models (live JSON, no key) · openrouter.ai/llms.txt
//   xAI         docs.x.ai/developers/models.md · docs.x.ai/llms.txt
//   Together    docs.together.ai/docs/serverless-models.md · docs.together.ai/llms.txt
//   Kimi        platform.moonshot.cn/docs/models · platform.kimi.com/sitemap.xml
//   Qwen        help.aliyun.com/zh/model-studio/text-generation-model · help.aliyun.com/zh/llms.txt
//   GLM         docs.bigmodel.cn/cn/guide/start/model-overview · docs.bigmodel.cn/llms.txt
//   Doubao      docs.volcengine.com/docs/82379/1330310
//   DeepSeek    api-docs.deepseek.com/quick_start/pricing · api-docs.deepseek.com/sitemap.xml
//   MiniMax     platform.minimaxi.com/docs/api-reference/text-anthropic-api · platform.minimaxi.com/sitemap.xml
// Checked against each provider's docs on 2026-11-05. Left out: Mistral
// (coding short of the others), SiliconFlow (its vision models are Kimi
// K2, retired at the end of 2026), and every model without image input
// (glm-5.3, qwen3.7-max, deepseek-v4-pro, MiniMax M2) or without tools on
// chat completions (OpenAI's gpt-6.1, Responses API only)
export const PRESETS: Preset[] = [
  { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', url: '', region: 'global', keyHint: 'sk-ant-…',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1'], keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'OpenAI', protocol: 'openai', url: 'https://api.openai.com/v1', region: 'global', keyHint: 'sk-…',
    models: ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.5'], keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', name: 'Google Gemini', protocol: 'openai', url: 'https://generativelanguage.googleapis.com/v1beta/openai', region: 'global', keyHint: 'AIza…',
    models: ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'], keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai', url: 'https://openrouter.ai/api/v1', region: 'global', keyHint: 'sk-or-…',
    models: ['anthropic/claude-opus-5.5', 'openai/gpt-6-astra', 'google/gemini-4-argon', 'moonshotai/kimi-k3.1-pro', 'qwen/qwen3.8-max-0902'], keyUrl: 'https://openrouter.ai/keys' },
  { id: 'xai', name: 'xAI Grok', protocol: 'openai', url: 'https://api.x.ai/v1', region: 'global',
    models: ['grok-4.7', 'grok-4.6'], keyUrl: 'https://console.x.ai' },
  { id: 'together', name: 'Together AI', protocol: 'openai', url: 'https://api.together.ai/v1', region: 'global',
    models: ['moonshotai/Kimi-K3.1-Pro', 'moonshotai/Kimi-K3'], keyUrl: 'https://api.together.ai/settings/api-keys' },
  { id: 'moonshot', name: 'Kimi (Moonshot)', protocol: 'openai', url: 'https://api.moonshot.cn/v1', region: 'cn', keyHint: 'sk-…',
    models: ['kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'kimi-k3'], keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { id: 'qwen', name: '通义千问 Qwen', protocol: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', region: 'cn', keyHint: 'sk-…',
    models: ['qwen3.8-max', 'qwen3.7-plus', 'qwen3.8-flash'], keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1' },
  { id: 'zhipu', name: '智谱 GLM', protocol: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4', region: 'cn',
    models: ['glm-5v-turbo', 'glm-5.3-flash', 'glm-5.3-flashx'], keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'doubao', name: '豆包 (火山方舟)', protocol: 'openai', url: 'https://ark.cn-beijing.volces.com/api/v3', region: 'cn',
    models: ['doubao-seed-2-1-pro-260915', 'doubao-seed-evolving', 'doubao-seed-2-1-lite-260915'], keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey' },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'openai', url: 'https://api.deepseek.com', region: 'cn', keyHint: 'sk-…',
    models: ['deepseek-flash'], keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'minimax', name: 'MiniMax', protocol: 'anthropic', url: 'https://api.minimax.cn/anthropic', region: 'cn',
    models: ['MiniMax-M3.1-Flash', 'MiniMax-M3'], keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key' },
  { id: 'custom', name: 'Custom', protocol: 'openai', url: '', region: 'global', models: [] }
]

// A provider saved before it left the list reads as custom: its saved
// URL and model keep working, shown as they are
export const presetById = (id: string) => PRESETS.find(p => p.id === id) ?? PRESETS.find(p => p.id === 'custom')!

