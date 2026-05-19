'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Zap, Flame, Mountain, FileCode2, ArrowRight, Clock, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ExampleComponent, Framework } from '@/lib/semantic-tree/types'
import { cn } from '@/lib/utils'

/** 示例视图组件 Props */
interface ExamplesViewProps {
  /** 点击示例后的回调，传入示例代码和框架 */
  onSelectExample: (code: string, framework: Framework) => void
  /** 额外的 className */
  className?: string
}

/** 难度图标和颜色配置 */
const DIFFICULTY_CONFIG = {
  basic: {
    icon: Zap,
    label: '基础',
    color: '#22c55e',
    bgClass: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20',
    stripeColor: 'bg-[#22c55e]',
  },
  intermediate: {
    icon: Flame,
    label: '中级',
    color: '#f97316',
    bgClass: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
    stripeColor: 'bg-[#f97316]',
  },
  advanced: {
    icon: Mountain,
    label: '高级',
    color: '#ef4444',
    bgClass: 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20',
    stripeColor: 'bg-[#ef4444]',
  },
}

/** 翻译历史记录类型（从 localStorage 读取） */
interface RecentTranslation {
  sourceFramework: Framework
  targetFramework: Framework
  sourceCodePreview: string
  timestamp: number
}

/** 从 localStorage 读取最近翻译记录 */
function getRecentTranslations(): RecentTranslation[] {
  try {
    const raw = localStorage.getItem('frameshift-history')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, 3).map((entry: { sourceFramework: Framework; targetFramework: Framework; sourceCodePreview: string; timestamp?: number }) => ({
      sourceFramework: entry.sourceFramework,
      targetFramework: entry.targetFramework,
      sourceCodePreview: entry.sourceCodePreview,
      timestamp: entry.timestamp ?? Date.now(),
    }))
  } catch {
    return []
  }
}

/** 占位示例数据（后续由 @/lib/examples 提供） */
const PLACEHOLDER_EXAMPLES: ExampleComponent[] = [
  {
    id: 'counter',
    name: 'Counter',
    description: '简单的计数器组件，展示状态管理和事件处理的基础模式。',
    difficulty: 'basic',
    tags: ['state', 'events', 'basic'],
    patterns: ['useState', 'event handler'],
    reactCode: `import React, { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <h2>计数: {count}</h2>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <button onClick={() => setCount(c => c - 1)}>-1</button>
    </div>
  );
}`,
    vueCode: `<template>
  <div class="counter">
    <h2>计数: {{ count }}</h2>
    <button @click="count++">+1</button>
    <button @click="count--">-1</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>`,
    angularCode: `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-counter',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div class="counter">
      <h2>计数: {{ count() }}</h2>
      <button (click)="increment()">+1</button>
      <button (click)="decrement()">-1</button>
    </div>
  \`
})
export class Counter {
  count = signal(0);

  increment() {
    this.count.update(c => c + 1);
  }

  decrement() {
    this.count.update(c => c - 1);
  }
}`,
  },
  {
    id: 'todo-list',
    name: 'TodoList',
    description: '待办事项列表，包含增删改查功能，演示列表渲染和表单交互。',
    difficulty: 'intermediate',
    tags: ['list', 'form', 'CRUD'],
    patterns: ['list rendering', 'form input', 'conditional rendering'],
    reactCode: `import React, { useState } from 'react';

export default function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, input.trim()]);
      setInput('');
    }
  };

  return (
    <div className="todo-list">
      <h2>待办事项</h2>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={addTodo}>添加</button>
      <ul>{todos.map((todo, i) => <li key={i}>{todo}</li>)}</ul>
    </div>
  );
}`,
    vueCode: `<template>
  <div class="todo-list">
    <h2>待办事项</h2>
    <input v-model="input" />
    <button @click="addTodo">添加</button>
    <ul><li v-for="(todo, i) in todos" :key="i">{{ todo }}</li></ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const todos = ref<string[]>([]);
const input = ref('');
const addTodo = () => { if (input.value.trim()) { todos.value.push(input.value.trim()); input.value = ''; } };
</script>`,
    angularCode: `import { Component, signal } from '@angular/core';
import { CommonModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \`
    <div class="todo-list">
      <h2>待办事项</h2>
      <input [(ngModel)]="input" (keydown.enter)="addTodo()" />
      <button (click)="addTodo()">添加</button>
      <ul>
        @for (todo of todos(); track $index) {
          <li>{{ todo }}</li>
        }
      </ul>
    </div>
  \`
})
export class TodoList {
  todos = signal<string[]>([]);
  input = signal('');

  addTodo() {
    if (this.input().trim()) {
      this.todos.update(t => [...t, this.input().trim()]);
      this.input.set('');
    }
  }
}`,
  },
  {
    id: 'timer',
    name: 'Timer',
    description: '计时器组件，展示 useEffect/onMounted 生命周期和定时器管理。',
    difficulty: 'intermediate',
    tags: ['lifecycle', 'timer', 'side-effect'],
    patterns: ['useEffect', 'cleanup', 'lifecycle'],
    reactCode: `import React, { useState, useEffect } from 'react';

export default function Timer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (isRunning) {
      const id = setInterval(() => setSeconds(s => s + 1), 1000);
      return () => clearInterval(id);
    }
  }, [isRunning]);

  return (
    <div className="timer">
      <h2>{seconds}s</h2>
      <button onClick={() => setIsRunning(!isRunning)}>{isRunning ? '暂停' : '开始'}</button>
    </div>
  );
}`,
    vueCode: `<template>
  <div class="timer">
    <h2>{{ seconds }}s</h2>
    <button @click="isRunning = !isRunning">{{ isRunning ? '暂停' : '开始' }}</button>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
const seconds = ref(0);
const isRunning = ref(false);
let intervalId = null;
watch(isRunning, (running) => {
  if (running) intervalId = setInterval(() => seconds.value++, 1000);
  else if (intervalId) clearInterval(intervalId);
});
onUnmounted(() => { if (intervalId) clearInterval(intervalId); });
</script>`,
  },
  {
    id: 'form-input',
    name: 'FormInput',
    description: '表单输入组件，包含验证逻辑和计算属性，展示双向绑定和派生状态。',
    difficulty: 'advanced',
    tags: ['form', 'validation', 'computed'],
    patterns: ['computed', 'form validation', 'derived state'],
    reactCode: `import React, { useState, useMemo } from 'react';

export default function FormInput() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isValid = useMemo(() => email.includes('@') && password.length >= 8, [email, password]);

  return (
    <form onSubmit={e => { e.preventDefault(); if (isValid) alert('提交成功!'); }}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit" disabled={!isValid}>提交</button>
    </form>
  );
}`,
    vueCode: `<template>
  <form @submit.prevent="handleSubmit">
    <input type="email" v-model="email" />
    <input type="password" v-model="password" />
    <button type="submit" :disabled="!isValid">提交</button>
  </form>
</template>

<script setup>
import { ref, computed } from 'vue';
const email = ref('');
const password = ref('');
const isValid = computed(() => email.value.includes('@') && password.value.length >= 8);
const handleSubmit = () => { if (isValid.value) alert('提交成功!'); };
</script>`,
  },
  {
    id: 'color-picker',
    name: 'ColorPicker',
    description: '颜色选择器组件，演示受控输入和派生样式的基础模式。',
    difficulty: 'basic',
    tags: ['state', 'style', 'input'],
    patterns: ['useState', 'inline styles', 'event handler'],
    reactCode: `import React, { useState } from 'react';

export default function ColorPicker() {
  const [color, setColor] = useState('#22c55e');
  return (
    <div className="color-picker">
      <div style={{ backgroundColor: color, width: 120, height: 120, borderRadius: 12 }} />
      <input type="color" value={color} onChange={e => setColor(e.target.value)} />
      <p>当前颜色: {color}</p>
    </div>
  );
}`,
    vueCode: `<template>
  <div class="color-picker">
    <div :style="{ backgroundColor: color, width: '120px', height: '120px', borderRadius: '12px' }" />
    <input type="color" v-model="color" />
    <p>当前颜色: {{ color }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const color = ref('#22c55e');
</script>`,
  },
  {
    id: 'accordion',
    name: 'Accordion',
    description: '手风琴/折叠面板组件，展示条件渲染、状态管理和 CSS 过渡动画。',
    difficulty: 'intermediate',
    tags: ['toggle', 'animation', 'layout'],
    patterns: ['conditional rendering', 'state management', 'CSS transitions'],
    reactCode: `import React, { useState } from 'react';

const ITEMS = [
  { title: '什么是 FrameShift？', content: 'FrameShift 是一个 AI 辅助的跨框架 UI 代码翻译器。' },
  { title: '支持哪些框架？', content: '目前支持 React 和 Vue 3 之间的双向翻译。' },
];

export default function Accordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="accordion">
      {ITEMS.map((item, index) => (
        <div key={index}>
          <button onClick={() => setOpenIndex(openIndex === index ? null : index)}>{item.title}</button>
          {openIndex === index && <div>{item.content}</div>}
        </div>
      ))}
    </div>
  );
}`,
    vueCode: `<template>
  <div class="accordion">
    <div v-for="(item, index) in items" :key="index">
      <button @click="openIndex = openIndex === index ? null : index">{{ item.title }}</button>
      <div v-if="openIndex === index">{{ item.content }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const items = [{ title: '什么是 FrameShift？', content: 'AI 辅助的跨框架 UI 代码翻译器。' }];
const openIndex = ref<number | null>(null);
</script>`,
  },
  {
    id: 'tabs',
    name: 'Tabs',
    description: '标签导航组件，展示不同内容面板的切换和活跃状态管理。',
    difficulty: 'intermediate',
    tags: ['navigation', 'content', 'tabs'],
    patterns: ['conditional rendering', 'active state', 'component composition'],
    reactCode: `import React, { useState } from 'react';

const TABS = [
  { label: '概览', content: '这是概览面板的内容。' },
  { label: '代码', content: '这是代码面板的内容。' },
];

export default function Tabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <div className="tabs">
      <div role="tablist">{TABS.map((tab, i) => (
        <button key={i} role="tab" aria-selected={activeIndex === i} onClick={() => setActiveIndex(i)}>{tab.label}</button>
      ))}</div>
      <div role="tabpanel">{TABS[activeIndex].content}</div>
    </div>
  );
}`,
    vueCode: `<template>
  <div class="tabs">
    <div role="tablist">
      <button v-for="(tab, i) in tabs" :key="i" role="tab" :aria-selected="activeIndex === i" @click="activeIndex = i">{{ tab.label }}</button>
    </div>
    <div role="tabpanel">{{ tabs[activeIndex].content }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const tabs = [{ label: '概览', content: '这是概览面板的内容。' }];
const activeIndex = ref(0);
</script>`,
  },
  {
    id: 'modal',
    name: 'Modal',
    description: '模态对话框组件，含遮罩层、关闭按钮和键盘支持，展示 useEffect 和无障碍模式。',
    difficulty: 'advanced',
    tags: ['portal', 'dialog', 'overlay'],
    patterns: ['useEffect', 'event listener', 'portal pattern', 'accessibility'],
    reactCode: `import React, { useState, useEffect, useCallback } from 'react';

export default function Modal() {
  const [isOpen, setIsOpen] = useState(false);
  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); }, []);
  useEffect(() => {
    if (isOpen) { document.addEventListener('keydown', handleKeyDown); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', handleKeyDown); document.body.style.overflow = ''; };
  }, [isOpen, handleKeyDown]);

  return (
    <div className="modal-demo">
      <button onClick={() => setIsOpen(true)}>打开对话框</button>
      {isOpen && <div role="dialog" aria-modal="true" onClick={() => setIsOpen(false)}>
        <div onClick={e => e.stopPropagation()}><h3>对话框标题</h3><button onClick={() => setIsOpen(false)}>关闭</button></div>
      </div>}
    </div>
  );
}`,
    vueCode: `<template>
  <div class="modal-demo">
    <button @click="isOpen = true">打开对话框</button>
    <div v-if="isOpen" role="dialog" aria-modal="true" @click.self="isOpen = false">
      <div @click.stop><h3>对话框标题</h3><button @click="isOpen = false">关闭</button></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
const isOpen = ref(false);
const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') isOpen.value = false; };
onMounted(() => document.addEventListener('keydown', handleKeyDown));
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown));
</script>`,
  },
]

/** 难度筛选类型 */
type DifficultyFilter = 'all' | 'basic' | 'intermediate' | 'advanced'

/** 骨架卡片组件 */
function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--app-border)] overflow-hidden">
      <div className="h-1 w-full bg-[var(--app-border)]" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-[var(--app-hover-bg)] rounded animate-pulse" />
          <div className="h-5 w-12 bg-[var(--app-hover-bg)] rounded-full animate-pulse" />
        </div>
        <div className="h-3 w-full bg-[var(--app-hover-bg)] rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-[var(--app-hover-bg)] rounded animate-pulse" />
        <div className="flex gap-1.5">
          <div className="h-4 w-10 bg-[var(--app-hover-bg)] rounded animate-pulse" />
          <div className="h-4 w-12 bg-[var(--app-hover-bg)] rounded animate-pulse" />
          <div className="h-4 w-8 bg-[var(--app-hover-bg)] rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/**
 * 示例视图组件
 * 展示示例组件画廊，支持按难度筛选和搜索
 * 增强版：悬停动画、点击试用遮罩、颜色条纹、搜索聚焦动画
 * 新增：最近翻译记录、骨架屏加载、预览弹窗、筛选动画
 */
export function ExamplesView({ onSelectExample, className }: ExamplesViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all')
  const [searchFocused, setSearchFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [recentTranslations] = useState<RecentTranslation[]>(() => getRecentTranslations())
  const [previewExample, setPreviewExample] = useState<ExampleComponent | null>(null)

  /** 模拟骨架屏加载 */
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  /** 过滤后的示例列表 */
  const filteredExamples = useMemo(() => {
    return PLACEHOLDER_EXAMPLES.filter((example) => {
      // 搜索过滤
      const matchesSearch =
        !searchQuery.trim() ||
        example.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        example.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        example.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      // 难度过滤
      const matchesDifficulty = difficultyFilter === 'all' || example.difficulty === difficultyFilter

      return matchesSearch && matchesDifficulty
    })
  }, [searchQuery, difficultyFilter])

  return (
    <div className={cn('p-6 max-w-5xl mx-auto', className)}>
      {/* 页面标题 */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold text-[var(--app-text)] mb-2">示例组件</h2>
        <p className="text-sm text-[var(--app-text-secondary)]">选择一个示例组件，快速体验跨框架翻译功能</p>
      </motion.div>

      {/* 最近翻译记录 */}
      {recentTranslations.length > 0 && (
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5 text-[var(--app-text-muted)]" />
            <span className="text-xs font-medium text-[var(--app-text-secondary)]">最近翻译</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentTranslations.map((entry, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="shrink-0"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--app-hover-bg)] border border-[var(--app-border)] text-xs text-[var(--app-text-secondary)]">
                  <span className="font-medium">{entry.sourceFramework === 'react' ? '⚛️' : '💚'}</span>
                  <span>→</span>
                  <span className="font-medium">{entry.targetFramework === 'react' ? '⚛️' : '💚'}</span>
                  <span className="text-[var(--app-text-muted)] truncate max-w-[120px]">{entry.sourceCodePreview}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 搜索和筛选栏 */}
      <motion.div
        className="flex flex-col sm:flex-row gap-3 mb-6"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* 搜索框 - 聚焦动画增强 */}
        <div className="relative flex-1">
          <Search className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200',
            searchFocused ? 'text-[#22c55e]' : 'text-[var(--app-text-muted)]',
          )} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="搜索示例..."
            className={cn(
              'pl-9 bg-[var(--app-hover-bg)] border-[var(--app-border)] text-[var(--app-text)] placeholder-[var(--app-text-muted)] transition-all duration-200',
              searchFocused
                ? 'border-[#22c55e]/50 shadow-[0_0_0_2px_rgba(34,197,94,0.1)]'
                : 'focus:border-[#22c55e]/50',
            )}
          />
        </div>

        {/* 难度筛选按钮 */}
        <div className="flex gap-2">
          {(['all', 'basic', 'intermediate', 'advanced'] as DifficultyFilter[]).map((level) => {
            const config = level === 'all'
              ? { label: '全部', bgClass: 'bg-[var(--app-border)] text-[var(--app-text)] border-[var(--app-border)]' }
              : DIFFICULTY_CONFIG[level]

            return (
              <Button
                key={level}
                variant="outline"
                size="sm"
                onClick={() => setDifficultyFilter(level)}
                className={cn(
                  'text-xs transition-all',
                  difficultyFilter === level
                    ? config.bgClass
                    : 'bg-transparent border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                )}
              >
                {config.label}
              </Button>
            )
          })}
        </div>
      </motion.div>

      {/* 示例卡片网格 */}
      <ScrollArea className="h-[calc(100vh-340px)]">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            /* 骨架屏加载 */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={`skeleton-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <SkeletonCard />
                </motion.div>
              ))}
            </div>
          ) : filteredExamples.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
              {filteredExamples.map((example, index) => {
                const difficultyConfig = DIFFICULTY_CONFIG[example.difficulty]
                const DifficultyIcon = difficultyConfig.icon

                return (
                  <motion.div
                    key={example.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  >
                    <Card className="bg-[var(--app-bg-secondary)] border-[var(--app-border)] hover:border-[#22c55e]/30 cursor-pointer transition-all duration-300 group relative overflow-hidden">
                      {/* 顶部颜色条纹 - 匹配难度级别 */}
                      <div className={cn('h-1 w-full', difficultyConfig.stripeColor)} />

                      {/* 悬停时的「点击试用」遮罩 */}
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--app-bg)]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <motion.div
                          className="flex items-center gap-2 text-[#22c55e] text-sm font-medium"
                          initial={false}
                          animate={{ scale: [0.9, 1], opacity: [0, 1] }}
                          transition={{ duration: 0.2 }}
                        >
                          <FileCode2 className="h-4 w-4" />
                          <span>点击试用</span>
                          <ArrowRight className="h-4 w-4" />
                        </motion.div>
                      </div>

                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-[var(--app-text)] text-base group-hover:text-[#22c55e] transition-colors">
                              {example.name}
                            </CardTitle>
                            {/* 预览弹窗 */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPreviewExample(previewExample?.id === example.id ? null : example)
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-72 bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text)] p-3 z-50"
                                side="left"
                              >
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-[var(--app-text-secondary)]">React 代码预览</p>
                                  <pre className="text-[10px] text-[var(--app-text)] bg-[var(--app-hover-bg)] rounded p-2 overflow-x-auto max-h-32 font-mono">
                                    <code>{example.reactCode.slice(0, 200)}{example.reactCode.length > 200 ? '...' : ''}</code>
                                  </pre>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] h-5 gap-1', difficultyConfig.bgClass)}
                          >
                            <DifficultyIcon className="h-3 w-3" />
                            {difficultyConfig.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent onClick={() => onSelectExample(example.reactCode, 'react')}>
                        <CardDescription className="text-[var(--app-text-secondary)] text-sm mb-3">
                          {example.description}
                        </CardDescription>
                        {/* 标签列表 */}
                        <div className="flex flex-wrap gap-1.5">
                          {example.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[10px] h-4 bg-[var(--app-hover-bg)] text-[var(--app-text-secondary)] border-[var(--app-border)]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        {/* 模式列表 */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {example.patterns.map((pattern) => (
                            <span
                              key={pattern}
                              className="text-[10px] text-[#22c55e]/70 bg-[#22c55e]/5 px-1.5 py-0.5 rounded"
                            >
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              className="flex flex-col items-center justify-center py-16 text-[var(--app-text-muted)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Search className="h-8 w-8 mb-3 opacity-50" />
              <p className="text-sm">未找到匹配的示例</p>
              <p className="text-xs text-[var(--app-text-muted)] mt-1">请尝试不同的搜索词或筛选条件</p>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  )
}
