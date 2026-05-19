'use client'

import { motion } from 'framer-motion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppSettings, EditorTheme, AnimationSpeed } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import { SettingRow, SettingDivider, EDITOR_THEME_OPTIONS, ANIMATION_SPEED_OPTIONS } from './sub-components'

interface AppearanceSettingsTabProps {
  settings: AppSettings
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

/** 外观设置标签页内容 */
export function AppearanceSettingsTab({ settings, setSetting }: AppearanceSettingsTabProps) {
  return (
    <div className="space-y-1">
      {/* 编辑器主题 */}
      <SettingRow
        label="编辑器主题"
        description="选择编辑器的配色方案"
      >
        <Select
          value={settings.appearanceEditorTheme}
          onValueChange={(v) => setSetting('appearanceEditorTheme', v as EditorTheme)}
        >
          <SelectTrigger
            size="sm"
            className="w-28 bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--app-bg-secondary)] border-[var(--app-border)]">
            {EDITOR_THEME_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[var(--app-text)] focus:bg-[#22c55e]/10 focus:text-[#22c55e]"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* 主题预览 */}
      <div className="flex gap-2 py-2">
        {EDITOR_THEME_OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            onClick={() => setSetting('appearanceEditorTheme', opt.value)}
            className={cn(
              'flex-1 rounded-lg border-2 p-3 text-center transition-all duration-200',
              settings.appearanceEditorTheme === opt.value
                ? 'border-[#22c55e] shadow-md shadow-[#22c55e]/20'
                : 'border-[var(--app-border)] hover:border-[var(--app-text-secondary)]'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              background:
                opt.value === 'vs-dark'
                  ? '#1e1e1e'
                  : opt.value === 'vs'
                    ? '#ffffff'
                    : '#000000',
            }}
          >
            <div
              className={cn(
                'text-xs font-medium',
                opt.value === 'vs' ? 'text-gray-800' : 'text-gray-200'
              )}
            >
              {opt.label}
            </div>
            <div
              className={cn(
                'text-[10px] mt-0.5',
                opt.value === 'vs' ? 'text-gray-500' : 'text-gray-400'
              )}
            >
              {opt.description}
            </div>
            {settings.appearanceEditorTheme === opt.value && (
              <motion.div
                layoutId="theme-indicator"
                className="mt-1.5 flex justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      <SettingDivider />

      {/* 动画速度 */}
      <SettingRow
        label="动画速度"
        description="调整界面动画的播放速度"
      >
        <Select
          value={settings.appearanceAnimationSpeed}
          onValueChange={(v) => setSetting('appearanceAnimationSpeed', v as AnimationSpeed)}
        >
          <SelectTrigger
            size="sm"
            className="w-24 bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--app-bg-secondary)] border-[var(--app-border)]">
            {ANIMATION_SPEED_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[var(--app-text)] focus:bg-[#22c55e]/10 focus:text-[#22c55e]"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* 动画速度可视化 */}
      <div className="flex gap-3 py-2">
        {ANIMATION_SPEED_OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            onClick={() => setSetting('appearanceAnimationSpeed', opt.value)}
            className={cn(
              'flex-1 rounded-lg border-2 p-2.5 text-center transition-all duration-200',
              settings.appearanceAnimationSpeed === opt.value
                ? 'border-[#22c55e] bg-[#22c55e]/5'
                : 'border-[var(--app-border)] hover:border-[var(--app-text-secondary)]'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="text-xs font-medium text-[var(--app-text)]">{opt.label}</div>
            <div className="text-[10px] text-[var(--app-text-secondary)] mt-0.5">
              {opt.description}
            </div>
            {/* 速度演示动画 */}
            <div className="mt-1.5 flex justify-center">
              <motion.div
                className="w-3 h-1 rounded-full bg-[#22c55e]"
                animate={{ x: [-8, 8, -8] }}
                transition={{
                  duration:
                    opt.value === 'fast'
                      ? 0.5
                      : opt.value === 'normal'
                        ? 1
                        : 1.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
