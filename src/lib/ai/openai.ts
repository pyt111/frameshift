/**
 * OpenAI 兼容 API 翻译
 * 使用自定义 OpenAI 兼容 API 进行翻译
 * 支持 OpenAI、DeepSeek、Moonshot、ZhipuAI、Qwen 等兼容接口
 */

import type { Framework } from '../semantic-tree/types';
import type { AICustomConfig } from './types';
import { FRAMEWORK_LABELS, FRAMEWORK_LANG, buildTranslationRules } from './constants';
import { normalizeProtocol, buildApiUrl, extractContentFromAnyFormat } from './protocol';
import { extractCodeBlock } from './code-extraction';
import { anthropicAiTranslation } from './anthropic';

/**
 * 使用自定义 OpenAI 兼容 API 进行翻译
 * 支持 OpenAI、DeepSeek、Moonshot、ZhipuAI、Qwen 等兼容接口
 */
export async function customAiTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
  config: AICustomConfig,
): Promise<{ code: string; success: boolean }> {
  const protocol = normalizeProtocol(config.apiProtocol);
  
  // 根据 API 协议选择对应的翻译方法
  if (protocol === 'anthropic-messages') {
    return await anthropicAiTranslation(sourceCode, from, to, config);
  }
  
  // OpenAI 兼容协议（openai-completions / openai-responses）
  const timeoutMs = 30000; // 30s timeout for custom API
  const fromLabel = FRAMEWORK_LABELS[from] || from;
  const toLabel = FRAMEWORK_LABELS[to] || to;
  const fromLang = FRAMEWORK_LANG[from] || 'typescript';
  const toLang = FRAMEWORK_LANG[to] || 'typescript';

  const translationRules = buildTranslationRules(from, to);

  const systemPrompt = `你是一个前端框架代码翻译专家，精通 React、Vue 3 和 Angular 的等价转换。你只输出翻译后的代码，不输出任何解释。保持代码完整，不省略任何部分。`;

  const userPrompt = `请将以下 ${fromLabel} 代码完整翻译为等价的 ${toLabel} 代码。

## 翻译规则

${translationRules}

## 严格要求

1. **保留所有功能**：翻译后的代码必须保留原代码的所有功能、逻辑和交互行为
2. **保留所有 import**：将源框架的 import 转换为目标框架的等价 import，第三方库保留原样
3. **保留所有变量和函数**：所有变量声明、函数定义都必须保留并转换为目标框架的等价形式
4. **保留所有组件引用**：自定义组件、UI 库组件等都必须保留
5. **只输出代码**：只输出翻译后的完整代码，不要输出任何解释、说明或注释说明
6. **不要省略任何代码**：即使某些部分你觉得不重要，也必须完整翻译
7. **使用 TypeScript**：如果源代码使用 TypeScript，翻译后也应使用 TypeScript

## 源代码

\`\`\`${fromLang}
${sourceCode}
\`\`\`

## 翻译为 ${toLabel}

\`\`\`${toLang}`;

  // 智能构建请求 URL
  const apiUrl = buildApiUrl(config.baseUrl, protocol);
  console.log(`[Custom AI] Protocol: ${protocol}, Request URL: ${apiUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 根据协议构建不同的请求体
    let requestBody: Record<string, unknown>;
    
    if (protocol === 'openai-responses') {
      // OpenAI Responses API 格式
      // 注意：Responses API 不支持 temperature 和 max_output_tokens 参数，使用模型默认值
      // 部分中转服务也不支持这些参数，因此不发送以保持兼容性
      requestBody = {
        model: config.model,
        input: [
          { role: 'user', content: userPrompt },
        ],
        instructions: systemPrompt,
      };
    } else {
      // OpenAI Chat Completions 格式
      requestBody = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 统一读取响应文本，避免 Body already read 错误
    const responseText = await response.text().catch(() => '');

    if (!response.ok) {
      // 检测是否返回了 HTML（通常是 404 页面，说明 URL 不正确）
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        console.error(`Custom AI API returned HTML instead of JSON (${response.status}). URL may be incorrect: ${apiUrl}`);
        return { code: '', success: false };
      }
      console.error(`Custom AI API error (${response.status}): ${responseText.slice(0, 500)}`);
      return { code: '', success: false };
    }

    // 检测非 JSON 响应（HTML 页面等）
    if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
      console.error(`Custom AI API returned HTML. URL may be incorrect: ${apiUrl}`);
      return { code: '', success: false };
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`Custom AI API returned non-JSON response: ${responseText.slice(0, 200)}`);
      return { code: '', success: false };
    }
    // 多协议兼容解析：首选所选协议格式，回退到其他格式
    // （中转服务可能返回不同于所选协议的格式）
    const { content, detectedFormat } = extractContentFromAnyFormat(data, protocol);

    if (!content) {
      console.warn(`[Custom AI] 无法从响应中提取内容 (格式: ${detectedFormat}):`, JSON.stringify(data).slice(0, 500));
      return { code: '', success: false };
    }

    const expectedFormat = protocol === 'openai-responses' ? 'OpenAI Responses' : 'OpenAI Chat';
    if (detectedFormat !== expectedFormat) {
      console.warn(`[Custom AI] 响应格式不是 ${expectedFormat} 而是实际: ${detectedFormat}，中转服务可能统一了响应格式`);
    }

    // 提取代码块
    const extractedCode = extractCodeBlock(content, toLang);

    return { code: extractedCode, success: true };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Custom AI translation timeout');
    } else {
      console.error('Custom AI translation failed:', error);
    }
    return { code: '', success: false };
  }
}
