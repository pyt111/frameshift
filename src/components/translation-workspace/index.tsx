'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Play, RotateCcw, Copy, Check, Clock, Keyboard, GitCompare, Download, HelpCircle, TreePine, BarChart3, FileCode2, ArrowRight, Share2, Settings, Sparkles, Info, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { CodeEditor } from '@/components/code-editor'
import { FrameworkSelector } from '@/components/framework-selector'
import { ConfidenceReport } from '@/components/confidence-report'
import { WarningList } from '@/components/warning-list'
import { SyntaxTreeView } from '@/components/syntax-tree-view'
import { DiffViewer } from '@/components/diff-viewer'
import { TranslationPipelineView } from '@/components/translation-pipeline'
import { TranslationHistory, saveToHistory } from '@/components/translation-history'
import type { TranslationHistoryEntry } from '@/components/translation-history'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type {
  Framework,
  TranslationResult,
  TranslationWarning,
} from '@/lib/semantic-tree/types'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/hooks/use-settings'
import { SettingsDialog } from '@/components/settings-dialog'
import { cn } from '@/lib/utils'
import { clientTranslate, isClientTranslationSupported } from '@/lib/translator/client-translate'
import { type TranslationWorkspaceProps, type TranslationState } from './types'
import {
  LOADING_STEPS_WITH_AI,
  LOADING_STEPS_WITHOUT_AI,
  DEFAULT_REACT_CODE,
  DEFAULT_VUE_CODE,
  DEFAULT_ANGULAR_CODE,
  FRAMEWORK_LANG,
} from './constants'
import {
  formatFileSize,
  getDirectionIndicator,
  countTranslationUnits,
  extractCodeBlockFromStream,
  stripStreamingCodeMarkers,
  getEditorLanguage,
} from './utils'
import {
  LoadingStepIndicator,
  LoadingSkeletonWithStep,
} from './loading-components'

// Re-export types for backward compatibility
export type { TranslationWorkspaceProps, TranslationState } from './types'

/**
 * 翻译工作区组件
 * 包含框架选择器、代码编辑器、翻译结果展示、置信度报告和警告列表
 * 增强版：渐变工具栏、发光按钮、加载动画、键盘快捷键、框架徽章增强、历史记录
 */
export function TranslationWorkspace({
  initialSourceCode,
  initialSourceFramework = 'react',
  initialTargetFramework = 'vue3',
  className,
}: TranslationWorkspaceProps) {
  /** 源框架和目标框架 */
  const [sourceFramework, setSourceFramework] = useState<Framework>(initialSourceFramework)
  const [targetFramework, setTargetFramework] = useState<Framework>(initialTargetFramework)

  /** 源代码和翻译结果代码 */
  const [sourceCode, setSourceCode] = useState<string>(
    initialSourceCode ?? (initialSourceFramework === 'react' ? DEFAULT_REACT_CODE : initialSourceFramework === 'angular' ? DEFAULT_ANGULAR_CODE : DEFAULT_VUE_CODE)
  )
  const [translatedCode, setTranslatedCode] = useState<string>('')

  /** 翻译状态 */
  const [translationState, setTranslationState] = useState<TranslationState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [result, setResult] = useState<TranslationResult | null>(null)

  /** 流式生成状态 */
  const [isStreaming, setIsStreaming] = useState(false)

  /** 复制状态 */
  const [copied, setCopied] = useState(false)

  /** 分享状态 */
  const [shareCopied, setShareCopied] = useState(false)

  /** Toast hook */
  const { toast } = useToast()

  /** 代码统计信息 */
  const codeStats = useMemo(() => {
    if (!translatedCode) return { lines: 0, chars: 0, size: '0 B' }
    const lines = translatedCode.split('\n').length
    const chars = translatedCode.length
    const size = formatFileSize(new Blob([translatedCode]).size)
    return { lines, chars, size }
  }, [translatedCode])

  /** 源代码行数 */
  const sourceLineCount = useMemo(() => sourceCode.split('\n').length, [sourceCode])

  /** 视图模式：编辑器 / Diff对比 */
  const [viewMode, setViewMode] = useState<'editor' | 'diff'>('editor')

  /** 键盘快捷键对话框 */
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)

  /** 历史面板展开状态 */
  const [showHistory, setShowHistory] = useState(false)

  /** 底部面板视图模式: report / syntax-tree */
  const [bottomView, setBottomView] = useState<'report' | 'syntax-tree' | 'pipeline'>('report')

  /** 设置对话框 */
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  /** 应用设置 */
  const { settings, setSetting, resetSettings } = useSettings()

  /** 是否使用流式翻译（仅自定义 AI 时启用） */
  const shouldUseStreaming = settings.translationAIAssist
    && !!settings.aiConfig.baseUrl
    && !!settings.aiConfig.model

  /** 当前结果的生成步骤信息 */
  const resultGenerateStep = useMemo(
    () => result?.pipeline?.steps?.find(s => s.id === 'generate'),
    [result]
  )
  const resultGenerateDetail = resultGenerateStep?.detail
  const isPartialResult = resultGenerateDetail?.partial === true

  /** 流式请求的 AbortController 引用 */
  const streamAbortRef = useRef<AbortController | null>(null)

  /** 执行翻译 */
  const handleTranslate = useCallback(async () => {
    if (!sourceCode.trim()) return

    // 如果正在翻译，先取消之前的请求
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }

    setTranslationState('loading')
    setErrorMessage('')
    setResult(null)
    setTranslatedCode('')

    try {
      const requestBody = {
        sourceCode,
        sourceFramework,
        targetFramework,
        enableAI: settings.translationAIAssist,
        aiConfig: settings.translationAIAssist ? settings.aiConfig : undefined,
      }

      // 调试日志：显示翻译请求的 AI 配置
      if (settings.translationAIAssist) {
        const aiProvider = settings.aiConfig.model ? `自定义AI (${settings.aiConfig.model})` : '自定义AI'
        console.log(`[FrameShift] 翻译请求使用 AI: ${aiProvider}`, settings.aiConfig.baseUrl ? `baseUrl: ${settings.aiConfig.baseUrl}` : '')
      }

      // 判断是否使用流式翻译
      const useStream = settings.translationAIAssist
        && !!settings.aiConfig.baseUrl
        && !!settings.aiConfig.model

      if (useStream) {
        // ===== 流式翻译 =====
        console.log('[FrameShift] 使用流式翻译模式')
        setIsStreaming(true)

        // 创建 AbortController 用于取消请求
        const abortController = new AbortController()
        streamAbortRef.current = abortController

        const response = await fetch('/api/translate/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error ?? `翻译请求失败 (${response.status})`)
        }

        // 检查是否返回了 SSE 流（自定义 AI）还是普通 JSON（回退到 AST）
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/event-stream')) {
          // ===== SSE 流式读取 =====
          //
          // 核心设计：
          // 1. 收到 token 事件时，累积原始文本并实时清除 Markdown 代码块标记
          //    - 这样用户在流式输出时看到的是干净代码，而非 ````tsx` 等标记
          // 2. 收到 done 事件时，使用后端已提取的 code（parsed.code）
          //    - 后端的 extractCodeBlock 已处理代码块提取
          //    - 如果 parsed.code 为空则回退到前端提取
          //    - 避免"双重刷新"：如果 finalCode 与当前展示的代码相同，不再重复设置
          //
          let accumulated = ''
          let displayCode = '' // 当前展示的代码（去除 Markdown 标记后）
          const toLang = FRAMEWORK_LANG[targetFramework] || 'typescript'
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('无法读取流式响应')
          }

          const decoder = new TextDecoder()
          let sseBuffer = ''
          let streamDone = false
          let tokenCount = 0
          const streamStartTime = Date.now()
          let streamProtocol = '' // 从 start 事件中记录协议
          const buildStreamResult = (
            code: string,
            options: {
              confidence: number
              confidenceLevel: TranslationResult['confidenceLevel']
              warningMessage: string
              stepName: string
              stepDescription: string
              isPartial?: boolean
              duration: number
            }
          ): TranslationResult => {
            const aiUnitCount = countTranslationUnits(sourceCode, sourceFramework)
            return {
              code,
              targetFramework,
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
                    status: 'completed' as const,
                    duration: options.duration,
                    icon: 'sparkles',
                    detail: {
                      mode: 'ai-full',
                      aiUnitCount: aiUnitCount as number,
                      partial: !!options.isPartial,
                    },
                  },
                ],
                totalDuration: options.duration,
              },
            }
          }

          try {
            while (!streamDone) {
              const { done, value } = await reader.read()
              if (done) break

              sseBuffer += decoder.decode(value, { stream: true })

              // 按 \n\n 分割 SSE 事件
              const parts = sseBuffer.split('\n\n')
              sseBuffer = parts.pop() || ''

              for (const part of parts) {
                const lines = part.split('\n')
                let eventData = ''

                for (const line of lines) {
                  // 跳过 SSE 注释行（如 : heartbeat）
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
                    // 实时追加 token 到累积文本
                    accumulated += parsed.content
                    tokenCount++
                    // 清除 Markdown 代码块标记，展示干净代码
                    displayCode = stripStreamingCodeMarkers(accumulated)
                    setTranslatedCode(displayCode)
                  } else if (parsed.type === 'done') {
                    // 流式翻译完成
                    const streamDuration = Date.now() - streamStartTime
                    // 优先使用后端已提取的代码，回退到前端提取
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

                    // 只在 finalCode 与当前展示不同时才更新（避免双重刷新）
                    if (finalCode !== displayCode) {
                      setTranslatedCode(finalCode)
                    }

                    console.log(`[FrameShift] 流式翻译完成，${tokenCount} tokens，${streamDuration}ms`)

                    const streamResult = buildStreamResult(finalCode, {
                      confidence: 0.85,
                      confidenceLevel: 'high',
                      warningMessage: `代码由 AI 全量翻译生成（${countTranslationUnits(sourceCode, sourceFramework)} 个翻译单元），建议人工审查`,
                      stepName: 'AI 流式翻译',
                      stepDescription: `流式翻译完成${streamProtocol ? ` (${streamProtocol})` : ''}，${tokenCount} tokens`,
                      duration: streamDuration,
                    })

                    setResult(streamResult)
                    setTranslationState('success')

                    // 保存到翻译历史
                    if (settings.translationAutoSaveHistory) {
                      saveToHistory({
                        sourceFramework,
                        targetFramework,
                        sourceCodePreview: sourceCode.slice(0, 100),
                        sourceCode,
                        translatedCode: finalCode,
                        confidence: streamResult.overallConfidence,
                        confidenceLevel: streamResult.confidenceLevel,
                      })
                    }
                    streamDone = true
                  } else if (parsed.type === 'error') {
                    throw new Error(parsed.message || '流式翻译失败')
                  }
                } catch (parseError) {
                  if (parseError instanceof SyntaxError) {
                    // JSON 解析错误 - 可能是不完整的数据，跳过
                    continue
                  }
                  throw parseError
                }
              }
            }
          } catch (readError) {
            // 读取中断（用户取消或连接断开）
            if (readError instanceof DOMException && readError.name === 'AbortError') {
              console.log('[FrameShift] 流式翻译被用户取消')
              // 如果已经累积了一些内容，尝试提取代码
              if (accumulated) {
                const partialCode = extractCodeBlockFromStream(accumulated, toLang)
                if (partialCode) {
                  setTranslatedCode(partialCode)
                  const partialResult = buildStreamResult(partialCode, {
                    confidence: 0.6,
                    confidenceLevel: 'medium',
                    warningMessage: '翻译被中断，当前仅为部分结果，建议重试或人工审查',
                    stepName: 'AI 流式翻译（部分结果）',
                    stepDescription: '翻译被中断，已保留可提取的部分结果',
                    isPartial: true,
                    duration: Date.now() - streamStartTime,
                  })
                  setResult(partialResult)
                  setTranslationState('success')
                  return
                }
              }
              setTranslationState('idle')
              return
            }
            throw readError
          }

          // 如果流结束了但没收到 done 事件（异常情况）
          if (!streamDone && accumulated) {
            const finalCode = extractCodeBlockFromStream(accumulated, toLang)
            if (finalCode) {
              setTranslatedCode(finalCode)
              const partialResult = buildStreamResult(finalCode, {
                confidence: 0.7,
                confidenceLevel: 'medium',
                warningMessage: '流式连接意外结束，当前仅为部分结果，建议重试或人工审查',
                stepName: 'AI 流式翻译（部分结果）',
                stepDescription: '流式连接意外结束，已保留可提取的部分结果',
                isPartial: true,
                duration: Date.now() - streamStartTime,
              })
              setResult(partialResult)
              setTranslationState('success')

              if (settings.translationAutoSaveHistory) {
                saveToHistory({
                  sourceFramework,
                  targetFramework,
                  sourceCodePreview: sourceCode.slice(0, 100),
                  sourceCode,
                  translatedCode: finalCode,
                  confidence: partialResult.overallConfidence,
                  confidenceLevel: partialResult.confidenceLevel,
                })
              }
            } else {
              setErrorMessage('流式翻译未能获取完整结果，请重试')
              setTranslationState('error')
            }
          } else if (!streamDone && !accumulated) {
            setErrorMessage('流式翻译未返回任何内容，请检查 AI 配置')
            setTranslationState('error')
          }
        } else {
          // 非 SSE 响应（回退到 AST 翻译），按普通 JSON 处理
          const data = await response.json() as Partial<TranslationResult> & { error?: string }
          if (data.error) {
            throw new Error(data.error)
          }
          if (!data.code?.trim()) {
            throw new Error('翻译接口未返回有效代码，请重试')
          }
          const translationResult = data as TranslationResult
          setResult(translationResult)
          setTranslatedCode(translationResult.code)
          setTranslationState('success')

          if (settings.translationAutoSaveHistory) {
            saveToHistory({
              sourceFramework,
              targetFramework,
              sourceCodePreview: sourceCode.slice(0, 100),
              sourceCode,
              translatedCode: translationResult.code,
              confidence: translationResult.overallConfidence,
              confidenceLevel: translationResult.confidenceLevel,
            })
          }
        }
      } else if (!settings.translationAIAssist && isClientTranslationSupported(sourceFramework)) {
        // ===== 客户端 AST 翻译（无需服务端 API） =====
        // 注意：Vue 3 源代码需要 @vue/compiler-sfc，不支持客户端翻译，需走服务端
        console.log('[FrameShift] 使用客户端 AST 翻译模式（无需网络请求）')
        const data = await clientTranslate(sourceCode, sourceFramework, targetFramework)
        setResult(data)
        setTranslatedCode(data.code)
        setTranslationState('success')

        console.log(`[FrameShift] 客户端 AST 翻译完成，耗时 ${data.duration}ms`)

        // 保存到翻译历史
        if (settings.translationAutoSaveHistory) {
          saveToHistory({
            sourceFramework,
            targetFramework,
            sourceCodePreview: sourceCode.slice(0, 100),
            sourceCode,
            translatedCode: data.code,
            confidence: data.overallConfidence,
            confidenceLevel: data.confidenceLevel,
          })
        }
      } else {
        // ===== 服务端翻译（自定义 AI 或 Vue 3 AST 模式） =====
        // Vue 3 源代码需要 @vue/compiler-sfc（Node.js only），走服务端 API
        // 自定义 AI 缺失字段可由服务端环境变量补齐，也走服务端 API
        console.log('[FrameShift] 使用服务端翻译', settings.translationAIAssist ? '(自定义 AI)' : '(Vue 3 AST 回退)')
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error ?? `翻译请求失败 (${response.status})`)
        }

        const data: TranslationResult = await response.json()
        setResult(data)
        setTranslatedCode(data.code)
        setTranslationState('success')

        // 日志：显示翻译结果的模式
        const genStep = data.pipeline?.steps?.find(s => s.id === 'generate')
        if (genStep?.detail) {
          const mode = (genStep.detail as Record<string, unknown>).mode
          console.log(`[FrameShift] 翻译完成，模式: ${mode}`, mode === 'ast-fallback' ? '⚠️ AI 翻译失败，已回退到 AST 管线' : '')
        }

        // 保存到翻译历史
        if (settings.translationAutoSaveHistory) {
          saveToHistory({
            sourceFramework,
            targetFramework,
            sourceCodePreview: sourceCode.slice(0, 100),
            sourceCode,
            translatedCode: data.code,
            confidence: data.overallConfidence,
            confidenceLevel: data.confidenceLevel,
          })
        }
      }
    } catch (err) {
      // 如果是用户取消的请求，不显示错误
      if (err instanceof DOMException && err.name === 'AbortError') {
        setTranslationState('idle')
        return
      }
      const msg = err instanceof Error ? err.message : '翻译过程中发生未知错误'
      setErrorMessage(msg)
      setTranslationState('error')
    } finally {
      setIsStreaming(false)
      streamAbortRef.current = null
    }
  }, [sourceCode, sourceFramework, targetFramework, settings])

  /** 重置翻译 */
  const handleReset = useCallback(() => {
    // 取消正在进行的流式请求
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }
    setTranslationState('idle')
    setResult(null)
    setTranslatedCode('')
    setErrorMessage('')
    setViewMode('editor')
    setIsStreaming(false)
  }, [])

  /** 复制翻译结果到剪贴板 */
  const handleCopy = useCallback(async () => {
    if (!translatedCode) return
    try {
      await navigator.clipboard.writeText(translatedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 剪贴板写入失败时静默处理
    }
  }, [translatedCode])

  /** 下载翻译结果代码 */
  const handleDownload = useCallback(() => {
    if (!translatedCode) return
    const extension = targetFramework === 'react' ? '.tsx' : targetFramework === 'angular' ? '.component.ts' : '.vue'
    const fileName = `translated-component${extension}`
    const blob = new Blob([translatedCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [translatedCode, targetFramework])

  /** 分享代码 - 生成分享链接并复制到剪贴板 */
  const handleShare = useCallback(async () => {
    if (!sourceCode.trim()) return
    try {
      // 将源代码编码为 base64，框架信息直接放在 URL 参数中
      const encodedCode = btoa(unescape(encodeURIComponent(sourceCode)))
      const shareUrl = `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(encodedCode)}&source=${sourceFramework}&target=${targetFramework}`
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      toast({
        title: '分享链接已复制',
        description: '链接已复制到剪贴板，可以发送给他人',
      })
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // 剪贴板写入失败时提示
      toast({
        title: '复制失败',
        description: '请手动复制浏览器地址栏中的链接',
        variant: 'destructive',
      })
    }
  }, [sourceCode, sourceFramework, targetFramework, toast])

  /** 切换 Diff 视图 */
  const handleToggleDiff = useCallback(() => {
    setViewMode((prev) => (prev === 'editor' ? 'diff' : 'editor'))
  }, [])

  /** 获取框架默认代码 */
  const getDefaultCode = useCallback((fw: Framework) => {
    switch (fw) {
      case 'react': return DEFAULT_REACT_CODE
      case 'vue3': return DEFAULT_VUE_CODE
      case 'angular': return DEFAULT_ANGULAR_CODE
      default: return DEFAULT_REACT_CODE
    }
  }, [])

  /** 获取目标框架（自动选择不同的框架） */
  const getAlternativeFramework = useCallback((fw: Framework): Framework => {
    if (fw === 'react') return 'vue3'
    if (fw === 'vue3') return 'react'
    return 'react'
  }, [])

  /** 处理源框架变更 */
  const handleSourceFrameworkChange = useCallback((fw: Framework) => {
    setSourceFramework(fw)
    // 自动设置目标框架为另一个
    if (fw === targetFramework) {
      setTargetFramework(getAlternativeFramework(fw))
    }
    // 更新默认代码
    setSourceCode(getDefaultCode(fw))
    handleReset()
  }, [handleReset, targetFramework, getDefaultCode, getAlternativeFramework])

  /** 处理目标框架变更 */
  const handleTargetFrameworkChange = useCallback((fw: Framework) => {
    setTargetFramework(fw)
    // 如果目标与源相同，自动切换源
    if (fw === sourceFramework) {
      const altFw = getAlternativeFramework(fw)
      setSourceFramework(altFw)
      setSourceCode(getDefaultCode(altFw))
    }
    handleReset()
  }, [sourceFramework, handleReset, getDefaultCode, getAlternativeFramework])

  /** 处理警告点击 */
  const handleWarningClick = useCallback((_warning: TranslationWarning) => {
    // 后续可实现：跳转到代码对应位置
  }, [])

  /** 键盘快捷键 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: 翻译代码
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (translationState !== 'loading' && sourceCode.trim()) {
          handleTranslate()
        }
      }
      // Ctrl+Shift+D: 切换 Diff 视图
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (translationState === 'success' && translatedCode) {
          handleToggleDiff()
        }
      }
      // Ctrl+S: 下载翻译结果
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        if (translationState === 'success' && translatedCode) {
          handleDownload()
        }
      }
      // Ctrl+Shift+C: 复制翻译结果
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        if (translationState === 'success' && translatedCode) {
          handleCopy()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTranslate, translationState, sourceCode, handleToggleDiff, handleDownload, handleCopy, translatedCode])

  /** 从历史记录加载 */
  const handleSelectHistoryEntry = useCallback((entry: TranslationHistoryEntry) => {
    setSourceFramework(entry.sourceFramework)
    setTargetFramework(entry.targetFramework)
    setSourceCode(entry.sourceCode)
    setTranslatedCode(entry.translatedCode)
    setTranslationState('success')
    // 构造一个简易的 result 用于展示报告
    setResult({
      code: entry.translatedCode,
      targetFramework: entry.targetFramework,
      overallConfidence: entry.confidence,
      confidenceLevel: entry.confidenceLevel,
      warnings: [],
      duration: 0,
    })
    setShowHistory(false)
  }, [])

  /** 翻译成功庆祝效果状态 */
  const [showCelebration, setShowCelebration] = useState(false)

  /** 监听翻译成功触发庆祝效果 */
  useEffect(() => {
    if (translationState === 'success') {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [translationState])

  return (
    <div className={cn('flex h-full', className)}>
      {/* 翻译成功庆祝效果 */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Sparkle bursts */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2
              const distance = 80 + Math.random() * 60
              return (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '40%',
                  }}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [1, 1, 0],
                    scale: [0, 1, 0.5],
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                  }}
                  transition={{
                    duration: 1.2,
                    delay: i * 0.05,
                    ease: 'easeOut',
                  }}
                >
                  <Sparkles
                    className="h-3 w-3"
                    style={{
                      color: i % 3 === 0 ? '#22c55e' : i % 3 === 1 ? '#4ade80' : '#86efac',
                    }}
                  />
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主工作区 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部工具栏 - 渐变背景 */}
        <div className="shrink-0 border-b border-[var(--app-border)] bg-gradient-to-r from-[var(--app-toolbar-gradient-from)] via-[var(--app-toolbar-gradient-via)] to-[var(--app-toolbar-gradient-to)] px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 框架选择器 */}
            <FrameworkSelector
              sourceFramework={sourceFramework}
              targetFramework={targetFramework}
              onSourceChange={handleSourceFrameworkChange}
              onTargetChange={handleTargetFrameworkChange}
            />

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {/* 翻译动作组 */}
              <div className="flex items-center gap-2">
              {/* 翻译按钮 - 发光效果 + 空闲时渐变边框动画 */}
              <div className="relative">
                {/* 空闲时渐变边框动画 */}
                {translationState === 'idle' && sourceCode.trim() && (
                  <motion.div
                    className="absolute -inset-[2px] rounded-lg pointer-events-none animate-glow-pulse"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.3), transparent 40%, rgba(139,92,246,0.2), transparent 80%, rgba(34,197,94,0.3))',
                      backgroundSize: '200% 200%',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                      padding: '2px',
                    }}
                    animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                {/* 悬停发光底层 */}
                <motion.div
                  className="absolute inset-0 rounded-md pointer-events-none"
                  animate={{
                    opacity: translationState === 'idle' && sourceCode.trim() ? 0 : 0,
                  }}
                  whileHover={{
                    opacity: 0.4,
                  }}
                  style={{
                    background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4), transparent 70%)',
                    filter: 'blur(8px)',
                  }}
                />
                <Button
                  onClick={handleTranslate}
                  disabled={translationState === 'loading' || !sourceCode.trim()}
                  className={cn(
                    'relative gap-2 font-medium transition-all duration-200',
                    translationState === 'idle' && 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-md shadow-[#22c55e]/20 hover:shadow-lg hover:shadow-[#22c55e]/30',
                    translationState === 'loading' && 'bg-[#22c55e]/70 text-white/80',
                    translationState === 'success' && 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-md shadow-[#22c55e]/20',
                    translationState === 'error' && 'bg-[#ef4444] hover:bg-[#ef4444]/90 text-white',
                  )}
                >
                  {translationState === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      翻译中...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      翻译
                    </>
                  )}
                </Button>
              </div>

              {/* AI 提供商指示器 */}
              {settings.translationAIAssist && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] cursor-default">
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isStreaming ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#22c55e] animate-pulse'
                      )} />
                      <span className={cn(
                        'font-medium',
                        'text-[#f59e0b]'
                      )}>
                        自定义AI
                      </span>
                      {settings.aiConfig.model && (
                        <span className="text-[var(--app-text-secondary)] font-mono">({settings.aiConfig.model})</span>
                      )}
                      {settings.aiConfig.apiProtocol === 'anthropic-messages' && (
                        <span className="text-[10px] px-1 py-0 rounded bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20">Anthropic</span>
                      )}
                      {isStreaming && (
                        <span className="text-[10px] px-1.5 py-0 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 font-medium animate-pulse">流式</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                    {isStreaming
                      ? `流式翻译中... (${settings.aiConfig.apiProtocol || 'openai-completions'} 协议)`
                      : `自定义 AI: ${settings.aiConfig.baseUrl || '使用环境变量 Base URL'} / ${settings.aiConfig.model || '使用环境变量模型'} (${settings.aiConfig.apiProtocol || 'openai-completions'} 协议)`}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* 键盘快捷键提示 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--app-text-secondary)] cursor-default">
                    <Keyboard className="h-3 w-3" />
                    <kbd className="px-1 py-0.5 rounded bg-[var(--app-hover-bg)] border border-[var(--app-border)] text-[var(--app-text-secondary)] font-mono text-[10px]">
                      Ctrl+Enter
                    </kbd>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                  按 Ctrl+Enter 快速翻译
                </TooltipContent>
              </Tooltip>
              </div>

              {/* 分隔线：动作组 | 工具组 */}
              <div className="w-px h-5 bg-[var(--app-border)]" />

              {/* 工具按钮组 */}
              <div className="flex items-center gap-2">
              {/* 重置按钮 */}
              {(translationState === 'success' || translationState === 'error') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleReset}
                        className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                      重置翻译
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}

              {/* Diff 视图切换按钮 */}
              {translationState === 'success' && translatedCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleToggleDiff}
                        className={cn(
                          'h-9 w-9 transition-colors',
                          viewMode === 'diff'
                            ? 'text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/15'
                            : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]',
                        )}
                      >
                        <GitCompare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                      {viewMode === 'editor' ? '切换到 Diff 视图' : '切换到编辑器视图'}
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}

              {/* 复制按钮 */}
              {translationState === 'success' && translatedCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopy}
                        className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-[#22c55e]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                      复制代码 (Ctrl+Shift+C)
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}

              {/* 下载按钮 */}
              {translationState === 'success' && translatedCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDownload}
                        className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                      下载代码 (Ctrl+S)
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
              </div>

              {/* 分隔线：工具组 | 设置组 */}
              <div className="w-px h-5 bg-[var(--app-border)]" />

              {/* 设置按钮组 */}
              <div className="flex items-center gap-2">
              {/* 分享按钮 */}
              {translationState === 'success' && sourceCode.trim() && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleShare}
                        className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                      >
                        {shareCopied ? (
                          <Check className="h-4 w-4 text-[#22c55e]" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                      分享代码
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}

              {/* 快捷键帮助按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowShortcutsDialog(true)}
                    className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                  键盘快捷键
                </TooltipContent>
              </Tooltip>

              {/* 设置按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettingsDialog(true)}
                    className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                  设置
                </TooltipContent>
              </Tooltip>

              {/* 历史按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowHistory(!showHistory)}
                    className={cn(
                      'h-9 w-9 transition-colors',
                      showHistory
                        ? 'text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/15'
                        : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]',
                    )}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                  翻译历史
                </TooltipContent>
              </Tooltip>
              </div>
            </div>
          </div>

          {/* 翻译状态指示器 - 加载动画增强 */}
          <AnimatePresence>
            {translationState === 'loading' && !isStreaming && (
              <LoadingStepIndicator steps={settings.translationAIAssist ? LOADING_STEPS_WITH_AI : LOADING_STEPS_WITHOUT_AI} />
            )}

            {translationState === 'loading' && isStreaming && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <div className="flex items-center gap-2 text-xs text-[#f59e0b]">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                      />
                    ))}
                  </div>
                  <span className="text-[#f59e0b] font-medium">AI 流式翻译中，代码实时生成...</span>
                </div>
              </motion.div>
            )}

            {translationState === 'error' && errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <div className="flex items-center gap-2 text-xs text-[#ef4444] bg-[#ef4444]/5 px-3 py-2 rounded-md">
                  <span>❌</span>
                  <span>{errorMessage}</span>
                </div>
              </motion.div>
            )}

            {translationState === 'success' && result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-5',
                      result.confidenceLevel === 'high' && 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
                      result.confidenceLevel === 'medium' && 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
                      result.confidenceLevel === 'low' && 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
                    )}
                  >
                    置信度 {Math.round(result.overallConfidence * 100)}%
                  </Badge>
                  {/* 置信度详细提示 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--app-text-muted)] cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)] max-w-64">
                      <div className="space-y-1">
                        <p className="font-medium text-xs">置信度分析</p>
                        <p className="text-[10px] text-[var(--app-text-secondary)]">总体置信度: {Math.round(result.overallConfidence * 100)}%</p>
                        <p className="text-[10px] text-[var(--app-text-secondary)]">级别: {result.confidenceLevel === 'high' ? '高 ✓' : result.confidenceLevel === 'medium' ? '中 ⚠' : '低 ✗'}</p>
                        {result.warnings.length > 0 && <p className="text-[10px] text-[var(--app-text-secondary)]">警告数: {result.warnings.length}</p>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  {result.warnings.length > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20">
                      {result.warnings.length} 个警告
                    </Badge>
                  )}
                  {/* AI 翻译模式指示器 */}
                  {settings.translationAIAssist && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={cn(
                          'text-[10px] h-5 gap-1',
                          isPartialResult
                            ? 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20'
                            : resultGenerateDetail?.mode === 'ai-full'
                              ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'
                              : resultGenerateDetail?.mode === 'ast-fallback'
                              ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
                              : 'bg-[var(--app-hover-bg)] text-[var(--app-text-muted)] border-[var(--app-border)]',
                        )}>
                          <Sparkles className="h-2.5 w-2.5" />
                          {isPartialResult
                            ? 'AI 部分结果'
                            : resultGenerateDetail?.mode === 'ai-full'
                              ? `${settings.aiConfig.model || '自定义AI'} 翻译`
                              : resultGenerateDetail?.mode === 'ast-fallback'
                              ? 'AI 失败·已回退'
                              : 'AI 翻译'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)] max-w-72">
                        {isPartialResult
                          ? '流式翻译未完整结束，当前仅保留部分结果，建议重试或人工审查'
                          : resultGenerateDetail?.mode === 'ai-full'
                            ? `已使用 ${settings.aiConfig.model || '自定义AI'} 进行全量翻译，翻译质量较高`
                            : resultGenerateDetail?.mode === 'ast-fallback'
                            ? 'AI 翻译失败，已自动回退到 AST 管线翻译。部分代码可能缺失，建议检查 API 配置或重试'
                            : '翻译模式信息'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 主内容区：可调整大小的面板 */}
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* 代码编辑器 / Diff 视图区域 */}
            <ResizablePanel defaultSize={65} minSize={30}>
              {viewMode === 'diff' && translationState === 'success' && translatedCode ? (
                /* Diff 对比视图 */
                <DiffViewer
                  sourceCode={sourceCode}
                  targetCode={translatedCode}
                  sourceLanguage={getEditorLanguage(sourceFramework)}
                  targetLanguage={getEditorLanguage(targetFramework)}
                  className="h-full"
                />
              ) : (
                /* 双编辑器视图 */
                <ResizablePanelGroup direction="horizontal">
                  {/* 源代码编辑器 */}
                  <ResizablePanel defaultSize={50} minSize={25}>
                    <div className="h-full flex flex-col bg-[var(--app-bg)]">
                      <div className="shrink-0 bg-[var(--app-bg-secondary)] px-4 py-1.5 border-b border-[var(--app-border)] flex items-center gap-2">
                        <span className="text-xs text-[var(--app-text-secondary)] font-medium">源代码</span>
                        {/* 框架徽章 - 更视觉化 */}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-4 gap-1 transition-colors',
                            sourceFramework === 'react'
                              ? 'bg-[#61dafb]/10 text-[#61dafb] border-[#61dafb]/20'
                              : sourceFramework === 'angular'
                                ? 'bg-[#dd0031]/10 text-[#dd0031] border-[#dd0031]/20'
                                : 'bg-[#42b883]/10 text-[#42b883] border-[#42b883]/20',
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sourceFramework === 'react' ? '#61dafb' : sourceFramework === 'angular' ? '#dd0031' : '#42b883' }} />
                          {sourceFramework === 'react' ? 'React' : sourceFramework === 'angular' ? 'Angular' : 'Vue 3'}
                        </Badge>
                      </div>
                      <div className="flex-1 min-h-0">
                        <CodeEditor
                          value={sourceCode}
                          onChange={setSourceCode}
                          language={getEditorLanguage(sourceFramework)}
                          height="100%"
                          settings={settings}
                        />
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle className="bg-[var(--app-border)]" />

                  {/* 翻译结果编辑器 */}
                  <ResizablePanel defaultSize={50} minSize={25}>
                    <div className="h-full flex flex-col bg-[var(--app-bg)]">
                      <div className="shrink-0 bg-[var(--app-bg-secondary)] px-4 py-1.5 border-b border-[var(--app-border)] flex items-center gap-2">
                        <span className="text-xs text-[var(--app-text-secondary)] font-medium">翻译结果</span>
                        {/* 框架徽章 - 更视觉化 */}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-4 gap-1 transition-colors',
                            targetFramework === 'react'
                              ? 'bg-[#61dafb]/10 text-[#61dafb] border-[#61dafb]/20'
                              : targetFramework === 'angular'
                                ? 'bg-[#dd0031]/10 text-[#dd0031] border-[#dd0031]/20'
                                : 'bg-[#42b883]/10 text-[#42b883] border-[#42b883]/20',
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: targetFramework === 'react' ? '#61dafb' : targetFramework === 'angular' ? '#dd0031' : '#42b883' }} />
                          {targetFramework === 'react' ? 'React' : targetFramework === 'angular' ? 'Angular' : 'Vue 3'}
                        </Badge>
                        {translationState === 'success' && (
                          <>
                            <motion.span
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={cn(
                                'text-[10px]',
                                isPartialResult ? 'text-[#f97316]' : 'text-[#22c55e]'
                              )}
                            >
                              {isPartialResult ? '⚠ 部分结果' : '✓ 翻译完成'}
                            </motion.span>
                            {/* 翻译来源指示器 */}
                            {(() => {
                              const mode = resultGenerateDetail?.mode
                              const isAI = mode === 'ai-full'
                              const isFallback = mode === 'ast-fallback'
                              const aiUnitCount = (resultGenerateDetail?.aiUnitCount as number) ?? 0
                              const model = settings.aiConfig.model || '自定义AI'
                              return (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.15 }}
                                >
                                  <Badge variant="outline" className={cn(
                                    'text-[10px] h-5 gap-1',
                                    isAI && !isPartialResult && 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
                                    isPartialResult && 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
                                    isFallback && 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
                                    !isAI && !isFallback && 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
                                  )}>
                                    {isAI && isPartialResult ? (
                                      <>
                                        <Sparkles className="h-2.5 w-2.5" />
                                        <span>AI 部分结果</span>
                                        {aiUnitCount > 0 && <span className="opacity-70">·{aiUnitCount}单元</span>}
                                      </>
                                    ) : isAI ? (
                                      <>
                                        <Sparkles className="h-2.5 w-2.5" />
                                        <span>{model}</span>
                                        {aiUnitCount > 0 && <span className="opacity-70">·{aiUnitCount}单元</span>}
                                      </>
                                    ) : isFallback ? (
                                      <>
                                        <Sparkles className="h-2.5 w-2.5" />
                                        <span>AI 失败·AST 回退</span>
                                      </>
                                    ) : (
                                      <>
                                        <TreePine className="h-2.5 w-2.5" />
                                        <span>AST 本地翻译</span>
                                      </>
                                    )}
                                  </Badge>
                                </motion.div>
                              )
                            })()}
                            {/* 代码统计信息 */}
                            <motion.div
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                              className="flex items-center gap-1.5 ml-1"
                            >
                              <span className="text-[10px] text-[var(--app-text-secondary)] tabular-nums">{codeStats.lines}行</span>
                              <span className="text-[10px] text-[var(--app-text-muted)]">|</span>
                              <span className="text-[10px] text-[var(--app-text-secondary)] tabular-nums">{codeStats.chars}字符</span>
                              <span className="text-[10px] text-[var(--app-text-muted)]">|</span>
                              <span className="text-[10px] text-[var(--app-text-secondary)] tabular-nums">{codeStats.size}</span>
                            </motion.div>
                          </>
                        )}
                        {/* 翻译方向指示器 */}
                        <div className="ml-auto flex items-center gap-1">
                          {/* AI 状态指示器 */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] cursor-default transition-colors',
                                settings.translationAIAssist
                                  ? 'bg-[#22c55e]/10 text-[#22c55e]'
                                  : 'bg-[var(--app-hover-bg)] text-[var(--app-text-muted)]',
                              )}>
                                <Sparkles className="h-2.5 w-2.5" />
                                <span>AI {settings.translationAIAssist ? 'ON' : 'OFF'}</span>
                                {settings.translationAIAssist && (
                                  <div className="w-1 h-1 rounded-full bg-[#22c55e] animate-pulse" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                              {settings.translationAIAssist
                                ? `AI 辅助翻译已启用 · ${settings.aiConfig.model || '自定义'} · 自动优化低置信度翻译`
                                : 'AI 辅助翻译已关闭 · 在设置中开启可获得更高质量的翻译'}
                            </TooltipContent>
                          </Tooltip>
                          {(() => {
                            const dir = getDirectionIndicator(sourceFramework, targetFramework)
                            return (
                              <motion.div
                                className="flex items-center gap-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                              >
                                <span className="text-[11px]">{dir.from}</span>
                                <motion.span
                                  className="text-[10px] text-[var(--app-text-secondary)]"
                                  animate={{ x: [0, 3, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  →
                                </motion.span>
                                <span className="text-[11px]">{dir.to}</span>
                              </motion.div>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        {translationState === 'loading' && !isStreaming ? (
                          /* 翻译流水线可视化（非流式模式） */
                          <div className="h-full flex flex-col items-center justify-center bg-[var(--app-bg)] p-6 overflow-y-auto custom-scrollbar">
                            <TranslationPipelineView
                              pipeline={result?.pipeline}
                              isLoading
                            />
                          </div>
                        ) : translationState === 'loading' && isStreaming && translatedCode ? (
                          /* 流式翻译中 - 实时显示生成的代码 */
                          <div className="h-full flex flex-col bg-[var(--app-bg)]">
                            {/* 流式状态栏 */}
                            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                              <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                  <motion.div
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                                  />
                                ))}
                              </div>
                              <span className="text-[11px] text-[#f59e0b] font-medium">AI 流式翻译中...</span>
                              <span className="text-[10px] text-[var(--app-text-secondary)]">
                                {translatedCode.split('\n').length} 行
                              </span>
                              <div className="flex-1 max-w-24 h-1 bg-[var(--app-hover-bg)] rounded-full overflow-hidden ml-2">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] rounded-full"
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                  style={{ width: '50%' }}
                                />
                              </div>
                            </div>
                            <div className="flex-1 min-h-0">
                              <CodeEditor
                                value={translatedCode}
                                language={getEditorLanguage(targetFramework)}
                                readOnly
                                height="100%"
                                settings={settings}
                              />
                            </div>
                          </div>
                        ) : !translatedCode ? (
                          /* 空状态 - 无翻译结果时的提示 */
                          <div className="h-full flex flex-col items-center justify-center bg-[var(--app-bg)]">
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5 }}
                              className="flex flex-col items-center gap-3"
                            >
                              <div className="flex items-center gap-3 text-[var(--app-text-muted)]">
                                <FileCode2 className="h-10 w-10" />
                                <motion.div
                                  animate={{ x: [0, 6, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  <ArrowRight className="h-6 w-6 text-[#22c55e]/40" />
                                </motion.div>
                                <FileCode2 className="h-10 w-10" style={{ color: targetFramework === 'react' ? '#61dafb' : '#42b883' }} />
                              </div>
                              <motion.p
                                className="text-sm text-[var(--app-text-secondary)] flex items-center gap-0.5"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2.5, repeat: Infinity }}
                              >
                                点击「翻译」按钮开始
                                <motion.span
                                  className="inline-block w-0.5 h-3.5 bg-[#22c55e] ml-0.5"
                                  animate={{ opacity: [1, 0] }}
                                  transition={{ duration: 0.6, repeat: Infinity }}
                                />
                              </motion.p>
                              <p className="text-[11px] text-[var(--app-text-muted)]">
                                源代码共 {sourceLineCount} 行
                              </p>
                            </motion.div>
                          </div>
                        ) : (
                          <CodeEditor
                            value={translatedCode}
                            language={getEditorLanguage(targetFramework)}
                            readOnly
                            height="100%"
                            settings={settings}
                          />
                        )}
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-[var(--app-border)]" />

            {/* 底部报告区域 - 加载动画增强 */}
            <ResizablePanel defaultSize={35} minSize={15}>
              <div className="h-full flex flex-col bg-[var(--app-bg)]">
                {/* 底部面板 Tab 栏 */}
                {translationState !== 'loading' && (
                  <div className="shrink-0 flex items-center gap-1 px-4 pt-3 pb-1">
                    <button
                      onClick={() => setBottomView('report')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        bottomView === 'report'
                          ? 'bg-[var(--app-hover-bg)] text-[var(--app-text)]'
                          : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]',
                      )}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      报告
                    </button>
                    <button
                      onClick={() => setBottomView('syntax-tree')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        bottomView === 'syntax-tree'
                          ? 'bg-[var(--app-hover-bg)] text-[var(--app-text)]'
                          : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]',
                      )}
                    >
                      <TreePine className="h-3.5 w-3.5" />
                      语法树
                    </button>
                    <button
                      onClick={() => setBottomView('pipeline')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        bottomView === 'pipeline'
                          ? 'bg-[var(--app-hover-bg)] text-[var(--app-text)]'
                          : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]',
                      )}
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      流水线
                    </button>
                  </div>
                )}

                {/* 底部面板内容 */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
                  {translationState === 'loading' ? (
                    /* 加载骨架屏 - 带微光动画 */
                    <LoadingSkeletonWithStep steps={settings.translationAIAssist ? LOADING_STEPS_WITH_AI : LOADING_STEPS_WITHOUT_AI} />
                  ) : bottomView === 'pipeline' ? (
                    /* 流水线视图 */
                    <TranslationPipelineView
                      pipeline={result?.pipeline}
                    />
                  ) : bottomView === 'syntax-tree' ? (
                    /* 语法树视图 */
                    <SyntaxTreeView
                      // 使用翻译 API 返回的真实语义树数据
                      tree={result?.semanticTree ?? null}
                    />
                  ) : (
                    <div className="space-y-4">
                      {/* 置信度报告 */}
                      <ConfidenceReport result={result} />

                      {/* 警告列表 */}
                      <WarningList
                        warnings={result?.warnings ?? []}
                        onWarningClick={handleWarningClick}
                      />
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* 底部状态栏 */}
        <div className="shrink-0 h-6 bg-[var(--app-bg-secondary)] border-t border-[var(--app-border)] flex items-center justify-between px-3">
          <div className="flex items-center gap-3 text-[10px] text-[var(--app-text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sourceFramework === 'react' ? '#61dafb' : '#42b883' }} />
              {sourceFramework === 'react' ? 'React' : 'Vue 3'}
            </span>
            <span className="text-[var(--app-border)]">→</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: targetFramework === 'react' ? '#61dafb' : '#42b883' }} />
              {targetFramework === 'react' ? 'React' : 'Vue 3'}
            </span>
            <span className="text-[var(--app-border)]">|</span>
            <span>{sourceCode.split('\n').length} 行</span>
            <span className="text-[var(--app-border)]">|</span>
            <span>{sourceCode.length} 字符</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-muted)]">
            {translationState === 'success' && (
              <span className="text-[#22c55e]">✓ 就绪</span>
            )}
            {translationState === 'idle' && (
              <span>就绪</span>
            )}
            {translationState === 'loading' && (
              <span className="flex items-center gap-1">
                <motion.span className="inline-block w-1 h-1 rounded-full bg-[#22c55e]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
                翻译中
              </span>
            )}
            {translationState === 'error' && (
              <span className="text-[#ef4444]">出错</span>
            )}
            <span className="text-[var(--app-border)]">|</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>

      {/* 键盘快捷键对话框 */}
      <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
        <DialogContent className="bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--app-text)] flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-[#22c55e]" />
              键盘快捷键
            </DialogTitle>
            <DialogDescription className="text-[var(--app-text-secondary)]">
              使用以下快捷键提高工作效率
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {[
              { keys: ['Ctrl', 'Enter'], description: '翻译代码' },
              { keys: ['Ctrl', 'Shift', 'D'], description: '切换 Diff 视图' },
              { keys: ['Ctrl', 'S'], description: '下载翻译结果' },
              { keys: ['Ctrl', 'Shift', 'C'], description: '复制翻译结果' },
            ].map((shortcut) => (
              <div
                key={shortcut.keys.join('+')}
                className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)]/50"
              >
                <span className="text-sm text-[var(--app-text)]">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <kbd className="px-2 py-1 rounded bg-[var(--app-hover-bg)] border border-[var(--app-border)] text-xs text-[var(--app-text)] font-mono min-w-[28px] text-center">
                        {key}
                      </kbd>
                      {i < shortcut.keys.length - 1 && (
                        <span className="text-[var(--app-text-muted)] text-xs">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 设置对话框 */}
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={settings}
        setSetting={setSetting}
        resetSettings={resetSettings}
      />

      {/* 翻译历史侧边面板 */}
      <AnimatePresence>
        {showHistory && (
          <div className="w-72 sm:w-80 shrink-0">
            <TranslationHistory
              onSelectEntry={handleSelectHistoryEntry}
              onClose={() => setShowHistory(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
