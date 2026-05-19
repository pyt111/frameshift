/**
 * Angular 代码生成器 — 样式与后处理
 */

import type {
  UISemanticTree,
  ReactiveStateNode,
} from '../../semantic-tree/types';
import { escapeRegex } from './utils';

/**
 * 从语义树生成 Angular <style> 代码
 */
export function generateStyleBlock(tree: UISemanticTree): string {
  const styleNodes = Object.values(tree.nodes).filter(
    (node): node is import('../../semantic-tree/types').StyleNode => node.nodeType === 'style'
  );

  if (styleNodes.length === 0) return '';

  return styleNodes
    .map(node => {
      let content = node.content;
      content = convertCssToKebabCase(content);
      return content;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * 将 camelCase CSS 属性转换为 kebab-case
 */
export function convertCssToKebabCase(cssContent: string): string {
  return cssContent.replace(
    /([a-z])([A-Z])/g,
    (_, lower, upper) => `${lower}-${upper.toLowerCase()}`
  );
}

/**
 * 后处理：将 React setter 调用和 Vue ref 赋值转换为 Angular signal 操作
 */
export function postProcessCode(tree: UISemanticTree, code: string): string {
  // Collect state names and setter names
  const setterMap = new Map<string, string>(); // setterName → stateName
  const refNames = new Set<string>();

  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      const stateNode = node as ReactiveStateNode;
      refNames.add(stateNode.name);
      if (stateNode.setterName) {
        setterMap.set(stateNode.setterName, stateNode.name);
      }
    }
  }

  let result = code;

  // Handle Vue ref mutations: count.value++ → count.update(c => c + 1)
  for (const refName of refNames) {
    const escaped = escapeRegex(refName);
    // count.value++ → count.update(c => c + 1)
    result = result.replace(
      new RegExp(`${escaped}\\.value\\+\\+`, 'g'),
      `${refName}.update(c => c + 1)`
    );
    // count.value-- → count.update(c => c - 1)
    result = result.replace(
      new RegExp(`${escaped}\\.value--`, 'g'),
      `${refName}.update(c => c - 1)`
    );
    // count++ → count.update(c => c + 1)
    result = result.replace(
      new RegExp(`(?<![a-zA-Z0-9_.])${escaped}\\+\\+(?![a-zA-Z0-9_])`, 'g'),
      `${refName}.update(c => c + 1)`
    );
    // count-- → count.update(c => c - 1)
    result = result.replace(
      new RegExp(`(?<![a-zA-Z0-9_.])${escaped}--(?![a-zA-Z0-9_])`, 'g'),
      `${refName}.update(c => c - 1)`
    );
  }

  // Handle React setter calls: setCount(val) → count.set(val)
  for (const [setterName, stateName] of setterMap) {
    const escapedSetter = escapeRegex(setterName);

    // Arrow function: setCount(c => c + 1) → count.update(c => c + 1)
    result = result.replace(
      new RegExp(`${escapedSetter}\\s*\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>\\s*([^)]+?)\\s*\\)`, 'g'),
      (_match, param: string, body: string) => {
        const trimmedBody = body.trim();
        if (trimmedBody === `${param} + 1`) return `${stateName}.update(c => c + 1)`;
        if (trimmedBody === `${param} - 1`) return `${stateName}.update(c => c - 1)`;
        const replaced = trimmedBody.replace(new RegExp(`\\b${escapeRegex(param)}\\b`, 'g'), 'c');
        return `${stateName}.update(c => ${replaced})`;
      }
    );

    // Direct value: setCount(val) → count.set(val)
    result = result.replace(
      new RegExp(`${escapedSetter}\\s*\\(\\s*([^)=>]+?)\\s*\\)`, 'g'),
      (_match, arg: string) => `${stateName}.set(${arg.trim()})`
    );
  }

  return result;
}
