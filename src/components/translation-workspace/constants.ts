import type { Framework } from '@/lib/semantic-tree/types'

/** 加载步骤序列（AI 开启版本） */
export const LOADING_STEPS_WITH_AI = [
  '正在解析源代码...',
  '正在构建语义树...',
  '正在生成目标代码...',
  '正在 AI 辅助优化...',
]

/** 加载步骤序列（AI 关闭版本） */
export const LOADING_STEPS_WITHOUT_AI = [
  '正在解析源代码...',
  '正在构建语义树...',
  '正在生成目标代码...',
  '正在校验翻译结果...',
]

/** React 默认示例代码 */
export const DEFAULT_REACT_CODE = `import React, { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => prev - 1);

  return (
    <div className="counter">
      <h2>计数器: {count}</h2>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
    </div>
  );
}`

/** Vue 3 默认示例代码 */
export const DEFAULT_VUE_CODE = `<template>
  <div class="counter">
    <h2>计数器: {{ count }}</h2>
    <button @click="increment">+1</button>
    <button @click="decrement">-1</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);

const increment = () => count.value++;
const decrement = () => count.value--;
</script>`

/** Angular 默认示例代码 */
export const DEFAULT_ANGULAR_CODE = [
  "import { Component, signal } from '@angular/core';",
  "import { CommonModule } from '@angular/common';",
  '',
  '@Component({',
  "  selector: 'app-counter',",
  '  standalone: true,',
  '  imports: [CommonModule],',
  '  template: \x60',
    '<div class="counter">',
      '<h2>计数器: {{ count() }}</h2>',
      '<button (click)="increment()">+1</button>',
      '<button (click)="decrement()">-1</button>',
    '</div>',
  '  \x60,',
  'export class Counter {',
  '  count = signal(0);',
  '',
  '  increment() {',
  '    this.count.update(c => c + 1);',
  '  }',
  '',
  '  decrement() {',
  '    this.count.update(c => c - 1);',
  '  }',
  '}',
].join('\n')

/** 框架代码块语言标记（用于流式输出提取代码块） */
export const FRAMEWORK_LANG: Record<Framework, string> = {
  react: 'tsx',
  vue3: 'vue',
  angular: 'typescript',
}
