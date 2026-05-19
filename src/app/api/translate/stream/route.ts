/**
 * 流式翻译 API 路由
 * POST /api/translate/stream
 *
 * 当使用自定义 AI 时，返回 SSE 流式响应
 * 否则回退到普通 JSON 响应
 *
 * 关键设计：
 * 1. 使用 ReadableStream + controller.enqueue() 模式
 *    - highWaterMark: 0 禁用内部缓冲，确保每次 enqueue 立即发送
 * 2. safeEnqueue 处理客户端断开连接
 * 3. 心跳机制防止代理/CDN 超时断开连接
 * 4. 完成事件含提取后的最终代码，前端无需二次提取
 */

import { NextRequest } from 'next/server';
import { streamAiTranslation, buildApiUrl, normalizeProtocol } from '@/lib/ai';
import { translate } from '@/lib/translator/engine';
import type { Framework, TranslationAIConfig } from '@/lib/semantic-tree/types';

// 增加路由超时时间到 5 分钟（适用于大型文件翻译）
export const maxDuration = 300;

// 禁用 Next.js 响应体缓存，确保流式响应不被缓冲
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceCode, sourceFramework, targetFramework, enableAI, aiConfig } = body as {
      sourceCode: string;
      sourceFramework: Framework;
      targetFramework: Framework;
      enableAI?: boolean;
      aiConfig?: TranslationAIConfig;
    };

    // 参数校验
    if (!sourceCode || typeof sourceCode !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 sourceCode 参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!sourceFramework || !targetFramework) {
      return new Response(JSON.stringify({ error: '缺少 sourceFramework 或 targetFramework 参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validFrameworks: Framework[] = ['react', 'vue3', 'angular'];
    if (!validFrameworks.includes(sourceFramework) || !validFrameworks.includes(targetFramework)) {
      return new Response(JSON.stringify({ error: `不支持的框架，目前仅支持: ${validFrameworks.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 如果不是自定义 AI，回退到普通翻译
    if (!enableAI || !aiConfig || aiConfig.provider !== 'custom' || !aiConfig.baseUrl || !aiConfig.apiKey || !aiConfig.model) {
      console.log('[FrameShift Stream API] 非自定义 AI，回退到同步翻译');
      const result = await translate({
        sourceCode,
        sourceFramework,
        targetFramework,
        enableAI: enableAI ?? false,
        aiConfig: aiConfig ? {
          provider: aiConfig.provider,
          apiProtocol: aiConfig.apiProtocol,
          baseUrl: aiConfig.baseUrl,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        } : undefined,
      });
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 流式 AI 翻译
    const protocol = normalizeProtocol(aiConfig.apiProtocol);
    console.log(`[FrameShift Stream API] 流式翻译请求: ${aiConfig.model} @ ${aiConfig.baseUrl} (${protocol} 协议)`);

    const encoder = new TextEncoder();

    // 使用 ReadableStream + controller.enqueue() 模式
    // highWaterMark: 0 禁用内部缓冲队列，确保每次 enqueue 立即发送到客户端
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        let tokenCount = 0;
        const startTime = Date.now();

        /** 安全写入数据到流，处理已关闭的情况 */
        const safeEnqueue = (data: Uint8Array): boolean => {
          if (closed) return false;
          try {
            controller.enqueue(data);
            return true;
          } catch {
            // Controller 已关闭（客户端断开连接）
            if (!closed) {
              closed = true;
              console.warn('[FrameShift Stream API] 客户端已断开连接，停止流式传输');
            }
            return false;
          }
        };

        /** 发送 SSE 事件 */
        const sendEvent = (eventType: string, payload: Record<string, unknown>): boolean => {
          const event = `data: ${JSON.stringify({ type: eventType, ...payload })}\n\n`;
          const result = safeEnqueue(encoder.encode(event));
          if (result && eventType === 'token') {
            tokenCount++;
            // 每 50 个 token 输出一次进度日志
            if (tokenCount % 50 === 0) {
              console.log(`[FrameShift Stream API] 已发送 ${tokenCount} tokens, 耗时 ${Date.now() - startTime}ms`);
            }
          }
          return result;
        };

        /** 发送 SSE 注释行（心跳，防止连接超时被代理断开） */
        const sendComment = (): boolean => {
          return safeEnqueue(encoder.encode(': heartbeat\n\n'));
        };

        // 心跳定时器：每 15 秒发送一次注释行，防止代理/CDN 超时
        const heartbeatId = setInterval(() => {
          if (!sendComment()) {
            clearInterval(heartbeatId);
          }
        }, 15000);

        // 在后台异步执行流式翻译
        (async () => {
          try {
            // 立即发送开始事件，让前端知道流已建立（含协议和实际请求 URL）
            const actualApiUrl = buildApiUrl(aiConfig.baseUrl, protocol);
            sendEvent('start', { protocol, requestUrl: actualApiUrl });

            // 流式 AI 翻译
            const result = await streamAiTranslation(
              sourceCode,
              sourceFramework,
              targetFramework,
              {
                provider: aiConfig.provider,
                apiProtocol: aiConfig.apiProtocol,
                baseUrl: aiConfig.baseUrl,
                apiKey: aiConfig.apiKey,
                model: aiConfig.model,
              },
              async (token) => {
                // 每收到一个 token，立即发送 SSE 事件
                sendEvent('token', { content: token });
              }
            );

            // 发送完成事件（含最终提取的代码）
            if (!closed) {
              const duration = Date.now() - startTime;
              sendEvent('done', {
                success: result.success,
                code: result.code,
                tokenCount,
                duration,
              });
              console.log(`[FrameShift Stream API] 流式翻译完成: ${tokenCount} tokens, ${duration}ms, success=${result.success}`);
            }
          } catch (error) {
            console.error('[FrameShift Stream API] 流式翻译错误:', error);
            if (!closed) {
              sendEvent('error', {
                message: error instanceof Error ? error.message : String(error),
              });
            }
          } finally {
            // 清理心跳定时器
            clearInterval(heartbeatId);

            // 安全关闭流
            if (!closed) {
              try {
                controller.close();
              } catch {
                // 忽略关闭错误
              }
              closed = true;
            }
          }
        })();
      },
    }, {
      // 关键：禁用内部缓冲，确保每次 enqueue() 立即发送到客户端
      // 默认 highWaterMark 为 1（缓冲 1 个 chunk），改为 0 实现无缓冲流式传输
      highWaterMark: 0,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('流式翻译 API 错误:', error);
    return new Response(
      JSON.stringify({ error: `流式翻译服务内部错误: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
