'use client'

import { motion } from 'framer-motion'
import { ArrowRight, FileCode2, Sparkles, TreePine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CodeEditor } from '@/components/code-editor'
import { DiffViewer } from '@/components/diff-viewer'
import { TranslationPipelineView } from '@/components/translation-pipeline'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/hooks/use-settings'
import type { Framework, TranslationResult } from '@/lib/semantic-tree/types'
import type { CodeStats, TranslationState, WorkspaceViewMode } from './types'
import {
  getDirectionIndicator,
  getEditorLanguage,
  getFrameworkBadgeClass,
  getFrameworkColor,
  getFrameworkLabel,
} from './utils'

interface EditorPanelsProps {
  sourceFramework: Framework
  targetFramework: Framework
  sourceCode: string
  translatedCode: string
  translationState: TranslationState
  viewMode: WorkspaceViewMode
  isStreaming: boolean
  isPartialResult: boolean
  result: TranslationResult | null
  resultGenerateDetail?: Record<string, unknown>
  codeStats: CodeStats
  sourceLineCount: number
  settings: AppSettings
  onSourceCodeChange: (code: string) => void
}

function FrameworkBadge({ framework }: { framework: Framework }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] h-4 gap-1 transition-colors',
        getFrameworkBadgeClass(framework),
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getFrameworkColor(framework) }} />
      {getFrameworkLabel(framework)}
    </Badge>
  )
}

function ResultSourceBadge({
  resultGenerateDetail,
  isPartialResult,
  model,
}: {
  resultGenerateDetail?: Record<string, unknown>
  isPartialResult: boolean
  model: string
}) {
  const mode = resultGenerateDetail?.mode
  const isAI = mode === 'ai-full'
  const isFallback = mode === 'ast-fallback'
  const aiUnitCount = (resultGenerateDetail?.aiUnitCount as number) ?? 0

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
}

function ResultHeader({
  targetFramework,
  translationState,
  isPartialResult,
  resultGenerateDetail,
  codeStats,
  sourceFramework,
  settings,
}: Pick<EditorPanelsProps, 'targetFramework' | 'translationState' | 'isPartialResult' | 'resultGenerateDetail' | 'codeStats' | 'sourceFramework' | 'settings'>) {
  const dir = getDirectionIndicator(sourceFramework, targetFramework)

  return (
    <div className="shrink-0 bg-[var(--app-bg-secondary)] px-4 py-1.5 border-b border-[var(--app-border)] flex items-center gap-2">
      <span className="text-xs text-[var(--app-text-secondary)] font-medium">翻译结果</span>
      <FrameworkBadge framework={targetFramework} />
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
          <ResultSourceBadge
            resultGenerateDetail={resultGenerateDetail}
            isPartialResult={isPartialResult}
            model={settings.aiConfig.model || '自定义AI'}
          />
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
      <div className="ml-auto flex items-center gap-1">
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
      </div>
    </div>
  )
}

function ResultBody({
  translationState,
  isStreaming,
  translatedCode,
  targetFramework,
  sourceLineCount,
  settings,
  result,
}: Pick<EditorPanelsProps, 'translationState' | 'isStreaming' | 'translatedCode' | 'targetFramework' | 'sourceLineCount' | 'settings' | 'result'>) {
  if (translationState === 'loading' && !isStreaming) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--app-bg)] p-6 overflow-y-auto custom-scrollbar">
        <TranslationPipelineView
          pipeline={result?.pipeline}
          isLoading
        />
      </div>
    )
  }

  if (translationState === 'loading' && isStreaming && translatedCode) {
    return (
      <div className="h-full flex flex-col bg-[var(--app-bg)]">
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
    )
  }

  if (!translatedCode) {
    return (
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
    )
  }

  return (
    <CodeEditor
      value={translatedCode}
      language={getEditorLanguage(targetFramework)}
      readOnly
      height="100%"
      settings={settings}
    />
  )
}

export function EditorPanels({
  sourceFramework,
  targetFramework,
  sourceCode,
  translatedCode,
  translationState,
  viewMode,
  isStreaming,
  isPartialResult,
  result,
  resultGenerateDetail,
  codeStats,
  sourceLineCount,
  settings,
  onSourceCodeChange,
}: EditorPanelsProps) {
  if (viewMode === 'diff' && translationState === 'success' && translatedCode) {
    return (
      <DiffViewer
        sourceCode={sourceCode}
        targetCode={translatedCode}
        sourceLanguage={getEditorLanguage(sourceFramework)}
        targetLanguage={getEditorLanguage(targetFramework)}
        className="h-full"
      />
    )
  }

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={50} minSize={25}>
        <div className="h-full flex flex-col bg-[var(--app-bg)]">
          <div className="shrink-0 bg-[var(--app-bg-secondary)] px-4 py-1.5 border-b border-[var(--app-border)] flex items-center gap-2">
            <span className="text-xs text-[var(--app-text-secondary)] font-medium">源代码</span>
            <FrameworkBadge framework={sourceFramework} />
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor
              value={sourceCode}
              onChange={onSourceCodeChange}
              language={getEditorLanguage(sourceFramework)}
              height="100%"
              settings={settings}
            />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="bg-[var(--app-border)]" />

      <ResizablePanel defaultSize={50} minSize={25}>
        <div className="h-full flex flex-col bg-[var(--app-bg)]">
          <ResultHeader
            targetFramework={targetFramework}
            translationState={translationState}
            isPartialResult={isPartialResult}
            resultGenerateDetail={resultGenerateDetail}
            codeStats={codeStats}
            sourceFramework={sourceFramework}
            settings={settings}
          />
          <div className="flex-1 min-h-0">
            <ResultBody
              translationState={translationState}
              isStreaming={isStreaming}
              translatedCode={translatedCode}
              targetFramework={targetFramework}
              sourceLineCount={sourceLineCount}
              settings={settings}
              result={result}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
