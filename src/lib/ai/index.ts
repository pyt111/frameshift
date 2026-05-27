/**
 * AI 辅助翻译模块 - 统一入口
 * 
 * 使用 LLM 对低置信度的翻译部分提供 AI 建议以及 AI 全量翻译模式
 * 
 * 支持两种 AI 配置来源：
 * 1. 自定义 API（baseUrl + apiKey + model，从前端设置传入）
 * 2. 服务端环境变量可作为自定义 API 的默认值和缺失字段补齐来源
 *    - OpenAI Chat Completions（/v1/chat/completions）—— 事实标准，几乎所有服务商都兼容
 *    - OpenAI Responses（/v1/responses）—— OpenAI 新一代接口
 *    - Anthropic（/v1/messages）—— Claude 原生接口
 */

import type { Framework } from '../semantic-tree/types';
import type { AICustomConfig } from './types';
import { getEnvAIConfig, resolveAIConfig } from './types';
import { customAiTranslation } from './openai';

// Re-export types
export type { AIApiProtocol, AICustomConfig } from './types';
export { getEnvAIConfig, getEnvAIConfigStatus } from './types';

// Re-export constants
export { FRAMEWORK_LANG } from './constants';

// Re-export protocol utilities
export { normalizeProtocol, buildApiUrl } from './protocol';

// Re-export stream translation
export { streamAiTranslation } from './stream';

// Re-export connection test
export { testAIConnection } from './connection-test';

// Re-export code extraction
export { extractCodeBlock } from './code-extraction';

/**
 * AI 全量翻译
 * 配置优先级：前端自定义配置 > 环境变量配置
 */
export async function aiFullTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
  aiConfig?: AICustomConfig,
): Promise<{ code: string; success: boolean }> {
  try {
    const effectiveConfig = resolveAIConfig(aiConfig);
    if (effectiveConfig) {
      return await customAiTranslation(sourceCode, from, to, effectiveConfig);
    }

    console.warn('AI 配置不完整，请配置环境变量或在前端设置中配置自定义 API');
    return { code: '', success: false };
  } catch (error) {
    console.error('AI 全量翻译失败:', error);
    return { code: '', success: false };
  }
}
