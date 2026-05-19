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
