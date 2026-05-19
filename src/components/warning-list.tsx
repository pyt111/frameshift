'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Code2,
  Palette,
  Eye,
  Bot,
  Zap,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { TranslationWarning, ConfidenceLevel } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 警告列表组件 Props */
interface WarningListProps {
  /** 翻译警告列表 */
  warnings: TranslationWarning[]
  /** 点击警告的回调 */
  onWarningClick?: (warning: TranslationWarning) => void
  /** 额外的 className */
  className?: string
}

/** 根据置信度等级获取图标组件 */
function getWarningIcon(level: ConfidenceLevel) {
  switch (level) {
    case 'high':
      return <AlertCircle className="h-4 w-4 text-[#22c55e]" />
    case 'medium':
      return <AlertTriangle className="h-4 w-4 text-[#f97316]" />
    case 'low':
      return <AlertCircle className="h-4 w-4 text-[#ef4444]" />
  }
}

/** 根据置信度等级获取 Badge 变体样式 */
function getConfidenceBadgeStyles(level: ConfidenceLevel) {
  switch (level) {
    case 'high':
      return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20'
    case 'medium':
      return 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20'
    case 'low':
      return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
  }
}

/** 根据置信度等级获取左侧边框颜色 */
function getSeverityBorderColor(level: ConfidenceLevel) {
  switch (level) {
    case 'high':
      return 'border-l-[#22c55e]'
    case 'medium':
      return 'border-l-[#f97316]'
    case 'low':
      return 'border-l-[#ef4444]'
  }
}

/** 根据警告类型获取中文标签和图标 */
function getWarningTypeInfo(type: TranslationWarning['warningType']): { label: string; icon: React.ReactNode } {
  switch (type) {
    case 'mapping-uncertain':
      return { label: '映射不确定', icon: <RefreshCw className="h-3 w-3" /> }
    case 'pattern-unsupported':
      return { label: '不支持的模式', icon: <Zap className="h-3 w-3" /> }
    case 'manual-review':
      return { label: '需人工审查', icon: <Eye className="h-3 w-3" /> }
    case 'ai-assisted':
      return { label: 'AI 辅助', icon: <Bot className="h-3 w-3" /> }
    case 'style-mismatch':
      return { label: '样式不匹配', icon: <Palette className="h-3 w-3" /> }
  }
}

/**
 * 警告列表组件
 * 展示翻译过程中产生的所有警告，支持展开查看 AI 建议和点击导航
 * 增强版：展开/折叠动画、警告类型图标、复制建议按钮、严重程度指示
 */
export function WarningList({
  warnings,
  onWarningClick,
  className,
}: WarningListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  /** 复制状态追踪 */
  const [copiedId, setCopiedId] = useState<string | null>(null)

  /** 切换警告项的展开/折叠状态 */
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  /** 复制 AI 建议到剪贴板 */
  const handleCopySuggestion = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // 剪贴板写入失败时静默处理
    }
  }, [])

  if (warnings.length === 0) {
    return (
      <div className={cn('p-4 bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}>
        <h3 className="text-sm font-semibold text-[var(--app-text)] mb-2 flex items-center gap-2">
          <span>✅</span>
          <span>翻译警告</span>
        </h3>
        <p className="text-xs text-[var(--app-text-muted)]">没有警告，翻译质量良好</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}>
      {/* 标题 */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-[var(--app-text)] flex items-center gap-2">
          <span>⚠️</span>
          <span>翻译警告</span>
          <Badge variant="outline" className="text-xs bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20 ml-auto">
            {warnings.length}
          </Badge>
        </h3>
      </div>

      {/* 警告列表 */}
      <ScrollArea className="max-h-64">
        <div className="px-4 pb-4 space-y-2">
          <AnimatePresence>
            {warnings.map((warning, index) => {
              const isExpanded = expandedIds.has(warning.id)
              const hasSuggestion = !!warning.aiSuggestion
              const typeInfo = getWarningTypeInfo(warning.warningType)

              return (
                <motion.div
                  key={warning.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleExpand(warning.id)}
                  >
                    {/* 警告项头部 - 增加严重程度左边框 */}
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          'w-full text-left p-3 rounded-md border border-l-[3px] transition-colors',
                          'bg-[var(--app-bg-secondary)] border-[var(--app-border)] hover:border-[var(--app-border-hover)]',
                          isExpanded && 'border-[var(--app-border-hover)]',
                          getSeverityBorderColor(warning.confidenceLevel),
                        )}
                        onClick={() => onWarningClick?.(warning)}
                      >
                        <div className="flex items-start gap-2">
                          {/* 警告图标 */}
                          <div className="shrink-0 mt-0.5">
                            {getWarningIcon(warning.confidenceLevel)}
                          </div>

                          {/* 警告内容 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {/* 置信度徽章 */}
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] px-1.5 py-0 h-4',
                                  getConfidenceBadgeStyles(warning.confidenceLevel)
                                )}
                              >
                                {Math.round(warning.confidence * 100)}%
                              </Badge>
                              {/* 警告类型 - 带图标 */}
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border-hover)] gap-1"
                              >
                                {typeInfo.icon}
                                {typeInfo.label}
                              </Badge>
                              {/* AI 建议标识 */}
                              {hasSuggestion && (
                                <Sparkles className="h-3 w-3 text-[#22c55e] shrink-0" />
                              )}
                            </div>
                            {/* 警告消息 */}
                            <p className="text-xs text-[var(--app-text)] leading-relaxed">
                              {warning.message}
                            </p>
                            {/* 源代码片段 */}
                            {warning.sourceSnippet && (
                              <code className="mt-1 block text-[11px] text-[var(--app-text-muted)] bg-[var(--app-bg-secondary)] px-2 py-1 rounded font-mono truncate">
                                {warning.sourceSnippet}
                              </code>
                            )}
                          </div>

                          {/* 展开图标 - 动画 */}
                          {hasSuggestion && (
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="h-4 w-4 text-[var(--app-text-muted)] shrink-0" />
                            </motion.div>
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    {/* AI 建议内容 - 展开/折叠动画 */}
                    {hasSuggestion && (
                      <CollapsibleContent>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 ml-6 mr-0 p-3 rounded-md bg-[#22c55e]/5 border border-[#22c55e]/10 relative">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 text-[#22c55e]" />
                                <span className="text-[11px] font-medium text-[#22c55e]">AI 建议</span>
                              </div>
                              {/* 复制建议按钮 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopySuggestion(warning.id, warning.aiSuggestion!)
                                }}
                                className="p-1 rounded hover:bg-[#22c55e]/10 transition-colors text-[var(--app-text-secondary)] hover:text-[#22c55e]"
                                title="复制建议"
                              >
                                {copiedId === warning.id ? (
                                  <Check className="h-3 w-3 text-[#22c55e]" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-[var(--app-text)] leading-relaxed">
                              {warning.aiSuggestion}
                            </p>
                          </div>
                        </motion.div>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
