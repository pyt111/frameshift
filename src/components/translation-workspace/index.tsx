'use client'

import { AnimatePresence } from 'framer-motion'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { TranslationHistory } from '@/components/translation-history'
import { cn } from '@/lib/utils'
import { type TranslationWorkspaceProps, type TranslationState } from './types'
import { useTranslationWorkspace } from './use-translation-workspace'
import { SuccessCelebration } from './success-celebration'
import { WorkspaceToolbar } from './workspace-toolbar'
import { EditorPanels } from './editor-panels'
import { BottomInspector } from './bottom-inspector'
import { WorkspaceStatusBar } from './workspace-status-bar'
import { WorkspaceDialogs } from './workspace-dialogs'

export type { TranslationWorkspaceProps, TranslationState } from './types'

/**
 * 翻译工作区组件。
 * 入口层只负责组合布局，状态和翻译流程由专用模块承接。
 */
export function TranslationWorkspace(props: TranslationWorkspaceProps) {
  const workspace = useTranslationWorkspace(props)

  return (
    <div className={cn('flex h-full', props.className)}>
      <SuccessCelebration show={workspace.showCelebration} />

      <div className="flex-1 min-w-0 flex flex-col">
        <WorkspaceToolbar
          sourceFramework={workspace.sourceFramework}
          targetFramework={workspace.targetFramework}
          sourceCode={workspace.sourceCode}
          translatedCode={workspace.translatedCode}
          translationState={workspace.translationState}
          errorMessage={workspace.errorMessage}
          result={workspace.result}
          isStreaming={workspace.isStreaming}
          copied={workspace.copied}
          shareCopied={workspace.shareCopied}
          viewMode={workspace.viewMode}
          showHistory={workspace.showHistory}
          settings={workspace.settings}
          resultGenerateDetail={workspace.resultGenerateDetail}
          isPartialResult={workspace.isPartialResult}
          onSourceFrameworkChange={workspace.handleSourceFrameworkChange}
          onTargetFrameworkChange={workspace.handleTargetFrameworkChange}
          onTranslate={workspace.handleTranslate}
          onReset={workspace.handleReset}
          onToggleDiff={workspace.handleToggleDiff}
          onCopy={workspace.handleCopy}
          onDownload={workspace.handleDownload}
          onShare={workspace.handleShare}
          onShowShortcuts={() => workspace.setShowShortcutsDialog(true)}
          onShowSettings={() => workspace.setShowSettingsDialog(true)}
          onToggleHistory={() => workspace.setShowHistory(!workspace.showHistory)}
        />

        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize={65} minSize={30}>
              <EditorPanels
                sourceFramework={workspace.sourceFramework}
                targetFramework={workspace.targetFramework}
                sourceCode={workspace.sourceCode}
                translatedCode={workspace.translatedCode}
                translationState={workspace.translationState}
                viewMode={workspace.viewMode}
                isStreaming={workspace.isStreaming}
                isPartialResult={workspace.isPartialResult}
                result={workspace.result}
                resultGenerateDetail={workspace.resultGenerateDetail}
                codeStats={workspace.codeStats}
                sourceLineCount={workspace.sourceLineCount}
                settings={workspace.settings}
                onSourceCodeChange={workspace.setSourceCode}
              />
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-[var(--app-border)]" />

            <ResizablePanel defaultSize={35} minSize={15}>
              <BottomInspector
                translationState={workspace.translationState}
                bottomView={workspace.bottomView}
                onBottomViewChange={workspace.setBottomView}
                result={workspace.result}
                aiAssistEnabled={workspace.settings.translationAIAssist}
                onWarningClick={workspace.handleWarningClick}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <WorkspaceStatusBar
          sourceFramework={workspace.sourceFramework}
          targetFramework={workspace.targetFramework}
          sourceCode={workspace.sourceCode}
          translationState={workspace.translationState}
        />
      </div>

      <WorkspaceDialogs
        showShortcutsDialog={workspace.showShortcutsDialog}
        onShortcutsOpenChange={workspace.setShowShortcutsDialog}
        showSettingsDialog={workspace.showSettingsDialog}
        onSettingsOpenChange={workspace.setShowSettingsDialog}
        settings={workspace.settings}
        setSetting={workspace.setSetting}
        resetSettings={workspace.resetSettings}
      />

      <AnimatePresence>
        {workspace.showHistory && (
          <div className="w-72 sm:w-80 shrink-0">
            <TranslationHistory
              onSelectEntry={workspace.handleSelectHistoryEntry}
              onClose={() => workspace.setShowHistory(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
