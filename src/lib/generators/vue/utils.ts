/**
 * Vue 3 代码生成器 - 工具函数
 */

import type {
  UISemanticTree,
  ReactiveStateNode,
  ExpressionValue,
  TranslationWarning,
} from '../../semantic-tree/types';

/** 生成结果 */
export interface VueGenerateResult {
  /** 生成的 Vue 3 SFC 代码 */
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
 * 格式化回调函数体，去除可能的外层花括号并正确缩进多行代码
 * 用于将 parser 提取的 callbackBody 嵌入到 Vue 生成代码中
 */
export function formatCallbackBody(body: string, indentLevel: number = 1): string {
  let code = body.trim();
  // Strip outer braces if present (for backward compatibility with old parser output)
  if (code.startsWith('{') && code.endsWith('}')) {
    // Find matching closing brace
    let depth = 0;
    let matchEnd = -1;
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
      if (depth === 0) { matchEnd = i; break; }
    }
    if (matchEnd === code.length - 1) {
      // The outer braces encompass the entire string - strip them
      code = code.slice(1, -1).trim();
      // Dedent: find minimum indentation
      const lines = code.split('\n');
      const nonEmptyLines = lines.filter(l => l.trim().length > 0);
      const minIndent = nonEmptyLines.reduce((min, line) => {
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        return Math.min(min, indent);
      }, Infinity);
      if (minIndent < Infinity && minIndent > 0) {
        code = lines.map(l => l.length > 0 ? l.slice(minIndent) : l).join('\n').trim();
      }
    }
  }
  if (!code) return '// TODO';

  // If multi-line, indent each line
  const spaces = '  '.repeat(indentLevel);
  const lines = code.split('\n');
  if (lines.length > 1) {
    return lines.map(l => (l.trim() ? spaces + l : '')).join('\n');
  }
  return spaces + code;
}

/**
 * 将 JS/TS 类型名映射为 Vue prop 类型构造器
 * 'string' -> 'String', 'number' -> 'Number', 'object' -> 'Object', etc.
 */
export function toVuePropType(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    object: 'Object',
    array: 'Array',
    function: 'Function',
    any: 'Object',
    symbol: 'Symbol',
    bigint: 'BigInt',
  };
  return typeMap[type.toLowerCase()] ?? type;
}

/**
 * React 事件名转换为 Vue 事件名
 * onClick -> @click, onChange -> @input
 */
export function reactEventToVue(reactEventName: string): string {
  // 常用事件映射
  const eventMap: Record<string, string> = {
    onClick: '@click',
    onChange: '@input',
    onSubmit: '@submit.prevent',
    onInput: '@input',
    onFocus: '@focus',
    onBlur: '@blur',
    onKeyDown: '@keydown',
    onKeyUp: '@keyup',
    onMouseEnter: '@mouseenter',
    onMouseLeave: '@mouseleave',
    onDoubleClick: '@dblclick',
    onMouseOver: '@mouseover',
    onMouseOut: '@mouseout',
    onScroll: '@scroll',
    onDragStart: '@dragstart',
    onDragEnd: '@dragend',
    onDragOver: '@dragover',
    onDrop: '@drop',
  };

  if (eventMap[reactEventName]) {
    return eventMap[reactEventName];
  }

  // 通用转换：onClick -> @click
  if (reactEventName.startsWith('on')) {
    const eventName = reactEventName.slice(2);
    // 将驼峰转为 kebab-case
    const kebabName = eventName.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1);
    return `@${kebabName}`;
  }

  return reactEventName;
}

/**
 * React 属性名转换为 Vue 属性名
 * className -> class, htmlFor -> for
 */
export function reactPropToVue(propName: string): string {
  const propMap: Record<string, string> = {
    className: 'class',
    htmlFor: 'for',
    tabIndex: 'tabindex',
    autoFocus: 'autofocus',
    autoComplete: 'autocomplete',
    readOnly: 'readonly',
    maxLength: 'maxlength',
    minLength: 'minlength',
    encType: 'enctype',
  };

  return propMap[propName] || propName;
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * 在表达式中为 ref 变量添加 .value 访问
 * 在 Vue 3 <script setup> 中，ref 需要通过 .value 访问
 * 例如: count * 2 → count.value * 2
 *       todos.filter(...) → todos.value.filter(...)
 * 但不会处理已经有 .value 的情况: count.value → count.value（不重复添加）
 *
 * @param expression 原始表达式
 * @param refNames ref 变量名集合
 * @returns 添加了 .value 的表达式
 */
export function addValueAccessForRefs(expression: string, refNames: Set<string>): string {
  let result = expression;
  for (const refName of refNames) {
    const escaped = escapeRegex(refName);
    // Match refName that is:
    // - NOT preceded by a word character or dot (to avoid matching inside other identifiers like "setCount")
    // - NOT followed by .value (to avoid double-adding)
    // - NOT followed by a word character (to avoid matching inside longer identifiers)
    // We add .value after refName when it's followed by a property access (like .length) or an operator/end
    const pattern = new RegExp(
      `(?<![a-zA-Z0-9_.])${escaped}(?!\\.value)(?=\\s*[.\\[()\\s*,;:?+\\-*/&|!<>=)]|\\s*$)`,
      'g'
    );
    result = result.replace(pattern, `${refName}.value`);
  }
  return result;
}

/**
 * 将箭头函数体转换为 Vue ref 赋值表达式
 * 例如：(c) => c + 1 配合 ref='count' → count++
 */
export function convertArrowBody(param: string, body: string, ref: string): string {
  const trimmedBody = body.trim();
  // param + 1 → ref++
  if (trimmedBody === `${param} + 1`) return `${ref}++`;
  // param - 1 → ref--
  if (trimmedBody === `${param} - 1`) return `${ref}--`;
  // param + N → ref = ref + N
  const addMatch = trimmedBody.match(new RegExp(`^${escapeRegex(param)}\\s*\\+\\s*(\\d+)$`));
  if (addMatch) return `${ref} = ${ref} + ${addMatch[1]}`;
  // param - N → ref = ref - N
  const subMatch = trimmedBody.match(new RegExp(`^${escapeRegex(param)}\\s*-\\s*(\\d+)$`));
  if (subMatch) return `${ref} = ${ref} - ${subMatch[1]}`;
  // General: replace param references with ref in body
  const replacedBody = trimmedBody.replace(new RegExp(`\\b${escapeRegex(param)}\\b`, 'g'), ref);
  return `${ref} = ${replacedBody}`;
}

/**
 * 在代码中转换 React setter 调用为 Vue ref 赋值
 * @param code 要处理的代码
 * @param setterMap setter名 → state名 的映射
 * @param useValueAccess 是否使用 .value 访问（script 中需要，template 中不需要）
 */
export function convertSettersInCode(
  code: string,
  setterMap: Map<string, string>,
  useValueAccess: boolean
): string {
  let result = code;

  for (const [setterName, stateName] of setterMap) {
    const ref = useValueAccess ? `${stateName}.value` : stateName;
    const escapedSetter = escapeRegex(setterName);

    // Arrow function patterns: setterName((param) => expr) or setterName(param => expr)
    // \(? allows optional parens around the arrow param
    result = result.replace(
      new RegExp(`${escapedSetter}\\s*\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>\\s*([^)]+?)\\s*\\)`, 'g'),
      (_match, param: string, body: string) => convertArrowBody(param, body, ref)
    );

    // Direct value pattern: setterName(value) — no arrow function, no `=` or `>` in arg
    result = result.replace(
      new RegExp(`${escapedSetter}\\s*\\(\\s*([^)=>]+?)\\s*\\)`, 'g'),
      (_match, arg: string) => `${ref} = ${arg.trim()}`
    );
  }

  return result;
}

/**
 * 将 React 的 setter 调用转换为 Vue 的 ref 赋值
 * 在 Vue 3 模板中，ref 自动解包，不需要 .value
 * 在 Vue 3 <script setup> 中，需要使用 .value
 */
export function convertReactSetters(tree: UISemanticTree, code: string): string {
  // 收集 setter → state 映射（来自 React useState 节点）
  const setterMap = new Map<string, string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state' && node.stateKind === 'state') {
      const stateNode = node as ReactiveStateNode;
      if (stateNode.setterName) {
        setterMap.set(stateNode.setterName, stateNode.name);
      }
    }
  }

  if (setterMap.size === 0) return code;

  let result = code;

  // 分别处理 template 和 script 部分（ref 解包规则不同）
  const templateMatch = result.match(/(<template>)([\s\S]*?)(<\/template>)/);
  const scriptMatch = result.match(/(<script[^>]*>)([\s\S]*?)(<\/script>)/);

  // 处理 template 部分（ref 自动解包，不需要 .value）
  if (templateMatch) {
    let templateContent = templateMatch[2];
    templateContent = convertSettersInCode(templateContent, setterMap, false);
    result = result.replace(templateMatch[0], templateMatch[1] + templateContent + templateMatch[3]);
  }

  // 处理 script 部分（需要 .value）
  if (scriptMatch) {
    let scriptContent = scriptMatch[2];
    scriptContent = convertSettersInCode(scriptContent, setterMap, true);
    result = result.replace(scriptMatch[0], scriptMatch[1] + scriptContent + scriptMatch[3]);
  }

  return result;
}

/**
 * 修复 Vue 模板插值表达式的空格
 * {{count}} → {{ count }}
 */
export function fixInterpolationSpacing(code: string): string {
  return code.replace(/\{\{(.+?)\}\}/g, (_match, content: string) => {
    return `{{ ${content.trim()} }}`;
  });
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
