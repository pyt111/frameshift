'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTypewriter, useLoadingStep } from './hooks'

/** 加载步骤指示器组件 - 顶部工具栏下方 */
export function LoadingStepIndicator({ steps }: { steps: string[] }) {
  const step = useLoadingStep(steps.length)
  const { displayed } = useTypewriter(steps[step], 40)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-2"
    >
      <div className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
        <span className="min-w-0 truncate">{displayed}<motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span></span>
        {/* 进度条动画 */}
        <div className="flex-1 max-w-48 h-1 bg-[var(--app-hover-bg)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min((step + 1) / steps.length * 100, 90)}%` }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}

/** 加载编辑器骨架屏 - 翻译结果面板 */
export function LoadingEditorSkeleton({ steps }: { steps: string[] }) {
  const step = useLoadingStep(steps.length)
  const { displayed } = useTypewriter(steps[step], 40)

  return (
    <div className="h-full flex flex-col items-center justify-center bg-[var(--app-bg)] relative overflow-hidden">
      {/* 微光扫描动画 */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(34,197,94,0.03) 45%, rgba(34,197,94,0.06) 50%, rgba(34,197,94,0.03) 55%, transparent 60%)',
        }}
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="h-8 w-8 text-[#22c55e]/50" />
      </motion.div>
      <p className="mt-3 text-sm text-[var(--app-text-secondary)]">
        {displayed}<motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>|</motion.span>
      </p>
      {/* 步骤指示器 */}
      <div className="mt-3 flex gap-1.5">
        {steps.map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-colors duration-300',
              i <= step ? 'bg-[#22c55e]' : 'bg-[var(--app-border)]',
            )}
            animate={i === step ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        ))}
      </div>
      {/* 加载进度条 */}
      <div className="mt-2 w-32 h-1 bg-[var(--app-hover-bg)] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[#22c55e] rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '50%' }}
        />
      </div>
    </div>
  )
}

/** 加载骨架屏 - 底部面板带微光和步骤 */
export function LoadingSkeletonWithStep({ steps }: { steps: string[] }) {
  const step = useLoadingStep(steps.length)

  return (
    <div className="space-y-4">
      <div className="p-4 bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)] relative overflow-hidden">
        {/* 微光扫描 */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(34,197,94,0.03) 45%, rgba(34,197,94,0.06) 50%, rgba(34,197,94,0.03) 55%, transparent 60%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="h-4 bg-[var(--app-hover-bg)] rounded w-24 mb-4 relative"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <div className="flex gap-4 items-center">
          <motion.div
            className="w-16 h-16 rounded-full border-2 border-[var(--app-border)] relative"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <div className="flex-1 space-y-3">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="h-2 bg-[var(--app-hover-bg)] rounded relative"
                style={{ width: `${70 - i * 10}%` }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
        {/* 步骤指示 */}
        <div className="mt-3 flex items-center gap-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <motion.div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  i <= step ? 'bg-[#22c55e]' : 'bg-[var(--app-border)]',
                )}
                animate={i === step ? { opacity: [0.5, 1, 0.5] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span className={`text-[9px] ${i <= step ? 'text-[var(--app-text-secondary)]' : 'text-[var(--app-text-muted)]'}`}>
                {label.replace('正在', '').replace('...', '')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
