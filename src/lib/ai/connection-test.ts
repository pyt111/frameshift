/**
 * AI 连接测试
 * 返回连接状态和模型信息
 */

import type { AIApiProtocol, AICustomConfig } from './types';
import { getEnvAIConfigStatus, resolveAIConfig } from './types';
import { normalizeProtocol, buildApiUrl, extractContentFromAnyFormat, extractTokenFromSSEEvent, isSSEStreamEndEvent, isSSEErrorEvent } from './protocol';

/**
 * 测试 AI 连接
 * 返回连接状态和模型信息
 */
export async function testAIConnection(aiConfig?: AICustomConfig): Promise<{
  available: boolean;
  model: string;
  provider: string;
  latency?: string;
  message: string;
  /** 实际请求的 API URL（让用户验证协议是否正确） */
  requestUrl?: string;
  /** 实际使用的协议 */
  protocol?: string;
  /** 响应格式（JSON/SSE/HTML） */
  responseFormat?: string;
}> {
  const effectiveConfig = resolveAIConfig(aiConfig);

  // 测试 AI 连接。前端自定义配置缺失的字段可由服务端环境变量补齐。
  if (effectiveConfig && effectiveConfig.baseUrl && effectiveConfig.apiKey) {
    const protocol = normalizeProtocol(effectiveConfig.apiProtocol);
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s 超时，中转服务可能较慢

      let response: Response;

      const actualApiUrl = buildApiUrl(effectiveConfig.baseUrl, protocol as AIApiProtocol);
      console.log(`[AI Status Test] Protocol: ${protocol}, Actual URL: ${actualApiUrl}`);

      if (protocol === 'anthropic-messages') {
        // Anthropic Messages 协议测试
        response = await fetch(actualApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': effectiveConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: effectiveConfig.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 20,
            messages: [
              { role: 'user', content: '测试连接' },
            ],
          }),
          signal: controller.signal,
        });
      } else if (protocol === 'openai-responses') {
        // OpenAI Responses API 协议测试
        // 注意：不发送 max_output_tokens，部分中转服务不支持此参数
        response = await fetch(actualApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: effectiveConfig.model || 'gpt-4o',
            input: [
              { role: 'user', content: '测试连接' },
            ],
            instructions: '你是一个测试助手，请回复"连接成功"。',
          }),
          signal: controller.signal,
        });
      } else {
        // OpenAI Chat Completions 协议测试
        // 注意：只发送最基本的参数，不发送 temperature/max_tokens 以确保最大兼容性
        response = await fetch(actualApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: effectiveConfig.model || 'gpt-4o',
            messages: [
              { role: 'system', content: '你是一个测试助手，请回复"连接成功"。' },
              { role: 'user', content: '测试连接' },
            ],
          }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      // 统一读取响应文本，避免 Body already read 错误
      const responseText = await response.text().catch(() => '');

      // 诊断日志：记录原始响应（截取前 1000 字符，方便排查中转服务格式问题）
      const contentTypeHeader = response.headers.get('content-type') || '';
      console.log(`[AI Status Test] Response: status=${response.status}, content-type=${contentTypeHeader}, body=${responseText.slice(0, 1000)}`);

      if (!response.ok) {
        if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
          return {
            available: false,
            model: effectiveConfig.model || 'unknown',
            provider: effectiveConfig.provider,
            requestUrl: actualApiUrl,
            protocol,
            message: `API 地址返回了网页而非 JSON，请检查 Base URL 和 API 协议。实际请求: ${actualApiUrl} (${protocol})`,
          };
        }
        return {
          available: false,
          model: effectiveConfig.model || 'unknown',
          provider: effectiveConfig.provider,
          requestUrl: actualApiUrl,
          protocol,
          message: `API 返回错误 (${response.status}): ${responseText.slice(0, 200)}`,
        };
      }

      // 检测非 JSON 响应（HTML 页面等）
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        return {
          available: false,
          model: effectiveConfig.model || 'unknown',
          provider: effectiveConfig.provider,
          requestUrl: actualApiUrl,
          protocol,
          message: `API 地址返回了网页而非 JSON，请检查 Base URL 和 API 协议。实际请求: ${actualApiUrl} (${protocol})`,
        };
      }

      let data: any;
      let isSSE = false;

      // 检测响应是否为 SSE 格式（某些 /v1/responses 代理即使未设 stream:true 也返回 SSE）
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') || responseText.startsWith('data: ') || responseText.startsWith('event:')) {
        isSSE = true;
        console.log(`[AI Status Test] 检测到 SSE 响应，解析流式事件`);
      }

      if (isSSE) {
        // 从 SSE 事件流中提取内容（多协议兼容）
        let content = '';
        const events = responseText.split('\n\n');
        for (const event of events) {
          const lines = event.split('\n');
          let eventData = '';
          let eventType = '';
          for (const line of lines) {
            if (line.startsWith(':')) continue;
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) eventData = line.slice(6);
            else if (line.startsWith('data:')) eventData = line.slice(5).trim();
          }
          if (!eventData || eventData === '[DONE]') continue;

          try {
            const parsed = JSON.parse(eventData);
            const detectedType = eventType || parsed.type || '';

            // 结束事件
            if (isSSEStreamEndEvent(detectedType)) continue;
            // 错误事件
            if (isSSEErrorEvent(detectedType)) continue;

            // 多协议兼容提取 token
            const token = extractTokenFromSSEEvent(parsed, detectedType);
            if (token) {
              content += token;
            } else {
              // SSE 事件中没有提取到 delta token，尝试用完整响应格式提取
              // （中转服务可能返回完整的 message 而非 delta）
              const { content: fullContent } = extractContentFromAnyFormat(parsed, protocol as AIApiProtocol);
              if (fullContent) {
                content += fullContent;
              }
            }
          } catch {
            // 忽略 JSON 解析错误
          }
        }

        console.log(`[AI Status Test] SSE 解析结果: ${content.length} chars, 前 200 字符: ${content.slice(0, 200)}`);

        return {
          available: !!content,
          model: effectiveConfig.model || 'unknown',
          provider: `${effectiveConfig.provider} (${protocol})`,
          latency: `${latency}ms`,
          requestUrl: actualApiUrl,
          protocol,
          responseFormat: 'SSE',
          message: content ? `连接正常 (${protocol} 协议，SSE 模式，响应格式: ${protocol}，请求: ${actualApiUrl})` : 'AI 服务返回空响应（SSE 模式）',
        };
      }

      try {
        data = JSON.parse(responseText);
      } catch {
        return {
          available: false,
          model: effectiveConfig.model || 'unknown',
          provider: effectiveConfig.provider,
          requestUrl: actualApiUrl,
          protocol,
          message: `API 返回了非 JSON 响应。实际请求: ${actualApiUrl}，协议: ${protocol}。如果 API 使用不同协议，请在设置中切换 API 协议`,
        };
      }
      
      // 多协议兼容解析：尝试所有格式提取内容
      const { content, detectedFormat } = extractContentFromAnyFormat(data, protocol as AIApiProtocol);

      // 协议与响应格式不匹配时给出警告（但现在我们已经兼容了，所以只是提示）
      let formatWarning = '';
      if (content && protocol === 'anthropic-messages' && detectedFormat !== 'Anthropic' && detectedFormat !== 'Anthropic (宽松)') {
        formatWarning = ` （响应实际为 ${detectedFormat} 格式，已自动兼容）`;
      }

      return {
        available: !!content,
        model: effectiveConfig.model || data.model || 'unknown',
        provider: `${effectiveConfig.provider} (${protocol})`,
        latency: `${latency}ms`,
        requestUrl: actualApiUrl,
        protocol,
        responseFormat: detectedFormat,
        message: content ? `连接正常 (${protocol} 协议，响应格式: ${detectedFormat}，请求: ${actualApiUrl})${formatWarning}` : `AI 服务返回空响应 (响应格式: ${detectedFormat})`,
      };
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : String(error);
      const actualApiUrl = buildApiUrl(effectiveConfig.baseUrl, protocol as AIApiProtocol);
      
      if (errorMsg.includes('is not valid JSON') || errorMsg.includes('Unexpected token')) {
        errorMsg = `API 返回了非 JSON 响应。实际请求: ${actualApiUrl}，协议: ${protocol}。如果 API 使用不同协议，请在设置中切换 API 协议`;
      }
      
      return {
        available: false,
        model: effectiveConfig.model || 'unknown',
        provider: effectiveConfig.provider,
        requestUrl: actualApiUrl,
        protocol,
        message: `连接失败: ${errorMsg}`,
      };
    }
  }

  const status = getEnvAIConfigStatus();
  return {
    available: false,
    model: process.env.AI_MODEL || '未配置',
    provider: 'custom',
    message: `AI 配置不完整，缺少: ${status.missing.join(', ')}。请在 .env.local 中配置，或在前端设置中填写自定义 API`,
  };
}
