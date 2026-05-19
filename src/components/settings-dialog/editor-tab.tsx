'use client'

import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppSettings } from '@/hooks/use-settings'
import { SettingRow, SettingDivider } from './sub-components'

interface EditorSettingsTabProps {
  settings: AppSettings
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

/** 编辑器设置标签页内容 */
export function EditorSettingsTab({ settings, setSetting }: EditorSettingsTabProps) {
  return (
    <div className="space-y-1">
      {/* 字体大小 */}
      <SettingRow
        label="字体大小"
        description={`当前: ${settings.editorFontSize}px — 调整编辑器文字大小`}
      >
        <div className="flex items-center gap-3 w-40">
          <Slider
            value={[settings.editorFontSize]}
            min={12}
            max={24}
            step={1}
            onValueChange={([v]) => setSetting('editorFontSize', v)}
            className="flex-1 [&_[data-slot=slider-range]]:bg-[#22c55e] [&_[data-slot=slider-thumb]]:border-[#22c55e]"
          />
          <span className="text-xs font-mono text-[#22c55e] w-8 text-right tabular-nums">
            {settings.editorFontSize}
          </span>
        </div>
      </SettingRow>

      <SettingDivider />

      {/* Tab 大小 */}
      <SettingRow
        label="Tab 大小"
        description="缩进空格数"
      >
        <Select
          value={String(settings.editorTabSize)}
          onValueChange={(v) => setSetting('editorTabSize', Number(v))}
        >
          <SelectTrigger
            size="sm"
            className="w-24 bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--app-bg-secondary)] border-[var(--app-border)]">
            <SelectItem value="2" className="text-[var(--app-text)] focus:bg-[#22c55e]/10 focus:text-[#22c55e]">
              2 空格
            </SelectItem>
            <SelectItem value="4" className="text-[var(--app-text)] focus:bg-[#22c55e]/10 focus:text-[#22c55e]">
              4 空格
            </SelectItem>
            <SelectItem value="8" className="text-[var(--app-text)] focus:bg-[#22c55e]/10 focus:text-[#22c55e]">
              8 空格
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingDivider />

      {/* 自动换行 */}
      <SettingRow
        label="自动换行"
        description="长行代码自动折行显示"
      >
        <Switch
          checked={settings.editorWordWrap}
          onCheckedChange={(v) => setSetting('editorWordWrap', v)}
          className="data-[state=checked]:bg-[#22c55e]"
        />
      </SettingRow>

      <SettingDivider />

      {/* 缩略图 */}
      <SettingRow
        label="缩略图"
        description="在编辑器右侧显示代码缩略图"
      >
        <Switch
          checked={settings.editorMinimap}
          onCheckedChange={(v) => setSetting('editorMinimap', v)}
          className="data-[state=checked]:bg-[#22c55e]"
        />
      </SettingRow>

      <SettingDivider />

      {/* 行号 */}
      <SettingRow
        label="行号"
        description="在编辑器左侧显示行号"
      >
        <Switch
          checked={settings.editorLineNumbers}
          onCheckedChange={(v) => setSetting('editorLineNumbers', v)}
          className="data-[state=checked]:bg-[#22c55e]"
        />
      </SettingRow>
    </div>
  )
}
