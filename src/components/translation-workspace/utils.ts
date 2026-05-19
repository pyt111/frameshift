import type { Framework } from '@/lib/semantic-tree/types'

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** 获取翻译方向指示器 */
export function getDirectionIndicator(source: Framework, target: Framework): { from: string; to: string } {
  const frameworkIcon = (fw: Framework) => {
    switch (fw) {
      case 'react': return '⚛️'
      case 'vue3': return '💚'
      case 'angular': return '🅰️'
      default: return '📄'
    }
  }
  return {
    from: frameworkIcon(source),
    to: frameworkIcon(target),
  }
}

/** 统计源代码中的翻译单元数量（组件、指令、函数等） */
export function countTranslationUnits(code: string, framework: Framework): number {
  const lines = code.split('\n')
  let count = 0
  if (framework === 'react') {
    // React: 函数组件 + class 组件 + hooks
    for (const line of lines) {
      if (/^(export\s+)?(default\s+)?function\s+[A-Z]/.test(line.trim())) count++
      if (/^(const|let|var)\s+[A-Z]\w*\s*=/.test(line.trim())) count++
      if (/^(export\s+)?class\s+[A-Z]/.test(line.trim())) count++
      if (/^use[A-Z]\w*\s*\(/.test(line.trim())) count++
    }
  } else if (framework === 'vue3') {
    // Vue 3: <script setup>, <template>, defineComponent, composables
    if (code.includes('<template>')) count++
    if (code.includes('<script')) count++
    if (code.includes('<style')) count++
    for (const line of lines) {
      if (/^(export\s+)?(default\s+)?defineComponent/.test(line.trim())) count++
      if (/^const\s+\w+\s*=\s*(ref|reactive|computed)\b/.test(line.trim())) count++
      if (/^(export\s+)?function\s+use[A-Z]/.test(line.trim())) count++
    }
  } else if (framework === 'angular') {
    // Angular: @Component, @Directive, @Pipe, @Injectable, @NgModule
    for (const line of lines) {
      if (/@Component\s*\(/.test(line)) count++
      if (/@Directive\s*\(/.test(line)) count++
      if (/@Pipe\s*\(/.test(line)) count++
      if (/@Injectable\s*\(/.test(line)) count++
      if (/@NgModule\s*\(/.test(line)) count++
    }
  }
  return Math.max(count, 1) // 至少 1 个翻译单元
}

/** 从流式输出中提取代码块（前端版本，与后端 extractCodeBlock 相同逻辑） */
export function extractCodeBlockFromStream(response: string, lang: string): string {
  // 尝试匹配带语言标记的代码块
  const codeBlockRegex = new RegExp(`\`\`\`${lang}\\s*\\n([\\s\\S]*?)\`\`\``, 'i')
  const match = response.match(codeBlockRegex)
  if (match) {
    return match[1].trim()
  }

  // 尝试匹配不带语言标记的代码块
  const genericCodeBlockRegex = /```\s*\n([\s\S]*?)```/
  const genericMatch = response.match(genericCodeBlockRegex)
  if (genericMatch) {
    return genericMatch[1].trim()
  }

  // 没有代码块标记，返回原始响应
  return response.trim()
}

/**
 * 实时清除流式文本中的 Markdown 代码块标记
 * 用于在流式输出时给用户展示干净的代码，而非原始 Markdown
 *
 * 处理逻辑：
 * - 移除开头的 ```tsx / ```vue / ```typescript 等标记
 * - 移除结尾的 ``` 标记
 * - 保留中间内容
 */
export function stripStreamingCodeMarkers(text: string): string {
  let result = text
  // 移除开头的代码块标记（如 ```tsx\n 或 ```\n）
  result = result.replace(/^```[a-zA-Z]*\n?/, '')
  // 移除结尾的代码块标记
  result = result.replace(/\n?```\s*$/, '')
  return result
}

/** 根据框架获取编辑器语言 */
export function getEditorLanguage(framework: Framework): 'typescript' | 'vue' | 'javascript' {
  if (framework === 'react') return 'typescript'
  if (framework === 'vue3') return 'vue'
  if (framework === 'angular') return 'typescript'
  return 'typescript'
}
