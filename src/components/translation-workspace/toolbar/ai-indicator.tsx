'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { WorkspaceToolbarProps } from './types'

export function ToolbarAiIndicator({
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
