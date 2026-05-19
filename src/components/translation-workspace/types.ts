import type { Framework } from '@/lib/semantic-tree/types'

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
