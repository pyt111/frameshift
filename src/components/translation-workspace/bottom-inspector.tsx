'use client'

import { BarChart3, GitBranch, TreePine } from 'lucide-react'
import { ConfidenceReport } from '@/components/confidence-report'
import { SyntaxTreeView } from '@/components/syntax-tree-view'
import { TranslationPipelineView } from '@/components/translation-pipeline'
import { WarningList } from '@/components/warning-list'
import { cn } from '@/lib/utils'
import type { TranslationResult, TranslationWarning } from '@/lib/semantic-tree/types'
import type { BottomInspectorView, TranslationState } from './types'
import { LOADING_STEPS_WITH_AI, LOADING_STEPS_WITHOUT_AI } from './constants'
import { LoadingSkeletonWithStep } from './loading-components'

interface BottomInspectorProps {
  translationState: TranslationState
  bottomView: BottomInspectorView
  onBottomViewChange: (view: BottomInspectorView) => void
  result: TranslationResult | null
  aiAssistEnabled: boolean
  onWarningClick: (warning: TranslationWarning) => void
}

export function BottomInspector({
  translationState,
  bottomView,
  onBottomViewChange,
  result,
  aiAssistEnabled,
  onWarningClick,
}: BottomInspectorProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--app-bg)]">
      {translationState !== 'loading' && (
        <div className="shrink-0 flex items-center gap-1 px-4 pt-3 pb-1">
          <button
            onClick={() => onBottomViewChange('report')}
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
            onClick={() => onBottomViewChange('syntax-tree')}
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
            onClick={() => onBottomViewChange('pipeline')}
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

      <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
        {translationState === 'loading' ? (
          <LoadingSkeletonWithStep steps={aiAssistEnabled ? LOADING_STEPS_WITH_AI : LOADING_STEPS_WITHOUT_AI} />
        ) : bottomView === 'pipeline' ? (
          <TranslationPipelineView pipeline={result?.pipeline} />
        ) : bottomView === 'syntax-tree' ? (
          <SyntaxTreeView tree={result?.semanticTree ?? null} />
        ) : (
          <div className="space-y-4">
            <ConfidenceReport result={result} />
            <WarningList
              warnings={result?.warnings ?? []}
              onWarningClick={onWarningClick}
            />
          </div>
        )}
      </div>
    </div>
  )
}
