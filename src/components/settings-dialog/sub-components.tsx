'use client'

import type { EditorTheme, AnimationSpeed } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

/** 设置项行组件 */
export function SettingRow({
  label,
  description,
  children,
  className,
}: {
  label: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', className)}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--app-text)]">{label}</div>
        <div className="text-xs text-[var(--app-text-secondary)] mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** 分隔线组件 */
export function SettingDivider() {
  return <div className="border-t border-[var(--app-border)]" />
}

/** 编辑器主题选项映射 */
export const EDITOR_THEME_OPTIONS: { value: EditorTheme; label: string; description: string }[] = [
  { value: 'vs-dark', label: '深色', description: '暗色主题' },
  { value: 'vs', label: '浅色', description: '亮色主题' },
  { value: 'hc-black', label: '高对比度', description: '黑色高对比度' },
]

/** 动画速度选项映射 */
export const ANIMATION_SPEED_OPTIONS: { value: AnimationSpeed; label: string; description: string }[] = [
  { value: 'fast', label: '快速', description: '150ms' },
  { value: 'normal', label: '正常', description: '300ms' },
  { value: 'slow', label: '慢速', description: '500ms' },
]
