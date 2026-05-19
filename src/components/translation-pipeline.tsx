'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSearch,
  GitBranch,
  Code2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'
import type { PipelineStep, PipelineStepStatus } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 图标名称到组件的映射 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileSearch,
  GitBranch,
  Code2,
  Sparkles,
  ShieldCheck,
}

/** 步骤状态到颜色的映射 */
const STATUS_COLORS: Record<PipelineStepStatus, { bg: string; border: string; text: string; dot: string }> = {
  pending: {
    bg: 'bg-[var(--app-hover-bg)]',
    border: 'border-[var(--app-border)]',
    text: 'text-[var(--app-text-muted)]',
    dot: 'bg-[var(--app-text-muted)]',
  },
  running: {
    bg: 'bg-[#22c55e]/5',
    border: 'border-[#22c55e]/30',
    text: 'text-[#22c55e]',
    dot: 'bg-[#22c55e]',
  },
  completed: {
    bg: 'bg-[#22c55e]/5',
    border: 'border-[#22c55e]/20',
    text: 'text-[#22c55e]',
    dot: 'bg-[#22c55e]',
  },
  error: {
    bg: 'bg-[#ef4444]/5',
    border: 'border-[#ef4444]/20',
    text: 'text-[#ef4444]',
    dot: 'bg-[#ef4444]',
  },
  skipped: {
    bg: 'bg-[var(--app-hover-bg)]',
    border: 'border-[var(--app-border)]',
    text: 'text-[var(--app-text-muted)]',
    dot: 'bg-[var(--app-text-muted)]',
  },
}

/** 单个步骤组件 */
function PipelineStepCard({
  step,
  index,
  isLast,
  animateDelay,
}: {
  step: PipelineStep
  index: number
  isLast: boolean
  animateDelay: number
}) {
  const [expanded, setExpanded] = useState(false)
  const IconComponent = ICON_MAP[step.icon] || FileSearch
  const colors = STATUS_COLORS[step.status]
  const hasDetail = step.detail && Object.keys(step.detail).length > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: animateDelay }}
      className="relative"
    >
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-[15px] top-[36px] bottom-0 w-[2px]">
          <motion.div
            className={cn(
              'h-full',
              step.status === 'completed' ? 'bg-[#22c55e]/30' : 'bg-[var(--app-border)]',
            )}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: animateDelay + 0.2 }}
            style={{ transformOrigin: 'top' }}
          />
        </div>
      )}

      {/* 步骤内容 */}
      <div className="flex gap-3 pb-3">
        {/* 步骤图标/状态指示器 */}
        <div className="relative z-10 shrink-0">
          <motion.div
            className={cn(
              'w-[32px] h-[32px] rounded-full flex items-center justify-center border-2 transition-colors duration-300',
              colors.bg,
              colors.border,
            )}
            animate={step.status === 'running' ? {
              scale: [1, 1.1, 1],
              boxShadow: ['0 0 0px rgba(34,197,94,0)', '0 0 12px rgba(34,197,94,0.3)', '0 0 0px rgba(34,197,94,0)'],
            } : {}}
            transition={step.status === 'running' ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            } : {}}
          >
            {step.status === 'running' ? (
              <Loader2 className="h-4 w-4 text-[#22c55e] animate-spin" />
            ) : step.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
            ) : step.status === 'error' ? (
              <XCircle className="h-4 w-4 text-[#ef4444]" />
            ) : step.status === 'skipped' ? (
              <SkipForward className="h-3.5 w-3.5 text-[var(--app-text-muted)]" />
            ) : (
              <IconComponent className={cn('h-4 w-4', colors.text)} />
            )}
          </motion.div>
        </div>

        {/* 步骤详情 */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-medium',
              step.status === 'pending' ? 'text-[var(--app-text-muted)]' :
              step.status === 'completed' ? 'text-[var(--app-text)]' :
              step.status === 'running' ? 'text-[#22c55e]' :
              step.status === 'error' ? 'text-[#ef4444]' :
              'text-[var(--app-text-muted)]',
            )}>
              {step.name}
            </span>
            {step.status === 'running' && (
              <motion.span
                className="text-[10px] text-[#22c55e] bg-[#22c55e]/10 px-1.5 py-0.5 rounded-full"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                进行中
              </motion.span>
            )}
            {step.status === 'completed' && step.duration !== undefined && (
              <span className="text-[10px] text-[var(--app-text-muted)] tabular-nums">
                {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>

          {/* 描述 */}
          <p className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-relaxed">
            {step.description}
          </p>

          {/* 完成后的摘要 */}
          <AnimatePresence>
            {step.summary && step.status === 'completed' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-[#22c55e] font-medium">
                    ✓ {step.summary}
                  </span>
                  {hasDetail && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors flex items-center gap-0.5"
                    >
                      {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      详情
                    </button>
                  )}
                </div>
              </motion.div>
            )}
            {step.summary && step.status === 'error' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span className="text-xs text-[#ef4444] mt-1 inline-block">
                  ✗ {step.summary}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 展开的详细数据 */}
          <AnimatePresence>
            {expanded && hasDetail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-2 overflow-hidden"
              >
                <div className="space-y-1">
                  {Object.entries(step.detail!).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--app-text-muted)]">{key}</span>
                      <span className="text-[var(--app-text)] font-mono tabular-nums">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/** 翻译流水线可视化组件的 Props */
interface TranslationPipelineViewProps {
  /** 流水线数据 */
  pipeline: {
    steps: PipelineStep[]
    totalDuration?: number
  } | undefined
  /** 是否正在加载中（用于模拟步骤进度） */
  isLoading?: boolean
  /** 额外的 className */
  className?: string
}

/**
 * 翻译流水线可视化组件
 * 展示翻译引擎每个步骤的进度、状态和中间结果
 */
export function TranslationPipelineView({
  pipeline,
  isLoading,
  className,
}: TranslationPipelineViewProps) {
  // 如果正在加载但没有流水线数据，使用模拟步骤
  const displaySteps = pipeline?.steps || (
    isLoading ? [
      { id: 'parse', name: '源代码解析', description: '解析源代码，提取语法结构', status: 'running' as PipelineStepStatus, icon: 'FileSearch' },
      { id: 'semantic-tree', name: '构建语义树', description: '构建框架无关的 UI 语义树', status: 'pending' as PipelineStepStatus, icon: 'GitBranch' },
      { id: 'generate', name: '目标代码生成', description: '基于语义树生成目标代码', status: 'pending' as PipelineStepStatus, icon: 'Code2' },
      { id: 'ai-assist', name: 'AI 辅助优化', description: 'AI 优化低置信度翻译点', status: 'pending' as PipelineStepStatus, icon: 'Sparkles' },
      { id: 'confidence', name: '置信度评估', description: '计算整体翻译置信度', status: 'pending' as PipelineStepStatus, icon: 'ShieldCheck' },
    ] : []
  )

  if (displaySteps.length === 0) return null

  const completedCount = displaySteps.filter(s => s.status === 'completed').length
  const totalCount = displaySteps.filter(s => s.status !== 'skipped').length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className={cn('space-y-3', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            className="flex items-center justify-center w-6 h-6 rounded-md bg-[#22c55e]/10"
            animate={isLoading && !pipeline ? {
              rotate: [0, 360],
            } : {}}
            transition={isLoading && !pipeline ? {
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            } : {}}
          >
            <GitBranch className="h-3.5 w-3.5 text-[#22c55e]" />
          </motion.div>
          <span className="text-sm font-medium text-[var(--app-text)]">翻译流水线</span>
          {pipeline?.totalDuration !== undefined && (
            <span className="text-[10px] text-[var(--app-text-muted)] tabular-nums">
              总耗时 {pipeline.totalDuration < 1000 ? `${pipeline.totalDuration}ms` : `${(pipeline.totalDuration / 1000).toFixed(1)}s`}
            </span>
          )}
        </div>
        {/* 进度指示 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--app-text-secondary)] tabular-nums">
            {completedCount}/{totalCount}
          </span>
          <div className="w-20 h-1.5 bg-[var(--app-hover-bg)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#22c55e] rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* 步骤列表 */}
      <div className="space-y-0">
        {displaySteps.map((step, index) => (
          <PipelineStepCard
            key={step.id}
            step={step}
            index={index}
            isLast={index === displaySteps.length - 1}
            animateDelay={index * 0.08}
          />
        ))}
      </div>
    </div>
  )
}
