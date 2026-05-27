/**
 * 流式 AI 翻译
 * 支持 OpenAI Chat Completions、Anthropic 和 OpenAI Responses 三种协议的流式传输
 *
 * 关键修复：
 * 1. 超时覆盖整个流式传输过程（不仅是初始连接）
 * 2. onToken 改为 async，配合 TransformStream writer
 * 3. AI API 返回错误时，通过 onToken 传递错误信息
 * 4. 增加源代码长度自适应超时
 */

import type { Framework } from '../semantic-tree/types';
import type { AIApiProtocol, AICustomConfig } from './types';
import { FRAMEWORK_LABELS, FRAMEWORK_LANG, buildTranslationRules } from './constants';
import {
  normalizeProtocol,
  buildApiUrl,
  extractContentFromAnyFormat,
  extractTokenFromSSEEvent,
  isSSEStreamEndEvent,
  isSSEErrorEvent,
  extractSSEErrorMessage,
} from './protocol';
import { extractCodeBlock } from './code-extraction';

/** 读取正整数环境变量 */
function getPositiveIntegerEnv(name: string): number | null {
  const value = process.env[name];
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 流式 AI 翻译
 * 支持 OpenAI Chat Completions、Anthropic 和 OpenAI Responses 三种协议的流式传输
 */
export async function streamAiTranslation(
  sourceCode: string,
  from: Framework,
  to: Framework,
  aiConfig: AICustomConfig,
  onToken: (token: string) => void | Promise<void>,
): Promise<{ code: string; success: boolean }> {
  const protocol = normalizeProtocol(aiConfig.apiProtocol);
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

  // 根据源代码长度自适应超时：基础 60s + 每百行 30s，最长 5 分钟
  const lineCount = sourceCode.split('\n').length;
  const defaultTotalTimeoutMs = Math.min(60000 + Math.ceil(lineCount / 100) * 30000, 300000);
  const connectTimeoutMs = getPositiveIntegerEnv('AI_STREAM_CONNECT_TIMEOUT_MS')
    ?? getPositiveIntegerEnv('AI_STREAM_TIMEOUT_MS')
    ?? defaultTotalTimeoutMs;
  const totalTimeoutMs = getPositiveIntegerEnv('AI_STREAM_TOTAL_TIMEOUT_MS') ?? defaultTotalTimeoutMs;
  const inactivityTimeoutMs = getPositiveIntegerEnv('AI_STREAM_INACTIVITY_TIMEOUT_MS') ?? 60000;
  console.log(`[Stream AI] Protocol: ${protocol}, Source: ${lineCount} lines, connect timeout: ${connectTimeoutMs / 1000}s, total timeout: ${totalTimeoutMs / 1000}s, inactivity: ${inactivityTimeoutMs / 1000}s`);

  const abortController = new AbortController();

  // 连接超时：AI 服务迟迟不返回响应时中止请求。
  let timeoutId = setTimeout(() => {
    console.warn(`[Stream AI] Connect timeout (${connectTimeoutMs / 1000}s) reached, aborting`);
    abortController.abort();
  }, connectTimeoutMs);

  // 总超时：无论中间是否持续收到 SSE 事件，整体耗时超过上限都中止请求。
  const totalTimeoutId = setTimeout(() => {
    console.warn(`[Stream AI] Total timeout (${totalTimeoutMs / 1000}s) reached, aborting`);
    abortController.abort();
  }, totalTimeoutMs);

  /** 重置超时定时器（每次收到数据时调用） */
  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      console.warn(`[Stream AI] Inactivity timeout, aborting`);
      abortController.abort();
    }, inactivityTimeoutMs); // 无数据超时
  };

  let accumulated = ''; // 在 try 外声明，以便 catch 中可以访问

  try {
    let response: Response;

    if (protocol === 'anthropic-messages') {
      // Anthropic Messages 流式请求
      const apiUrl = buildApiUrl(aiConfig.baseUrl, 'anthropic-messages');
      console.log(`[Stream AI] Anthropic Messages protocol, URL: ${apiUrl}`);

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: aiConfig.model,
          max_tokens: 16384,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          stream: true,
        }),
        signal: abortController.signal,
      });
    } else if (protocol === 'openai-responses') {
      // OpenAI Responses API 流式请求
      const apiUrl = buildApiUrl(aiConfig.baseUrl, 'openai-responses');
      console.log(`[Stream AI] OpenAI Responses protocol, URL: ${apiUrl}`);

      // 注意：Responses API 不支持 temperature 和 max_output_tokens 参数，使用模型默认值
      // 部分中转服务也不支持这些参数，因此不发送以保持兼容性
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          input: [
            { role: 'user', content: userPrompt },
          ],
          instructions: systemPrompt,
          stream: true,
        }),
        signal: abortController.signal,
      });
    } else {
      // OpenAI Chat Completions 流式请求
      const apiUrl = buildApiUrl(aiConfig.baseUrl, 'openai-completions');
      console.log(`[Stream AI] OpenAI Chat Completions protocol, URL: ${apiUrl}`);

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
          stream: true,
        }),
        signal: abortController.signal,
      });
    }

    // 连接成功，重置超时
    resetTimeout();

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const errorMsg = `AI API 错误 (${response.status}): ${errorText.slice(0, 300)}`;
      console.error(`[Stream AI] ${errorMsg}`);
      // 通知前端 API 错误
      onToken(`[翻译错误: ${errorMsg}]`);
      return { code: '', success: false };
    }

    // ===== 关键修复：检测 API 是否真正返回了 SSE 流 =====
    // 某些 API 提供商即使设置了 stream: true，也可能返回普通 JSON 响应
    const contentType = response.headers.get('content-type') || '';
    const isSSE = contentType.includes('text/event-stream');

    if (!isSSE) {
      // API 返回了非 SSE 响应（普通 JSON），按同步方式处理
      console.warn(`[Stream AI] API 返回了非 SSE 响应 (content-type: ${contentType}), 按同步模式处理`);

      const responseText = await response.text().catch(() => '');

      // 检测 HTML 响应
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        console.error(`[Stream AI] API returned HTML instead of JSON/SSE`);
        onToken('[翻译错误: API 返回了网页而非 JSON，请检查 URL 和协议]');
        return { code: '', success: false };
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error(`[Stream AI] Non-SSE response is not valid JSON: ${responseText.slice(0, 200)}`);
        onToken('[翻译错误: API 返回了非 JSON 响应，请检查 URL 和协议]');
        return { code: '', success: false };
      }

      // 多协议兼容解析：首选所选协议格式，回退到其他格式
      const { content, detectedFormat } = extractContentFromAnyFormat(data, protocol as AIApiProtocol);

      if (!content) {
        console.error(`[Stream AI] Non-SSE response returned empty content (detected: ${detectedFormat}): ${JSON.stringify(data).slice(0, 500)}`);
        onToken('[翻译错误: API 返回了空内容]');
        return { code: '', success: false };
      }

      if (detectedFormat !== 'OpenAI Chat' && detectedFormat !== 'Anthropic' && detectedFormat !== 'OpenAI Responses') {
        console.warn(`[Stream AI] 非 SSE 响应格式检测: ${detectedFormat} (协议: ${protocol})`);
      }

      // 将内容通过 onToken 一次性发送给前端（模拟流式输出，让前端能实时看到）
      // 分块发送以提供更好的用户体验
      const code = extractCodeBlock(content, toLang);
      const chunkSize = 20; // 每次发送 20 个字符
      for (let i = 0; i < code.length; i += chunkSize) {
        const chunk = code.slice(i, i + chunkSize);
        accumulated += chunk;
        await onToken(chunk);
      }

      console.log(`[Stream AI] Non-SSE fallback: extracted ${code.length} chars`);
      return { code, success: !!code };
    }

    // ===== SSE 流式响应处理 =====
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('[Stream AI] No response body reader available');
      onToken('[翻译错误: 无法读取 AI 响应流]');
      return { code: '', success: false };
    }

    const decoder = new TextDecoder();
    let sseBuffer = ''; // 用于处理跨 chunk 的 SSE 事件
    let tokenCount = 0;
    const streamStartTime = Date.now();
    let firstTokenTime = 0;
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      // 每收到一个 chunk，重置无数据超时
      resetTimeout();

      // 记录第一个 chunk 到达时间（诊断 API 是否真正流式返回）
      if (chunkCount === 1) {
        console.log(`[Stream AI] First chunk received in ${Date.now() - streamStartTime}ms`);
      }

      sseBuffer += decoder.decode(value, { stream: true });

      // 按 \n\n 分割 SSE 事件
      const parts = sseBuffer.split('\n\n');
      sseBuffer = parts.pop() || ''; // 保留最后一个不完整的部分

      for (const part of parts) {
        const lines = part.split('\n');
        let eventData = '';
        // 每个事件独立解析 event 类型，避免跨事件状态污染
        let eventType = ''; // 当前事件的类型（从 event: 行解析）

        for (const line of lines) {
          // 跳过 SSE 注释行
          if (line.startsWith(':')) continue;
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          }
        }

        if (!eventData) continue;

        // 检查 [DONE] 标记
        if (eventData === '[DONE]') continue;

        try {
          const parsed = JSON.parse(eventData);
          let token = '';

          // 使用双重检测：优先使用 event: 行的类型，回退到 parsed.type
          // 某些 API 提供商可能不发送 event: 行，而是将类型放在 data JSON 的 type 字段中
          const detectedType = eventType || parsed.type || '';

          // ===== 多协议兼容 SSE 事件解析 =====
          // 不再仅按所选协议解析，而是尝试所有格式，确保中转服务也能正常工作

          // 先检查结束事件
          if (isSSEStreamEndEvent(detectedType)) continue;

          // 先检查错误事件
          if (isSSEErrorEvent(detectedType)) {
            const errMsg = extractSSEErrorMessage(parsed, 'AI 流式错误');
            console.error(`[Stream AI] Error event (${detectedType}): ${errMsg}`);
            onToken(`[翻译错误: ${errMsg}]`);
            return { code: '', success: false };
          }

          // OpenAI Chat Completions 的 finish_reason 检测
          if (parsed.choices?.[0]?.finish_reason === 'stop') continue;

          // 多协议兼容：尝试从所有格式中提取 token
          token = extractTokenFromSSEEvent(parsed, detectedType);

          // 忽略 Responses API 的非内容事件（如 response.created, response.output_item.added 等）
          if (detectedType.startsWith('response.') && !token) {
            if (tokenCount === 0 && !detectedType.includes('delta') && !detectedType.includes('error')) {
              console.log(`[Stream AI] Responses event (ignored): ${detectedType}`);
            }
            continue;
          }

          if (token) {
            accumulated += token;
            tokenCount++;
            if (tokenCount === 1) {
              firstTokenTime = Date.now();
              console.log(`[Stream AI] First token received in ${firstTokenTime - streamStartTime}ms`);
            }
            // 异步调用 onToken（支持 TransformStream writer）
            await onToken(token);
          }
        } catch {
          // 忽略 JSON 解析错误（可能是不完整的数据）
        }
      }
    }

    console.log(`[Stream AI] Stream complete: ${tokenCount} tokens, ${accumulated.length} chars, first token in ${firstTokenTime ? firstTokenTime - streamStartTime : '?'}ms, total ${Date.now() - streamStartTime}ms, ${chunkCount} chunks`);

    // 提取代码块
    const finalCode = extractCodeBlock(accumulated, toLang);
    return { code: finalCode, success: !!finalCode };
  } catch (error) {
    clearTimeout(timeoutId);
    clearTimeout(totalTimeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Stream AI] Translation timeout or aborted');
      // 尝试用已累积的内容生成结果
      if (accumulated) {
        const partialCode = extractCodeBlock(accumulated, toLang);
        if (partialCode) {
          console.log('[Stream AI] Using partial result from timeout');
          return { code: partialCode, success: true };
        }
      }
      return { code: '', success: false };
    } else {
      console.error('[Stream AI] Translation failed:', error);
      return { code: '', success: false };
    }
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(totalTimeoutId);
  }
}
