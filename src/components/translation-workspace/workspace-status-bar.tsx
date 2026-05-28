'use client'

import { motion } from 'framer-motion'
import type { Framework } from '@/lib/semantic-tree/types'
import type { TranslationState } from './types'
import { getFrameworkColor, getFrameworkLabel } from './utils'

interface WorkspaceStatusBarProps {
  sourceFramework: Framework
  targetFramework: Framework
  sourceCode: string
  translationState: TranslationState
}

export function WorkspaceStatusBar({
  sourceFramework,
  targetFramework,
  sourceCode,
  translationState,
}: WorkspaceStatusBarProps) {
  return (
    <div className="shrink-0 h-6 bg-[var(--app-bg-secondary)] border-t border-[var(--app-border)] flex items-center justify-between px-3">
      <div className="flex items-center gap-3 text-[10px] text-[var(--app-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getFrameworkColor(sourceFramework) }} />
          {getFrameworkLabel(sourceFramework)}
        </span>
        <span className="text-[var(--app-border)]">→</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getFrameworkColor(targetFramework) }} />
          {getFrameworkLabel(targetFramework)}
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
  )
}
