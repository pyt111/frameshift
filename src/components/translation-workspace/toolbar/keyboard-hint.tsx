'use client'

import { Keyboard } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ToolbarKeyboardHint() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-[var(--app-text-secondary)] cursor-default">
          <Keyboard className="h-3 w-3" />
          <kbd className="px-1 py-0.5 rounded bg-[var(--app-hover-bg)] border border-[var(--app-border)] text-[var(--app-text-secondary)] font-mono text-[10px]">
            Ctrl+Enter
          </kbd>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
        按 Ctrl+Enter 快速翻译
      </TooltipContent>
    </Tooltip>
  )
}
