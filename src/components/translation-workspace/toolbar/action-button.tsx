'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ToolbarActionButtonProps {
  children: ReactNode
  tooltip: string
  onClick: () => void
  className?: string
  animated?: boolean
}

export function ToolbarActionButton({
  children,
  tooltip,
  onClick,
  className,
  animated = true,
}: ToolbarActionButtonProps) {
  const button = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn('h-9 w-9 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]', className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )

  if (!animated) return button

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {button}
    </motion.div>
  )
}
