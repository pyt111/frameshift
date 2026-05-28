'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import {
  Check,
  Clock,
  Copy,
  Download,
  GitCompare,
  HelpCircle,
  Info,
  Keyboard,
  Loader2,
  Play,
  RotateCcw,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FrameworkSelector } from '@/components/framework-selector'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/hooks/use-settings'
import type { Framework, TranslationResult } from '@/lib/semantic-tree/types'
import type { TranslationState, WorkspaceViewMode } from './types'
import { LOADING_STEPS_WITH_AI, LOADING_STEPS_WITHOUT_AI } from './constants'
import { LoadingStepIndicator } from './loading-components'

interface WorkspaceToolbarProps {
  sourceFramework: Framework
  targetFramework: Framework
  sourceCode: string
  translatedCode: string
  translationState: TranslationState
  errorMessage: string
  result: TranslationResult | null
  isStreaming: boolean
  copied: boolean
  shareCopied: boolean
  viewMode: WorkspaceViewMode
  showHistory: boolean
  settings: AppSettings
  resultGenerateDetail?: Record<string, unknown>
  isPartialResult: boolean
  onSourceFrameworkChange: (framework: Framework) => void
  onTargetFrameworkChange: (framework: Framework) => void
  onTranslate: () => void
  onReset: () => void
  onToggleDiff: () => void
  onCopy: () => void
  onDownload: () => void
  onShare: () => void
  onShowShortcuts: () => void
  onShowSettings: () => void
  onToggleHistory: () => void
}

function AnimatedToolButton({
  children,
  tooltip,
  onClick,
  className,
}: {
  children: ReactNode
  tooltip: string
  onClick: () => void
  className?: string
}) {
  return (
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
            onClick={onClick}
            className={cn('h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]', className)}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </motion.div>
  )
}

function TranslationButton({
  translationState,
  sourceCode,
  onTranslate,
}: Pick<WorkspaceToolbarProps, 'translationState' | 'sourceCode' | 'onTranslate'>) {
  return (
    <div className="relative">
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
        onClick={onTranslate}
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
  )
}

function AiProviderIndicator({
  settings,
  isStreaming,
}: Pick<WorkspaceToolbarProps, 'settings' | 'isStreaming'>) {
  if (!settings.translationAIAssist) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] cursor-default">
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            isStreaming ? 'bg-[#f59e0b] animate-pulse' : 'bg-[#22c55e] animate-pulse'
          )} />
          <span className="font-medium text-[#f59e0b]">
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
  )
}

function KeyboardHint() {
  return (
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
  )
}

function ToolbarStatus({
  translationState,
  isStreaming,
  errorMessage,
  result,
  settings,
  resultGenerateDetail,
  isPartialResult,
}: Pick<WorkspaceToolbarProps, 'translationState' | 'isStreaming' | 'errorMessage' | 'result' | 'settings' | 'resultGenerateDetail' | 'isPartialResult'>) {
  return (
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
  )
}

export function WorkspaceToolbar({
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
  viewMode,
  showHistory,
  settings,
  resultGenerateDetail,
  isPartialResult,
  onSourceFrameworkChange,
  onTargetFrameworkChange,
  onTranslate,
  onReset,
  onToggleDiff,
  onCopy,
  onDownload,
  onShare,
  onShowShortcuts,
  onShowSettings,
  onToggleHistory,
}: WorkspaceToolbarProps) {
  return (
    <div className="shrink-0 border-b border-[var(--app-border)] bg-gradient-to-r from-[var(--app-toolbar-gradient-from)] via-[var(--app-toolbar-gradient-via)] to-[var(--app-toolbar-gradient-to)] px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FrameworkSelector
          sourceFramework={sourceFramework}
          targetFramework={targetFramework}
          onSourceChange={onSourceFrameworkChange}
          onTargetChange={onTargetFrameworkChange}
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <TranslationButton
              translationState={translationState}
              sourceCode={sourceCode}
              onTranslate={onTranslate}
            />
            <AiProviderIndicator settings={settings} isStreaming={isStreaming} />
            <KeyboardHint />
          </div>

          <div className="w-px h-5 bg-[var(--app-border)]" />

          <div className="flex items-center gap-2">
            {(translationState === 'success' || translationState === 'error') && (
              <AnimatedToolButton tooltip="重置翻译" onClick={onReset}>
                <RotateCcw className="h-4 w-4" />
              </AnimatedToolButton>
            )}

            {translationState === 'success' && translatedCode && (
              <AnimatedToolButton
                tooltip={viewMode === 'editor' ? '切换到 Diff 视图' : '切换到编辑器视图'}
                onClick={onToggleDiff}
                className={viewMode === 'diff' ? 'text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/15' : undefined}
              >
                <GitCompare className="h-4 w-4" />
              </AnimatedToolButton>
            )}

            {translationState === 'success' && translatedCode && (
              <AnimatedToolButton tooltip="复制代码 (Ctrl+Shift+C)" onClick={onCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-[#22c55e]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </AnimatedToolButton>
            )}

            {translationState === 'success' && translatedCode && (
              <AnimatedToolButton tooltip="下载代码 (Ctrl+S)" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </AnimatedToolButton>
            )}
          </div>

          <div className="w-px h-5 bg-[var(--app-border)]" />

          <div className="flex items-center gap-2">
            {translationState === 'success' && sourceCode.trim() && (
              <AnimatedToolButton tooltip="分享代码" onClick={onShare}>
                {shareCopied ? (
                  <Check className="h-4 w-4 text-[#22c55e]" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
              </AnimatedToolButton>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onShowShortcuts}
                  className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                键盘快捷键
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onShowSettings}
                  className="h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                设置
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleHistory}
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

      <ToolbarStatus
        translationState={translationState}
        isStreaming={isStreaming}
        errorMessage={errorMessage}
        result={result}
        settings={settings}
        resultGenerateDetail={resultGenerateDetail}
        isPartialResult={isPartialResult}
      />
    </div>
  )
}
