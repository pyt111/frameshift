'use client'

import { useState, useCallback } from 'react'

/** 编辑器主题选项 */
export type EditorTheme = 'vs-dark' | 'vs' | 'hc-black'

/** 动画速度选项 */
export type AnimationSpeed = 'fast' | 'normal' | 'slow'

/** AI 提供商类型 */
export type AIProvider = 'builtin' | 'custom'

/** AI API 协议类型 */
export type AIApiProtocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages'

/** AI 配置接口 */
export interface AIConfig {
  /** AI 提供商 */
  provider: AIProvider
  /** API 协议（openai 兼容 / anthropic） */
  apiProtocol: AIApiProtocol
  /** 自定义 API Base URL（如 https://api.openai.com/v1） */
  baseUrl: string
  /** API Key */
  apiKey: string
  /** 模型名称（如 gpt-4o, deepseek-chat, claude-3-5-sonnet） */
  model: string
}

/** 应用设置接口 */
export interface AppSettings {
  /** 编辑器字体大小 (12-24) */
  editorFontSize: number
  /** 编辑器 Tab 大小 (2, 4, 8) */
  editorTabSize: number
  /** 编辑器自动换行 */
  editorWordWrap: boolean
  /** 编辑器缩略图 */
  editorMinimap: boolean
  /** 编辑器行号显示 */
  editorLineNumbers: boolean
  /** 自动翻译 (防抖) */
  translationAutoTranslate: boolean
  /** AI 辅助翻译 */
  translationAIAssist: boolean
  /** 自动保存到历史 */
  translationAutoSaveHistory: boolean
  /** 编辑器主题 */
  appearanceEditorTheme: EditorTheme
  /** 动画速度 */
  appearanceAnimationSpeed: AnimationSpeed
  /** AI 配置 */
  aiConfig: AIConfig
}

/** 默认 AI 配置 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'builtin',
  apiProtocol: 'openai-completions',
  baseUrl: '',
  apiKey: '',
  model: '',
}

/** 预设 AI 模型 */
export const AI_PRESETS: { name: string; baseUrl: string; models: string[]; apiProtocol: AIApiProtocol }[] = [
  { name: 'OpenAI (Chat)', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], apiProtocol: 'openai-completions' },
  { name: 'OpenAI (Responses)', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], apiProtocol: 'openai-responses' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder'], apiProtocol: 'openai-completions' },
  { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], apiProtocol: 'openai-completions' },
  { name: 'ZhipuAI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4', 'glm-4-flash', 'glm-4-plus'], apiProtocol: 'openai-completions' },
  { name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], apiProtocol: 'openai-completions' },
  { name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'], apiProtocol: 'openai-completions' },
  { name: 'Anthropic', baseUrl: 'https://api.anthropic.com', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], apiProtocol: 'anthropic-messages' },
]

/** 默认设置 */
export const DEFAULT_SETTINGS: AppSettings = {
  editorFontSize: 14,
  editorTabSize: 2,
  editorWordWrap: true,
  editorMinimap: false,
  editorLineNumbers: true,
  translationAutoTranslate: false,
  translationAIAssist: true,
  translationAutoSaveHistory: true,
  appearanceEditorTheme: 'vs-dark',
  appearanceAnimationSpeed: 'normal',
  aiConfig: DEFAULT_AI_CONFIG,
}

/** localStorage 存储键 */
const STORAGE_KEY = 'frameshift-settings'

/** 从 localStorage 读取设置 */
function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_SETTINGS
    const parsed = JSON.parse(stored)
    // 合并默认值，确保新字段有默认值
    const settings = { ...DEFAULT_SETTINGS, ...parsed }
    // 向后兼容：旧的 'openai' 协议值映射为 'openai-completions'，'anthropic' 映射为 'anthropic-messages'
    if (settings.aiConfig?.apiProtocol === 'openai') {
      settings.aiConfig.apiProtocol = 'openai-completions'
    }
    if (settings.aiConfig?.apiProtocol === 'anthropic') {
      settings.aiConfig.apiProtocol = 'anthropic-messages'
    }
    return settings
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** 保存设置到 localStorage */
function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage 满或不可用时静默处理
  }
}

/**
 * 应用设置 Hook
 * 管理全局设置，自动持久化到 localStorage
 * 使用 lazy initializer 避免在 effect 中调用 setState
 */
export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings)

  /** 更新设置（部分更新） */
  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...partial }
        saveSettings(next)
        return next
      })
    },
    []
  )

  /** 重置为默认设置 */
  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS)
    saveSettings(DEFAULT_SETTINGS)
  }, [])

  /** 更新单个设置项的便捷方法 */
  const setSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      updateSettings({ [key]: value })
    },
    [updateSettings]
  )

  return {
    settings,
    updateSettings,
    setSetting,
    resetSettings,
  }
}
