'use client'

import { saveToHistory } from '@/components/translation-history'
import type { AppSettings } from '@/hooks/use-settings'
import type {
  Framework,
  TranslationResult,
} from '@/lib/semantic-tree/types'
import { clientTranslate, isClientTranslationSupported } from '@/lib/translator/client-translate'
import { FRAMEWORK_LANG } from './constants'
import {
  countTranslationUnits,
  extractCodeBlockFromStream,
  stripStreamingCodeMarkers,
} from './utils'

interface RunTranslationParams {
  sourceCode: string
  sourceFramework: Framework
  targetFramework: Framework
  settings: AppSettings
  signal?: AbortSignal
  setTranslatedCode: (code: string) => void
  setResult: (result: TranslationResult) => void
  setStreaming: (isStreaming: boolean) => void
}

interface StreamResultOptions {
  confidence: number
  confidenceLevel: TranslationResult['confidenceLevel']
  warningMessage: string
  stepName: string
  stepDescription: string
  isPartial?: boolean
  duration: number
}

interface TranslationRunOutput {
  result: TranslationResult | null
  shouldSaveHistory: boolean
}

function saveResultToHistory(
  result: TranslationResult,
  params: Pick<RunTranslationParams, 'sourceCode' | 'sourceFramework' | 'targetFramework' | 'settings'>
) {
  if (!params.settings.translationAutoSaveHistory) return

  saveToHistory({
    sourceFramework: params.sourceFramework,
    targetFramework: params.targetFramework,
    sourceCodePreview: params.sourceCode.slice(0, 100),
    sourceCode: params.sourceCode,
    translatedCode: result.code,
    confidence: result.overallConfidence,
    confidenceLevel: result.confidenceLevel,
  })
}

function buildStreamResult(
  code: string,
  params: Pick<RunTranslationParams, 'sourceCode' | 'sourceFramework' | 'targetFramework'>,
  options: StreamResultOptions
): TranslationResult {
  const aiUnitCount = countTranslationUnits(params.sourceCode, params.sourceFramework)

  return {
    code,
    targetFramework: params.targetFramework,
    overallConfidence: options.confidence,
    confidenceLevel: options.confidenceLevel,
    warnings: [
      {
        id: `ai-stream-${Date.now()}`,
        message: options.warningMessage,
        confidence: options.confidence,
        confidenceLevel: options.confidenceLevel,
        warningType: options.isPartial ? 'manual-review' : 'ai-assisted',
      },
    ],
    duration: options.duration,
    pipeline: {
      steps: [
        {
          id: 'generate',
          name: options.stepName,
          description: options.stepDescription,
          status: 'completed',
          duration: options.duration,
          icon: 'sparkles',
          detail: {
            mode: 'ai-full',
            aiUnitCount,
            partial: !!options.isPartial,
          },
        },
      ],
      totalDuration: options.duration,
    },
  }
}

async function readStreamingResponse(
  response: Response,
  params: RunTranslationParams
): Promise<TranslationRunOutput> {
  let accumulated = ''
  let displayCode = ''
  const toLang = FRAMEWORK_LANG[params.targetFramework] || 'typescript'
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('无法读取流式响应')
  }

  const decoder = new TextDecoder()
  let sseBuffer = ''
  let streamDone = false
  let tokenCount = 0
  const streamStartTime = Date.now()
  let streamProtocol = ''

  try {
    while (!streamDone) {
      const { done, value } = await reader.read()
      if (done) break

      sseBuffer += decoder.decode(value, { stream: true })

      const parts = sseBuffer.split('\n\n')
      sseBuffer = parts.pop() || ''

      for (const part of parts) {
        const lines = part.split('\n')
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith(':')) continue
          if (line.startsWith('data: ')) {
            eventData = line.slice(6)
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }

        if (!eventData) continue

        try {
          const parsed = JSON.parse(eventData)

          if (parsed.type === 'start') {
            streamProtocol = parsed.protocol || ''
            console.log(`[FrameShift] 流式翻译开始，协议: ${streamProtocol}`)
          } else if (parsed.type === 'token') {
            accumulated += parsed.content
            tokenCount++
            displayCode = stripStreamingCodeMarkers(accumulated)
            params.setTranslatedCode(displayCode)
          } else if (parsed.type === 'done') {
            const streamDuration = Date.now() - streamStartTime
            const finalCode = parsed.code || extractCodeBlockFromStream(accumulated, toLang)

            if (!parsed.success || !finalCode?.trim()) {
              throw new Error(
                typeof parsed.message === 'string'
                  ? parsed.message
                  : tokenCount > 0
                    ? 'AI 翻译未能提取有效代码，请重试'
                    : 'AI 翻译超时，未返回任何内容，请稍后重试或切换模型'
              )
            }

            if (finalCode.trim().startsWith('[翻译错误:')) {
              throw new Error(finalCode.replace(/^\[翻译错误:\s*/, '').replace(/\]$/, ''))
            }

            if (finalCode !== displayCode) {
              params.setTranslatedCode(finalCode)
            }

            console.log(`[FrameShift] 流式翻译完成，${tokenCount} tokens，${streamDuration}ms`)

            streamDone = true
            return {
              result: buildStreamResult(finalCode, params, {
                confidence: 0.85,
                confidenceLevel: 'high',
                warningMessage: `代码由 AI 全量翻译生成（${countTranslationUnits(params.sourceCode, params.sourceFramework)} 个翻译单元），建议人工审查`,
                stepName: 'AI 流式翻译',
                stepDescription: `流式翻译完成${streamProtocol ? ` (${streamProtocol})` : ''}，${tokenCount} tokens`,
                duration: streamDuration,
              }),
              shouldSaveHistory: true,
            }
          } else if (parsed.type === 'error') {
            throw new Error(parsed.message || '流式翻译失败')
          }
        } catch (parseError) {
          if (parseError instanceof SyntaxError) continue
          throw parseError
        }
      }
    }
  } catch (readError) {
    if (readError instanceof DOMException && readError.name === 'AbortError') {
      console.log('[FrameShift] 流式翻译被用户取消')
      if (accumulated) {
        const partialCode = extractCodeBlockFromStream(accumulated, toLang)
        if (partialCode) {
          params.setTranslatedCode(partialCode)
          return {
            result: buildStreamResult(partialCode, params, {
              confidence: 0.6,
              confidenceLevel: 'medium',
              warningMessage: '翻译被中断，当前仅为部分结果，建议重试或人工审查',
              stepName: 'AI 流式翻译（部分结果）',
              stepDescription: '翻译被中断，已保留可提取的部分结果',
              isPartial: true,
              duration: Date.now() - streamStartTime,
            }),
            shouldSaveHistory: false,
          }
        }
      }
      return { result: null, shouldSaveHistory: false }
    }

    throw readError
  }

  if (!streamDone && accumulated) {
    const finalCode = extractCodeBlockFromStream(accumulated, toLang)
    if (!finalCode) {
      throw new Error('流式翻译未能获取完整结果，请重试')
    }

    params.setTranslatedCode(finalCode)
    return {
      result: buildStreamResult(finalCode, params, {
        confidence: 0.7,
        confidenceLevel: 'medium',
        warningMessage: '流式连接意外结束，当前仅为部分结果，建议重试或人工审查',
        stepName: 'AI 流式翻译（部分结果）',
        stepDescription: '流式连接意外结束，已保留可提取的部分结果',
        isPartial: true,
        duration: Date.now() - streamStartTime,
      }),
      shouldSaveHistory: true,
    }
  }

  if (!streamDone && !accumulated) {
    throw new Error('流式翻译未返回任何内容，请检查 AI 配置')
  }

  return { result: null, shouldSaveHistory: false }
}

async function runStreamTranslation(params: RunTranslationParams): Promise<TranslationRunOutput> {
  console.log('[FrameShift] 使用流式翻译模式')
  params.setStreaming(true)

  const requestBody = {
    sourceCode: params.sourceCode,
    sourceFramework: params.sourceFramework,
    targetFramework: params.targetFramework,
    enableAI: params.settings.translationAIAssist,
    aiConfig: params.settings.translationAIAssist ? params.settings.aiConfig : undefined,
  }

  const response = await fetch('/api/translate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ?? `翻译请求失败 (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) {
    return readStreamingResponse(response, params)
  }

  const data = await response.json() as Partial<TranslationResult> & { error?: string }
  if (data.error) {
    throw new Error(data.error)
  }
  if (!data.code?.trim()) {
    throw new Error('翻译接口未返回有效代码，请重试')
  }
  return { result: data as TranslationResult, shouldSaveHistory: true }
}

async function runClientTranslation(params: RunTranslationParams): Promise<TranslationResult> {
  console.log('[FrameShift] 使用客户端 AST 翻译模式（无需网络请求）')
  const data = await clientTranslate(params.sourceCode, params.sourceFramework, params.targetFramework)
  console.log(`[FrameShift] 客户端 AST 翻译完成，耗时 ${data.duration}ms`)
  return data
}

async function runServerTranslation(params: RunTranslationParams): Promise<TranslationResult> {
  console.log('[FrameShift] 使用服务端翻译', params.settings.translationAIAssist ? '(自定义 AI)' : '(Vue 3 AST 回退)')

  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceCode: params.sourceCode,
      sourceFramework: params.sourceFramework,
      targetFramework: params.targetFramework,
      enableAI: params.settings.translationAIAssist,
      aiConfig: params.settings.translationAIAssist ? params.settings.aiConfig : undefined,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error ?? `翻译请求失败 (${response.status})`)
  }

  const data: TranslationResult = await response.json()
  const genStep = data.pipeline?.steps?.find(s => s.id === 'generate')

  if (genStep?.detail) {
    const mode = (genStep.detail as Record<string, unknown>).mode
    console.log(`[FrameShift] 翻译完成，模式: ${mode}`, mode === 'ast-fallback' ? '⚠️ AI 翻译失败，已回退到 AST 管线' : '')
  }

  return data
}

/** 执行一次翻译，并返回最终结果；流式取消且没有部分结果时返回 null。 */
export async function runTranslation(params: RunTranslationParams): Promise<TranslationResult | null> {
  if (params.settings.translationAIAssist) {
    const aiProvider = params.settings.aiConfig.model ? `自定义AI (${params.settings.aiConfig.model})` : '自定义AI'
    console.log(`[FrameShift] 翻译请求使用 AI: ${aiProvider}`, params.settings.aiConfig.baseUrl ? `baseUrl: ${params.settings.aiConfig.baseUrl}` : '')
  }

  const useStream = params.settings.translationAIAssist
    && !!params.settings.aiConfig.baseUrl
    && !!params.settings.aiConfig.model

  const output = useStream
    ? await runStreamTranslation(params)
    : {
        result: !params.settings.translationAIAssist && isClientTranslationSupported(params.sourceFramework)
          ? await runClientTranslation(params)
          : await runServerTranslation(params),
        shouldSaveHistory: true,
      }

  if (output.result) {
    params.setTranslatedCode(output.result.code)
    params.setResult(output.result)
    if (output.shouldSaveHistory) {
      saveResultToHistory(output.result, params)
    }
  }

  return output.result
}
