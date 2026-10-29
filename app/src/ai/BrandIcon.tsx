// Brand marks of the AI tools and providers (LobeHub Icons, MIT), inlined
// so the one-colour marks take the text colour in light and dark

import i_claude_color from '@lobehub/icons-static-svg/icons/claude-color.svg?raw'
import i_claudecode_color from '@lobehub/icons-static-svg/icons/claudecode-color.svg?raw'
import i_codex_color from '@lobehub/icons-static-svg/icons/codex-color.svg?raw'
import i_deepseek_color from '@lobehub/icons-static-svg/icons/deepseek-color.svg?raw'
import i_doubao_color from '@lobehub/icons-static-svg/icons/doubao-color.svg?raw'
import i_gemini_color from '@lobehub/icons-static-svg/icons/gemini-color.svg?raw'
import i_geminicli_color from '@lobehub/icons-static-svg/icons/geminicli-color.svg?raw'
import i_kimi_color from '@lobehub/icons-static-svg/icons/kimi-color.svg?raw'
import i_lmstudio from '@lobehub/icons-static-svg/icons/lmstudio.svg?raw'
import i_minimax_color from '@lobehub/icons-static-svg/icons/minimax-color.svg?raw'
import i_mistral_color from '@lobehub/icons-static-svg/icons/mistral-color.svg?raw'
import i_ollama from '@lobehub/icons-static-svg/icons/ollama.svg?raw'
import i_openai from '@lobehub/icons-static-svg/icons/openai.svg?raw'
import i_openrouter from '@lobehub/icons-static-svg/icons/openrouter.svg?raw'
import i_qwen_color from '@lobehub/icons-static-svg/icons/qwen-color.svg?raw'
import i_siliconcloud_color from '@lobehub/icons-static-svg/icons/siliconcloud-color.svg?raw'
import i_together_color from '@lobehub/icons-static-svg/icons/together-color.svg?raw'
import i_vllm_color from '@lobehub/icons-static-svg/icons/vllm-color.svg?raw'
import i_xai from '@lobehub/icons-static-svg/icons/xai.svg?raw'
import i_zhipu_color from '@lobehub/icons-static-svg/icons/zhipu-color.svg?raw'

const ICONS: Record<string, string> = {
  'cli:claude': i_claudecode_color,
  'cli:codex': i_codex_color,
  'cli:gemini': i_geminicli_color,
  'api:anthropic': i_claude_color,
  'api:openai': i_openai,
  'api:gemini': i_gemini_color,
  'api:openrouter': i_openrouter,
  'api:xai': i_xai,
  'api:mistral': i_mistral_color,
  'api:together': i_together_color,
  'api:deepseek': i_deepseek_color,
  'api:qwen': i_qwen_color,
  'api:moonshot': i_kimi_color,
  'api:zhipu': i_zhipu_color,
  'api:minimax': i_minimax_color,
  'api:doubao': i_doubao_color,
  'api:siliconflow': i_siliconcloud_color,
  'local:ollama': i_ollama,
  'local:lmstudio': i_lmstudio,
  'local:vllm': i_vllm_color
}

// kind:id, e.g. cli:claude, api:deepseek, local:ollama; null when there is none
export const hasBrand = (key: string) => key in ICONS

export function BrandIcon({ id, size = 16 }: { id: string; size?: number }) {
  const svg = ICONS[id]
  if (!svg) return null
  // The marks are sized 1em: the wrapper's font size sets them
  return <span className='brand-icon' style={{ fontSize: size }} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />
}
