import type { AppSettings } from '@/hooks/use-settings'
import type { Framework, TranslationResult } from '@/lib/semantic-tree/types'
import type { TranslationState, WorkspaceViewMode } from '../types'

export interface WorkspaceToolbarProps {
  sourceFramework: Framework
  targetFramework: Framework
  sourceCode: string
  translatedCode: string
  translationState: TranslationState
  errorMessage: string
  result: TranslationResult | null
  isStreaming: boolean
  copied: boolean
  shareCopied: boolean
  viewMode: WorkspaceViewMode
  showHistory: boolean
  settings: AppSettings
  resultGenerateDetail?: Record<string, unknown>
  isPartialResult: boolean
  onSourceFrameworkChange: (framework: Framework) => void
  onTargetFrameworkChange: (framework: Framework) => void
  onTranslate: () => void
  onReset: () => void
  onToggleDiff: () => void
  onCopy: () => void
  onDownload: () => void
  onShare: () => void
  onShowShortcuts: () => void
  onShowSettings: () => void
  onToggleHistory: () => void
}
