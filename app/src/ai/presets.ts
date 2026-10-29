// Hosted model providers, after open-design's BYOK presets: each is a
// protocol, a base URL and a few suggested models (the live list comes
// from the provider's /models). "anthropic" speaks /v1/messages (base URL
// without /v1; empty for Anthropic's own API); "openai" speaks chat
// completions (base URL with its version path). Checks look at stills,
// so `vision: false` warns that checks need another model.

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
  vision?: boolean
}

export const PRESETS: Preset[] = [
  { id: 'anthropic', name: 'Anthropic', protocol: 'anthropic', url: '', region: 'global', keyHint: 'sk-ant-…',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-haiku-4-5'], keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'OpenAI', protocol: 'openai', url: 'https://api.openai.com/v1', region: 'global', keyHint: 'sk-…',
    models: ['gpt-5.5', 'gpt-5.2', 'gpt-4o'], keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', name: 'Google Gemini', protocol: 'openai', url: 'https://generativelanguage.googleapis.com/v1beta/openai', region: 'global', keyHint: 'AIza…',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-pro'], keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai', url: 'https://openrouter.ai/api/v1', region: 'global', keyHint: 'sk-or-…',
    models: ['anthropic/claude-sonnet-4.6', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'qwen/qwen3-vl-235b-a22b-instruct'], keyUrl: 'https://openrouter.ai/keys' },
  { id: 'xai', name: 'xAI Grok', protocol: 'openai', url: 'https://api.x.ai/v1', region: 'global',
    models: ['grok-4', 'grok-3-mini'], keyUrl: 'https://console.x.ai' },
  { id: 'mistral', name: 'Mistral', protocol: 'openai', url: 'https://api.mistral.ai/v1', region: 'global',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'pixtral-large-latest'], keyUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'together', name: 'Together AI', protocol: 'openai', url: 'https://api.together.xyz/v1', region: 'global',
    models: ['Qwen/Qwen2.5-VL-72B-Instruct', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'], keyUrl: 'https://api.together.ai/settings/api-keys' },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'openai', url: 'https://api.deepseek.com/v1', region: 'cn', keyHint: 'sk-…', vision: false,
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'], keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'qwen', name: '通义千问 Qwen', protocol: 'openai', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', region: 'cn', keyHint: 'sk-…',
    models: ['qwen3-vl-plus', 'qwen-max', 'qwen-plus', 'qwen3-coder-plus'], keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1' },
  { id: 'moonshot', name: 'Kimi (Moonshot)', protocol: 'openai', url: 'https://api.moonshot.cn/v1', region: 'cn', keyHint: 'sk-…',
    models: ['kimi-k2.6', 'kimi-k2.5', 'moonshot-v1-128k-vision-preview'], keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { id: 'zhipu', name: '智谱 GLM', protocol: 'openai', url: 'https://open.bigmodel.cn/api/paas/v4', region: 'cn',
    models: ['glm-4.6', 'glm-4.5v', 'glm-4-plus'], keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'minimax', name: 'MiniMax', protocol: 'anthropic', url: 'https://api.minimaxi.com/anthropic', region: 'cn', vision: false,
    models: ['MiniMax-M2.7', 'MiniMax-M2.5'], keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key' },
  { id: 'doubao', name: '豆包 (火山方舟)', protocol: 'openai', url: 'https://ark.cn-beijing.volces.com/api/v3', region: 'cn',
    models: ['doubao-seed-1-6', 'doubao-seed-1-6-thinking'], keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey' },
  { id: 'siliconflow', name: '硅基流动 SiliconFlow', protocol: 'openai', url: 'https://api.siliconflow.cn/v1', region: 'cn',
    models: ['Qwen/Qwen2.5-VL-72B-Instruct', 'deepseek-ai/DeepSeek-V3.1', 'zai-org/GLM-4.5V'], keyUrl: 'https://cloud.siliconflow.cn/account/ak' },
  { id: 'custom', name: 'Custom', protocol: 'openai', url: '', region: 'global', models: [] }
]

export const presetById = (id: string) => PRESETS.find(p => p.id === id) ?? PRESETS[0]

// Local OpenAI-compatible servers the agent looks for (agent/src/providers.ts)
export const LOCAL_SERVERS = [
  { id: 'ollama', name: 'Ollama', url: 'http://localhost:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', url: 'http://localhost:1234/v1' },
  { id: 'vllm', name: 'vLLM', url: 'http://localhost:8000/v1' },
  { id: 'llamacpp', name: 'llama.cpp', url: 'http://localhost:8080/v1' }
]
