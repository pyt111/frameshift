'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, CheckCircle2, XCircle, Eye, EyeOff, Server, Key, Cpu, ChevronDown } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AI_PRESETS } from '@/hooks/use-settings'
import type { AppSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import { SettingRow, SettingDivider } from './sub-components'
import type { AITestStatus, AITestResult } from './types'

interface TranslationSettingsTabProps {
  settings: AppSettings
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

/** 响应格式是否符合当前选择的 API 协议 */
function isResponseFormatMatched(protocol?: string, responseFormat?: string): boolean {
  if (!protocol || !responseFormat) return true

  const expectedFormats: Record<string, string[]> = {
    'openai-completions': ['OpenAI Chat'],
    'openai-responses': ['OpenAI Responses', 'OpenAI Responses (宽松)'],
    'anthropic-messages': ['Anthropic', 'Anthropic (宽松)'],
  }

  return expectedFormats[protocol]?.includes(responseFormat) ?? true
}

/** 翻译设置标签页内容 */
export function TranslationSettingsTab({ settings, setSetting }: TranslationSettingsTabProps) {
  /** AI 连接测试状态 */
  const [aiTestStatus, setAiTestStatus] = useState<AITestStatus>('idle')
  const [aiTestResult, setAiTestResult] = useState<AITestResult | null>(null)
  /** API Key 可见性 */
  const [showApiKey, setShowApiKey] = useState(false)
  /** 预设下拉 */
  const [showPresets, setShowPresets] = useState(false)
  const hasResponseFormatWarning = !!aiTestResult?.available
    && !!aiTestResult.responseFormat
    && !isResponseFormatMatched(aiTestResult.protocol, aiTestResult.responseFormat)

  useEffect(() => {
    if (!settings.translationAIAssist) return
    if (settings.aiConfig.baseUrl || settings.aiConfig.model) return

    let cancelled = false
    fetch('/api/ai-status')
      .then((res) => res.json())
      .then((envConfig: {
        apiProtocol?: AppSettings['aiConfig']['apiProtocol']
        baseUrl?: string
        model?: string
      }) => {
        if (cancelled || (!envConfig.baseUrl && !envConfig.model)) return
        setSetting('aiConfig', {
          ...settings.aiConfig,
          provider: 'custom',
          presetName: settings.aiConfig.presetName || '自定义',
          apiProtocol: envConfig.apiProtocol || settings.aiConfig.apiProtocol,
          baseUrl: envConfig.baseUrl || settings.aiConfig.baseUrl,
          model: envConfig.model || settings.aiConfig.model,
        })
      })
      .catch(() => {
        // 环境变量默认值读取失败时保持手动配置流程。
      })

    return () => {
      cancelled = true
    }
  }, [settings.aiConfig, settings.translationAIAssist, setSetting])

  /** 测试 AI 连接 */
  const handleTestAI = useCallback(async () => {
    setAiTestStatus('testing')
    setAiTestResult(null)
    try {
      const res = await fetch('/api/ai-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConfig: settings.aiConfig }),
      })
      const data = await res.json()
      setAiTestResult(data)
      setAiTestStatus(data.available ? 'success' : 'error')
    } catch {
      setAiTestResult({
        available: false,
        model: settings.aiConfig.model || '未配置',
        provider: settings.aiConfig.provider,
        message: '网络请求失败',
      })
      setAiTestStatus('error')
    }
  }, [settings.aiConfig])

  /** 手动更新 AI 配置后标记为自定义 */
  const updateCustomAiConfig = useCallback(<K extends keyof AppSettings['aiConfig']>(key: K, value: AppSettings['aiConfig'][K]) => {
    setSetting('aiConfig', { ...settings.aiConfig, presetName: '自定义', [key]: value })
  }, [settings.aiConfig, setSetting])

  /** 选择预设 */
  const handleSelectPreset = useCallback((preset: typeof AI_PRESETS[number]) => {
    setSetting('aiConfig', {
      ...settings.aiConfig,
      provider: 'custom',
      presetName: preset.name,
      apiProtocol: preset.apiProtocol,
      baseUrl: preset.baseUrl,
      model: preset.models[0],
    })
    setShowPresets(false)
    // 重置测试状态
    setAiTestStatus('idle')
    setAiTestResult(null)
  }, [settings.aiConfig, setSetting])

  return (
    <div className="space-y-1 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
      {/* 自动翻译 */}
      <SettingRow
        label="自动翻译"
        description="源代码变更后自动触发翻译（带防抖）"
      >
        <Switch
          checked={settings.translationAutoTranslate}
          onCheckedChange={(v) => setSetting('translationAutoTranslate', v)}
          className="data-[state=checked]:bg-[#22c55e]"
        />
      </SettingRow>

      {settings.translationAutoTranslate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="ml-0 pl-4 border-l-2 border-[#22c55e]/30"
        >
          <p className="text-xs text-[var(--app-text-secondary)] py-2">
            自动翻译将在代码变更后 1 秒自动触发，无需手动点击翻译按钮
          </p>
        </motion.div>
      )}

      <SettingDivider />

      {/* AI 辅助 */}
      <SettingRow
        label="AI 辅助翻译"
        description="使用 AI 优化翻译结果的质量和准确性"
      >
        <Switch
          checked={settings.translationAIAssist}
          onCheckedChange={(v) => setSetting('translationAIAssist', v)}
          className="data-[state=checked]:bg-[#22c55e]"
        />
      </SettingRow>

      {/* AI 配置详情卡片 */}
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{
          opacity: settings.translationAIAssist ? 1 : 0,
          height: settings.translationAIAssist ? 'auto' : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="ml-0 pl-4 border-l-2 border-[#22c55e]/30 py-2 space-y-3">
          {/* 自定义 AI 配置 */}
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
              {/* 快速预设 */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--app-text)] flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[#22c55e]" />
                  快速选择预设
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowPresets(!showPresets)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all',
                      'border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-text)]',
                      'hover:border-[#22c55e]/50 focus:outline-none focus:border-[#22c55e]'
                    )}
                  >
                    <span>{settings.aiConfig.presetName || '自定义'}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showPresets && 'rotate-180')} />
                  </button>
                  {showPresets && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] shadow-lg overflow-hidden">
                      {AI_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => handleSelectPreset(preset)}
                          className="w-full px-3 py-2 text-left hover:bg-[#22c55e]/10 transition-colors border-b border-[var(--app-border)] last:border-0"
                        >
                          <div className="text-xs font-medium text-[var(--app-text)]">{preset.name}</div>
                          <div className="text-[10px] text-[var(--app-text-secondary)] mt-0.5">
                            {preset.models.filter(Boolean).slice(0, 3).join(' / ') || '手动填写 Base URL、API Key 和模型'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* API 协议选择 */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--app-text)] flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[#22c55e]" />
                  API 协议
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      updateCustomAiConfig('apiProtocol', 'openai-completions')
                      setAiTestStatus('idle')
                      setAiTestResult(null)
                    }}
                    className={cn(
                      'rounded-lg border-2 p-2 text-center transition-all duration-200',
                      (settings.aiConfig.apiProtocol || 'openai-completions') === 'openai-completions'
                        ? 'border-[#22c55e] bg-[#22c55e]/5 shadow-sm'
                        : 'border-[var(--app-border)] hover:border-[var(--app-text-secondary)]'
                    )}
                  >
                    <div className="text-[11px] font-medium text-[var(--app-text)]">Chat</div>
                    <div className="text-[9px] text-[var(--app-text-secondary)] mt-0.5 leading-tight">
                      /chat/completions
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      updateCustomAiConfig('apiProtocol', 'openai-responses')
                      setAiTestStatus('idle')
                      setAiTestResult(null)
                    }}
                    className={cn(
                      'rounded-lg border-2 p-2 text-center transition-all duration-200',
                      settings.aiConfig.apiProtocol === 'openai-responses'
                        ? 'border-[#22c55e] bg-[#22c55e]/5 shadow-sm'
                        : 'border-[var(--app-border)] hover:border-[var(--app-text-secondary)]'
                    )}
                  >
                    <div className="text-[11px] font-medium text-[var(--app-text)]">Responses</div>
                    <div className="text-[9px] text-[var(--app-text-secondary)] mt-0.5 leading-tight">
                      /v1/responses
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      updateCustomAiConfig('apiProtocol', 'anthropic-messages')
                      setAiTestStatus('idle')
                      setAiTestResult(null)
                    }}
                    className={cn(
                      'rounded-lg border-2 p-2 text-center transition-all duration-200',
                      settings.aiConfig.apiProtocol === 'anthropic-messages'
                        ? 'border-[#22c55e] bg-[#22c55e]/5 shadow-sm'
                        : 'border-[var(--app-border)] hover:border-[var(--app-text-secondary)]'
                    )}
                  >
                    <div className="text-[11px] font-medium text-[var(--app-text)]">Anthropic</div>
                    <div className="text-[9px] text-[var(--app-text-secondary)] mt-0.5 leading-tight">
                      /v1/messages
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-[var(--app-text-secondary)]">
                  Chat 适用于几乎所有服务商（OpenAI、DeepSeek、Kimi、智谱、千问等），Responses 为 OpenAI 新一代接口，Anthropic Messages 为 Claude 原生接口
                </p>
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--app-text)] flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-[#22c55e]" />
                  API Base URL
                </label>
                <Input
                  value={settings.aiConfig.baseUrl}
                  onChange={(e) => {
                    updateCustomAiConfig('baseUrl', e.target.value)
                    setAiTestStatus('idle')
                    setAiTestResult(null)
                  }}
                  placeholder={
                    settings.aiConfig.apiProtocol === 'anthropic-messages'
                      ? 'https://api.anthropic.com 或 https://your-api.com'
                      : 'https://api.openai.com/v1 或 https://your-api.com'
                  }
                  className="h-8 text-xs font-mono bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-secondary)]/50 focus:border-[#22c55e] focus:ring-[#22c55e]/20"
                />
                <div className="text-[10px] text-[var(--app-text-secondary)] space-y-0.5">
                  {settings.aiConfig.apiProtocol === 'anthropic-messages' ? (
                    <>
                      <p>• Anthropic 协议自动拼接 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/v1/messages</code></p>
                      <p>• 官方 API 填 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">https://api.anthropic.com</code></p>
                      <p>• 代理/中转服务填对应地址即可</p>
                    </>
                  ) : settings.aiConfig.apiProtocol === 'openai-responses' ? (
                    <>
                      <p>• Responses 协议自动拼接 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/v1/responses</code></p>
                      <p>• 填写完整路径如 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">https://api.openai.com/v1</code> → 自动拼接 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/responses</code></p>
                      <p>• 只填域名如 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">https://your-api.com</code> → 自动添加 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/v1/responses</code></p>
                    </>
                  ) : (
                    <>
                      <p>• Chat 协议自动拼接 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/v1/chat/completions</code></p>
                      <p>• 填写完整路径如 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">https://api.openai.com/v1</code> → 自动拼接 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/chat/completions</code></p>
                      <p>• 只填域名如 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">https://your-api.com</code> → 自动添加 <code className="px-1 py-0.5 rounded bg-[var(--app-bg-secondary)] font-mono text-[9px]">/v1/chat/completions</code></p>
                    </>
                  )}
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--app-text)] flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-[#22c55e]" />
                  API Key
                </label>
                <div className="relative">
                  <Input
                    value={settings.aiConfig.apiKey}
                    onChange={(e) => {
                      updateCustomAiConfig('apiKey', e.target.value)
                      setAiTestStatus('idle')
                      setAiTestResult(null)
                    }}
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    className="h-8 text-xs font-mono bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-secondary)]/50 focus:border-[#22c55e] focus:ring-[#22c55e]/20 pr-9"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-text-secondary)] hover:text-[var(--app-text)] transition-colors"
                    type="button"
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-[var(--app-text-secondary)]">
                  留空时优先使用服务端环境变量中的 API Key；手动填写的 Key 仅存储在浏览器本地，不会上传到服务器数据库
                </p>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--app-text)] flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[#22c55e]" />
                  模型名称
                </label>
                <Input
                  value={settings.aiConfig.model}
                  onChange={(e) => {
                    updateCustomAiConfig('model', e.target.value)
                    setAiTestStatus('idle')
                    setAiTestResult(null)
                  }}
                  placeholder="gpt-4o / deepseek-chat / ..."
                  className="h-8 text-xs font-mono bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-secondary)]/50 focus:border-[#22c55e] focus:ring-[#22c55e]/20"
                />
              </div>

              {/* 自定义 AI 连接状态 */}
              <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--app-text)]">连接状态</span>
                  <div className="flex items-center gap-1.5">
                    {aiTestStatus === 'idle' && (
                      <span className="text-[10px] text-[var(--app-text-secondary)]">未测试</span>
                    )}
                    {aiTestStatus === 'testing' && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-[#22c55e]" />
                        <span className="text-[10px] text-[#22c55e] font-medium">测试中...</span>
                      </div>
                    )}
                    {aiTestStatus === 'success' && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-[#22c55e]" />
                        <span className="text-[10px] text-[#22c55e] font-medium">已连接</span>
                      </div>
                    )}
                    {aiTestStatus === 'error' && (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3 w-3 text-[#ef4444]" />
                        <span className="text-[10px] text-[#ef4444] font-medium">连接失败</span>
                      </div>
                    )}
                  </div>
                </div>
                {aiTestResult && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--app-text-secondary)]">模型</span>
                      <span className="text-[var(--app-text)] font-mono">{aiTestResult.model}</span>
                    </div>
                    {aiTestResult.protocol && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[var(--app-text-secondary)]">协议</span>
                        <span className={cn(
                          'font-mono',
                          aiTestResult.protocol === 'anthropic-messages' ? 'text-orange-400' :
                          'text-[#22c55e]'
                        )}>{aiTestResult.protocol}</span>
                      </div>
                    )}
                    {aiTestResult.responseFormat && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[var(--app-text-secondary)]">响应格式</span>
                        <span className={cn(
                          'font-mono',
                          hasResponseFormatWarning
                            ? 'text-amber-400'
                            : 'text-[var(--app-text)]'
                        )}>
                          {aiTestResult.responseFormat}
                          {hasResponseFormatWarning && ' ⚠️'}
                        </span>
                      </div>
                    )}
                    {aiTestResult.requestUrl && (
                      <div className="text-[10px]">
                        <span className="text-[var(--app-text-secondary)]">请求 URL</span>
                        <p className="text-[var(--app-text)] font-mono break-all mt-0.5 bg-[var(--app-bg)] rounded px-1.5 py-0.5 text-[9px]">{aiTestResult.requestUrl}</p>
                      </div>
                    )}
                    {aiTestResult.latency && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[var(--app-text-secondary)]">延迟</span>
                        <span className="text-[var(--app-text)] font-mono">{aiTestResult.latency}</span>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestAI}
                  disabled={aiTestStatus === 'testing'}
                  className={cn(
                    'w-full gap-1.5 text-[10px] h-7',
                    aiTestStatus === 'success' && 'border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10',
                    aiTestStatus === 'error' && 'border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10',
                    (aiTestStatus === 'idle' || aiTestStatus === 'testing') && 'border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)]',
                  )}
                >
                  {aiTestStatus === 'testing' ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 测试连接中...</>
                  ) : aiTestStatus === 'success' ? (
                    <><CheckCircle2 className="h-3 w-3" /> 连接正常 - 再次测试</>
                  ) : aiTestStatus === 'error' ? (
                    <><XCircle className="h-3 w-3" /> 重试连接</>
                  ) : (
                    <><Sparkles className="h-3 w-3" /> 测试自定义 AI 连接</>
                  )}
                </Button>
                {aiTestResult && aiTestStatus === 'error' && (
                  <p className="text-[9px] text-[#ef4444] mt-1 break-all">{aiTestResult.message}</p>
                )}
                {aiTestResult && aiTestStatus === 'success' && hasResponseFormatWarning && (
                  <p className="text-[9px] text-amber-400 mt-1 break-all">
                    响应格式 ({aiTestResult.responseFormat}) 与所选协议 ({aiTestResult.protocol}) 不匹配，但已自动兼容。你的 API 中转服务统一了响应格式。
                  </p>
                )}
              </div>
          </motion.div>

          {/* AI 功能说明 */}
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--app-text-secondary)]">
              AI 辅助会在规则翻译基础上进行语义优化，提升代码转换质量
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                <Sparkles className="h-2.5 w-2.5" /> 语义优化
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                💡 低置信度修复
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                🔍 代码建议
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <SettingDivider />

      {/* 自动保存到历史 */}
      <SettingRow
        label="自动保存历史"
        description="翻译完成后自动保存到历史记录"
      >
        <Switch
          checked={settings.translationAutoSaveHistory}
          onCheckedChange={(v) => setSetting('translationAutoSaveHistory', v)}
          className="data-[state=checked]:bg-[#22c55e]"
        />
      </SettingRow>
    </div>
  )
}
