'use client'

import { ArrowLeftRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Framework } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 框架选项定义 */
const FRAMEWORK_OPTIONS: { value: Framework; label: string; icon: string }[] = [
  { value: 'react', label: 'React (TSX)', icon: '⚛️' },
  { value: 'vue3', label: 'Vue 3 (SFC)', icon: '💚' },
  { value: 'angular', label: 'Angular (TS)', icon: '🅰️' },
]

/** 框架选择器组件 Props */
interface FrameworkSelectorProps {
  /** 当前源框架 */
  sourceFramework: Framework
  /** 当前目标框架 */
  targetFramework: Framework
  /** 源框架变更回调 */
  onSourceChange: (framework: Framework) => void
  /** 目标框架变更回调 */
  onTargetChange: (framework: Framework) => void
  /** 额外的 className */
  className?: string
}

/**
 * 框架选择器组件
 * 包含源/目标两个下拉框、中间箭头和交换按钮
 * 不允许选择相同的源和目标框架
 */
export function FrameworkSelector({
  sourceFramework,
  targetFramework,
  onSourceChange,
  onTargetChange,
  className,
}: FrameworkSelectorProps) {
  /** 交换源和目标框架 */
  const handleSwap = () => {
    onSourceChange(targetFramework)
    onTargetChange(sourceFramework)
  }

  /** 获取当前可用的源框架选项（排除目标框架） */
  const availableSourceOptions = FRAMEWORK_OPTIONS.filter(
    (opt) => opt.value !== targetFramework
  )

  /** 获取当前可用的目标框架选项（排除源框架） */
  const availableTargetOptions = FRAMEWORK_OPTIONS.filter(
    (opt) => opt.value !== sourceFramework
  )

  /** 获取框架标签 */
  const getFrameworkLabel = (fw: Framework) => {
    return FRAMEWORK_OPTIONS.find((opt) => opt.value === fw)?.label ?? fw
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* 源框架选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--app-text-secondary)] font-medium shrink-0">源</span>
        <Select
          value={sourceFramework}
          onValueChange={(val) => onSourceChange(val as Framework)}
        >
          <SelectTrigger className="w-[180px] bg-[var(--app-hover-bg)] border-[var(--app-border)] text-[var(--app-text)] hover:border-[#22c55e]/50 transition-colors">
            <SelectValue>
              <span className="flex items-center gap-2">
                <span>{FRAMEWORK_OPTIONS.find((o) => o.value === sourceFramework)?.icon}</span>
                <span>{getFrameworkLabel(sourceFramework)}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[var(--app-hover-bg)] border-[var(--app-border)]">
            {availableSourceOptions.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[var(--app-text)] focus:bg-[var(--app-hover-bg)] focus:text-[var(--app-text)]"
              >
                <span className="flex items-center gap-2">
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 交换按钮和箭头 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSwap}
            className="h-8 w-8 text-[var(--app-text-secondary)] hover:text-[#22c55e] hover:bg-[#22c55e]/10 shrink-0 transition-all duration-200"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[var(--app-hover-bg)] text-[var(--app-text)] border-[var(--app-border)]">
          交换源和目标框架
        </TooltipContent>
      </Tooltip>

      {/* 目标框架选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--app-text-secondary)] font-medium shrink-0">目标</span>
        <Select
          value={targetFramework}
          onValueChange={(val) => onTargetChange(val as Framework)}
        >
          <SelectTrigger className="w-[180px] bg-[var(--app-hover-bg)] border-[var(--app-border)] text-[var(--app-text)] hover:border-[#22c55e]/50 transition-colors">
            <SelectValue>
              <span className="flex items-center gap-2">
                <span>{FRAMEWORK_OPTIONS.find((o) => o.value === targetFramework)?.icon}</span>
                <span>{getFrameworkLabel(targetFramework)}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[var(--app-hover-bg)] border-[var(--app-border)]">
            {availableTargetOptions.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[var(--app-text)] focus:bg-[var(--app-hover-bg)] focus:text-[var(--app-text)]"
              >
                <span className="flex items-center gap-2">
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
