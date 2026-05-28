'use client'

import { FrameworkSelector } from '@/components/framework-selector'
import { ToolbarActionGroups } from './toolbar/action-groups'
import { ToolbarAiIndicator } from './toolbar/ai-indicator'
import { ToolbarKeyboardHint } from './toolbar/keyboard-hint'
import { ToolbarStatus } from './toolbar/status'
import { ToolbarTranslateButton } from './toolbar/translate-button'
import type { WorkspaceToolbarProps } from './toolbar/types'

export function WorkspaceToolbar({
  sourceFramework,
  targetFramework,
  sourceCode,
  translatedCode,
  translationState,
  errorMessage,
  result,
  isStreaming,
  copied,
  shareCopied,
  viewMode,
  showHistory,
  settings,
  resultGenerateDetail,
  isPartialResult,
  onSourceFrameworkChange,
  onTargetFrameworkChange,
  onTranslate,
  onReset,
  onToggleDiff,
  onCopy,
  onDownload,
  onShare,
  onShowShortcuts,
  onShowSettings,
  onToggleHistory,
}: WorkspaceToolbarProps) {
  return (
    <div className="shrink-0 border-b border-[var(--app-border)] bg-gradient-to-r from-[var(--app-toolbar-gradient-from)] via-[var(--app-toolbar-gradient-via)] to-[var(--app-toolbar-gradient-to)] px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FrameworkSelector
          sourceFramework={sourceFramework}
          targetFramework={targetFramework}
          onSourceChange={onSourceFrameworkChange}
          onTargetChange={onTargetFrameworkChange}
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <ToolbarTranslateButton
              translationState={translationState}
              sourceCode={sourceCode}
              onTranslate={onTranslate}
            />
            <ToolbarAiIndicator settings={settings} isStreaming={isStreaming} />
            <ToolbarKeyboardHint />
          </div>

          <ToolbarActionGroups
            sourceCode={sourceCode}
            translatedCode={translatedCode}
            translationState={translationState}
            copied={copied}
            shareCopied={shareCopied}
            viewMode={viewMode}
            showHistory={showHistory}
            onReset={onReset}
            onToggleDiff={onToggleDiff}
            onCopy={onCopy}
            onDownload={onDownload}
            onShare={onShare}
            onShowShortcuts={onShowShortcuts}
            onShowSettings={onShowSettings}
            onToggleHistory={onToggleHistory}
          />
        </div>
      </div>

      <ToolbarStatus
        translationState={translationState}
        isStreaming={isStreaming}
        errorMessage={errorMessage}
        result={result}
        settings={settings}
        resultGenerateDetail={resultGenerateDetail}
        isPartialResult={isPartialResult}
      />
    </div>
  )
}
