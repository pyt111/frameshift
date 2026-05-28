'use client'

import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import type { AppSettings } from '@/hooks/use-settings'
import type { SetSetting } from './types'

interface WorkspaceDialogsProps {
  showShortcutsDialog: boolean
  onShortcutsOpenChange: (open: boolean) => void
  showSettingsDialog: boolean
  onSettingsOpenChange: (open: boolean) => void
  settings: AppSettings
  setSetting: SetSetting
  resetSettings: () => void
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'Enter'], description: '翻译代码' },
  { keys: ['Ctrl', 'Shift', 'D'], description: '切换 Diff 视图' },
  { keys: ['Ctrl', 'S'], description: '下载翻译结果' },
  { keys: ['Ctrl', 'Shift', 'C'], description: '复制翻译结果' },
]

export function WorkspaceDialogs({
  showShortcutsDialog,
  onShortcutsOpenChange,
  showSettingsDialog,
  onSettingsOpenChange,
  settings,
  setSetting,
  resetSettings,
}: WorkspaceDialogsProps) {
  return (
    <>
      <Dialog open={showShortcutsDialog} onOpenChange={onShortcutsOpenChange}>
        <DialogContent className="bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--app-text)] flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-[#22c55e]" />
              键盘快捷键
            </DialogTitle>
            <DialogDescription className="text-[var(--app-text-secondary)]">
              使用以下快捷键提高工作效率
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.keys.join('+')}
                className="flex items-center justify-between px-3 py-2.5 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)]/50"
              >
                <span className="text-sm text-[var(--app-text)]">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <span key={key} className="flex items-center gap-1">
                      <kbd className="px-2 py-1 rounded bg-[var(--app-hover-bg)] border border-[var(--app-border)] text-xs text-[var(--app-text)] font-mono min-w-[28px] text-center">
                        {key}
                      </kbd>
                      {i < shortcut.keys.length - 1 && (
                        <span className="text-[var(--app-text-muted)] text-xs">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={onSettingsOpenChange}
        settings={settings}
        setSetting={setSetting}
        resetSettings={resetSettings}
      />
    </>
  )
}
