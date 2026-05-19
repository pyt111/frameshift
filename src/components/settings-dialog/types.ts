import type { AppSettings } from '@/hooks/use-settings'

/** AI 连接测试状态 */
export type AITestStatus = 'idle' | 'testing' | 'success' | 'error'

/** AI 测试结果 */
export interface AITestResult {
  available: boolean
  model: string
  provider: string
  latency?: string
  message: string
  /** 实际请求的 API URL */
  requestUrl?: string
  /** 实际使用的协议 */
  protocol?: string
  /** 响应格式（Anthropic/OpenAI Responses/OpenAI Chat/SSE/JSON） */
  responseFormat?: string
}

/** SettingsDialog 组件的 Props */
export interface SettingsDialogProps {
  /** 是否打开 */
  open: boolean
  /** 打开/关闭回调 */
  onOpenChange: (open: boolean) => void
  /** 外部传入的 settings（从父组件的 useSettings 获取） */
  settings: AppSettings
  /** 外部传入的 setSetting 方法 */
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  /** 外部传入的 resetSettings 方法 */
  resetSettings: () => void
}
