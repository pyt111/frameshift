/**
 * 内置 AI 翻译
 * 使用内置 z-ai-web-dev-sdk 进行翻译
 */

import ZAI from 'z-ai-web-dev-sdk';
import type { Framework } from '../semantic-tree/types';
import { FRAMEWORK_LABELS, FRAMEWORK_LANG, buildTranslationRules } from './constants';
import { extractCodeBlock } from './code-extraction';

/**
 * 使用内置 z-ai-web-dev-sdk 进行翻译
 */
export async function builtinAiTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
): Promise<{ code: string; success: boolean }> {
  const timeoutMs = 30000;

  const zai = await Promise.race([
    ZAI.create(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI SDK initialization timeout')), timeoutMs)
    ),
  ]);

  const fromLabel = FRAMEWORK_LABELS[from] || from;
  const toLabel = FRAMEWORK_LABELS[to] || to;
  const fromLang = FRAMEWORK_LANG[from] || 'typescript';
  const toLang = FRAMEWORK_LANG[to] || 'typescript';

  const translationRules = buildTranslationRules(from, to);

  const prompt = `你是一个前端代码翻译专家。请将以下 ${fromLabel} 代码完整翻译为等价的 ${toLabel} 代码。

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

  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `你是一个前端框架代码翻译专家，精通 React、Vue 3 和 Angular 的等价转换。你只输出翻译后的代码，不输出任何解释。保持代码完整，不省略任何部分。`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      thinking: { type: 'disabled' },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI translation timeout')), timeoutMs)
    ),
  ]);

  let response = completion.choices[0]?.message?.content || '';
  if (!response) {
    return { code: '', success: false };
  }

  response = extractCodeBlock(response, toLang);
  return { code: response, success: true };
}
