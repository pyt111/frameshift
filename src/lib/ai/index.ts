/**
 * AI 辅助翻译模块 - 统一入口
 * 
 * 使用 LLM 对低置信度的翻译部分提供 AI 建议以及 AI 全量翻译模式
 * 
 * 支持两种 AI 提供商：
 * 1. 内置 z-ai-web-dev-sdk（默认，仅云端沙箱可用）
 * 2. 环境变量配置（本地部署推荐）
 * 3. 自定义 API（baseUrl + apiKey + model，从前端设置传入）
 *    - OpenAI Chat Completions（/v1/chat/completions）—— 事实标准，几乎所有服务商都兼容
 *    - OpenAI Responses（/v1/responses）—— OpenAI 新一代接口
 *    - Anthropic（/v1/messages）—— Claude 原生接口
 */

import type { Framework } from '../semantic-tree/types';
import type { AICustomConfig } from './types';
import { getEnvAIConfig, isBuiltinAvailable } from './types';
import { builtinAiTranslation } from './builtin';
import { customAiTranslation } from './openai';

// Re-export types
export type { AIApiProtocol, AICustomConfig } from './types';
export { getEnvAIConfig, isBuiltinAvailable } from './types';

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
 * 配置优先级：前端自定义配置 > 环境变量配置 > 内置 SDK
 */
export async function aiFullTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
  aiConfig?: AICustomConfig,
): Promise<{ code: string; success: boolean }> {
  try {
    // 1. 如果前端配置了自定义 AI 提供商，优先使用
    if (aiConfig && aiConfig.provider === 'custom' && aiConfig.baseUrl && aiConfig.apiKey && aiConfig.model) {
      return await customAiTranslation(sourceCode, from, to, aiConfig);
    }

    // 2. 如果环境变量配置了 AI 提供商，使用环境变量
    const envConfig = getEnvAIConfig();
    if (envConfig) {
      return await customAiTranslation(sourceCode, from, to, envConfig);
    }

    // 3. 否则使用内置 SDK（仅云端沙箱可用）
    if (!isBuiltinAvailable()) {
      console.warn('内置 AI 不可用，请在 .env 中配置 AI_PROVIDER=env 及相关变量，或在前端设置中配置自定义 API');
      return { code: '', success: false };
    }
    return await builtinAiTranslation(sourceCode, from, to);
  } catch (error) {
    console.error('AI 全量翻译失败:', error);
    return { code: '', success: false };
  }
}
