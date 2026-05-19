/**
 * Angular 代码生成器 — 模板生成
 */

import type {
  UISemanticTree,
  SemanticNodeId,
  RootComponentNode,
  ComponentNode,
  TextNode,
  ConditionalRenderNode,
  ListRenderNode,
  ComponentProp,
  VModelInfo,
  TranslationWarning,
} from '../../semantic-tree/types';

import {
  indent,
  escapeRegex,
  toAngularEvent,
  toAngularProp,
  getPropValueString,
  isDynamicValue,
} from './utils';

/**
 * 递归生成节点的 Angular 模板代码
 */
export function generateNodeTemplate(
  nodeId: SemanticNodeId,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number,
  refNames: Set<string>,
  setterMap: Map<string, string>,
): string {
  const node = tree.nodes[nodeId];
  if (!node) return '';

  switch (node.nodeType) {
    case 'text':
      return generateTextTemplate(node as TextNode, refNames);
    case 'component':
      return generateComponentTemplate(node as ComponentNode, tree, warnings, indentLevel, refNames, setterMap);
    case 'conditional-render':
      return generateConditionalTemplate(node as ConditionalRenderNode, tree, warnings, indentLevel, refNames, setterMap);
    case 'list-render':
      return generateListTemplate(node as ListRenderNode, tree, warnings, indentLevel, refNames, setterMap);
    default:
      return `<!-- Unsupported node type: ${node.nodeType} -->`;
  }
}

/**
 * 生成文本节点的 Angular 模板
 */
export function generateTextTemplate(node: TextNode, refNames: Set<string>): string {
  let content = node.content;
  // Convert {{ expression }} interpolation
  // In Angular, interpolation is also {{ expression }}, same as Vue
  // But signal values need () to read: {{ count() }} instead of {{ count }}
  if (content.includes('{{')) {
    for (const refName of refNames) {
      const escaped = escapeRegex(refName);
      // Match refName inside {{ }} that isn't already refName()
      const pattern = new RegExp(`(\\{\\{[^}]*?)\\b${escaped}\\b(?![^(]*\\))(.*?\\}\\})`, 'g');
      content = content.replace(pattern, `$1${refName}()$2`);
    }
  }
  return content;
}

/**
 * 生成组件节点的 Angular 模板
 */
export function generateComponentTemplate(
  node: ComponentNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number,
  refNames: Set<string>,
  setterMap: Map<string, string>,
): string {
  // Fragment 节点特殊处理
  if (node.tagName === 'Fragment') {
    const children = node.children
      .map(id => generateNodeTemplate(id, tree, warnings, indentLevel, refNames, setterMap))
      .filter(Boolean);
    return children.join('\n');
  }

  // Generate attributes
  const attrs: string[] = [];
  for (const prop of node.props) {
    const attrStr = generatePropTemplate(prop, warnings, node.vModelInfo, refNames, setterMap);
    if (attrStr) attrs.push(attrStr);
  }

  // Generate children
  const children = node.children
    .map(id => generateNodeTemplate(id, tree, warnings, indentLevel + 1, refNames, setterMap))
    .filter(Boolean);

  let tag = node.tagName;
  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Self-closing tags
  const selfClosingTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  if (selfClosingTags.has(tag.toLowerCase()) && children.length === 0) {
    return `<${tag}${attrStr} />`;
  }

  // No children
  if (children.length === 0) {
    return `<${tag}${attrStr}></${tag}>`;
  }

  // Single-line text child
  if (children.length === 1 && tree.nodes[node.children[0]]?.nodeType === 'text') {
    return `<${tag}${attrStr}>${children[0]}</${tag}>`;
  }

  // Multi-line children
  const indentedChildren = children
    .map(child => indent(1, child))
    .join('\n');
  return `<${tag}${attrStr}>\n${indentedChildren}\n</${tag}>`;
}

/**
 * 生成属性模板字符串
 */
export function generatePropTemplate(
  prop: ComponentProp,
  warnings: TranslationWarning[],
  vModelInfo?: VModelInfo,
  refNames?: Set<string>,
  setterMap?: Map<string, string>,
): string {
  const name = prop.name;

  // v-model → [(ngModel)] or signal binding
  if (name === 'v-model') {
    const expr = getPropValueString(prop.value);
    if (vModelInfo) {
      // Use [(ngModel)] for two-way binding with ngModel
      return `[(ngModel)]="${expr}"`;
    }
    // Fallback
    return `[(ngModel)]="${expr}"`;
  }

  // v-show → [style.display]
  if (name === 'v-show') {
    const expr = getPropValueString(prop.value);
    return `[style.display]="${expr} ? 'block' : 'none'"`;
  }

  // v-html → [innerHTML]
  if (name === 'v-html') {
    const expr = getPropValueString(prop.value);
    return `[innerHTML]="${expr}"`;
  }

  // v-text → interpolation (skip as attribute)
  if (name === 'v-text') {
    return '';
  }

  // @event → (event)
  if (name.startsWith('@')) {
    const angularEvent = toAngularEvent(name);
    if (isDynamicValue(prop.value)) {
      let expr = getPropValueString(prop.value);
      // Simple identifier → method call
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
        return `${angularEvent}="${expr}()"`;
      }
      return `${angularEvent}="${expr}"`;
    }
    return `${angularEvent}="${prop.value}"`;
  }

  // :attr → [attr]
  if (name.startsWith(':')) {
    const angularName = toAngularProp(name.slice(1));
    const expr = getPropValueString(prop.value);
    return `[${angularName}]="${expr}"`;
  }

  // className → class
  if (name === 'className') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `[class]="${expr}"`;
    }
    return `class="${prop.value}"`;
  }

  // class
  if (name === 'class') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `[class]="${expr}"`;
    }
    return `class="${prop.value}"`;
  }

  // style → [style]
  if (name === 'style') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `[style]="${expr}"`;
    }
    return `style="${prop.value}"`;
  }

  // React event handlers → Angular events
  if (name.startsWith('on')) {
    const angularEvent = toAngularEvent(name);
    if (isDynamicValue(prop.value)) {
      let expr = getPropValueString(prop.value);
      // Arrow function in event handler
      if (prop.value && typeof prop.value !== 'string' && prop.value.type === 'arrow-function') {
        const bodyMatch = expr.match(/^\(.*?\)\s*=>\s*(.+)$/);
        if (bodyMatch) {
          // Convert setter calls in the expression
          if (setterMap && setterMap.size > 0) {
            let body = bodyMatch[1];
            for (const [setterName, stateName] of setterMap) {
              const escapedSetter = escapeRegex(setterName);
              // setter(val) → stateName.set(val)
              body = body.replace(
                new RegExp(`${escapedSetter}\\(([^)]+)\\)`, 'g'),
                `${stateName}.set($1)`
              );
              // setter(c => c + 1) → stateName.update(c => c + 1)
              body = body.replace(
                new RegExp(`${escapedSetter}\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>\\s*(.+?)\\s*\\)`, 'g'),
                (_m, param: string, b: string) => `${stateName}.update(${param} => ${b})`
              );
            }
            return `${angularEvent}="${body}"`;
          }
          return `${angularEvent}="${bodyMatch[1]}"`;
        }
      }
      // Simple identifier → method call
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
        return `${angularEvent}="${expr}()"`;
      }
      return `${angularEvent}="${expr}"`;
    }
    return `${angularEvent}="${prop.value}"`;
  }

  // key → not needed in Angular @for (uses track)
  if (name === 'key') {
    return '';
  }

  // Other prop name mappings
  const angularName = toAngularProp(name);
  if (angularName !== name) {
    if (isDynamicValue(prop.value)) {
      return `[${angularName}]="${getPropValueString(prop.value)}"`;
    }
    return `${angularName}="${prop.value}"`;
  }

  // Dynamic binding
  if (isDynamicValue(prop.value)) {
    return `[${name}]="${getPropValueString(prop.value)}"`;
  }

  // Boolean attributes
  if (prop.value === 'true') {
    return name;
  }

  // Static attributes
  return `${name}="${prop.value}"`;
}

/**
 * 生成条件渲染 Angular 17+ @if 模板
 */
export function generateConditionalTemplate(
  node: ConditionalRenderNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number,
  refNames: Set<string>,
  setterMap: Map<string, string>,
): string {
  const trueContent = generateNodeTemplate(node.trueBranch, tree, warnings, indentLevel + 1, refNames, setterMap);
  const falseContent = node.falseBranch
    ? generateNodeTemplate(node.falseBranch, tree, warnings, indentLevel + 1, refNames, setterMap)
    : null;

  // Angular 17+ @if control flow
  let condition = node.condition;
  // Convert state access for Angular signals
  for (const refName of refNames) {
    const escaped = escapeRegex(refName);
    // Replace bare refName with refName() in condition
    const pattern = new RegExp(`(?<![a-zA-Z0-9_])${escaped}(?!\\(|\\.set\\(|\\.update\\(|[a-zA-Z0-9_])`, 'g');
    condition = condition.replace(pattern, `${refName}()`);
  }

  let result = `@if (${condition}) {\n${indent(1, trueContent)}\n}`;
  if (falseContent) {
    result += ` @else {\n${indent(1, falseContent)}\n}`;
  }
  return result;
}

/**
 * 生成列表渲染 Angular 17+ @for 模板
 */
export function generateListTemplate(
  node: ListRenderNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number,
  refNames: Set<string>,
  setterMap: Map<string, string>,
): string {
  const bodyContent = generateNodeTemplate(node.body, tree, warnings, indentLevel + 1, refNames, setterMap);

  // Angular 17+ @for control flow
  let iterable = node.iterableExpression;
  // Convert signal access: items → items()
  for (const refName of refNames) {
    const escaped = escapeRegex(refName);
    const pattern = new RegExp(`(?<![a-zA-Z0-9_])${escaped}(?!\\(|\\.set\\(|\\.update\\(|[a-zA-Z0-9_])`, 'g');
    iterable = iterable.replace(pattern, `${refName}()`);
  }

  const trackExpr = node.keyExpression || '$index';
  const forExpr = node.indexName
    ? `${node.itemName}; track ${trackExpr}; let ${node.indexName} = $index`
    : `${node.itemName}; track ${trackExpr}`;

  return `@for (${forExpr} of ${iterable}) {\n${indent(1, bodyContent)}\n}`;
}

/**
 * 从语义树生成 Angular 模板内容
 */
export function generateTemplateContent(tree: UISemanticTree, warnings: TranslationWarning[]): string {
  const rootNode = tree.nodes[tree.rootId] as RootComponentNode;
  const bodyNode = tree.nodes[rootNode.body];

  if (!bodyNode) {
    return '<div><!-- Parse error: missing component body --></div>';
  }

  // Collect ref/state names for signal access conversion
  const refNames = new Set<string>();
  const setterMap = new Map<string, string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.nodeType === 'reactive-state') {
      const stateNode = node as import('../../semantic-tree/types').ReactiveStateNode;
      refNames.add(stateNode.name);
      if (stateNode.setterName) {
        setterMap.set(stateNode.setterName, stateNode.name);
      }
    }
  }

  return generateNodeTemplate(rootNode.body, tree, warnings, 0, refNames, setterMap);
}
