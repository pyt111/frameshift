/**
 * Anthropic 协议 AI 翻译
 * 使用 Anthropic Messages API 进行翻译，支持 Claude 系列模型和 Anthropic 兼容接口
 */

import type { Framework } from '../semantic-tree/types';
import type { AICustomConfig } from './types';
import { FRAMEWORK_LABELS, FRAMEWORK_LANG, buildTranslationRules } from './constants';
import { buildApiUrl } from './protocol';
import { extractContentFromAnyFormat } from './protocol';
import { extractCodeBlock } from './code-extraction';

/**
 * 使用 Anthropic 协议 API 进行翻译
 * 支持 Claude 系列模型和 Anthropic 兼容接口
 */
export async function anthropicAiTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
  config: AICustomConfig,
): Promise<{ code: string; success: boolean }> {
  const timeoutMs = 60000; // Claude 模型可能需要更长时间
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

  // 构建 Anthropic API URL
  const apiUrl = buildApiUrl(config.baseUrl, 'anthropic-messages');
  console.log(`[Anthropic Messages AI] Request URL: ${apiUrl}, Model: ${config.model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 统一读取响应文本，避免 Body already read 错误
    const responseText = await response.text().catch(() => '');

    if (!response.ok) {
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        console.error(`Anthropic API returned HTML instead of JSON (${response.status}). URL may be incorrect: ${apiUrl}`);
        return { code: '', success: false };
      }
      console.error(`Anthropic API error (${response.status}): ${responseText.slice(0, 500)}`);
      return { code: '', success: false };
    }

    // 检测非 JSON 响应（HTML 页面等）
    if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
      console.error(`Anthropic API returned HTML. URL may be incorrect: ${apiUrl}`);
      return { code: '', success: false };
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`Anthropic API returned non-JSON response: ${responseText.slice(0, 200)}`);
      return { code: '', success: false };
    }
    // 多协议兼容解析：首选 Anthropic 格式，回退到其他格式
    // （中转服务可能返回 OpenAI 格式而非 Anthropic 格式）
    const { content, detectedFormat } = extractContentFromAnyFormat(data, 'anthropic-messages');

    if (!content) {
      console.error('Anthropic API returned empty content:', JSON.stringify(data).slice(0, 500));
      return { code: '', success: false };
    }

    if (detectedFormat !== 'Anthropic') {
      console.warn(`[Anthropic AI] 响应格式不是 Anthropic 而是实际: ${detectedFormat}，中转服务可能统一了响应格式`);
    }

    // 提取代码块
    const extractedCode = extractCodeBlock(content, toLang);

    return { code: extractedCode, success: true };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Anthropic AI translation timeout');
    } else {
      console.error('Anthropic AI translation failed:', error);
    }
    return { code: '', success: false };
  }
}
