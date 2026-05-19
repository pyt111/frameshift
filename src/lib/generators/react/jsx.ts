/**
 * React 代码生成器 - JSX 生成
 */

import type {
  UISemanticTree,
  SemanticNodeId,
  ComponentNode,
  TextNode,
  ConditionalRenderNode,
  ListRenderNode,
  ComponentProp,
  VModelInfo,
  TranslationWarning,
} from '../../semantic-tree/types';
import { generateWarning } from '../../translator/confidence';
import {
  indent,
  vueEventToReact,
  vuePropToReact,
  generateVModelOnChange,
  getPropValueString,
  isDynamicValue,
} from './utils';

/**
 * 递归生成节点的 JSX 代码
 */
export function generateNodeJsx(
  nodeId: SemanticNodeId,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  const node = tree.nodes[nodeId];
  if (!node) return '';

  switch (node.nodeType) {
    case 'text':
      return generateTextJsx(node as TextNode);
    case 'component':
      return generateComponentJsx(node as ComponentNode, tree, warnings, indentLevel);
    case 'conditional-render':
      return generateConditionalJsx(node as ConditionalRenderNode, tree, warnings, indentLevel);
    case 'list-render':
      return generateListJsx(node as ListRenderNode, tree, warnings, indentLevel);
    default:
      return `{/* 未支持的节点类型: ${node.nodeType} */}`;
  }
}

/**
 * 生成文本节点的 JSX
 */
export function generateTextJsx(node: TextNode): string {
  // 将 Vue 的 {{ expression }} 转换为 JSX 的 { expression }
  let content = node.content;
  content = content.replace(/\{\{(.+?)\}\}/g, '{$1}');
  return content;
}

/**
 * 生成组件节点的 JSX
 */
export function generateComponentJsx(
  node: ComponentNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  // Fragment 节点特殊处理
  if (node.tagName === 'Fragment') {
    const children = node.children
      .map(id => generateNodeJsx(id, tree, warnings, indentLevel))
      .filter(Boolean);
    return `<>${children.join('\n')}</>`;
  }

  // 生成属性字符串
  const attrs: string[] = [];
  for (const prop of node.props) {
    const attrStr = generatePropJsx(prop, warnings, node.vModelInfo);
    if (attrStr) attrs.push(attrStr);
  }

  // 生成子节点内容
  const children = node.children
    .map(id => generateNodeJsx(id, tree, warnings, indentLevel + 1))
    .filter(Boolean);

  // 将 class 转换为 className
  let tag = node.tagName;
  
  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // 自闭合标签
  const selfClosingTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  if (selfClosingTags.has(tag.toLowerCase()) && children.length === 0) {
    return `<${tag}${attrStr} />`;
  }

  // 没有子节点
  if (children.length === 0) {
    return `<${tag}${attrStr}></${tag}>`;
  }

  // 单行文本子节点
  if (children.length === 1 && tree.nodes[node.children[0]]?.nodeType === 'text') {
    return `<${tag}${attrStr}>${children[0]}</${tag}>`;
  }

  // 多行子节点：每个子元素缩进1级，闭合标签与开标签同层
  const indentedChildren = children
    .map(child => indent(1, child))
    .join('\n');
  return `<${tag}${attrStr}>\n${indentedChildren}\n</${tag}>`;
}

/**
 * 生成属性 JSX 字符串
 */
export function generatePropJsx(prop: ComponentProp, warnings: TranslationWarning[], vModelInfo?: VModelInfo): string {
  const name = prop.name;

  // 处理 Vue 指令属性
  // v-model → value + onChange（使用 VModelInfo 生成精确的 onChange）
  if (name === 'v-model') {
    const expr = getPropValueString(prop.value);

    if (vModelInfo) {
      // 使用 VModelInfo 生成精确的 value + onChange 对
      const onChangeAttr = generateVModelOnChange(vModelInfo);
      return `value={${expr}} ${onChangeAttr}`;
    }

    // 回退：没有 VModelInfo 时使用简单转换
    const setterName = `set${expr.charAt(0).toUpperCase() + expr.slice(1)}`;
    warnings.push(generateWarning(
      `Vue v-model → React 受控组件，需要 value + onChange 配对`,
      0.8,
      'mapping-uncertain',
      `v-model="${expr}"`,
      `value={${expr}} onChange={(e) => ${setterName}(e.target.value)}`,
    ));
    return `value={${expr}} onChange={(e) => ${setterName}(e.target.value)}`;
  }

  // v-show → style.display
  if (name === 'v-show') {
    const expr = getPropValueString(prop.value);
    return `style={{ display: ${expr} ? 'block' : 'none' }}`;
  }

  // v-html → dangerouslySetInnerHTML
  if (name === 'v-html') {
    const expr = getPropValueString(prop.value);
    return `dangerouslySetInnerHTML={{ __html: ${expr} }}`;
  }

  // v-text → 直接表达式
  if (name === 'v-text') {
    // v-text 通常不需要额外属性，直接作为子节点
    return '';
  }

  // @event → onEvent
  if (name.startsWith('@')) {
    const reactEvent = vueEventToReact(name);
    if (isDynamicValue(prop.value)) {
      let expr = getPropValueString(prop.value);
      // Vue 模板中的事件表达式在 React 中需要包装为箭头函数（除非已经是函数引用）
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
        // 简单标识符——可能是函数引用，直接传递
        return `${reactEvent}={${expr}}`;
      }
      // 复杂表达式——包装为箭头函数
      return `${reactEvent}={() => ${expr}}`;
    }
    return `${reactEvent}={() => ${prop.value}}`;
  }

  // :attr → attr={}
  if (name.startsWith(':')) {
    const reactName = vuePropToReact(name.slice(1));
    const expr = getPropValueString(prop.value);
    return `${reactName}={${expr}}`;
  }

  // class → className
  if (name === 'class') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `className={${expr}}`;
    }
    return `className="${prop.value}"`;
  }

  // style (Vue :style) → style={}
  if (name === 'style') {
    if (isDynamicValue(prop.value)) {
      const expr = getPropValueString(prop.value);
      return `style={${expr}}`;
    }
    return `style={${prop.value}}`;
  }

  // key → key
  if (name === 'key') {
    if (isDynamicValue(prop.value)) {
      return `key={${getPropValueString(prop.value)}}`;
    }
    return `key="${prop.value}"`;
  }

  // 其他属性名映射
  const reactName = vuePropToReact(name);
  if (reactName !== name) {
    if (isDynamicValue(prop.value)) {
      return `${reactName}={${getPropValueString(prop.value)}}`;
    }
    return `${reactName}="${prop.value}"`;
  }

  // 动态绑定
  if (isDynamicValue(prop.value)) {
    return `${name}={${getPropValueString(prop.value)}}`;
  }

  // 布尔属性
  if (prop.value === 'true') {
    return name;
  }

  // 静态属性
  return `${name}="${prop.value}"`;
}

/**
 * 生成条件渲染 JSX
 */
export function generateConditionalJsx(
  node: ConditionalRenderNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  const trueContent = generateNodeJsx(node.trueBranch, tree, warnings, indentLevel);
  const falseContent = node.falseBranch
    ? generateNodeJsx(node.falseBranch, tree, warnings, indentLevel)
    : null;

  // v-if → && 或 三元表达式
  if (node.conditionalKind === 'if' || node.conditionalKind === 'logical-and') {
    if (falseContent) {
      return `{${node.condition} ? (${trueContent}) : (${falseContent})}`;
    }
    return `{${node.condition} && (${trueContent})}`;
  }

  if (node.conditionalKind === 'ternary') {
    if (falseContent) {
      return `{${node.condition} ? (${trueContent}) : (${falseContent})}`;
    }
    return `{${node.condition} && (${trueContent})}`;
  }

  return `{${node.condition} && (${trueContent})}`;
}

/**
 * 生成列表渲染 JSX
 */
export function generateListJsx(
  node: ListRenderNode,
  tree: UISemanticTree,
  warnings: TranslationWarning[],
  indentLevel: number
): string {
  const bodyContent = generateNodeJsx(node.body, tree, warnings, indentLevel + 1);

  // v-for → .map()
  const itemArg = node.indexName
    ? `(${node.itemName}, ${node.indexName})`
    : node.itemName;

  const keyExpr = node.keyExpression || node.indexName || 'index';

  if (!node.keyExpression) {
    warnings.push(generateWarning(
      '缺少 key 属性，建议使用唯一标识作为 key',
      0.7,
      'mapping-uncertain',
      `v-for="${itemArg} in ${node.iterableExpression}"`,
      `.map((${itemArg}) => <... key={${keyExpr}}>)`,
    ));
  }

  return `{${node.iterableExpression}.map((${itemArg}) => (
${indent(indentLevel + 1, `<Fragment key={${keyExpr}}>`)}
${indent(indentLevel + 2, bodyContent)}
${indent(indentLevel + 1, '</Fragment>')}
${indent(indentLevel, ')})')}`;
}
