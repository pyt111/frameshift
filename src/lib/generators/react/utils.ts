/**
 * React 代码生成器 - 工具函数
 */

import type {
  UISemanticTree,
  ReactiveStateNode,
  ComponentNode,
  ExpressionValue,
  VModelInfo,
  TranslationWarning,
} from '../../semantic-tree/types';

/** 生成结果 */
export interface ReactGenerateResult {
  /** 生成的 React 代码 */
  code: string;
  /** 样式代码 */
  styles: string;
  /** 额外 import 语句 */
  imports: string[];
  /** 翻译警告 */
  warnings: TranslationWarning[];
}

/** 缩进辅助函数 */
export function indent(level: number, code: string): string {
  const spaces = '  '.repeat(level);
  return code
    .split('\n')
    .map(line => (line.trim() ? spaces + line : ''))
    .join('\n');
}

/**
 * Vue 事件名转换为 React 事件名
 * @click -> onClick, @input -> onChange
 */
export function vueEventToReact(vueEventName: string): string {
  // 去除 @ 前缀
  const event = vueEventName.replace(/^@/, '');
  
  // 常用事件映射
  const eventMap: Record<string, string> = {
    click: 'onClick',
    input: 'onChange',
    change: 'onChange',
    submit: 'onSubmit',
    focus: 'onFocus',
    blur: 'onBlur',
    keydown: 'onKeyDown',
    keyup: 'onKeyUp',
    keypress: 'onKeyPress',
    mouseenter: 'onMouseEnter',
    mouseleave: 'onMouseLeave',
    mouseover: 'onMouseOver',
    mouseout: 'onMouseOut',
    dblclick: 'onDoubleClick',
    scroll: 'onScroll',
    dragstart: 'onDragStart',
    dragend: 'onDragEnd',
    dragover: 'onDragOver',
    drop: 'onDrop',
  };

  if (eventMap[event]) {
    return eventMap[event];
  }

  // 通用转换：click -> onClick, input -> onInput
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

/**
 * Vue 属性名转换为 React 属性名
 * class -> className, for -> htmlFor
 */
export function vuePropToReact(propName: string): string {
  // 去除 : 和 @ 前缀
  const name = propName.replace(/^[:@]/, '');
  
  const propMap: Record<string, string> = {
    class: 'className',
    for: 'htmlFor',
    tabindex: 'tabIndex',
    autofocus: 'autoFocus',
    autocomplete: 'autoComplete',
    readonly: 'readOnly',
    maxlength: 'maxLength',
    minlength: 'minLength',
    enctype: 'encType',
  };

  return propMap[name] || name;
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 根据 v-model 信息生成 React onChange 处理器代码
 * <input v-model="email"> → onChange={(e) => setEmail(e.target.value)}
 * <input type="number" v-model="count"> → onChange={(e) => setCount(Number(e.target.value))}
 * <textarea v-model="content"> → onChange={(e) => setContent(e.target.value)}
 * <select v-model="selected"> → onChange={(e) => setSelected(e.target.value)}
 */
export function generateVModelOnChange(vModelInfo: VModelInfo): string {
  const { setterName, tagName, inputType, modifiers } = vModelInfo;

  // 获取事件值路径
  // select 使用 e.target.value，textarea 使用 e.target.value，input 也用 e.target.value
  const valuePath = 'e.target.value';

  // 是否需要类型转换
  let setterArg = valuePath;

  // v-model.number 修饰符 或 type="number" 的 input → Number() 转换
  const isNumberInput = (inputType === 'number') || (modifiers?.includes('number'));
  if (isNumberInput) {
    setterArg = `Number(${valuePath})`;
  }

  // v-model.trim 修饰符 → trim() 处理
  if (modifiers?.includes('trim')) {
    if (setterArg !== valuePath) {
      // 已经有 Number() 包裹，先 trim 再 Number
      setterArg = `Number(${valuePath}.trim())`;
    } else {
      setterArg = `${valuePath}.trim()`;
    }
  }

  return `onChange={(e) => ${setterName}(${setterArg})}`;
}

/**
 * 收集语义树中所有 v-model 信息
 * 用于确保对应的 useState 已存在
 */
export function collectVModelInfos(tree: UISemanticTree): VModelInfo[] {
  const result: VModelInfo[] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'component') {
      const compNode = node as ComponentNode;
      if (compNode.vModelInfo) {
        result.push(compNode.vModelInfo);
      }
    }
  }
  return result;
}

/**
 * 在表达式中去除 Vue ref 的 .value 访问
 * 在 Vue 3 <script setup> 中，ref 通过 .value 访问，但 React 中使用普通变量
 * 例如: count.value * 2 → count * 2
 *       todos.value.filter(...) → todos.filter(...)
 *       email.value.includes('@') → email.includes('@')
 *
 * @param expression 原始表达式
 * @param refNames ref 变量名集合
 * @returns 去除了 .value 的表达式
 */
export function stripValueAccessForRefs(expression: string, refNames: Set<string>): string {
  let result = expression;
  for (const refName of refNames) {
    const escaped = escapeRegex(refName);
    // Match refName.value and replace with just refName
    const pattern = new RegExp(`(?<![a-zA-Z0-9_])${escaped}\\.value(?![a-zA-Z0-9_])`, 'g');
    result = result.replace(pattern, refName);
  }
  return result;
}

/**
 * 判断一个计算属性表达式是否需要用花括号包裹（即是否为多语句体）
 * 单表达式如 "count * 2" 不需要包裹
 * 多语句如 "const mins = ...; return `${mins}:${secs}`;" 需要包裹
 */
export function isBlockExpression(expression: string): boolean {
  const trimmed = expression.trim();
  // Check for return statement (multi-statement body)
  if (/\breturn\b/.test(trimmed)) return true;
  // Check for variable declarations (const, let, var)
  if (/\b(?:const|let|var)\s+/.test(trimmed)) return true;
  return false;
}

/**
 * 将 Vue 的 ref 变更转换为 React 的 setter 调用
 * Vue: count++ / count.value++ → React: setCount(c => c + 1)
 * Vue: count = val / count.value = val → React: setCount(val)
 */
export function convertVueRefMutations(tree: UISemanticTree, code: string): string {
  // 收集 ref/state 变量名及其 setter 名
  const refMap = new Map<string, string>(); // stateName → setterName
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      const stateNode = node as ReactiveStateNode;
      if (stateNode.stateKind === 'ref' || stateNode.stateKind === 'state') {
        const setterName = stateNode.setterName ||
          `set${stateNode.name.charAt(0).toUpperCase() + stateNode.name.slice(1)}`;
        refMap.set(stateNode.name, setterName);
      }
    }
  }

  if (refMap.size === 0) return code;

  let result = code;

  for (const [stateName, setterName] of refMap) {
    const escapedState = escapeRegex(stateName);

    // stateName.value++ → setterName(c => c + 1)
    result = result.replace(
      new RegExp(`${escapedState}\\.value\\+\\+`, 'g'),
      `${setterName}(c => c + 1)`
    );

    // stateName.value-- → setterName(c => c - 1)
    result = result.replace(
      new RegExp(`${escapedState}\\.value--`, 'g'),
      `${setterName}(c => c - 1)`
    );

    // stateName++ → setterName(c => c + 1)
    // 使用词边界确保不会匹配到如 count++ 在 someCount++ 中
    result = result.replace(
      new RegExp(`(?<![a-zA-Z0-9_.])${escapedState}\\+\\+(?![a-zA-Z0-9_])`, 'g'),
      `${setterName}(c => c + 1)`
    );

    // stateName-- → setterName(c => c - 1)
    result = result.replace(
      new RegExp(`(?<![a-zA-Z0-9_.])${escapedState}--(?![a-zA-Z0-9_])`, 'g'),
      `${setterName}(c => c - 1)`
    );

    // stateName.value = expr → setterName(expr) — 仅匹配简单赋值
    result = result.replace(
      new RegExp(`${escapedState}\\.value\\s*=\\s*([^;\n]+?)(?:;|\n)`, 'g'),
      (_match, expr: string) => `${setterName}(${expr.trim()})\n`
    );
  }

  return result;
}

/**
 * 获取属性值的字符串表示
 */
export function getPropValueString(value: string | ExpressionValue): string {
  if (typeof value === 'string') {
    return value;
  }
  return value.expression;
}

/**
 * 判断属性值是否为动态
 */
export function isDynamicValue(value: string | ExpressionValue): boolean {
  return typeof value !== 'string';
}
