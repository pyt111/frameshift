/**
 * AI 模块共享类型定义
 */

/** API 协议类型（用户可选的协议） */
export type AIApiProtocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages';

/** AI 配置接口（从前端设置传入） */
export interface AICustomConfig {
  /** 提供商类型 */
  provider: 'builtin' | 'custom';
  /** API 协议 */
  apiProtocol?: AIApiProtocol;
  /** 自定义 API Base URL（如 https://api.openai.com/v1） */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 模型名称（如 gpt-4o, deepseek-chat, claude-3-5-sonnet） */
  model: string;
}

/**
 * 从环境变量读取 AI 配置
 * 本地部署时，内置 AI (z-ai-web-dev-sdk) 不可用，
 * 通过环境变量配置默认 AI 提供商
 */
export function getEnvAIConfig(): AICustomConfig | null {
  const provider = process.env.AI_PROVIDER;
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const apiProtocol = process.env.AI_API_PROTOCOL as AIApiProtocol | undefined;

  if (provider === 'env' && baseUrl && apiKey && model) {
    return {
      provider: 'custom',
      apiProtocol: apiProtocol || 'openai-completions',
      baseUrl,
      apiKey,
      model,
    };
  }

  return null;
}

/**
 * 判断内置 AI (z-ai-web-dev-sdk) 是否可用
 * 在非沙箱环境中不可用
 */
export function isBuiltinAvailable(): boolean {
  // 如果环境变量配置了 AI_PROVIDER=env，说明用户明确选择使用环境变量配置
  return process.env.AI_PROVIDER !== 'env';
}
