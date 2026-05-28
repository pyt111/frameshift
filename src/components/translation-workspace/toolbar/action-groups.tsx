'use client'

import {
  Check,
  Clock,
  Copy,
  Download,
  GitCompare,
  HelpCircle,
  RotateCcw,
  Settings,
  Share2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolbarActionButton } from './action-button'
import type { WorkspaceToolbarProps } from './types'

export function ToolbarActionGroups({
  sourceCode,
  translatedCode,
  translationState,
  copied,
  shareCopied,
  viewMode,
  showHistory,
  onReset,
  onToggleDiff,
  onCopy,
  onDownload,
  onShare,
  onShowShortcuts,
  onShowSettings,
  onToggleHistory,
}: Pick<
  WorkspaceToolbarProps,
  | 'sourceCode'
  | 'translatedCode'
  | 'translationState'
  | 'copied'
  | 'shareCopied'
  | 'viewMode'
  | 'showHistory'
  | 'onReset'
  | 'onToggleDiff'
  | 'onCopy'
  | 'onDownload'
  | 'onShare'
  | 'onShowShortcuts'
  | 'onShowSettings'
  | 'onToggleHistory'
>) {
  return (
    <>
      <div className="w-px h-5 bg-[var(--app-border)]" />

      <div className="flex items-center gap-2">
        {(translationState === 'success' || translationState === 'error') && (
          <ToolbarActionButton tooltip="重置翻译" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
          </ToolbarActionButton>
        )}

        {translationState === 'success' && translatedCode && (
          <ToolbarActionButton
            tooltip={viewMode === 'editor' ? '切换到 Diff 视图' : '切换到编辑器视图'}
            onClick={onToggleDiff}
            className={viewMode === 'diff' ? 'text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/15' : undefined}
          >
            <GitCompare className="h-4 w-4" />
          </ToolbarActionButton>
        )}

        {translationState === 'success' && translatedCode && (
          <ToolbarActionButton tooltip="复制代码 (Ctrl+Shift+C)" onClick={onCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-[#22c55e]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </ToolbarActionButton>
        )}

        {translationState === 'success' && translatedCode && (
          <ToolbarActionButton tooltip="下载代码 (Ctrl+S)" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </ToolbarActionButton>
        )}
      </div>

      <div className="w-px h-5 bg-[var(--app-border)]" />

      <div className="flex items-center gap-2">
        {translationState === 'success' && sourceCode.trim() && (
          <ToolbarActionButton tooltip="分享代码" onClick={onShare}>
            {shareCopied ? (
              <Check className="h-4 w-4 text-[#22c55e]" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </ToolbarActionButton>
        )}

        <ToolbarActionButton tooltip="键盘快捷键" onClick={onShowShortcuts} animated={false}>
          <HelpCircle className="h-4 w-4" />
        </ToolbarActionButton>

        <ToolbarActionButton tooltip="设置" onClick={onShowSettings} animated={false}>
          <Settings className="h-4 w-4" />
        </ToolbarActionButton>

        <ToolbarActionButton
          tooltip="翻译历史"
          onClick={onToggleHistory}
          animated={false}
          className={cn(
            'transition-colors',
            showHistory
              ? 'text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/15'
              : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]',
          )}
        >
          <Clock className="h-4 w-4" />
        </ToolbarActionButton>
      </div>
    </>
  )
}
