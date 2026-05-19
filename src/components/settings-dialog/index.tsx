'use client'

import { Settings, Type, Languages, Palette, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SettingsDialogProps } from './types'
import { EditorSettingsTab } from './editor-tab'
import { TranslationSettingsTab } from './translation-tab'
import { AppearanceSettingsTab } from './appearance-tab'

/**
 * 设置对话框组件
 * 包含编辑器、翻译和外观三个标签页
 */
export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  setSetting,
  resetSettings,
}: SettingsDialogProps) {
  /** 当前 AI 提供商标签 */
  const currentProviderLabel = settings.aiConfig.provider === 'builtin' ? '内置 AI' : '自定义 AI'
  const currentModelLabel = settings.aiConfig.provider === 'builtin'
    ? 'GLM-4'
    : (settings.aiConfig.model || '未配置')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text)] shadow-2xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--app-text)]">
            <Settings className="h-5 w-5 text-[#22c55e]" />
            设置
          </DialogTitle>
          <DialogDescription className="text-[var(--app-text-secondary)]">
            自定义编辑器、翻译和外观偏好
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="w-full bg-[var(--app-bg-secondary)] border border-[var(--app-border)]">
            <TabsTrigger
              value="editor"
              className={cn(
                'flex-1 gap-1.5 data-[state=active]:bg-[#22c55e]/10 data-[state=active]:text-[#22c55e]',
                'text-[var(--app-text-secondary)]'
              )}
            >
              <Type className="h-3.5 w-3.5" />
              编辑器
            </TabsTrigger>
            <TabsTrigger
              value="translation"
              className={cn(
                'flex-1 gap-1.5 data-[state=active]:bg-[#22c55e]/10 data-[state=active]:text-[#22c55e]',
                'text-[var(--app-text-secondary)]'
              )}
            >
              <Languages className="h-3.5 w-3.5" />
              翻译
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className={cn(
                'flex-1 gap-1.5 data-[state=active]:bg-[#22c55e]/10 data-[state=active]:text-[#22c55e]',
                'text-[var(--app-text-secondary)]'
              )}
            >
              <Palette className="h-3.5 w-3.5" />
              外观
            </TabsTrigger>
          </TabsList>

          {/* 编辑器设置标签页 */}
          <TabsContent value="editor" className="mt-4">
            <EditorSettingsTab settings={settings} setSetting={setSetting} />
          </TabsContent>

          {/* 翻译设置标签页 */}
          <TabsContent value="translation" className="mt-4">
            <TranslationSettingsTab settings={settings} setSetting={setSetting} />
          </TabsContent>

          {/* 外观设置标签页 */}
          <TabsContent value="appearance" className="mt-4">
            <AppearanceSettingsTab settings={settings} setSetting={setSetting} />
          </TabsContent>
        </Tabs>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--app-border)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSettings}
            className="gap-1.5 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置默认
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--app-text-secondary)]">
              AI: {currentProviderLabel} · {currentModelLabel}
            </span>
            <span className="text-[10px] text-[var(--app-text-secondary)]">
              设置已自动保存
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Re-export types for backward compatibility
export type { AITestStatus, AITestResult, SettingsDialogProps } from './types'
