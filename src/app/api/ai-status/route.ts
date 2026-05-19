/**
 * AI 状态检查 API
 * GET /api/ai-status - 测试内置 AI
 * POST /api/ai-status - 测试自定义 AI 配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { testAIConnection } from '@/lib/ai';

export async function GET() {
  try {
    const result = await testAIConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI 状态检查失败:', error);
    return NextResponse.json({
      available: false,
      model: 'GLM-4',
      provider: 'builtin',
      message: `AI 服务连接失败: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { aiConfig } = body as {
      aiConfig?: {
        provider: 'builtin' | 'custom';
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
