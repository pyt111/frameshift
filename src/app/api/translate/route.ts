/**
 * 翻译 API 路由
 * POST /api/translate
 */

import { NextRequest, NextResponse } from 'next/server';
import { translate } from '@/lib/translator/engine';
import type { Framework, TranslationRequest, TranslationAIConfig } from '@/lib/semantic-tree/types';

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
      return NextResponse.json(
        { error: '缺少 sourceCode 参数' },
        { status: 400 }
      );
    }

    if (!sourceFramework || !targetFramework) {
      return NextResponse.json(
        { error: '缺少 sourceFramework 或 targetFramework 参数' },
        { status: 400 }
      );
    }

    const validFrameworks: Framework[] = ['react', 'vue3', 'angular'];
    if (!validFrameworks.includes(sourceFramework) || !validFrameworks.includes(targetFramework)) {
      return NextResponse.json(
        { error: `不支持的框架，目前仅支持: ${validFrameworks.join(', ')}` },
        { status: 400 }
      );
    }

    // 校验自定义 AI 配置
    if (enableAI && aiConfig?.provider === 'custom') {
      if (!aiConfig.baseUrl || !aiConfig.apiKey || !aiConfig.model) {
        return NextResponse.json(
          { error: '自定义 AI 配置不完整，需要提供 baseUrl、apiKey 和 model' },
          { status: 400 }
        );
      }
      const protocol = aiConfig.apiProtocol || 'openai-completions';
      console.log(`[FrameShift API] 翻译请求使用自定义 AI: ${aiConfig.model} @ ${aiConfig.baseUrl} (${protocol} 协议)`);
    } else if (enableAI) {
      console.log(`[FrameShift API] 翻译请求使用内置 AI: GLM-4`);
    } else {
      console.log(`[FrameShift API] 翻译请求: AST 模式（无 AI）`);
    }

    // 执行翻译
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

    return NextResponse.json(result);
  } catch (error) {
    console.error('翻译 API 错误:', error);
    return NextResponse.json(
      { error: `翻译服务内部错误: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
