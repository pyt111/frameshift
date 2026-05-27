/**
 * AI 模块共享类型定义
 */

/** API 协议类型（用户可选的协议） */
export type AIApiProtocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages';

/** AI 配置接口（从前端设置传入） */
export interface AICustomConfig {
  /** 提供商类型 */
  provider: 'custom';
  /** API 协议 */
  apiProtocol?: AIApiProtocol;
  /** 自定义 API Base URL（如 https://api.openai.com/v1） */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 模型名称（如 gpt-4o, deepseek-chat, claude-3-5-sonnet） */
  model: string;
}

/** 可安全下发到前端的环境变量 AI 配置 */
export interface AIClientEnvConfig {
  configured: boolean;
  hasApiKey: boolean;
  apiProtocol: AIApiProtocol;
  baseUrl: string;
  model: string;
}

/** 从环境变量读取默认 AI 配置 */
export function getEnvAIConfig(): AICustomConfig | null {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const apiProtocol = process.env.AI_API_PROTOCOL as AIApiProtocol | undefined;

  if (baseUrl && apiKey && model) {
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

/** 从环境变量读取可下发给前端的默认配置，不包含 API Key */
export function getEnvAIClientConfig(): AIClientEnvConfig {
  const status = getEnvAIConfigStatus();
  return {
    configured: status.configured,
    hasApiKey: !!process.env.AI_API_KEY,
    apiProtocol: (process.env.AI_API_PROTOCOL as AIApiProtocol | undefined) || 'openai-completions',
    baseUrl: process.env.AI_BASE_URL || '',
    model: process.env.AI_MODEL || '',
  };
}

/** 合并前端自定义配置和服务端环境变量配置，前端值优先 */
export function resolveAIConfig(aiConfig?: AICustomConfig): AICustomConfig | null {
  const envConfig = getEnvAIConfig();

  if (!aiConfig) {
    return envConfig;
  }

  const resolved: AICustomConfig = {
    provider: 'custom',
    apiProtocol: aiConfig.apiProtocol || envConfig?.apiProtocol || 'openai-completions',
    baseUrl: aiConfig.baseUrl || envConfig?.baseUrl || '',
    apiKey: aiConfig.apiKey || envConfig?.apiKey || '',
    model: aiConfig.model || envConfig?.model || '',
  };

  if (resolved.baseUrl && resolved.apiKey && resolved.model) {
    return resolved;
  }

  return null;
}

/** 检查合并后的 AI 配置缺失项 */
export function getResolvedAIConfigMissing(aiConfig?: AICustomConfig): string[] {
  const envConfig = getEnvAIConfig();
  const resolved = {
    AI_BASE_URL: aiConfig?.baseUrl || envConfig?.baseUrl,
    AI_API_KEY: aiConfig?.apiKey || envConfig?.apiKey,
    AI_MODEL: aiConfig?.model || envConfig?.model,
  };

  return Object.entries(resolved)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

/** 检查环境变量 AI 配置是否完整 */
export function getEnvAIConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const required = {
    AI_BASE_URL: process.env.AI_BASE_URL,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
  };
}
