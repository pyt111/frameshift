'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TranslationHistoryEntry } from '@/components/translation-history'
import { useSettings } from '@/hooks/use-settings'
import { useToast } from '@/hooks/use-toast'
import type {
  Framework,
  TranslationResult,
  TranslationWarning,
} from '@/lib/semantic-tree/types'
import type {
  BottomInspectorView,
  TranslationState,
  TranslationWorkspaceProps,
  WorkspaceViewMode,
} from './types'
import { runTranslation } from './translation-runner'
import {
  formatFileSize,
  getAlternativeFramework,
  getDefaultCode,
} from './utils'

export function useTranslationWorkspace({
  initialSourceCode,
  initialSourceFramework = 'react',
  initialTargetFramework = 'vue3',
}: TranslationWorkspaceProps) {
  const [sourceFramework, setSourceFramework] = useState<Framework>(initialSourceFramework)
  const [targetFramework, setTargetFramework] = useState<Framework>(initialTargetFramework)
  const [sourceCode, setSourceCode] = useState<string>(
    initialSourceCode ?? getDefaultCode(initialSourceFramework)
  )
  const [translatedCode, setTranslatedCode] = useState<string>('')
  const [translationState, setTranslationState] = useState<TranslationState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('editor')
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [bottomView, setBottomView] = useState<BottomInspectorView>('report')
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  const { toast } = useToast()
  const { settings, setSetting, resetSettings } = useSettings()
  const streamAbortRef = useRef<AbortController | null>(null)

  const codeStats = useMemo(() => {
    if (!translatedCode) return { lines: 0, chars: 0, size: '0 B' }
    const lines = translatedCode.split('\n').length
    const chars = translatedCode.length
    const size = formatFileSize(new Blob([translatedCode]).size)
    return { lines, chars, size }
  }, [translatedCode])

  const sourceLineCount = useMemo(() => sourceCode.split('\n').length, [sourceCode])

  const resultGenerateStep = useMemo(
    () => result?.pipeline?.steps?.find(s => s.id === 'generate'),
    [result]
  )
  const resultGenerateDetail = resultGenerateStep?.detail
  const isPartialResult = resultGenerateDetail?.partial === true

  const handleReset = useCallback(() => {
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

  const handleTranslate = useCallback(async () => {
    if (!sourceCode.trim()) return

    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }

    const abortController = new AbortController()
    streamAbortRef.current = abortController

    setTranslationState('loading')
    setErrorMessage('')
    setResult(null)
    setTranslatedCode('')

    try {
      const translationResult = await runTranslation({
        sourceCode,
        sourceFramework,
        targetFramework,
        settings,
        signal: abortController.signal,
        setTranslatedCode,
        setResult,
        setStreaming: setIsStreaming,
      })

      setTranslationState(translationResult ? 'success' : 'idle')
    } catch (err) {
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

  const handleShare = useCallback(async () => {
    if (!sourceCode.trim()) return
    try {
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
      toast({
        title: '复制失败',
        description: '请手动复制浏览器地址栏中的链接',
        variant: 'destructive',
      })
    }
  }, [sourceCode, sourceFramework, targetFramework, toast])

  const handleToggleDiff = useCallback(() => {
    setViewMode((prev) => (prev === 'editor' ? 'diff' : 'editor'))
  }, [])

  const handleSourceFrameworkChange = useCallback((fw: Framework) => {
    setSourceFramework(fw)
    if (fw === targetFramework) {
      setTargetFramework(getAlternativeFramework(fw))
    }
    setSourceCode(getDefaultCode(fw))
    handleReset()
  }, [handleReset, targetFramework])

  const handleTargetFrameworkChange = useCallback((fw: Framework) => {
    setTargetFramework(fw)
    if (fw === sourceFramework) {
      const altFw = getAlternativeFramework(fw)
      setSourceFramework(altFw)
      setSourceCode(getDefaultCode(altFw))
    }
    handleReset()
  }, [sourceFramework, handleReset])

  const handleWarningClick = useCallback((_warning: TranslationWarning) => {
    // 后续可实现：跳转到代码对应位置
  }, [])

  const handleSelectHistoryEntry = useCallback((entry: TranslationHistoryEntry) => {
    setSourceFramework(entry.sourceFramework)
    setTargetFramework(entry.targetFramework)
    setSourceCode(entry.sourceCode)
    setTranslatedCode(entry.translatedCode)
    setTranslationState('success')
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (translationState !== 'loading' && sourceCode.trim()) {
          handleTranslate()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (translationState === 'success' && translatedCode) {
          handleToggleDiff()
        }
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        if (translationState === 'success' && translatedCode) {
          handleDownload()
        }
      }
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

  useEffect(() => {
    if (translationState === 'success') {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [translationState])

  return {
    sourceFramework,
    targetFramework,
    sourceCode,
    translatedCode,
    translationState,
    errorMessage,
    result,
    isStreaming,
    copied,
    shareCopied,
    codeStats,
    sourceLineCount,
    viewMode,
    showShortcutsDialog,
    showHistory,
    bottomView,
    showSettingsDialog,
    settings,
    setSourceCode,
    setBottomView,
    setShowShortcutsDialog,
    setShowHistory,
    setShowSettingsDialog,
    setSetting,
    resetSettings,
    resultGenerateDetail,
    isPartialResult,
    showCelebration,
    handleTranslate,
    handleReset,
    handleCopy,
    handleDownload,
    handleShare,
    handleToggleDiff,
    handleSourceFrameworkChange,
    handleTargetFrameworkChange,
    handleWarningClick,
    handleSelectHistoryEntry,
  }
}
