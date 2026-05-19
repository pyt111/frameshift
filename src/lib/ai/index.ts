/**
 * AI 辅助翻译模块 - 统一入口
 * 
 * 使用 LLM 对低置信度的翻译部分提供 AI 建议以及 AI 全量翻译模式
 * 
 * 支持两种 AI 提供商：
 * 1. 内置 z-ai-web-dev-sdk（默认，无需配置）
 * 2. 自定义 API（baseUrl + apiKey + model）
 *    - OpenAI Chat Completions（/v1/chat/completions）—— 事实标准，几乎所有服务商都兼容
 *    - OpenAI Responses（/v1/responses）—— OpenAI 新一代接口
 *    - Anthropic（/v1/messages）—— Claude 原生接口
 */

import type { Framework } from '../semantic-tree/types';
import type { AICustomConfig } from './types';
import { builtinAiTranslation } from './builtin';
import { customAiTranslation } from './openai';

// Re-export types
export type { AIApiProtocol, AICustomConfig } from './types';

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
 * 根据配置选择内置 SDK 或自定义 API
 */
export async function aiFullTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
  aiConfig?: AICustomConfig,
): Promise<{ code: string; success: boolean }> {
  try {
    // 如果配置了自定义 AI 提供商，使用自定义 API
    if (aiConfig && aiConfig.provider === 'custom' && aiConfig.baseUrl && aiConfig.apiKey && aiConfig.model) {
      return await customAiTranslation(sourceCode, from, to, aiConfig);
    }

    // 否则使用内置 SDK
    return await builtinAiTranslation(sourceCode, from, to);
  } catch (error) {
    console.error('AI 全量翻译失败:', error);
    return { code: '', success: false };
  }
}
