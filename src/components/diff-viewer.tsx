'use client'

import { useCallback, useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Diff 查看器组件的 Props */
interface DiffViewerProps {
  /** 源代码 */
  sourceCode: string
  /** 目标代码 */
  targetCode: string
  /** 源语言 */
  sourceLanguage: 'typescript' | 'vue' | 'javascript'
  /** 目标语言 */
  targetLanguage: 'typescript' | 'vue' | 'javascript'
  /** 额外的 className */
  className?: string
}

/**
 * 代码差异查看器组件
 * 并排展示源代码和翻译后的目标代码，支持同步滚动
 */
export function DiffViewer({
  sourceCode,
  targetCode,
  sourceLanguage,
  targetLanguage,
  className,
}: DiffViewerProps) {
  const sourceEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const targetEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const isSyncingScroll = useRef(false)

  /** 同步滚动处理：源编辑器滚动时同步目标编辑器 */
  const handleSourceEditorMount: OnMount = useCallback((editorInstance) => {
    sourceEditorRef.current = editorInstance
    editorInstance.onDidScrollChange((e) => {
      if (isSyncingScroll.current) return
      isSyncingScroll.current = true
      const targetEditor = targetEditorRef.current
      if (targetEditor) {
        targetEditor.setScrollTop(e.scrollTop)
        targetEditor.setScrollLeft(e.scrollLeft)
      }
      isSyncingScroll.current = false
    })
  }, [])

  /** 同步滚动处理：目标编辑器滚动时同步源编辑器 */
  const handleTargetEditorMount: OnMount = useCallback((editorInstance) => {
    targetEditorRef.current = editorInstance
    editorInstance.onDidScrollChange((e) => {
      if (isSyncingScroll.current) return
      isSyncingScroll.current = true
      const sourceEditor = sourceEditorRef.current
      if (sourceEditor) {
        sourceEditor.setScrollTop(e.scrollTop)
        sourceEditor.setScrollLeft(e.scrollLeft)
      }
      isSyncingScroll.current = false
    })
  }, [])

  /** 将语言映射为 Monaco 编辑器语言 */
  const mapLanguage = (lang: string) => {
    switch (lang) {
      case 'typescript':
        return 'typescript'
      case 'vue':
        return 'html'
      case 'javascript':
        return 'javascript'
      default:
        return 'plaintext'
    }
  }

  /** 编辑器通用配置 */
  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    readOnly: true,
    minimap: { enabled: false },
    lineNumbers: 'on',
    fontSize: 13,
    fontFamily: "'Geist Mono', 'Fira Code', 'Consolas', monospace",
    fontLigatures: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: 'gutter',
    smoothScrolling: true,
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
    },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    domReadOnly: true,
    cursorBlinking: 'smooth',
  }

  /** 加载骨架屏 */
  const loadingSkeleton = (
    <div className="flex flex-col gap-2 p-4 h-full">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-3.5 rounded',
            i % 3 === 0 ? 'w-5/6' : i % 2 === 0 ? 'w-2/3' : 'w-1/2'
          )}
        />
      ))}
    </div>
  )

  return (
    <div className={cn('flex gap-0 h-full', className)}>
      {/* 源代码面板 */}
      <div className="flex-1 min-w-0 border border-[var(--app-border)] border-r-0 rounded-l-md overflow-hidden">
        <div className="bg-[var(--app-bg-secondary)] px-4 py-1.5 border-b border-[var(--app-border)] flex items-center gap-2">
          <span className="text-xs text-[var(--app-text-secondary)] font-medium">源代码</span>
          <span className="text-xs text-[#22c55e]/70 bg-[#22c55e]/10 px-1.5 py-0.5 rounded">
            {sourceLanguage.toUpperCase()}
          </span>
        </div>
        <Editor
          height="calc(100% - 30px)"
          language={mapLanguage(sourceLanguage)}
          value={sourceCode}
          onMount={handleSourceEditorMount}
          theme="vs-dark"
          loading={loadingSkeleton}
          options={editorOptions}
        />
      </div>

      {/* 目标代码面板 */}
      <div className="flex-1 min-w-0 border border-[var(--app-border)] rounded-r-md overflow-hidden">
        <div className="bg-[var(--app-bg-secondary)] px-4 py-1.5 border-b border-[var(--app-border)] flex items-center gap-2">
          <span className="text-xs text-[var(--app-text-secondary)] font-medium">翻译结果</span>
          <span className="text-xs text-[#22c55e]/70 bg-[#22c55e]/10 px-1.5 py-0.5 rounded">
            {targetLanguage.toUpperCase()}
          </span>
        </div>
        <Editor
          height="calc(100% - 30px)"
          language={mapLanguage(targetLanguage)}
          value={targetCode}
          onMount={handleTargetEditorMount}
          theme="vs-dark"
          loading={loadingSkeleton}
          options={editorOptions}
        />
      </div>
    </div>
  )
}
