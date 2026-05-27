/**
 * AI 状态检查 API
 * GET /api/ai-status - 读取服务端环境变量中的 AI 默认配置（不返回 API Key）
 * POST /api/ai-status - 测试自定义 AI 配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { testAIConnection } from '@/lib/ai';
import { getEnvAIClientConfig } from '@/lib/ai/types';

export async function GET() {
  return NextResponse.json(getEnvAIClientConfig());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { aiConfig } = body as {
      aiConfig?: {
        provider: 'custom';
        apiProtocol?: 'openai-completions' | 'openai-responses' | 'anthropic-messages';
        baseUrl: string;
        apiKey: string;
        model: string;
      };
    };

    const result = await testAIConnection(aiConfig);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI 状态检查失败:', error);
    return NextResponse.json({
      available: false,
      model: 'unknown',
      provider: 'custom',
      message: `AI 服务连接失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
