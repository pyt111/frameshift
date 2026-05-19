/**
 * 框架 API 等价映射表
 * 定义 React 和 Vue 3 之间的 API 等价关系
 */

import type { Framework } from '../semantic-tree/types';

/** API 映射条目 */
interface ApiMapping {
  /** 源框架 API 名称 */
  source: string;
  /** 目标框架等价 API */
  target: string;
  /** 映射置信度 0-1 */
  confidence: number;
  /** 映射说明 */
  description: string;
  /** 是否需要额外转换步骤 */
  needsTransformation: boolean;
  /** 转换函数说明 */
  transformationNotes?: string;
}

/** React → Vue 3 映射表 */
const REACT_TO_VUE_MAPPINGS: ApiMapping[] = [
  // 状态管理
  {
    source: 'useState',
    target: 'ref',
    confidence: 0.95,
    description: 'React useState → Vue 3 ref',
    needsTransformation: false,
  },
  {
    source: 'useState (object)',
    target: 'reactive',
    confidence: 0.85,
    description: 'React useState (对象值) → Vue 3 reactive',
    needsTransformation: true,
    transformationNotes: '当 useState 的初始值为对象时，可考虑使用 reactive',
  },
  {
    source: 'useReducer',
    target: 'ref + 自定义逻辑',
    confidence: 0.6,
    description: 'React useReducer 无直接等价，需手动转换为 ref + 自定义更新逻辑',
    needsTransformation: true,
    transformationNotes: '需手动实现 reducer 逻辑',
  },

  // 计算属性
  {
    source: 'useMemo',
    target: 'computed',
    confidence: 0.9,
    description: 'React useMemo → Vue 3 computed',
    needsTransformation: false,
  },

  // 副作用
  {
    source: 'useEffect',
    target: 'watch / onMounted',
    confidence: 0.7,
    description: 'React useEffect → Vue 3 watch 或 onMounted，取决于依赖项',
    needsTransformation: true,
    transformationNotes: '空依赖 → onMounted；有依赖 → watch；有返回函数 → onUnmounted',
  },
  {
    source: 'useEffect (empty deps)',
    target: 'onMounted + onUnmounted',
    confidence: 0.85,
    description: 'React useEffect([]) → Vue 3 onMounted，清理函数 → onUnmounted',
    needsTransformation: true,
  },
  {
    source: 'useEffect (with deps)',
    target: 'watch',
    confidence: 0.8,
    description: 'React useEffect([deps]) → Vue 3 watch(deps, callback)',
    needsTransformation: true,
  },
  {
    source: 'useLayoutEffect',
    target: 'onMounted / watch (flush: sync)',
    confidence: 0.65,
    description: 'React useLayoutEffect → Vue 3 watch with flush: sync',
    needsTransformation: true,
  },

  // Refs
  {
    source: 'useRef',
    target: 'ref (template ref) / shallowRef',
    confidence: 0.75,
    description: 'React useRef → Vue 3 ref (用于 DOM 引用) 或 shallowRef',
    needsTransformation: true,
    transformationNotes: 'DOM ref 使用 template ref 模式；值 ref 使用 shallowRef',
  },

  // 上下文
  {
    source: 'useContext',
    target: 'inject',
    confidence: 0.7,
    description: 'React useContext → Vue 3 inject（需要在祖先用 provide）',
    needsTransformation: true,
    transformationNotes: '需要检查是否有对应的 Provider/provide',
  },

  // 事件处理
  {
    source: 'onClick',
    target: '@click',
    confidence: 0.95,
    description: 'React onClick → Vue 3 @click',
    needsTransformation: false,
  },
  {
    source: 'onChange',
    target: '@input / @change',
    confidence: 0.8,
    description: 'React onChange → Vue 3 @input (实时) 或 @change (变更后)',
    needsTransformation: true,
    transformationNotes: 'React 的 onChange 在 Vue 中更接近 @input',
  },
  {
    source: 'onSubmit',
    target: '@submit.prevent',
    confidence: 0.9,
    description: 'React onSubmit → Vue 3 @submit.prevent',
    needsTransformation: false,
  },
  {
    source: 'onInput',
    target: '@input',
    confidence: 0.95,
    description: 'React onInput → Vue 3 @input',
    needsTransformation: false,
  },
  {
    source: 'onFocus',
    target: '@focus',
    confidence: 0.95,
    description: 'React onFocus → Vue 3 @focus',
    needsTransformation: false,
  },
  {
    source: 'onBlur',
    target: '@blur',
    confidence: 0.95,
    description: 'React onBlur → Vue 3 @blur',
    needsTransformation: false,
  },
  {
    source: 'onKeyDown',
    target: '@keydown',
    confidence: 0.95,
    description: 'React onKeyDown → Vue 3 @keydown',
    needsTransformation: false,
  },
  {
    source: 'onKeyUp',
    target: '@keyup',
    confidence: 0.95,
    description: 'React onKeyUp → Vue 3 @keyup',
    needsTransformation: false,
  },
  {
    source: 'onMouseEnter',
    target: '@mouseenter',
    confidence: 0.95,
    description: 'React onMouseEnter → Vue 3 @mouseenter',
    needsTransformation: false,
  },
  {
    source: 'onMouseLeave',
    target: '@mouseleave',
    confidence: 0.95,
    description: 'React onMouseLeave → Vue 3 @mouseleave',
    needsTransformation: false,
  },

  // 属性映射
  {
    source: 'className',
    target: 'class',
    confidence: 1.0,
    description: 'React className → Vue 3 class',
    needsTransformation: false,
  },
  {
    source: 'htmlFor',
    target: 'for',
    confidence: 1.0,
    description: 'React htmlFor → Vue 3 for',
    needsTransformation: false,
  },
  {
    source: 'style (object)',
    target: ':style (object)',
    confidence: 0.9,
    description: 'React style 对象 → Vue 3 :style 对象（camelCase 相同）',
    needsTransformation: false,
  },
  {
    source: 'dangerouslySetInnerHTML',
    target: 'v-html',
    confidence: 0.85,
    description: 'React dangerouslySetInnerHTML → Vue 3 v-html',
    needsTransformation: true,
    transformationNotes: '语法不同：__html 属性 → v-html 指令',
  },

  // 条件渲染
  {
    source: 'ternary (? :) ',
    target: 'v-if / v-else',
    confidence: 0.85,
    description: 'React 三元表达式 → Vue 3 v-if/v-else',
    needsTransformation: true,
  },
  {
    source: '&& (logical and)',
    target: 'v-if',
    confidence: 0.9,
    description: 'React && 条件渲染 → Vue 3 v-if',
    needsTransformation: true,
  },

  // 列表渲染
  {
    source: '.map()',
    target: 'v-for',
    confidence: 0.85,
    description: 'React .map() → Vue 3 v-for',
    needsTransformation: true,
    transformationNotes: '需要添加 :key 绑定',
  },
];

/** Vue 3 → React 映射表 */
const VUE_TO_REACT_MAPPINGS: ApiMapping[] = [
  // 状态管理
  {
    source: 'ref',
    target: 'useState',
    confidence: 0.95,
    description: 'Vue 3 ref → React useState',
    needsTransformation: false,
  },
  {
    source: 'reactive',
    target: 'useState (object)',
    confidence: 0.8,
    description: 'Vue 3 reactive → React useState（对象值）',
    needsTransformation: true,
    transformationNotes: '需要将 reactive 对象转为 useState 的对象状态，更新需用展开运算符',
  },

  // 计算属性
  {
    source: 'computed',
    target: 'useMemo',
    confidence: 0.9,
    description: 'Vue 3 computed → React useMemo',
    needsTransformation: false,
  },

  // 副作用
  {
    source: 'watch',
    target: 'useEffect',
    confidence: 0.75,
    description: 'Vue 3 watch → React useEffect',
    needsTransformation: true,
    transformationNotes: '需要将 watch 的源和回调转为 useEffect 的依赖和回调',
  },
  {
    source: 'watchEffect',
    target: 'useEffect',
    confidence: 0.6,
    description: 'Vue 3 watchEffect → React useEffect（自动追踪依赖）',
    needsTransformation: true,
    transformationNotes: 'watchEffect 自动追踪依赖，在 React 中需手动指定',
  },
  {
    source: 'onMounted',
    target: 'useEffect (empty deps)',
    confidence: 0.9,
    description: 'Vue 3 onMounted → React useEffect([])',
    needsTransformation: false,
  },
  {
    source: 'onUnmounted',
    target: 'useEffect cleanup',
    confidence: 0.9,
    description: 'Vue 3 onUnmounted → React useEffect 返回的清理函数',
    needsTransformation: true,
    transformationNotes: '需合并到 useEffect 的返回函数中',
  },

  // 事件处理
  {
    source: '@click',
    target: 'onClick',
    confidence: 0.95,
    description: 'Vue 3 @click → React onClick',
    needsTransformation: false,
  },
  {
    source: '@input',
    target: 'onChange',
    confidence: 0.8,
    description: 'Vue 3 @input → React onChange',
    needsTransformation: true,
  },
  {
    source: '@submit.prevent',
    target: 'onSubmit + e.preventDefault()',
    confidence: 0.9,
    description: 'Vue 3 @submit.prevent → React onSubmit + 手动 preventDefault',
    needsTransformation: true,
  },

  // 指令映射
  {
    source: 'v-if',
    target: '&& 或 三元表达式',
    confidence: 0.9,
    description: 'Vue 3 v-if → React && 条件渲染',
    needsTransformation: true,
  },
  {
    source: 'v-else',
    target: ': 三元表达式',
    confidence: 0.85,
    description: 'Vue 3 v-else → React 三元表达式',
    needsTransformation: true,
  },
  {
    source: 'v-for',
    target: '.map()',
    confidence: 0.85,
    description: 'Vue 3 v-for → React .map()',
    needsTransformation: true,
  },
  {
    source: 'v-model',
    target: 'value + onChange',
    confidence: 0.85,
    description: 'Vue 3 v-model → React value + onChange 受控组件',
    needsTransformation: true,
  },
  {
    source: 'v-html',
    target: 'dangerouslySetInnerHTML',
    confidence: 0.85,
    description: 'Vue 3 v-html → React dangerouslySetInnerHTML',
    needsTransformation: true,
  },
  {
    source: 'v-show',
    target: 'style.display',
    confidence: 0.9,
    description: 'Vue 3 v-show → React style={{ display }}',
    needsTransformation: true,
  },

  // 属性映射
  {
    source: 'class',
    target: 'className',
    confidence: 1.0,
    description: 'Vue 3 class → React className',
    needsTransformation: false,
  },
  {
    source: 'for',
    target: 'htmlFor',
    confidence: 1.0,
    description: 'Vue 3 for → React htmlFor',
    needsTransformation: false,
  },

  // Props
  {
    source: 'defineProps',
    target: 'Props interface + 函数参数',
    confidence: 0.85,
    description: 'Vue 3 defineProps → React Props 接口定义 + 函数参数解构',
    needsTransformation: true,
  },
  {
    source: 'defineEmits',
    target: 'Props 回调函数',
    confidence: 0.7,
    description: 'Vue 3 defineEmits → React 通过 Props 传递回调函数',
    needsTransformation: true,
    transformationNotes: '需要将 emit 事件转为回调 prop',
  },
];

/**
 * 获取映射表
 */
function getMappings(from: Framework, to: Framework): ApiMapping[] {
  if (from === 'react' && to === 'vue3') {
    return REACT_TO_VUE_MAPPINGS;
  }
  if (from === 'vue3' && to === 'react') {
    return VUE_TO_REACT_MAPPINGS;
  }
  return [];
}

/**
 * 查找特定 API 的映射
 */
export function findMapping(
  apiName: string,
  from: Framework,
  to: Framework
): ApiMapping | undefined {
  const mappings = getMappings(from, to);
  return mappings.find(
    m => m.source.toLowerCase() === apiName.toLowerCase()
  );
}
