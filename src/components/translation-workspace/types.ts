import type { Framework } from '@/lib/semantic-tree/types'
import type { AppSettings } from '@/hooks/use-settings'

/** 翻译工作区组件 Props */
export interface TranslationWorkspaceProps {
  /** 初始源代码 */
  initialSourceCode?: string
  /** 初始源框架 */
  initialSourceFramework?: Framework
  /** 初始目标框架 */
  initialTargetFramework?: Framework
  /** 额外的 className */
  className?: string
}

/** 翻译状态 */
export type TranslationState = 'idle' | 'loading' | 'success' | 'error'

/** 主编辑区视图 */
export type WorkspaceViewMode = 'editor' | 'diff'

/** 底部检查器视图 */
export type BottomInspectorView = 'report' | 'syntax-tree' | 'pipeline'

/** 代码统计信息 */
export interface CodeStats {
  lines: number
  chars: number
  size: string
}

/** 设置项更新函数 */
export type SetSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
