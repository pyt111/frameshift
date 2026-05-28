'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Info, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { LOADING_STEPS_WITH_AI, LOADING_STEPS_WITHOUT_AI } from '../constants'
import { LoadingStepIndicator } from '../loading-components'
import type { WorkspaceToolbarProps } from './types'

export function ToolbarStatus({
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
