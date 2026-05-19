'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Trash2, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Framework, TranslationResult } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 翻译历史记录条目 */
export interface TranslationHistoryEntry {
  /** 唯一标识 */
  id: string
  /** 源框架 */
  sourceFramework: Framework
  /** 目标框架 */
  targetFramework: Framework
  /** 源代码（截取前100字符） */
  sourceCodePreview: string
  /** 完整源代码 */
  sourceCode: string
  /** 翻译结果代码 */
  translatedCode: string
  /** 整体置信度 */
  confidence: number
  /** 置信度等级 */
  confidenceLevel: TranslationResult['confidenceLevel']
  /** 时间戳 */
  timestamp: number
}

/** 翻译历史组件 Props */
interface TranslationHistoryProps {
  /** 选择历史条目的回调 */
  onSelectEntry: (entry: TranslationHistoryEntry) => void
  /** 关闭面板的回调 */
  onClose: () => void
  /** 额外的 className */
  className?: string
}

/** localStorage 键名 */
const STORAGE_KEY = 'frameshift-translation-history'
/** 最大记录数 */
const MAX_ENTRIES = 20

/** 从 localStorage 读取历史记录 */
function loadHistory(): TranslationHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TranslationHistoryEntry[]
  } catch {
    return []
  }
}

/** 保存历史记录到 localStorage */
export function saveToHistory(entry: Omit<TranslationHistoryEntry, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return
  try {
    const history = loadHistory()
    const newEntry: TranslationHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    }
    // 新记录放在最前面
    history.unshift(newEntry)
    // 最多保留 MAX_ENTRIES 条
    if (history.length > MAX_ENTRIES) {
      history.splice(MAX_ENTRIES)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // localStorage 写入失败时静默处理
  }
}

/** 清空历史记录 */
function clearHistory(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage 清除失败时静默处理
  }
}

/** 格式化时间戳 */
function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`

  const date = new Date(ts)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

/** 获取框架图标颜色 */
function getFrameworkColor(fw: Framework): string {
  switch (fw) {
    case 'react': return '#61dafb'
    case 'vue3': return '#42b883'
    case 'angular': return '#dd0031'
  }
}

/** 获取框架标签 */
function getFrameworkLabel(fw: Framework): string {
  switch (fw) {
    case 'react': return 'React'
    case 'vue3': return 'Vue 3'
    case 'angular': return 'Angular'
  }
}

/**
 * 翻译历史组件
 * 可折叠的侧边面板，展示最近的翻译记录
 * 使用 localStorage 持久化，最多 20 条
 */
export function TranslationHistory({
  onSelectEntry,
  onClose,
  className,
}: TranslationHistoryProps) {
  const [entries, setEntries] = useState<TranslationHistoryEntry[]>(() => loadHistory())
  const [isClearing, setIsClearing] = useState(false)

  /** 清空历史 */
  const handleClear = useCallback(() => {
    setIsClearing(true)
    setTimeout(() => {
      clearHistory()
      setEntries([])
      setIsClearing(false)
    }, 300)
  }, [])

  /** 获取置信度颜色 */
  const getConfidenceColor = (level: TranslationResult['confidenceLevel']) => {
    switch (level) {
      case 'high': return 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20'
      case 'medium': return 'text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20'
      case 'low': return 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20'
    }
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col h-full bg-[var(--app-bg)] border-l border-[var(--app-border)]',
        className,
      )}
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* 面板头部 */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--app-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--app-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--app-text)]">翻译历史</h3>
          <Badge variant="outline" className="text-[10px] h-4 bg-[var(--app-hover-bg)] text-[var(--app-text-secondary)] border-[var(--app-border-hover)]">
            {entries.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* 清空历史按钮 */}
          {entries.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={isClearing}
                  className="h-7 w-7 text-[var(--app-text-secondary)] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
                清空历史
              </TooltipContent>
            </Tooltip>
          )}
          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 历史记录列表 */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <AnimatePresence>
            {entries.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Clock className="h-8 w-8 text-[var(--app-text-muted)] mx-auto mb-3" />
                <p className="text-sm text-[var(--app-text-secondary)]">暂无翻译历史</p>
                <p className="text-xs text-[var(--app-text-muted)] mt-1">完成翻译后将自动保存</p>
              </motion.div>
            ) : (
              entries.map((entry, index) => (
                <motion.button
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  onClick={() => onSelectEntry(entry)}
                  className="w-full text-left p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-bg)] hover:border-[var(--app-border-hover)] transition-all duration-200 group"
                >
                  {/* 框架方向指示 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getFrameworkColor(entry.sourceFramework) }}
                    />
                    <span className="text-[11px] text-[var(--app-text-secondary)] font-medium">
                      {getFrameworkLabel(entry.sourceFramework)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-[#22c55e] shrink-0" />
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getFrameworkColor(entry.targetFramework) }}
                    />
                    <span className="text-[11px] text-[var(--app-text-secondary)] font-medium">
                      {getFrameworkLabel(entry.targetFramework)}
                    </span>
                  </div>

                  {/* 代码预览 */}
                  <p className="text-[11px] text-[var(--app-text-muted)] font-mono truncate mb-2">
                    {entry.sourceCodePreview}
                  </p>

                  {/* 底部：置信度和时间 */}
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] h-4 px-1.5', getConfidenceColor(entry.confidenceLevel))}
                    >
                      {Math.round(entry.confidence * 100)}%
                    </Badge>
                    <span className="text-[10px] text-[var(--app-text-muted)]">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                </motion.button>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </motion.div>
  )
}
