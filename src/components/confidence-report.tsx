'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { TranslationResult } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 置信度报告组件 Props */
interface ConfidenceReportProps {
  /** 翻译结果 */
  result: TranslationResult | null
  /** 额外的 className */
  className?: string
}

/** 分类置信度项 */
interface CategoryItem {
  /** 分类名称 */
  label: string
  /** 分类图标 */
  icon: string
  /** 置信度值 0-1 */
  value: number
  /** 颜色类型 */
  color: 'green' | 'yellow' | 'red'
}

/**
 * 获取置信度对应的颜色
 * 高 ≥0.8 绿色，中 ≥0.5 黄色，低 <0.5 红色
 */
function getConfidenceColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 0.8) return 'green'
  if (score >= 0.5) return 'yellow'
  return 'red'
}

/** 获取颜色对应的具体 CSS 类名和样式 */
function getColorStyles(color: 'green' | 'yellow' | 'red') {
  switch (color) {
    case 'green':
      return {
        stroke: '#22c55e',
        bg: 'bg-[#22c55e]/10',
        text: 'text-[#22c55e]',
        barBg: 'bg-[#22c55e]/20',
        barFill: 'bg-[#22c55e]',
        gradientId: 'gradientGreen',
      }
    case 'yellow':
      return {
        stroke: '#f97316',
        bg: 'bg-[#f97316]/10',
        text: 'text-[#f97316]',
        barBg: 'bg-[#f97316]/20',
        barFill: 'bg-[#f97316]',
        gradientId: 'gradientYellow',
      }
    case 'red':
      return {
        stroke: '#ef4444',
        bg: 'bg-[#ef4444]/10',
        text: 'text-[#ef4444]',
        barBg: 'bg-[#ef4444]/20',
        barFill: 'bg-[#ef4444]',
        gradientId: 'gradientRed',
      }
  }
}

/** 获取翻译质量标签 */
function getQualityLabel(score: number): { label: string; color: string } {
  if (score >= 0.9) return { label: '优秀', color: 'text-[#22c55e]' }
  if (score >= 0.7) return { label: '良好', color: 'text-[#4ade80]' }
  if (score >= 0.5) return { label: '一般', color: 'text-[#f97316]' }
  return { label: '需改进', color: 'text-[#ef4444]' }
}

/** 计数动画 Hook */
function useCountUp(target: number, duration: number = 1200, delay: number = 300) {
  const [count, setCount] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    // 延迟启动动画
    const delayTimer = setTimeout(() => {
      const startTimestamp = performance.now()
      startTimeRef.current = startTimestamp

      const animate = (now: number) => {
        const elapsed = now - startTimestamp
        const progress = Math.min(elapsed / duration, 1)
        // 使用 easeOutCubic 缓动
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(eased * target))

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate)
        }
      }

      frameRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(delayTimer)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, delay])

  return count
}

/**
 * 置信度报告组件
 * 展示整体置信度圆形进度条和各分类置信度条形图
 * 增强版：绘制动画、渐变描边、分类条形图、计数动画、质量标签、悬停效果、脉冲动画
 */
export function ConfidenceReport({ result, className }: ConfidenceReportProps) {
  /** 从翻译结果中提取分类置信度数据 */
  const categories = useMemo<CategoryItem[]>(() => {
    if (!result) return []

    // 从警告中按类型统计置信度
    const warningByType = new Map<string, number[]>()
    for (const w of result.warnings) {
      const key = w.warningType
      if (!warningByType.has(key)) {
        warningByType.set(key, [])
      }
      warningByType.get(key)!.push(w.confidence)
    }

    // 定义分类映射
    const categoryMap: Record<string, { label: string; icon: string }> = {
      'mapping-uncertain': { label: '映射不确定', icon: '🔄' },
      'pattern-unsupported': { label: '不支持的模式', icon: '⚠️' },
      'manual-review': { label: '需人工审查', icon: '👁️' },
      'ai-assisted': { label: 'AI 辅助翻译', icon: '🤖' },
      'style-mismatch': { label: '样式不匹配', icon: '🎨' },
    }

    // 如果没有警告，生成默认的高置信度分类
    if (warningByType.size === 0) {
      return [
        { label: '状态管理', icon: '📊', value: Math.min(result.overallConfidence + 0.05, 1), color: getConfidenceColor(result.overallConfidence + 0.05) },
        { label: '事件绑定', icon: '🔗', value: Math.min(result.overallConfidence + 0.03, 1), color: getConfidenceColor(result.overallConfidence + 0.03) },
        { label: '渲染逻辑', icon: '🏗️', value: Math.min(result.overallConfidence + 0.02, 1), color: getConfidenceColor(result.overallConfidence + 0.02) },
        { label: '样式处理', icon: '🎨', value: Math.min(result.overallConfidence - 0.02, 1), color: getConfidenceColor(result.overallConfidence - 0.02) },
      ]
    }

    // 将警告类型映射到分类
    const items: CategoryItem[] = []
    for (const [type, confidences] of warningByType) {
      const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length
      const info = categoryMap[type] ?? { label: type, icon: '📋' }
      items.push({
        label: info.label,
        icon: info.icon,
        value: avg,
        color: getConfidenceColor(avg),
      })
    }

    return items
  }, [result])

  const overallScore = result?.overallConfidence ?? 0
  const overallColor = getConfidenceColor(overallScore)
  const overallStyles = getColorStyles(overallColor)
  const qualityInfo = getQualityLabel(overallScore)

  /** 计数动画 */
  const displayScore = useCountUp(Math.round(overallScore * 100), 1200, 500)

  /** 圆形进度条参数 */
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progressOffset = circumference - overallScore * circumference

  /** 翻译统计指标 */
  const stats = useMemo(() => {
    if (!result) return { totalNodes: 0, highConfCount: 0, medConfCount: 0, lowConfCount: 0, warningCount: 0, aiAssistedCount: 0, translationMode: 'ast' as const }
    const totalNodes = categories.length
    const highConfCount = categories.filter(c => c.value >= 0.8).length
    const medConfCount = categories.filter(c => c.value >= 0.5 && c.value < 0.8).length
    const lowConfCount = categories.filter(c => c.value < 0.5).length
    const warningCount = result.warnings.length
    // 从 ai-assisted 警告消息中提取翻译单元数量，例如 "3 个翻译单元"
    const aiWarning = result.warnings.find(w => w.warningType === 'ai-assisted')
    const aiUnitMatch = aiWarning?.message.match(/(\d+)\s*个翻译单元/)
    const aiAssistedCount = aiUnitMatch ? parseInt(aiUnitMatch[1]) : (aiWarning ? 1 : 0)
    // 翻译模式
    const genStep = result.pipeline?.steps?.find(s => s.id === 'generate')
    const translationMode = genStep?.detail?.mode || (aiWarning ? 'ai-full' : 'ast')
    return { totalNodes, highConfCount, medConfCount, lowConfCount, warningCount, aiAssistedCount, translationMode }
  }, [categories, result])

  if (!result) {
    return (
      <div className={cn('p-4 bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}>
        <div className="text-center text-[var(--app-text-muted)] text-sm py-4">
          翻译完成后将显示置信度报告
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className={cn('p-4 bg-[var(--app-bg)] rounded-lg border border-[var(--app-border)]', className)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* 标题 */}
      <h3 className="text-sm font-semibold text-[var(--app-text)] mb-4 flex items-center gap-2">
        <span>📈</span>
        <span>置信度报告</span>
      </h3>

      <div className="flex gap-6 items-start">
        {/* 圆形进度条 - 增强版：绘制动画 + 渐变描边 + 脉冲 */}
        <motion.div
          className="flex flex-col items-center gap-2 shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              {/* 渐变定义 */}
              <defs>
                <linearGradient id={overallStyles.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  {overallColor === 'green' && (
                    <>
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="50%" stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </>
                  )}
                  {overallColor === 'yellow' && (
                    <>
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="50%" stopColor="#fb923c" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </>
                  )}
                  {overallColor === 'red' && (
                    <>
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="50%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </>
                  )}
                </linearGradient>
              </defs>
              {/* 背景圆环 */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke="#3d3d5c"
                strokeWidth="6"
              />
              {/* 进度圆环 - 绘制动画 + 渐变描边 */}
              <motion.circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke={`url(#${overallStyles.gradientId})`}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: progressOffset }}
                transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
              />
              {/* 外层发光效果 */}
              <motion.circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke={`url(#${overallStyles.gradientId})`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={circumference}
                opacity={0.3}
                filter="blur(3px)"
                initial={{ strokeDashoffset: circumference }}
                animate={{
                  strokeDashoffset: progressOffset,
                  ...(overallScore >= 0.9 ? { opacity: [0.2, 0.4, 0.2] } : {}),
                }}
                transition={overallScore >= 0.9
                  ? {
                      strokeDashoffset: { duration: 1.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 },
                      opacity: { duration: 2, repeat: Infinity, delay: 2 },
                    }
                  : { duration: 1.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }
                }
              />
            </svg>
            {/* 中心分数 - 计数动画 + 质量标签 */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <span className={cn('text-2xl font-bold tabular-nums', overallStyles.text)}>
                {displayScore}
              </span>
              <span className={cn('text-[10px] font-medium', qualityInfo.color)}>
                {qualityInfo.label}
              </span>
            </motion.div>
          </div>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', overallStyles.bg, overallStyles.text)}>
            {result.confidenceLevel === 'high' ? '高' : result.confidenceLevel === 'medium' ? '中' : '低'}
          </span>
        </motion.div>

        {/* 分类置信度条形图 - 增强版 */}
        <div className="flex-1 min-w-0 space-y-3">
          {categories.map((category, index) => {
            const styles = getColorStyles(category.color)
            return (
              <motion.div
                key={category.label}
                className="space-y-1.5 rounded-md px-2 py-1.5 -mx-2 transition-all duration-200 hover:bg-[var(--app-hover-bg)]"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--app-text)] flex items-center gap-1.5">
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </span>
                  <span className={cn('text-xs font-medium tabular-nums', styles.text)}>
                    {Math.round(category.value * 100)}%
                  </span>
                </div>
                {/* 分类置信度条形图 */}
                <div className={cn('h-2 rounded-full overflow-hidden', styles.barBg)}>
                  <motion.div
                    className={cn('h-full rounded-full relative', styles.barFill)}
                    initial={{ width: 0 }}
                    animate={{ width: `${category.value * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.7 + index * 0.1 }}
                  >
                    {/* 条形图高光效果 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
                  </motion.div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 翻译耗时 */}
      {result.duration > 0 && (
        <motion.div
          className="mt-3 pt-3 border-t border-[var(--app-border)] text-xs text-[var(--app-text-muted)] flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span>⏱️</span>
          <span>翻译耗时: {result.duration < 1000 ? `${result.duration}ms` : `${(result.duration / 1000).toFixed(1)}s`}</span>
        </motion.div>
      )}

      {/* 翻译统计指标 - 带悬停效果 */}
      <motion.div
        className="mt-3 pt-3 border-t border-[var(--app-border)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        <h4 className="text-xs font-semibold text-[var(--app-text)] mb-2 flex items-center gap-1.5">
          <span>📊</span>
          <span>翻译统计</span>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {/* 高置信度 */}
          <motion.div
            className="p-2 rounded-md bg-[#22c55e]/5 border border-[#22c55e]/10 text-center cursor-default transition-all duration-200 hover:bg-[#22c55e]/10 hover:shadow-[0_0_12px_rgba(34,197,94,0.15)]"
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-lg font-bold text-[#22c55e] tabular-nums">{stats.highConfCount}</div>
            <div className="text-[10px] text-[var(--app-text-muted)]">高置信度</div>
          </motion.div>
          {/* 中置信度 */}
          <motion.div
            className="p-2 rounded-md bg-[#f97316]/5 border border-[#f97316]/10 text-center cursor-default transition-all duration-200 hover:bg-[#f97316]/10 hover:shadow-[0_0_12px_rgba(249,115,22,0.15)]"
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-lg font-bold text-[#f97316] tabular-nums">{stats.medConfCount}</div>
            <div className="text-[10px] text-[var(--app-text-muted)]">中置信度</div>
          </motion.div>
          {/* 低置信度 */}
          <motion.div
            className="p-2 rounded-md bg-[#ef4444]/5 border border-[#ef4444]/10 text-center cursor-default transition-all duration-200 hover:bg-[#ef4444]/10 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)]"
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-lg font-bold text-[#ef4444] tabular-nums">{stats.lowConfCount}</div>
            <div className="text-[10px] text-[var(--app-text-muted)]">低置信度</div>
          </motion.div>
        </div>
        {/* 底部小统计 */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--app-text-muted)]">
          <span>⚠️ {stats.warningCount} 个警告</span>
          <span className={stats.aiAssistedCount > 0 ? 'text-[#22c55e]' : ''}>
            {stats.aiAssistedCount > 0 ? '🤖' : '🔧'} {stats.aiAssistedCount > 0 ? `${stats.aiAssistedCount} 处 AI 翻译` : 'AST 本地翻译'}
          </span>
          <span>📦 {stats.totalNodes} 个分类</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
