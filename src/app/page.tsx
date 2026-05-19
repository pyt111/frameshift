'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Home, ArrowLeftRight, BookOpen, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HomeView } from '@/components/home-view'
import { TranslationWorkspace } from '@/components/translation-workspace'
import { ExamplesView } from '@/components/examples-view'
import type { Framework } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 导航视图类型 */
type ViewType = 'home' | 'translate' | 'examples'

/** 主题类型 */
type ThemeMode = 'dark' | 'light'

/** 导航项配置 */
const NAV_ITEMS: { key: ViewType; label: string; icon: typeof Home }[] = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'translate', label: '翻译', icon: ArrowLeftRight },
  { key: 'examples', label: '示例', icon: BookOpen },
]

/** 视图切换动画配置 */
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  duration: 0.25,
  ease: 'easeOut' as const,
}

/** 主题切换图标动画配置 */
const themeIconVariants = {
  initial: { scale: 0, rotate: -90, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  exit: { scale: 0, rotate: 90, opacity: 0 },
}

const themeIconTransition = {
  duration: 0.3,
  ease: 'easeInOut' as const,
}

/**
 * 从 URL search params 中解析分享数据
 * URL 格式: ?code=BASE64&source=react&target=vue3
 */
function parseShareParams(searchParams: URLSearchParams): {
  code: string
  sourceFramework: Framework
  targetFramework: Framework
} | null {
  const encodedCode = searchParams.get('code')
  const source = searchParams.get('source') as Framework | null
  const target = searchParams.get('target') as Framework | null

  if (!encodedCode || !source) return null

  try {
    // 解码 base64 → UTF-8 字符串
    const decodedCode = decodeURIComponent(escape(atob(encodedCode)))
    const validFrameworks: Framework[] = ['react', 'vue3']
    const sourceFramework = validFrameworks.includes(source) ? source : 'react'
    const targetFramework = (target && validFrameworks.includes(target)) ? target : (sourceFramework === 'react' ? 'vue3' : 'react')

    return {
      code: decodedCode,
      sourceFramework,
      targetFramework,
    }
  } catch {
    // base64 解码失败，忽略
    return null
  }
}

/**
 * 主页面内容组件
 * 管理导航和视图切换，支持在首页、翻译工作区和示例之间导航
 * 支持通过 URL 参数分享代码
 * 支持暗色/亮色主题切换
 */
function MainPageContent() {
  const searchParams = useSearchParams()

  /** 从 URL 分享参数中解析初始数据（仅初始化时计算一次） */
  const shareData = parseShareParams(searchParams)

  /** 当前视图 - 如果有分享数据则直接进入翻译视图 */
  const [currentView, setCurrentView] = useState<ViewType>(shareData ? 'translate' : 'home')

  /** 预加载的源代码 */
  const [preloadedCode, setPreloadedCode] = useState<string | undefined>(shareData?.code)
  const [preloadedFramework, setPreloadedFramework] = useState<Framework>(shareData?.sourceFramework ?? 'react')
  const [preloadedTargetFramework, setPreloadedTargetFramework] = useState<Framework>(shareData?.targetFramework ?? 'vue3')

  /** 主题状态，默认暗色 - 使用 lazy initializer 从 localStorage 读取 */
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const savedTheme = localStorage.getItem('frameshift-theme') as ThemeMode | null
      if (savedTheme === 'light' || savedTheme === 'dark') {
        // 延迟设置 DOM 属性到 effect 中
        return savedTheme
      }
    } catch {
      // 静默处理 localStorage 不可用的情况
    }
    return 'dark'
  })

  /** 同步主题到 DOM */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  /** 切换主题 */
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', newTheme)
      try {
        localStorage.setItem('frameshift-theme', newTheme)
      } catch {
        // 静默处理 localStorage 不可用的情况
      }
      return newTheme
    })
  }, [])

  /** 清除 URL 中的分享参数，避免刷新时重复加载 */
  useEffect(() => {
    if (shareData) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [shareData])

  /** 切换到翻译视图 */
  const handleStartTranslating = useCallback(() => {
    setPreloadedCode(undefined)
    setCurrentView('translate')
  }, [])

  /** 从示例选择后加载到翻译视图 */
  const handleSelectExample = useCallback((code: string, framework: Framework) => {
    setPreloadedCode(code)
    setPreloadedFramework(framework)
    setPreloadedTargetFramework(framework === 'react' ? 'vue3' : 'react')
    setCurrentView('translate')
  }, [])

  /** 导航项点击处理 */
  const handleNavClick = useCallback((view: ViewType) => {
    setCurrentView(view)
  }, [])

  return (
    <div className={cn(
      "h-screen flex flex-col overflow-hidden",
      "bg-[var(--app-bg)] text-[var(--app-text)]"
    )}>
      {/* 顶部导航栏 */}
      <header className="shrink-0 bg-[var(--app-bg)] border-b border-[var(--app-border)] z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#22c55e]/10">
              <Sparkles className="h-4 w-4 text-[#22c55e]" />
            </div>
            <span className="text-base font-bold tracking-tight">
              <span className="text-[var(--app-text)]">Frame</span>
              <span className="text-[#22c55e]">Shift</span>
            </span>
          </div>

          {/* 右侧：导航项 + 主题切换 */}
          <div className="flex items-center gap-1">
            <nav className="flex items-center gap-1" role="navigation" aria-label="主导航">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = currentView === item.key
                return (
                  <Button
                    key={item.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavClick(item.key)}
                    className={cn(
                      'gap-1.5 text-sm transition-all duration-200',
                      isActive
                        ? 'text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/15'
                        : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover-bg)]'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                )
              })}
            </nav>

            {/* 主题切换按钮 */}
            <div className="ml-2 pl-2 border-l border-[var(--app-border)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="relative h-8 w-8 p-0 rounded-md transition-colors duration-200 hover:bg-[var(--app-hover-bg)]"
                aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
                title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {theme === 'dark' ? (
                    <motion.div
                      key="moon"
                      variants={themeIconVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={themeIconTransition}
                    >
                      <Moon className="h-4 w-4 text-[var(--app-text-secondary)]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="sun"
                      variants={themeIconVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={themeIconTransition}
                    >
                      <Sun className="h-4 w-4 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 使用相对定位 + 溢出隐藏确保子元素可以撑满 */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div
              key="home"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="absolute inset-0 overflow-y-auto"
            >
              <HomeView onStartTranslating={handleStartTranslating} />
            </motion.div>
          )}

          {currentView === 'translate' && (
            <motion.div
              key="translate"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="absolute inset-0"
            >
              <TranslationWorkspace
                initialSourceCode={preloadedCode}
                initialSourceFramework={preloadedFramework}
                initialTargetFramework={preloadedTargetFramework}
              />
            </motion.div>
          )}

          {currentView === 'examples' && (
            <motion.div
              key="examples"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="absolute inset-0 overflow-y-auto"
            >
              <ExamplesView onSelectExample={handleSelectExample} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 页脚 */}
      <footer className="shrink-0 bg-[var(--app-bg)] border-t border-[var(--app-border)]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 truncate">
            <p className="text-[10px] sm:text-xs text-[var(--app-text-muted)] shrink-0">
              FrameShift © 2025
            </p>
            <div className="hidden md:flex items-center gap-2 text-[10px] text-[var(--app-text-muted)] shrink-0">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                AI Powered
              </span>
              <span className="text-[var(--app-border)]">·</span>
              <span>React ↔ Vue 3</span>
              <span className="text-[var(--app-border)]">·</span>
              <span>TypeScript</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[var(--app-text-muted)] hidden sm:inline">v1.0</span>
            <span className="text-[10px] text-[var(--app-border)] hidden sm:inline">·</span>
            <p className="text-[10px] text-[var(--app-text-muted)]">
              Next.js
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * 主页面入口组件
 * 使用 Suspense 包裹以支持 useSearchParams
 */
export default function MainPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[var(--app-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--app-text-secondary)]">加载中...</span>
        </div>
      </div>
    }>
      <MainPageContent />
    </Suspense>
  )
}
