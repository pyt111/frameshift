'use client'

import { useCallback, useRef, useMemo } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/hooks/use-settings'

/** 代码编辑器组件的 Props */
interface CodeEditorProps {
  /** 编辑器内容 */
  value: string
  /** 内容变更回调 */
  onChange?: (value: string) => void
  /** 编程语言 */
  language: 'typescript' | 'vue' | 'javascript'
  /** 是否只读 */
  readOnly?: boolean
  /** 编辑器高度 */
  height?: string | number
  /** 编辑器挂载回调 */
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
  /** 编辑器设置 */
  settings?: AppSettings
  /** 额外的 className */
  className?: string
}

/**
 * Monaco 代码编辑器封装组件
 * 使用 vs-dark 主题，支持代码高亮和行号显示
 */
export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '100%',
  onEditorMount,
  settings,
  className,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  /** 编辑器挂载回调 */
  const handleEditorMount: OnMount = useCallback(
    (editorInstance) => {
      editorRef.current = editorInstance
      onEditorMount?.(editorInstance)
    },
    [onEditorMount]
  )

  /** 内容变更回调 */
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange?.(newValue ?? '')
    },
    [onChange]
  )

  /** 加载骨架屏 */
  const loadingSkeleton = (
    <div className="flex flex-col gap-2 p-4 h-full">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4 rounded',
            i === 0 ? 'w-3/4' : i % 3 === 0 ? 'w-5/6' : i % 2 === 0 ? 'w-2/3' : 'w-1/2'
          )}
        />
      ))}
    </div>
  )

  /** 根据 settings 计算编辑器选项 */
  const editorOptions = useMemo((): editor.IStandaloneEditorConstructionOptions => ({
    readOnly,
    minimap: { enabled: settings?.editorMinimap ?? false },
    lineNumbers: (settings?.editorLineNumbers ?? true) ? 'on' as const : 'off' as const,
    fontSize: settings?.editorFontSize ?? 14,
    fontFamily: "'Geist Mono', 'Fira Code', 'Consolas', monospace",
    fontLigatures: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: settings?.editorTabSize ?? 2,
    wordWrap: (settings?.editorWordWrap ?? true) ? 'on' : 'off',
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: 'gutter' as const,
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on' as const,
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
  }), [readOnly, settings])

  /** 编辑器主题 */
  const editorTheme = settings?.appearanceEditorTheme ?? 'vs-dark'

  return (
    <div className={cn('h-full w-full overflow-hidden', className)}>
      <Editor
        height={height}
        language={language === 'typescript' ? 'typescript' : language === 'vue' ? 'html' : 'javascript'}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={editorTheme}
        loading={loadingSkeleton}
        options={editorOptions}
      />
    </div>
  )
}
