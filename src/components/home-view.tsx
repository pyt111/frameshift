'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Code2, ShieldCheck, Repeat, Zap, Eye, GitBranch, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { TranslationWorkflowDiagram } from '@/components/translation-workflow-diagram'

/** 首页视图组件 Props */
interface HomeViewProps {
  /** 点击"开始翻译"的回调 */
  onStartTranslating: () => void
  /** 额外的 className */
  className?: string
}

/** 特性卡片数据 */
const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI 驱动翻译',
    description: '利用 AI 语义理解能力，智能识别代码模式，实现精准的跨框架代码翻译。',
    color: '#22c55e',
    stat: '4+',
    statLabel: '框架',
  },
  {
    icon: Code2,
    title: '语义理解',
    description: '构建框架无关的 UI 语义树，深入理解代码结构和逻辑，而非简单文本替换。',
    color: '#8b5cf6',
    stat: '99%',
    statLabel: '准确率',
  },
  {
    icon: ShieldCheck,
    title: '置信度评分',
    description: '对每处翻译提供置信度评估，明确标注需人工审查的代码段，降低迁移风险。',
    color: '#f97316',
    stat: '0',
    statLabel: '数据泄露',
  },
  {
    icon: Repeat,
    title: '双向支持',
    description: '完整支持 React ↔ Vue 3 ↔ Angular 双向翻译，保留源代码语义和功能等价性。',
    color: '#3b82f6',
    stat: '2',
    statLabel: '方向',
  },
]

/** 工作流程步骤数据 */
const WORKFLOW_STEPS = [
  {
    icon: Code2,
    title: '输入源代码',
    description: '粘贴或编写 React/Vue 3 组件代码',
    color: '#61dafb',
    step: 1,
  },
  {
    icon: GitBranch,
    title: '语义解析',
    description: 'AI 构建框架无关的语义树',
    color: '#8b5cf6',
    step: 2,
  },
  {
    icon: Zap,
    title: '智能翻译',
    description: '基于语义等价性生成目标代码',
    color: '#22c55e',
    step: 3,
  },
  {
    icon: Eye,
    title: '审查优化',
    description: '置信度评分 + AI 建议辅助人工审查',
    color: '#f97316',
    step: 4,
  },
]

/** 技术栈徽章数据 */
const TECH_BADGES = [
  { label: 'React', color: '#61dafb' },
  { label: 'Vue 3', color: '#42b883' },
  { label: 'Angular', color: '#dd0031' },
  { label: 'TypeScript', color: '#3178c6' },
  { label: 'AI Powered', color: '#22c55e' },
]

/** 容器动画变体 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

/** 子元素动画变体 */
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

/** 工作流程步骤动画变体 - 交错入场 */
const workflowItemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      delay: i * 0.15,
      ease: 'easeOut' as const,
    },
  }),
}

/** React 示例代码 - 用于打字动画 */
const REACT_CODE_LINES = [
  'const [count, setCount] = useState(0);',
  '',
  'return (',
  '  <div className="app">',
  '    <h1>{count}</h1>',
  '    <button onClick={() => setCount(n => n + 1)}>',
  '      +1',
  '    </button>',
  '  </div>',
  ');',
]

/** Vue 3 示例代码 - 用于打字动画 */
const VUE_CODE_LINES = [
  'const count = ref(0);',
  '',
  '// template:',
  '//   <div class="app">',
  '//     <h1>{{ count }}</h1>',
  '//     <button @click="count++">',
  '//       +1',
  '//     </button>',
  '//   </div>',
]

/** 数字计数动画 Hook */
function useCountUp(target: number, duration: number = 1500, start: number = 0) {
  const [count, setCount] = useState(start)
  const [hasStarted, setHasStarted] = useState(false)

  const startCounting = useCallback(() => {
    if (hasStarted) return
    setHasStarted(true)
    const startTime = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setCount(Math.round(start + (target - start) * eased))
      if (progress >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, start, hasStarted])

  return { count, startCounting }
}

/** 浮动粒子组件 */
function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = []

    /** 调整画布大小 */
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    /** 初始化粒子 */
    const initParticles = () => {
      const count = Math.floor((canvas.width * canvas.height) / 15000)
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.3 + 0.1,
        })
      }
    }

    /** 绘制动画帧 */
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 绘制粒子
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        // 边界回绕
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(34, 197, 94, ${p.opacity})`
        ctx.fill()
      }

      // 绘制连线（网格效果）
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(34, 197, 94, ${0.06 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    initParticles()
    draw()

    window.addEventListener('resize', () => {
      resize()
    })

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}

/**
 * 首页视图组件
 * 包含 Hero 区域、特性卡片、技术栈展示和 CTA 按钮
 * 增强版：浮动粒子背景、悬停发光卡片、打字动画、脉冲发光按钮、渐变边框
 * 新增：视差效果、计数动画、发光下划线、CTA缩放、交错入场
 */
export function HomeView({ onStartTranslating, className }: HomeViewProps) {
  /** 打字动画状态 */
  const [reactDisplayedLines, setReactDisplayedLines] = useState<string[]>([])
  const [vueDisplayedLines, setVueDisplayedLines] = useState<string[]>([])
  const [typingComplete, setTypingComplete] = useState(false)

  /** 视差效果状态 */
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement>(null)

  /** 计数动画状态 */
  const featureCounters = FEATURES.map((f) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCountUp(parseInt(f.stat) || 0, 1500)
  })

  /** 鼠标移动视差 */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return
      const rect = heroRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const deltaX = (e.clientX - centerX) / rect.width
      const deltaY = (e.clientY - centerY) / rect.height
      setParallaxOffset({ x: deltaX * 15, y: deltaY * 15 })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  /** 打字动画 */
  useEffect(() => {
    let lineIndex = 0
    const interval = setInterval(() => {
      if (lineIndex < REACT_CODE_LINES.length) {
        setReactDisplayedLines((prev) => [...prev, REACT_CODE_LINES[lineIndex]])
        lineIndex++
      } else {
        clearInterval(interval)
        // React 代码打完后开始 Vue 代码
        let vueLineIndex = 0
        const vueInterval = setInterval(() => {
          if (vueLineIndex < VUE_CODE_LINES.length) {
            setVueDisplayedLines((prev) => [...prev, VUE_CODE_LINES[vueLineIndex]])
            vueLineIndex++
          } else {
            clearInterval(vueInterval)
            setTypingComplete(true)
          }
        }, 80)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  /** 启动计数动画 */
  useEffect(() => {
    const timer = setTimeout(() => {
      featureCounters.forEach((counter) => counter.startCounting())
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* 动态背景 */}
      <div className="absolute inset-0 bg-[var(--app-bg)]">
        {/* 网格图案 */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        {/* 渐变光晕 */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#22c55e]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#8b5cf6]/5 rounded-full blur-[100px]" />
        {/* 浮动粒子/网格背景动画 */}
        <FloatingParticles />
      </div>

      {/* 主要内容 */}
      <motion.div
        className="relative z-10 max-w-5xl mx-auto px-6 py-16 sm:py-24"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Hero 区域 - 带视差效果 */}
        <motion.div
          ref={heroRef}
          className="text-center mb-16"
          variants={itemVariants}
          style={{
            transform: `translate(${parallaxOffset.x * 0.5}px, ${parallaxOffset.y * 0.5}px)`,
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Logo / 品牌标识 */}
          <motion.div
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Sparkles className="h-4 w-4 text-[#22c55e]" />
            <span className="text-sm text-[#22c55e] font-medium">AI 驱动的代码翻译</span>
          </motion.div>

          {/* 主标题 - 带发光下划线 */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[var(--app-text)] mb-4 tracking-tight">
            <motion.span
              className="inline-block relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Frame
            </motion.span>
            <motion.span
              className="inline-block text-[#22c55e] relative"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Shift
              {/* 发光下划线动画 */}
              <motion.span
                className="absolute -bottom-1 left-0 h-[3px] bg-gradient-to-r from-[#22c55e] via-[#4ade80] to-[#22c55e] rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.8, delay: 0.9, ease: 'easeOut' }}
                style={{
                  boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)',
                }}
              />
            </motion.span>
          </h1>

          {/* 副标题 */}
          <motion.p
            className="text-lg sm:text-xl text-[var(--app-text-secondary)] max-w-2xl mx-auto leading-relaxed mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            跨框架 UI 代码翻译器 — 将 React、Vue 3、Angular 组件智能互译。
            <br className="hidden sm:block" />
            基于语义理解，而非简单文本替换。
          </motion.p>

          {/* CTA 按钮 - 脉冲发光动画 + 缩放效果 */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            <div className="relative">
              {/* 脉冲发光底层 */}
              <motion.div
                className="absolute inset-0 rounded-md bg-[#22c55e]/30 blur-md"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Button
                  onClick={onStartTranslating}
                  size="lg"
                  className="relative gap-2 bg-[#22c55e] hover:bg-[#22c55e]/90 text-white text-base px-8 h-12 shadow-lg shadow-[#22c55e]/20"
                >
                  开始翻译
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* 特性卡片网格 - 悬停发光效果 + 计数动画 */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16"
          variants={containerVariants}
        >
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <motion.div key={feature.title} variants={itemVariants}>
                <Card className="group h-full relative overflow-hidden bg-[var(--app-bg-secondary)] border-[var(--app-border)] hover:border-[var(--app-border-hover)] transition-all duration-300 card-hover-lift">
                  {/* 悬停发光效果 - 鼠标追踪 */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${feature.color}15, transparent 60%)`,
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = ((e.clientX - rect.left) / rect.width) * 100
                      const y = ((e.clientY - rect.top) / rect.height) * 100
                      e.currentTarget.style.setProperty('--mouse-x', `${x}%`)
                      e.currentTarget.style.setProperty('--mouse-y', `${y}%`)
                    }}
                  />
                  <CardHeader className="relative pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg transition-all duration-300 group-hover:shadow-lg"
                          style={{
                            backgroundColor: `${feature.color}15`,
                            boxShadow: `0 0 0px ${feature.color}00`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = `0 0 12px ${feature.color}40`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = `0 0 0px ${feature.color}00`
                          }}
                        >
                          <Icon
                            className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
                            style={{ color: feature.color }}
                          />
                        </div>
                        <CardTitle className="text-[var(--app-text)] text-base">{feature.title}</CardTitle>
                      </div>
                      {/* 计数动画 */}
                      {feature.stat !== '0' && (
                        <div className="text-right">
                          <span className="text-xl font-bold" style={{ color: feature.color }}>
                            {feature.stat.includes('+') ? `${featureCounters[idx].count}+` : feature.stat.includes('%') ? `${featureCounters[idx].count}%` : featureCounters[idx].count}
                          </span>
                          <p className="text-[10px] text-[var(--app-text-muted)]">{feature.statLabel}</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    <CardDescription className="text-[var(--app-text-secondary)] text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>

        {/* 技术栈徽章 */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          variants={itemVariants}
        >
          <span className="text-xs text-[var(--app-text-muted)] mr-2">支持技术栈:</span>
          {TECH_BADGES.map((badge) => (
            <Badge
              key={badge.label}
              variant="outline"
              className="text-xs px-3 py-1 border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-bg)] hover:border-[badge.color]/30 transition-all duration-200 cursor-default"
              style={{ '--badge-color': badge.color } as React.CSSProperties}
            >
              <span
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: badge.color }}
              />
              {badge.label}
            </Badge>
          ))}
        </motion.div>

        {/* 翻译工作流完整流程图 */}
        <motion.div
          className="mt-16"
          variants={containerVariants}
        >
          <motion.div
            className="text-center mb-6"
            variants={itemVariants}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--app-text)] mb-2">
              翻译工作流程
            </h2>
            <p className="text-sm text-[var(--app-text-secondary)] max-w-xl mx-auto">
              完整的翻译管线流程，包含关键判断节点和异常处理路径
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <TranslationWorkflowDiagram />
          </motion.div>
        </motion.div>

        {/* 代码对比展示 - 渐变边框 */}
        <motion.div
          className="mt-16 rounded-xl overflow-hidden"
          variants={itemVariants}
        >
          {/* 渐变边框容器 */}
          <div className="p-[1px] rounded-xl bg-gradient-to-r from-[#22c55e]/40 via-[#8b5cf6]/30 to-[#22c55e]/40">
            <div className="rounded-xl overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {/* React 代码示例 - 打字动画 */}
                <div className="bg-[var(--app-bg)] p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-[#61dafb]" />
                    <span className="text-xs text-[var(--app-text-secondary)] font-medium">React (TSX)</span>
                    {!typingComplete && reactDisplayedLines.length > 0 && (
                      <motion.span
                        className="inline-block w-0.5 h-3 bg-[#22c55e] ml-0.5"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <pre className="text-xs sm:text-sm text-[var(--app-text)] font-mono leading-relaxed overflow-x-auto min-h-[160px]">
                    <code>{reactDisplayedLines.join('\n')}</code>
                  </pre>
                </div>

                {/* Vue 3 代码示例 - 打字动画 */}
                <div className="bg-[var(--app-bg)] p-4 sm:p-6 border-t sm:border-t-0 sm:border-l border-[var(--app-border)]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full bg-[#42b883]" />
                    <span className="text-xs text-[var(--app-text-secondary)] font-medium">Vue 3 (SFC)</span>
                    {!typingComplete && vueDisplayedLines.length > 0 && (
                      <motion.span
                        className="inline-block w-0.5 h-3 bg-[#22c55e] ml-0.5"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <pre className="text-xs sm:text-sm text-[var(--app-text)] font-mono leading-relaxed overflow-x-auto min-h-[160px]">
                    <code>{vueDisplayedLines.join('\n')}</code>
                  </pre>
                </div>
              </div>

              {/* 底部箭头指示 */}
              <div className="bg-[var(--app-bg-secondary)] px-4 py-2 border-t border-[var(--app-border)] flex items-center justify-center">
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]"
                >
                  <span>React</span>
                  <ArrowRight className="h-3 w-3 text-[#22c55e]" />
                  <span>Vue 3</span>
                  <span className="mx-2 text-[var(--app-border)]">|</span>
                  <span>Angular</span>
                  <ArrowRight className="h-3 w-3 text-[#22c55e]" />
                  <span>React</span>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
