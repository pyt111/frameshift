/**
 * Angular 代码生成器 — 工具函数与类型定义
 */

import type {
  ExpressionValue,
  TranslationWarning,
} from '../../semantic-tree/types';

/** 生成结果 */
export interface AngularGenerateResult {
  /** 生成的 Angular 组件代码 */
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
 */
export function formatCallbackBody(body: string, indentLevel: number = 2): string {
  let code = body.trim();
  if (code.startsWith('{') && code.endsWith('}')) {
    let depth = 0;
    let matchEnd = -1;
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
      if (depth === 0) { matchEnd = i; break; }
    }
    if (matchEnd === code.length - 1) {
      code = code.slice(1, -1).trim();
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

  const spaces = '  '.repeat(indentLevel);
  const lines = code.split('\n');
  if (lines.length > 1) {
    return lines.map(l => (l.trim() ? spaces + l : '')).join('\n');
  }
  return spaces + code;
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将组件名转换为 Angular selector 格式
 * e.g. "Counter" → "app-counter", "TodoList" → "app-todo-list"
 */
export function toAngularSelector(componentName: string): string {
  // Remove "Component" suffix if present
  let name = componentName.replace(/Component$/, '');
  // Convert PascalCase to kebab-case
  const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `app-${kebab}`;
}

/**
 * React/Vue 事件名转换为 Angular 事件名
 * onClick → (click), onChange → (change), @click → (click)
 */
export function toAngularEvent(eventName: string): string {
  // Handle @event syntax (from Vue)
  if (eventName.startsWith('@')) {
    const evt = eventName.slice(1);
    // Handle modifiers like .enter, .prevent
    const parts = evt.split('.');
    return `(${parts[0]})`;
  }

  // Handle React onEvent syntax
  const eventMap: Record<string, string> = {
    onClick: '(click)',
    onChange: '(change)',
    onSubmit: '(ngSubmit)',
    onInput: '(input)',
    onFocus: '(focus)',
    onBlur: '(blur)',
    onKeyDown: '(keydown)',
    onKeyUp: '(keyup)',
    onKeyPress: '(keypress)',
    onMouseEnter: '(mouseenter)',
    onMouseLeave: '(mouseleave)',
    onDoubleClick: '(dblclick)',
    onMouseOver: '(mouseover)',
    onMouseOut: '(mouseout)',
    onScroll: '(scroll)',
    onDragStart: '(dragstart)',
    onDragEnd: '(dragend)',
    onDragOver: '(dragover)',
    onDrop: '(drop)',
  };

  if (eventMap[eventName]) {
    return eventMap[eventName];
  }

  // General: onClick → (click)
  if (eventName.startsWith('on')) {
    const evt = eventName.slice(2);
    const kebab = evt.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    return `(${kebab})`;
  }

  return `(${eventName})`;
}

/**
 * React 属性名转换为 Angular 属性名
 * className → class, htmlFor → for
 */
export function toAngularProp(propName: string): string {
  // Handle Vue :attr syntax
  if (propName.startsWith(':')) {
    return `[${propName.slice(1)}]`;
  }

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
 * 判断一个计算属性表达式是否需要用花括号包裹
 */
export function isBlockExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (/\breturn\b/.test(trimmed)) return true;
  if (/\b(?:const|let|var)\s+/.test(trimmed)) return true;
  return false;
}

/**
 * 在表达式中为 ref 变量去除 .value 访问
 * Vue ref → Angular signal (不需要 .value)
 */
export function stripValueAccessForRefs(expression: string, refNames: Set<string>): string {
  let result = expression;
  for (const refName of refNames) {
    const escaped = escapeRegex(refName);
    const pattern = new RegExp(`(?<![a-zA-Z0-9_])${escaped}\\.value(?![a-zA-Z0-9_])`, 'g');
    result = result.replace(pattern, `${refName}()`);
  }
  return result;
}

/**
 * 在表达式中为 React state 变量添加 signal() 调用
 * React state → Angular signal: count → count()
 * But for assignment, we keep the setter: setCount(val) → count.set(val)
 */
export function convertStateAccessInExpression(expression: string, stateNames: Set<string>, setterMap: Map<string, string>): string {
  let result = expression;

  // First, convert setter calls: setCount(val) → count.set(val)
  for (const [setterName, stateName] of setterMap) {
    const escapedSetter = escapeRegex(setterName);
    // Arrow function pattern: setterName((param) => body)
    result = result.replace(
      new RegExp(`${escapedSetter}\\s*\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>\\s*([^)]+?)\\s*\\)`, 'g'),
      (_match, param: string, body: string) => {
        // Simple patterns: c => c + 1 → c => c + 1 (as update callback)
        const trimmedBody = body.trim();
        if (trimmedBody === `${param} + 1`) return `${stateName}.update(c => c + 1)`;
        if (trimmedBody === `${param} - 1`) return `${stateName}.update(c => c - 1)`;
        // General: replace param with c and use update
        const replaced = trimmedBody.replace(new RegExp(`\\b${escapeRegex(param)}\\b`, 'g'), 'c');
        return `${stateName}.update(c => ${replaced})`;
      }
    );

    // Direct value pattern: setterName(value) → stateName.set(value)
    result = result.replace(
      new RegExp(`${escapedSetter}\\s*\\(\\s*([^)=>]+?)\\s*\\)`, 'g'),
      (_match, arg: string) => `${stateName}.set(${arg.trim()})`
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
