/**
 * AI 模块共享常量和翻译规则
 */

import type { Framework } from '../semantic-tree/types';

/** 框架标签映射 */
export const FRAMEWORK_LABELS: Record<Framework, string> = {
  react: 'React (JSX/TSX)',
  vue3: 'Vue 3 (SFC)',
  angular: 'Angular (TypeScript)',
};

/** 框架代码块语言标记（导出供流式 API 使用） */
export const FRAMEWORK_LANG: Record<Framework, string> = {
  react: 'tsx',
  vue3: 'vue',
  angular: 'typescript',
};

/**
 * 构建翻译规则提示
 */
export function buildTranslationRules(from: Framework, to: Framework): string {
  const rules: string[] = [];

  // Vue → React 规则
  if (from === 'vue3' && to === 'react') {
    rules.push(`### Vue 3 → React 转换规则
- \`<script setup>\` → 函数组件内部逻辑
- \`ref(value)\` → \`useState(value)\`，变量名保持不变，自动生成 setter
- \`reactive(obj)\` → \`useState(obj)\`，使用展开运算符更新
- \`computed(() => expr)\` → \`useMemo(() => expr, [deps])\`
- \`watch(source, callback)\` → \`useEffect(() => { callback }, [source])\`
- \`watchEffect(fn)\` → \`useEffect(fn)\`，需手动指定依赖
- \`onMounted(fn)\` → \`useEffect(fn, [])\`
- \`onUnmounted(fn)\` → \`useEffect(() => () => fn(), [])\`
- \`v-model="var"\` → \`value={var} onChange={(e) => setVar(e.target.value)}\`
- \`v-if="cond"\` → \`{cond && <Element />}\` 或三元表达式
- \`v-for="item in list"\` → \`{list.map((item) => <Element />)}\`
- \`@click="handler"\` → \`onClick={handler}\`
- \`:class="expr"\` → \`className={expr}\`
- \`class="str"\` → \`className="str"\`
- \`{{ expression }}\` → \`{expression}\`
- \`<template>\` 内容 → JSX return 语句
- \`defineProps\` → 函数组件的 props 参数
- \`defineEmits\` → 回调 props (onXxx)
- 第三方 UI 组件库（如 Element Plus）保持原样引用
- Vue 的 \`h()\` 渲染函数 → JSX 语法
- \`<slot>\` → props.children 或 render props
- 保留所有自定义 composable 的调用逻辑`);
  }

  // React → Vue 规则
  if (from === 'react' && to === 'vue3') {
    rules.push(`### React → Vue 3 转换规则
- 函数组件 → \`<script setup>\` + \`<template>\`
- \`useState(value)\` → \`ref(value)\`
- \`useMemo(() => expr, [deps])\` → \`computed(() => expr)\`
- \`useEffect(fn, [deps])\` → \`watch(deps, fn)\`
- \`useEffect(fn, [])\` → \`onMounted(fn)\`
- \`value={var} onChange={(e) => setVar(e.target.value)}\` → \`v-model="var"\`
- \`{cond && <Element />}\` → \`v-if="cond"\`
- \`{list.map((item) => <Element />)}\` → \`v-for="item in list"\`
- \`onClick={handler}\` → \`@click="handler"\`
- \`className={expr}\` → \`:class="expr"\`
- \`className="str"\` → \`class="str"\`
- \`{expression}\` → \`{{ expression }}\`
- Props → \`defineProps\`
- 回调 props → \`defineEmits\`
- 第三方 React UI 库替换为 Vue 等价库`);
  }

  // Angular → React 规则
  if (from === 'angular' && to === 'react') {
    rules.push(`### Angular → React 转换规则
- \`@Component\` → 函数组件
- \`signal(value)\` → \`useState(value)\`
- \`computed(() => expr)\` → \`useMemo(() => expr, [deps])\`
- \`effect(fn)\` → \`useEffect(fn, [])\`
- 模板语法 → JSX
- \`(click)="handler()"\` → \`onClick={handler}\`
- \`[ngClass]="expr"\` → \`className={expr}\`
- \`*ngIf="cond"\` → \`{cond && <Element />}\`
- \`*ngFor="let item of list"\` → \`{list.map((item) => <Element />)}\`
- \`@Input()\` → Props
- \`@Output()\` → 回调 props`);
  }

  // Angular → Vue 规则
  if (from === 'angular' && to === 'vue3') {
    rules.push(`### Angular → Vue 3 转换规则
- \`@Component\` → \`<script setup>\` + \`<template>\`
- \`signal(value)\` → \`ref(value)\`
- \`computed(() => expr)\` → \`computed(() => expr)\`
- 模板语法 → Vue 模板
- \`(click)="handler()"\` → \`@click="handler()"\`
- \`[ngClass]="expr"\` → \`:class="expr"\`
- \`*ngIf="cond"\` → \`v-if="cond"\`
- \`*ngFor="let item of list"\` → \`v-for="item in list"\`
- \`@Input()\` → \`defineProps\`
- \`@Output()\` → \`defineEmits\``);
  }

  // Vue → Angular 规则
  if (from === 'vue3' && to === 'angular') {
    rules.push(`### Vue 3 → Angular 转换规则
- \`<script setup>\` → Angular 组件类
- \`ref(value)\` → \`signal(value)\`
- \`computed(() => expr)\` → \`computed(() => expr)\`
- \`v-model\` → 双向绑定 \`[(ngModel)]\`
- \`v-if\` → \`*ngIf\`
- \`v-for\` → \`*ngFor\`
- \`@click\` → \`(click)\`
- \`:class\` → \`[ngClass]\`
- Props → \`@Input()\`
- Emits → \`@Output()\``);
  }

  // React → Angular 规则
  if (from === 'react' && to === 'angular') {
    rules.push(`### React → Angular 转换规则
- 函数组件 → Angular 组件类
- \`useState(value)\` → \`signal(value)\`
- \`useMemo(() => expr)\` → \`computed(() => expr)\`
- \`useEffect\` → 生命周期方法
- JSX → Angular 模板
- \`onClick\` → \`(click)\`
- \`className\` → \`class\` 或 \`[ngClass]\`
- Props → \`@Input()\`
- 回调 props → \`@Output()\``);
  }

  return rules.join('\n\n');
}
